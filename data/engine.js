/* ============================================================
   tillclose — core reconciliation engine (pure functions).
   ALL money is INTEGER minor units (paise / cents / pence / sentimo).
   Never a float rupee. Formatting for display happens elsewhere.

   Imported identically by the browser app (global TILL) and the
   Node self-tests (module.exports). No DOM, no localStorage, no
   network — just arithmetic that the tests re-derive.
   ============================================================ */

var _denoms = (typeof require !== "undefined")
  ? require("./denominations.js")
  : { CORPUS: (typeof CORPUS !== "undefined" ? CORPUS : []),
      CURRENCIES: (typeof CURRENCIES !== "undefined" ? CURRENCIES : []) };

var _CORPUS = _denoms.CORPUS;
var _CURRENCIES = _denoms.CURRENCIES;

/* ---- corpus access -------------------------------------------------- */

/* All denominations for a currency, notes first then coins, each
   strictly descending by value (the corpus is authored that way). */
function denomsFor(code) {
  return _CORPUS.filter(function (d) { return d.code === code; })
    .slice()
    .sort(function (a, b) {
      if (a.kind !== b.kind) { return a.kind === "note" ? -1 : 1; }
      return b.value - a.value;
    });
}

function currencyMeta(code) {
  for (var i = 0; i < _CURRENCIES.length; i++) {
    if (_CURRENCIES[i].code === code) { return _CURRENCIES[i]; }
  }
  return null;
}

/* Build a lookup key for a denomination inside a counts object.
   Notes key on the value directly ("500"); coins are prefixed
   ("coin5") so a note and a coin of the same face value never clash. */
function denomKey(d) {
  return d.kind === "coin" ? ("coin" + d.value) : String(d.value);
}

/* ---- the count ------------------------------------------------------ */

/* countTotal(code, counts) -> integer minor units.
   `counts` maps denomKey -> quantity. Missing / blank / non-finite
   quantities are treated as 0. Result is Σ qty × value, an integer ≥ 0. */
function countTotal(code, counts) {
  var ds = denomsFor(code);
  var total = 0;
  for (var i = 0; i < ds.length; i++) {
    var d = ds[i];
    var q = counts ? counts[denomKey(d)] : 0;
    q = Math.trunc(Number(q) || 0);
    if (q < 0) { q = 0; }
    total += q * d.value;
  }
  return total;
}

/* Per-denomination subtotals, in corpus order (notes then coins). */
function countBreakdown(code, counts) {
  var ds = denomsFor(code);
  return ds.map(function (d) {
    var q = counts ? counts[denomKey(d)] : 0;
    q = Math.trunc(Number(q) || 0);
    if (q < 0) { q = 0; }
    return { key: denomKey(d), label: d.label, kind: d.kind,
             value: d.value, qty: q, subtotal: q * d.value, rare: !!d.rare };
  });
}

/* ---- expected cash -------------------------------------------------- */

/* expectedCash({ float, sales, payouts:[amount,...], adjustments:[amount,...] })
   All inputs are integer minor units. Expected = float + sales − Σ payouts
   + Σ adjustments (adjustments may be positive or negative). */
function expectedCash(input) {
  input = input || {};
  var floatAmt = Math.trunc(Number(input.float) || 0);
  var sales = Math.trunc(Number(input.sales) || 0);
  var payouts = Array.isArray(input.payouts) ? input.payouts : [];
  var adjustments = Array.isArray(input.adjustments) ? input.adjustments : [];
  var sumPay = payouts.reduce(function (s, p) { return s + Math.trunc(Number(p) || 0); }, 0);
  var sumAdj = adjustments.reduce(function (s, a) { return s + Math.trunc(Number(a) || 0); }, 0);
  return floatAmt + sales - sumPay + sumAdj;
}

/* ---- variance ------------------------------------------------------- */

/* variance(counted, expected) -> { diff, status } in minor units.
   diff = counted − expected. status is a WORD, never color-only:
   'short' (diff<0), 'over' (diff>0), 'tallied' (diff===0). */
function variance(counted, expected) {
  var diff = Math.trunc(Number(counted) || 0) - Math.trunc(Number(expected) || 0);
  var status = diff < 0 ? "short" : (diff > 0 ? "over" : "tallied");
  return { diff: diff, status: status };
}

/* ---- history summary ------------------------------------------------ */

/* summarize(variances[]) -> counts of short/over/tallied, net & worst.
   `variances` is an array of diffs (integer minor units, signed). */
function summarize(variances) {
  variances = Array.isArray(variances) ? variances : [];
  var short = 0, over = 0, tallied = 0, net = 0;
  var worstDay = 0; // most negative diff seen (0 if none are short)
  for (var i = 0; i < variances.length; i++) {
    var v = Math.trunc(Number(variances[i]) || 0);
    net += v;
    if (v < 0) { short++; if (v < worstDay) { worstDay = v; } }
    else if (v > 0) { over++; }
    else { tallied++; }
  }
  var count = variances.length;
  var avg = count ? net / count : 0;
  return { count: count, short: short, over: over, tallied: tallied,
           net: net, avg: avg, worstDay: worstDay };
}

/* ---- money formatting ----------------------------------------------- */

/* Group an integer major-unit string per convention.
   'indian' -> last 3 then pairs (12,34,567); 'western' -> threes (1,234,567). */
function groupDigits(intStr, grouping) {
  var neg = intStr.charAt(0) === "-";
  if (neg) { intStr = intStr.slice(1); }
  var out;
  if (grouping === "indian") {
    if (intStr.length <= 3) { out = intStr; }
    else {
      var last3 = intStr.slice(-3);
      var rest = intStr.slice(0, -3);
      var parts = [];
      while (rest.length > 2) { parts.unshift(rest.slice(-2)); rest = rest.slice(0, -2); }
      if (rest.length) { parts.unshift(rest); }
      out = parts.join(",") + "," + last3;
    }
  } else {
    out = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  return neg ? "-" + out : out;
}

/* formatMoney(minor, code) -> symbol + grouped major.minor string.
   minor is an integer in minor units; sign is preserved. */
function formatMoney(minor, code) {
  var meta = currencyMeta(code) || { symbol: "", minorPerMajor: 100, grouping: "western" };
  minor = Math.trunc(Number(minor) || 0);
  var neg = minor < 0;
  var abs = Math.abs(minor);
  var per = meta.minorPerMajor || 100;
  var major = Math.floor(abs / per);
  var frac = abs % per;
  var fracStr = String(frac);
  while (fracStr.length < String(per - 1).length) { fracStr = "0" + fracStr; }
  var grouped = groupDigits(String(major), meta.grouping);
  return (neg ? "-" : "") + meta.symbol + grouped + "." + fracStr;
}

/* ---- RFC-4180 CSV helpers ------------------------------------------- */

/* Quote a single field only when it must be: contains comma, quote,
   CR or LF. Embedded double-quotes are doubled. */
function csvField(v) {
  var s = (v === null || v === undefined) ? "" : String(v);
  if (/[",\r\n]/.test(s)) { return '"' + s.replace(/"/g, '""') + '"'; }
  return s;
}

/* csvRow(fields[]) -> one RFC-4180 line (fields joined by comma, no EOL). */
function csvRow(fields) {
  return fields.map(csvField).join(",");
}

/* Minimal RFC-4180 parser: text -> array of row arrays. Handles quoted
   fields with embedded commas, doubled quotes, and CR/LF inside quotes.
   Used by the round-trip self-test and never by the shipped UI. */
function csvParse(text) {
  var rows = [], row = [], field = "", i = 0, inQ = false;
  text = String(text);
  while (i < text.length) {
    var c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  // flush trailing field/row if the text did not end with a newline
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

var TILL = {
  denomsFor: denomsFor,
  currencyMeta: currencyMeta,
  denomKey: denomKey,
  countTotal: countTotal,
  countBreakdown: countBreakdown,
  expectedCash: expectedCash,
  variance: variance,
  summarize: summarize,
  groupDigits: groupDigits,
  formatMoney: formatMoney,
  csvField: csvField,
  csvRow: csvRow,
  csvParse: csvParse
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = TILL;
}
