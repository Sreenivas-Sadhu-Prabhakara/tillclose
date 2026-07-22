/* ============================================================
   tillclose — client-side till-closing app.
   No network. No dependencies. State in localStorage.
   Core arithmetic lives in data/engine.js (global TILL); this
   file is UI wiring only — every handler is addEventListener,
   never an inline on*= attribute (the CSP forbids inline script).
   ============================================================ */
(function () {
  "use strict";

  var T = window.TILL;                       // pure engine (data/engine.js)
  var CURRENCIES = window.CURRENCIES || [];  // data/denominations.js

  var $ = function (s, r) { return (r || document).querySelector(s); };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  var LS = {
    theme: "tillclose:theme",
    state: "tillclose:state",       // live draft (counts / float / sales / payouts / adjustments)
    history: "tillclose:history"    // array of saved closings
  };

  /* ---------- money parsing (string -> integer minor units) ---------- */
  // Accepts "12,345.75", "12345", "1.5", "-500". Grouping commas ignored.
  function parseMoney(str, code) {
    var meta = T.currencyMeta(code) || { minorPerMajor: 100 };
    var per = meta.minorPerMajor || 100;
    if (str == null) { return 0; }
    str = String(str).trim().replace(/,/g, "");
    if (str === "" || str === "-" || str === ".") { return 0; }
    var neg = str.charAt(0) === "-";
    if (neg) { str = str.slice(1); }
    if (!/^\d*\.?\d*$/.test(str)) { return 0; }
    var parts = str.split(".");
    var major = parseInt(parts[0] || "0", 10) || 0;
    var fracStr = (parts[1] || "").slice(0, String(per).length - 1);
    while (fracStr.length < String(per - 1).length) { fracStr += "0"; }
    var frac = parseInt(fracStr || "0", 10) || 0;
    var total = major * per + frac;
    return neg ? -total : total;
  }

  /* ---------- state ---------- */
  var state = loadState();

  function blankState() {
    return { currency: "INR", counts: {}, floatMinor: 0, salesMinor: 0,
             payouts: [], adjustments: [] };
  }
  function loadState() {
    try {
      var raw = localStorage.getItem(LS.state);
      if (!raw) { return blankState(); }
      var s = JSON.parse(raw);
      var b = blankState();
      return {
        currency: s.currency || b.currency,
        counts: s.counts || {},
        floatMinor: s.floatMinor || 0,
        salesMinor: s.salesMinor || 0,
        payouts: Array.isArray(s.payouts) ? s.payouts : [],
        adjustments: Array.isArray(s.adjustments) ? s.adjustments : []
      };
    } catch (e) { return blankState(); }
  }
  function saveState() {
    try { localStorage.setItem(LS.state, JSON.stringify(state)); } catch (e) {}
  }
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(LS.history)) || []; }
    catch (e) { return []; }
  }
  function saveHistory(h) {
    try { localStorage.setItem(LS.history, JSON.stringify(h)); } catch (e) {}
  }

  /* ---------- theme ---------- */
  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(LS.theme); } catch (e) {}
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
    updateThemeLabel();
  }
  function currentTheme() {
    var attr = document.documentElement.getAttribute("data-theme");
    if (attr) { return attr; }
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function updateThemeLabel() {
    var next = currentTheme() === "dark" ? "Light" : "Dark";
    $("#themeLabel").textContent = next + " mode";
    $("#themeToggle").setAttribute("aria-pressed", currentTheme() === "light" ? "true" : "false");
  }
  function toggleTheme() {
    var next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(LS.theme, next); } catch (e) {}
    updateThemeLabel();
  }

  /* ---------- render: drawer wells ---------- */
  function symbolFor(code) {
    var m = T.currencyMeta(code);
    return m ? m.symbol : "";
  }

  function renderWells() {
    var wells = $("#wells");
    wells.textContent = "";
    var ds = T.denomsFor(state.currency);
    ds.forEach(function (d) {
      var key = T.denomKey(d);
      var well = el("div", "well" + (d.rare ? " well--rare" : ""));
      var head = el("div", "well__head");
      head.appendChild(el("span", "well__face", d.label));
      head.appendChild(el("span", "well__kind", d.kind));
      well.appendChild(head);

      var stepper = el("div", "stepper");
      var minus = el("button", "stepper__btn", "−");
      minus.type = "button";
      minus.setAttribute("aria-label", "One fewer " + d.label + " " + d.kind);
      var qty = el("input", "stepper__qty");
      qty.type = "text"; qty.inputMode = "numeric"; qty.autocomplete = "off";
      qty.setAttribute("aria-label", "Quantity of " + d.label + " " + d.kind);
      qty.value = state.counts[key] ? String(state.counts[key]) : "";
      qty.placeholder = "0";
      var plus = el("button", "stepper__btn", "+");
      plus.type = "button";
      plus.setAttribute("aria-label", "One more " + d.label + " " + d.kind);

      function setQty(v) {
        v = Math.max(0, Math.trunc(v) || 0);
        if (v === 0) { delete state.counts[key]; } else { state.counts[key] = v; }
        qty.value = v ? String(v) : "";
        saveState(); recompute();
      }
      minus.addEventListener("click", function () { setQty((state.counts[key] || 0) - 1); });
      plus.addEventListener("click", function () { setQty((state.counts[key] || 0) + 1); });
      qty.addEventListener("input", function () {
        var digits = qty.value.replace(/[^0-9]/g, "");
        var v = parseInt(digits, 10) || 0;
        if (v === 0) { delete state.counts[key]; } else { state.counts[key] = v; }
        saveState(); recompute();
      });

      stepper.appendChild(minus); stepper.appendChild(qty); stepper.appendChild(plus);
      well.appendChild(stepper);

      var sub = el("div", "well__subtotal");
      sub.id = "sub-" + key;
      well.appendChild(sub);
      wells.appendChild(well);
    });
    updateSubtotals();
  }

  function updateSubtotals() {
    var bd = T.countBreakdown(state.currency, state.counts);
    bd.forEach(function (r) {
      var sub = document.getElementById("sub-" + r.key);
      if (!sub) { return; }
      if (r.qty > 0) {
        sub.textContent = T.formatMoney(r.subtotal, state.currency);
        sub.setAttribute("data-has", "1");
      } else {
        sub.textContent = "";
        sub.setAttribute("data-has", "0");
      }
    });
  }

  /* ---------- render: payout / adjustment line lists ---------- */
  function renderLineList(listId, arr, kind) {
    var host = $(listId);
    host.textContent = "";
    arr.forEach(function (item, idx) {
      var row = el("div", "lineitem");
      var label = el("input");
      label.type = "text"; label.placeholder = kind === "payout" ? "e.g. milk vendor" : "e.g. ₹2000 note (withdrawn)";
      label.value = item.label || ""; label.setAttribute("aria-label", kind + " label");
      label.addEventListener("input", function () { item.label = label.value; saveState(); });

      var amt = el("input", "lineitem__amt");
      amt.type = "text"; amt.inputMode = "decimal";
      amt.placeholder = kind === "payout" ? "0.00" : "-0.00";
      amt.value = item.raw != null ? item.raw : "";
      amt.setAttribute("aria-label", kind + " amount");
      amt.addEventListener("input", function () {
        item.raw = amt.value;
        item.minor = parseMoney(amt.value, state.currency);
        saveState(); recompute();
      });

      var del = el("button", "lineitem__del", "×");
      del.type = "button"; del.setAttribute("aria-label", "Remove this " + kind);
      del.addEventListener("click", function () {
        arr.splice(idx, 1); saveState();
        renderLineList(listId, arr, kind); recompute();
      });

      row.appendChild(label); row.appendChild(amt); row.appendChild(del);
      host.appendChild(row);
    });
  }

  /* ---------- recompute totals + verdict ---------- */
  function recompute() {
    var code = state.currency;
    var counted = T.countTotal(code, state.counts);

    var payoutMinors = state.payouts.map(function (p) { return p.minor || 0; });
    var adjMinors = state.adjustments.map(function (a) { return a.minor || 0; });
    var expected = T.expectedCash({
      float: state.floatMinor, sales: state.salesMinor,
      payouts: payoutMinors, adjustments: []
    });
    // adjustments belong to the physical count, not to expected cash:
    var countedWithAdj = counted + adjMinors.reduce(function (s, v) { return s + v; }, 0);

    $("#countedTotal").textContent = T.formatMoney(countedWithAdj, code);
    $("#expectedTotal").textContent = T.formatMoney(expected, code);
    updateSubtotals();

    var v = T.variance(countedWithAdj, expected);
    var band = $("#verdictBand");
    var haveInput = counted !== 0 || expected !== 0 || adjMinors.length || state.floatMinor || state.salesMinor;
    if (!haveInput) {
      band.setAttribute("data-status", "none");
      $("#verdictStamp").textContent = "—";
      $("#verdictAmt").textContent = "Enter counts to reconcile";
      $("#verdictWords").textContent = "";
      return;
    }
    band.setAttribute("data-status", v.status);
    if (v.status === "tallied") {
      $("#verdictStamp").textContent = "Tallied";
      $("#verdictAmt").textContent = T.formatMoney(0, code);
      $("#verdictWords").textContent = "Counted cash matches expected exactly.";
    } else if (v.status === "short") {
      $("#verdictStamp").textContent = "Short";
      $("#verdictAmt").textContent = "− " + T.formatMoney(Math.abs(v.diff), code);
      $("#verdictWords").textContent = "The drawer is short of expected cash.";
    } else {
      $("#verdictStamp").textContent = "Over";
      $("#verdictAmt").textContent = "+ " + T.formatMoney(Math.abs(v.diff), code);
      $("#verdictWords").textContent = "The drawer holds more than expected.";
    }
  }

  /* ---------- currency switch ---------- */
  function switchCurrency(code) {
    state.currency = code;
    state.counts = {}; // denominations differ per currency; start clean
    saveState();
    var sym = symbolFor(code);
    $("#symFloat").textContent = sym;
    $("#symSales").textContent = sym;
    $("#currency").value = code;
    renderWells();
    recompute();
  }

  /* ---------- close the day ---------- */
  function todayISO() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd;
  }

  function currentClosing() {
    var code = state.currency;
    var counted = T.countTotal(code, state.counts);
    var adjMinors = state.adjustments.map(function (a) { return a.minor || 0; });
    var countedWithAdj = counted + adjMinors.reduce(function (s, v) { return s + v; }, 0);
    var payoutMinors = state.payouts.map(function (p) { return p.minor || 0; });
    var expected = T.expectedCash({ float: state.floatMinor, sales: state.salesMinor, payouts: payoutMinors });
    var v = T.variance(countedWithAdj, expected);
    return {
      date: $("#closeDate").value || todayISO(),
      currency: code,
      counts: JSON.parse(JSON.stringify(state.counts)),
      adjustments: state.adjustments.map(function (a) { return { label: a.label || "", minor: a.minor || 0 }; }),
      payouts: state.payouts.map(function (p) { return { label: p.label || "", minor: p.minor || 0 }; }),
      floatMinor: state.floatMinor, salesMinor: state.salesMinor,
      counted: countedWithAdj, expected: expected,
      variance: v.diff, status: v.status,
      note: $("#closeNote").value || ""
    };
  }

  function saveClosing() {
    var closing = currentClosing();
    var hist = loadHistory();
    var existingIdx = -1;
    for (var i = 0; i < hist.length; i++) {
      if (hist[i].date === closing.date && hist[i].currency === closing.currency) { existingIdx = i; break; }
    }
    if (existingIdx >= 0) {
      if (!window.confirm("A closing already exists for " + closing.date + " (" + closing.currency + "). Overwrite it?")) {
        return;
      }
      hist[existingIdx] = closing;
    } else {
      hist.push(closing);
    }
    hist.sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
    saveHistory(hist);
    var msg = $("#closeMsg");
    msg.setAttribute("data-kind", "ok");
    msg.textContent = "Saved closing for " + closing.date + ".";
    renderHistory();
  }

  /* ---------- history ---------- */
  function renderHistory() {
    var hist = loadHistory();
    var list = $("#historyList");
    var strip = $("#summaryStrip");
    list.textContent = "";

    if (!hist.length) {
      strip.hidden = true;
      list.appendChild(el("p", "history__empty", "No closings saved yet. Count the drawer and press “Save closing”."));
      return;
    }

    var summ = T.summarize(hist.map(function (h) { return h.variance; }));
    // net/avg are shown in the currency of the most-recent closing (best-effort label)
    var code = hist[0].currency;
    strip.hidden = false;
    strip.textContent = "";
    strip.appendChild(chip("Days closed", String(summ.count)));
    strip.appendChild(chip("Short", String(summ.short), "s-short"));
    strip.appendChild(chip("Over", String(summ.over), "s-over"));
    strip.appendChild(chip("Tallied", String(summ.tallied), "s-tally"));
    strip.appendChild(chip("Net variance", signed(summ.net, code)));
    strip.appendChild(chip("Avg variance", signed(Math.round(summ.avg), code)));
    if (summ.worstDay < 0) { strip.appendChild(chip("Worst day", signed(summ.worstDay, code), "s-short")); }

    hist.forEach(function (h) {
      var worst = (summ.worstDay < 0 && h.variance === summ.worstDay);
      var row = el("div", "hrow" + (worst ? " hrow--worst" : ""));
      row.appendChild(el("span", "hrow__date", h.date));

      var meta = el("div", "hrow__meta");
      meta.textContent = h.currency + " · counted " + T.formatMoney(h.counted, h.currency) +
        " · expected " + T.formatMoney(h.expected, h.currency) + (h.note ? " · " + h.note : "");
      row.appendChild(meta);

      var varWrap = el("div");
      var stamp = el("div", "hrow__stamp", h.status.toUpperCase() + (worst ? " · worst" : ""));
      var vv = el("div", "hrow__var hrow__var--" + h.status, signed(h.variance, h.currency));
      varWrap.appendChild(stamp); varWrap.appendChild(vv);
      row.appendChild(varWrap);

      var del = el("button", "hrow__del", "×");
      del.type = "button"; del.setAttribute("aria-label", "Delete closing for " + h.date);
      del.addEventListener("click", function () {
        if (!window.confirm("Delete the closing for " + h.date + "?")) { return; }
        var cur = loadHistory().filter(function (x) { return !(x.date === h.date && x.currency === h.currency); });
        saveHistory(cur); renderHistory();
      });
      row.appendChild(del);
      list.appendChild(row);
    });
  }

  function chip(label, value, cls) {
    var c = el("span");
    c.appendChild(document.createTextNode(label + " "));
    var b = el("b", cls || null, value);
    c.appendChild(b);
    return c;
  }
  function signed(minor, code) {
    if (minor === 0) { return T.formatMoney(0, code); }
    var sign = minor < 0 ? "− " : "+ ";
    return sign + T.formatMoney(Math.abs(minor), code);
  }

  /* ---------- CSV export ---------- */
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: (mime || "text/csv") + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = el("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  function toMajor(minor, code) {
    var meta = T.currencyMeta(code) || { minorPerMajor: 100 };
    var per = meta.minorPerMajor || 100;
    var neg = minor < 0; var abs = Math.abs(minor);
    var frac = String(abs % per); while (frac.length < String(per - 1).length) { frac = "0" + frac; }
    return (neg ? "-" : "") + Math.floor(abs / per) + "." + frac;
  }

  function exportHistoryCsv() {
    var hist = loadHistory();
    if (!hist.length) { alert("No closings to export yet."); return; }
    var header = ["date", "currency", "counted", "expected", "variance", "status", "note"];
    var lines = [T.csvRow(header)];
    hist.forEach(function (h) {
      lines.push(T.csvRow([
        h.date, h.currency, toMajor(h.counted, h.currency),
        toMajor(h.expected, h.currency), toMajor(h.variance, h.currency),
        h.status, h.note || ""
      ]));
    });
    download("tillclose-history.csv", lines.join("\r\n") + "\r\n");
  }

  function exportBreakdownCsv() {
    var hist = loadHistory();
    if (!hist.length) { alert("No closings to export yet."); return; }
    var header = ["date", "currency", "kind", "denomination", "quantity", "subtotal"];
    var lines = [T.csvRow(header)];
    hist.forEach(function (h) {
      var bd = T.countBreakdown(h.currency, h.counts);
      bd.forEach(function (r) {
        if (r.qty === 0) { return; }
        lines.push(T.csvRow([h.date, h.currency, r.kind, r.label, String(r.qty), toMajor(r.subtotal, h.currency)]));
      });
      (h.adjustments || []).forEach(function (a) {
        if (!a.minor) { return; }
        lines.push(T.csvRow([h.date, h.currency, "adjustment", a.label || "(unlabelled)", "1", toMajor(a.minor, h.currency)]));
      });
    });
    download("tillclose-denomination-breakdown.csv", lines.join("\r\n") + "\r\n");
  }

  /* ---------- print sheet ---------- */
  function buildPrintSheet() {
    var host = $("#printSheetEl");
    host.textContent = "";
    var c = currentClosing();
    var code = c.currency;

    host.appendChild(el("h2", null, "Till closing sheet — " + c.date + " (" + code + ")"));

    var bd = T.countBreakdown(code, c.counts);
    var tbl = el("table"); tbl.style.width = "100%"; tbl.style.borderCollapse = "collapse";
    var thead = el("tr");
    ["Denomination", "Qty", "Subtotal"].forEach(function (t) {
      var th = el("th", null, t); th.style.textAlign = "left"; th.style.borderBottom = "1px solid #000"; th.style.padding = "4px 6px";
      thead.appendChild(th);
    });
    tbl.appendChild(thead);
    bd.forEach(function (r) {
      if (r.qty === 0) { return; }
      var tr = el("tr");
      [r.label + " (" + r.kind + ")", String(r.qty), T.formatMoney(r.subtotal, code)].forEach(function (t) {
        var td = el("td", null, t); td.style.padding = "3px 6px"; td.style.borderBottom = "1px solid #ccc";
        tr.appendChild(td);
      });
      tbl.appendChild(tr);
    });
    host.appendChild(tbl);

    var lines = el("div");
    lines.style.marginTop = "12px";
    lines.appendChild(el("p", null, "Counted total: " + T.formatMoney(c.counted, code)));
    lines.appendChild(el("p", null, "Opening float: " + T.formatMoney(c.floatMinor, code) +
      " · Cash sales: " + T.formatMoney(c.salesMinor, code) +
      " · Payouts: " + T.formatMoney(c.payouts.reduce(function (s, p) { return s + (p.minor || 0); }, 0), code)));
    lines.appendChild(el("p", null, "Expected total: " + T.formatMoney(c.expected, code)));
    var vp = el("p", null, "Variance: " + signed(c.variance, code) + "  (" + c.status.toUpperCase() + ")");
    vp.style.fontWeight = "800";
    lines.appendChild(vp);
    if (c.note) { lines.appendChild(el("p", null, "Note: " + c.note)); }
    host.appendChild(lines);

    var signoff = el("div", "printsheet__signoff");
    signoff.appendChild(el("div", null, "Counted by"));
    signoff.appendChild(el("div", null, "Verified by"));
    host.appendChild(signoff);
  }

  /* ---------- wire up ---------- */
  function init() {
    initTheme();

    // seed currency + symbols
    $("#currency").value = state.currency;
    $("#symFloat").textContent = symbolFor(state.currency);
    $("#symSales").textContent = symbolFor(state.currency);
    $("#closeDate").value = todayISO();

    // restore float/sales raw
    if (state.floatMinor) { $("#floatInput").value = toMajor(state.floatMinor, state.currency); }
    if (state.salesMinor) { $("#salesInput").value = toMajor(state.salesMinor, state.currency); }

    renderWells();
    renderLineList("#payoutList", state.payouts, "payout");
    renderLineList("#adjustList", state.adjustments, "adjustment");
    recompute();
    renderHistory();

    $("#themeToggle").addEventListener("click", toggleTheme);
    $("#currency").addEventListener("change", function () { switchCurrency($("#currency").value); });

    $("#floatInput").addEventListener("input", function () {
      state.floatMinor = parseMoney($("#floatInput").value, state.currency); saveState(); recompute();
    });
    $("#salesInput").addEventListener("input", function () {
      state.salesMinor = parseMoney($("#salesInput").value, state.currency); saveState(); recompute();
    });

    $("#addPayout").addEventListener("click", function () {
      state.payouts.push({ label: "", raw: "", minor: 0 }); saveState();
      renderLineList("#payoutList", state.payouts, "payout");
    });
    $("#addAdjust").addEventListener("click", function () {
      state.adjustments.push({ label: "", raw: "", minor: 0 }); saveState();
      renderLineList("#adjustList", state.adjustments, "adjustment");
    });

    $("#carryFloat").addEventListener("click", function () {
      var hist = loadHistory();
      var last = null;
      for (var i = 0; i < hist.length; i++) {
        if (hist[i].currency === state.currency) { last = hist[i]; break; } // history is newest-first
      }
      if (!last) { flash("#closeMsg", "No previous closing in " + state.currency + " to carry forward.", "warn"); return; }
      state.floatMinor = last.floatMinor || 0;
      $("#floatInput").value = toMajor(state.floatMinor, state.currency);
      saveState(); recompute();
    });

    $("#saveClose").addEventListener("click", saveClosing);
    $("#printSheet").addEventListener("click", function () { buildPrintSheet(); window.print(); });
    $("#exportCsv").addEventListener("click", exportHistoryCsv);
    $("#exportBreakdown").addEventListener("click", exportBreakdownCsv);

    window.addEventListener("beforeprint", buildPrintSheet);
  }

  function flash(sel, text, kind) {
    var m = $(sel); m.textContent = text; m.setAttribute("data-kind", kind || "ok");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
