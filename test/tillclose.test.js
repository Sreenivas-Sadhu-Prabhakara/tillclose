"use strict";
/* ============================================================
   tillclose self-tests — re-derive the core arithmetic and
   assert the brief's fixtures to the paise/cent, plus corpus
   invariants and a seeded property test.
   Run with:  node --test
   ============================================================ */

const test = require("node:test");
const assert = require("node:assert/strict");

const TILL = require("../data/engine.js");
const { CORPUS, CURRENCIES } = require("../data/denominations.js");

const CODES = ["INR", "USD", "EUR", "GBP", "PHP"];
const EXPECTED_COUNTS = { INR: 11, USD: 11, EUR: 15, GBP: 12, PHP: 11 };

/* ---- deterministic PRNG for the property test (cyrb53 -> mulberry32) ---- */
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- countTotal fixtures (brief) ---- */

test("countTotal INR hand-derived fixture === 216900 paise", () => {
  // 3×₹500 note +1×₹200 +4×₹100 +2×₹20 +1×₹10 notes, +3×₹5 +1×₹2 +2×₹1 coins
  const counts = {
    "50000": 3, "20000": 1, "10000": 4, "2000": 2, "1000": 1,
    coin500: 3, coin200: 1, coin100: 2
  };
  assert.equal(TILL.countTotal("INR", counts), 216900);
});

test("countTotal USD fixture === 4079 cents (no float drift)", () => {
  // 2×$20 notes + 3×25¢ + 4×1¢
  const counts = { "2000": 2, coin25: 3, coin1: 4 };
  assert.equal(TILL.countTotal("USD", counts), 4079);
  assert.equal(Number.isInteger(TILL.countTotal("USD", counts)), true);
});

test("countTotal ignores blanks, negatives and unknown keys as 0", () => {
  const counts = { "50000": "", "20000": -5, bogus: 99, "10000": 2 };
  assert.equal(TILL.countTotal("INR", counts), 20000); // only 2×₹100
});

test("countBreakdown subtotals sum to countTotal exactly", () => {
  const counts = { "50000": 3, "20000": 1, "10000": 4, "2000": 2, "1000": 1,
                   coin500: 3, coin200: 1, coin100: 2 };
  const bd = TILL.countBreakdown("INR", counts);
  const sum = bd.reduce((s, r) => s + r.subtotal, 0);
  assert.equal(sum, TILL.countTotal("INR", counts));
  assert.equal(sum, 216900);
});

/* ---- expectedCash fixture (brief) ---- */

test("expectedCash float+sales-payouts === 1645000 paise", () => {
  // ₹5,000 float + ₹12,750 sales − ₹1,300 payout = ₹16,450
  const got = TILL.expectedCash({ float: 500000, sales: 1275000, payouts: [130000] });
  assert.equal(got, 1645000);
});

test("expectedCash sums multiple payouts and signed adjustments", () => {
  const got = TILL.expectedCash({
    float: 500000, sales: 1275000,
    payouts: [130000, 20000],          // ₹1,300 + ₹200
    adjustments: [-50000, 10000]        // −₹500 (withdrawn note) +₹100
  });
  assert.equal(got, 500000 + 1275000 - 150000 + (-40000));
});

/* ---- variance fixtures (brief) ---- */

test("variance short/over/tallied statuses", () => {
  assert.deepEqual(TILL.variance(216900, 220000), { diff: -3100, status: "short" });
  assert.deepEqual(TILL.variance(220000, 216900), { diff: 3100, status: "over" });
  assert.deepEqual(TILL.variance(220000, 220000), { diff: 0, status: "tallied" });
});

/* ---- history summary fixture (brief) ---- */

test("summarize([-3100,0,+500,-200]) matches brief", () => {
  const s = TILL.summarize([-3100, 0, 500, -200]);
  assert.equal(s.short, 2);
  assert.equal(s.over, 1);
  assert.equal(s.tallied, 1);
  assert.equal(s.net, -2800);
  assert.equal(s.worstDay, -3100);
});

test("summarize of empty history is all zeros", () => {
  const s = TILL.summarize([]);
  assert.deepEqual(
    { count: s.count, short: s.short, over: s.over, tallied: s.tallied, net: s.net, worstDay: s.worstDay },
    { count: 0, short: 0, over: 0, tallied: 0, net: 0, worstDay: 0 }
  );
});

/* ---- formatMoney fixtures (brief) ---- */

test("formatMoney Indian vs western grouping", () => {
  assert.equal(TILL.formatMoney(12345675, "INR"), "₹1,23,456.75");
  assert.equal(TILL.formatMoney(12345675, "USD"), "$123,456.75");
});

test("formatMoney handles small, zero and negative amounts", () => {
  assert.equal(TILL.formatMoney(0, "INR"), "₹0.00");
  assert.equal(TILL.formatMoney(5, "USD"), "$0.05");
  assert.equal(TILL.formatMoney(-3100, "INR"), "-₹31.00");
  assert.equal(TILL.formatMoney(99, "GBP"), "£0.99");
});

/* ---- corpus invariants ---- */

test("corpus has exactly 60 denominations with the documented per-currency counts", () => {
  assert.equal(CORPUS.length, 60);
  let total = 0;
  for (const code of CODES) {
    const n = CORPUS.filter((d) => d.code === code).length;
    assert.equal(n, EXPECTED_COUNTS[code], `${code} count`);
    total += n;
  }
  assert.equal(total, 60);
});

test("every denomination value is a positive integer in minor units", () => {
  for (const d of CORPUS) {
    assert.equal(Number.isInteger(d.value), true, `${d.code} ${d.label} integer`);
    assert.equal(d.value > 0, true, `${d.code} ${d.label} positive`);
    assert.ok(d.kind === "note" || d.kind === "coin", `${d.code} ${d.label} kind`);
    assert.equal(typeof d.rare, "boolean");
    assert.equal(Number.isInteger(d.order), true);
  }
});

test("notes and coins are strictly descending within each currency+kind", () => {
  for (const code of CODES) {
    for (const kind of ["note", "coin"]) {
      const vals = CORPUS.filter((d) => d.code === code && d.kind === kind)
        .sort((a, b) => a.order - b.order)
        .map((d) => d.value);
      for (let i = 1; i < vals.length; i++) {
        assert.equal(vals[i] < vals[i - 1], true, `${code} ${kind} strictly descending at ${i}`);
      }
    }
  }
});

test("no duplicate (currency, kind, value) triples", () => {
  const seen = new Set();
  for (const d of CORPUS) {
    const key = d.code + "|" + d.kind + "|" + d.value;
    assert.equal(seen.has(key), false, `duplicate ${key}`);
    seen.add(key);
  }
});

test("every currency has exactly one meta record with minorPerMajor 100", () => {
  assert.equal(CURRENCIES.length, 5);
  for (const code of CODES) {
    const meta = CURRENCIES.filter((m) => m.code === code);
    assert.equal(meta.length, 1, `${code} meta`);
    assert.equal(meta[0].minorPerMajor, 100);
    assert.ok(meta[0].grouping === "indian" || meta[0].grouping === "western");
    assert.ok(meta[0].source_url && /^https:\/\//.test(meta[0].source_url), `${code} source_url`);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(meta[0].as_of), `${code} as_of ISO`);
  }
});

test("INR grid excludes the withdrawn ₹2000 note", () => {
  const inrNotes = CORPUS.filter((d) => d.code === "INR" && d.kind === "note").map((d) => d.value);
  assert.equal(inrNotes.includes(200000), false); // ₹2000 = 200000 paise
});

test("engine reads denominations FROM the corpus (single source of truth)", () => {
  // denomsFor must surface exactly the corpus rows for a currency, notes first.
  const ds = TILL.denomsFor("EUR");
  assert.equal(ds.length, EXPECTED_COUNTS.EUR);
  assert.equal(ds[0].kind, "note");
  assert.equal(ds[ds.length - 1].kind, "coin");
});

/* ---- property / fuzz test ---- */

test("property: 1000 seeded random count vectors reconcile exactly and stay ≥ 0", () => {
  for (let trial = 0; trial < 1000; trial++) {
    const rnd = mulberry32(cyrb53("tillclose", trial));
    const code = CODES[Math.floor(rnd() * CODES.length)];
    const ds = TILL.denomsFor(code);
    const counts = {};
    let independent = 0;
    for (const d of ds) {
      const q = Math.floor(rnd() * 40); // 0..39 pieces
      counts[TILL.denomKey(d)] = q;
      independent += q * d.value;
    }
    const total = TILL.countTotal(code, counts);
    assert.equal(total, independent, `trial ${trial} ${code} matches independent sum`);
    assert.equal(Number.isInteger(total), true, `trial ${trial} integer`);
    assert.equal(total >= 0, true, `trial ${trial} non-negative`);
    // breakdown subtotals must also reconcile to the same total
    const bd = TILL.countBreakdown(code, counts);
    assert.equal(bd.reduce((s, r) => s + r.subtotal, 0), total, `trial ${trial} breakdown`);
  }
});

test("property: variance is exactly counted − expected over random pairs", () => {
  for (let trial = 0; trial < 500; trial++) {
    const rnd = mulberry32(cyrb53("variance", trial));
    const counted = Math.floor(rnd() * 5000000);
    const expected = Math.floor(rnd() * 5000000);
    const v = TILL.variance(counted, expected);
    assert.equal(v.diff, counted - expected);
    const expStatus = counted < expected ? "short" : (counted > expected ? "over" : "tallied");
    assert.equal(v.status, expStatus);
  }
});

/* ---- CSV round-trip (RFC-4180) ---- */

test("CSV round-trip: comma, double-quote and newline in a note survive intact", () => {
  const header = ["date", "currency", "counted", "expected", "variance", "status", "note"];
  const noteText = 'milk vendor, ₹350; "urgent"\nsigned off';
  const rowFields = ["2026-07-22", "INR", "216900", "220000", "-3100", "short", noteText];
  const csv = TILL.csvRow(header) + "\n" + TILL.csvRow(rowFields) + "\n";
  const parsed = TILL.csvParse(csv);
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0], header);
  assert.deepEqual(parsed[1], rowFields);
  assert.equal(parsed[1][6], noteText); // note reconstructed byte-for-byte
});

test("CSV header row matches the documented closing-column list exactly", () => {
  const header = ["date", "currency", "counted", "expected", "variance", "status", "note"];
  const line = TILL.csvRow(header);
  assert.equal(line, "date,currency,counted,expected,variance,status,note");
});
