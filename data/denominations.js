/* ============================================================
   tillclose — currency denomination corpus.
   60 hand-verified denominations across 5 currency sets + 5 meta records.

   All `value` fields are POSITIVE INTEGERS in MINOR units
   (paise / cents / pence / sentimo). minorPerMajor is 100 for all five.
   `order` is a display index; per currency+kind the values are strictly
   descending. These are structural facts asserted in test/tillclose.test.js.

   Every denomination value was eyeball-verified against the named
   central-bank source during authoring (see sources/CITATIONS.md).
   Works in the browser (global CORPUS/CURRENCIES) and in Node tests
   (module.exports) via the dual-export guard at the bottom.
   ============================================================ */

/* Per-currency metadata.
   grouping: "indian" = 2,2,3 lakh/crore digit grouping; "western" = 3,3,3. */
var CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee",      minorName: "paise",   minorPerMajor: 100, grouping: "indian",
    source_name: "Reserve Bank of India — Indian Currency FAQ (15 Apr 2025)",
    source_url:  "https://www.rbi.org.in/commonman/Upload/English/FAQs/PDFs/INDIANCURRENCY15042025.pdf",
    as_of: "2026-07-22" },
  { code: "USD", symbol: "$",      name: "US Dollar",         minorName: "cents",   minorPerMajor: 100, grouping: "western",
    source_name: "U.S. Currency Education Program & U.S. Mint — circulating denominations",
    source_url:  "https://www.uscurrency.gov/denominations",
    as_of: "2026-07-22" },
  { code: "EUR", symbol: "€", name: "Euro",              minorName: "cents",   minorPerMajor: 100, grouping: "western",
    source_name: "European Central Bank — euro banknotes & coins",
    source_url:  "https://www.ecb.europa.eu/euro/html/index.en.html",
    as_of: "2026-07-22" },
  { code: "GBP", symbol: "£", name: "Pound Sterling",    minorName: "pence",   minorPerMajor: 100, grouping: "western",
    source_name: "Bank of England (notes) & The Royal Mint (coins)",
    source_url:  "https://www.bankofengland.co.uk/banknotes/current-banknotes",
    as_of: "2026-07-22" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso",   minorName: "sentimo", minorPerMajor: 100, grouping: "western",
    source_name: "Bangko Sentral ng Pilipinas — New Generation Currency (notes & coins)",
    source_url:  "https://www.bsp.gov.ph/SitePages/CoinsAndNotes/NewGenerationCurrencyBanknotes.aspx",
    as_of: "2026-07-22" }
];

/* The 60 denominations. value is always in MINOR units. */
var CORPUS = [
  /* ---------- INR (11): notes 500/200/100/50/20/10, coins 20/10/5/2/1 ----------
     Rs.2000 note deliberately EXCLUDED (withdrawn from circulation May 2023);
     it is handled through the app's adjustment row, not this grid. */
  { code: "INR", kind: "note", value: 50000, label: "₹500", rare: false, order: 1 },
  { code: "INR", kind: "note", value: 20000, label: "₹200", rare: false, order: 2 },
  { code: "INR", kind: "note", value: 10000, label: "₹100", rare: false, order: 3 },
  { code: "INR", kind: "note", value:  5000, label: "₹50",  rare: false, order: 4 },
  { code: "INR", kind: "note", value:  2000, label: "₹20",  rare: false, order: 5 },
  { code: "INR", kind: "note", value:  1000, label: "₹10",  rare: false, order: 6 },
  { code: "INR", kind: "coin", value:  2000, label: "₹20",  rare: false, order: 1 },
  { code: "INR", kind: "coin", value:  1000, label: "₹10",  rare: false, order: 2 },
  { code: "INR", kind: "coin", value:   500, label: "₹5",   rare: false, order: 3 },
  { code: "INR", kind: "coin", value:   200, label: "₹2",   rare: false, order: 4 },
  { code: "INR", kind: "coin", value:   100, label: "₹1",   rare: false, order: 5 },

  /* ---------- USD (11): notes 100/50/20/10/5/2/1, coins 25c/10c/5c/1c ----------
     $2 note is legal tender but rarely seen -> rare:true.
     Half-dollar and $1 coin excluded as rare -> adjustment row. */
  { code: "USD", kind: "note", value: 10000, label: "$100", rare: false, order: 1 },
  { code: "USD", kind: "note", value:  5000, label: "$50",  rare: false, order: 2 },
  { code: "USD", kind: "note", value:  2000, label: "$20",  rare: false, order: 3 },
  { code: "USD", kind: "note", value:  1000, label: "$10",  rare: false, order: 4 },
  { code: "USD", kind: "note", value:   500, label: "$5",   rare: false, order: 5 },
  { code: "USD", kind: "note", value:   200, label: "$2",   rare: true,  order: 6 },
  { code: "USD", kind: "note", value:   100, label: "$1",   rare: false, order: 7 },
  { code: "USD", kind: "coin", value:    25, label: "25¢", rare: false, order: 1 },
  { code: "USD", kind: "coin", value:    10, label: "10¢", rare: false, order: 2 },
  { code: "USD", kind: "coin", value:     5, label: "5¢",  rare: false, order: 3 },
  { code: "USD", kind: "coin", value:     1, label: "1¢",  rare: false, order: 4 },

  /* ---------- EUR (15): notes 500/200/100/50/20/10/5, coins 2/1/50c/20c/10c/5c/2c/1c ----------
     EUR500 note no longer issued (since 2019) but remains legal tender -> rare:true. */
  { code: "EUR", kind: "note", value: 50000, label: "€500", rare: true,  order: 1 },
  { code: "EUR", kind: "note", value: 20000, label: "€200", rare: false, order: 2 },
  { code: "EUR", kind: "note", value: 10000, label: "€100", rare: false, order: 3 },
  { code: "EUR", kind: "note", value:  5000, label: "€50",  rare: false, order: 4 },
  { code: "EUR", kind: "note", value:  2000, label: "€20",  rare: false, order: 5 },
  { code: "EUR", kind: "note", value:  1000, label: "€10",  rare: false, order: 6 },
  { code: "EUR", kind: "note", value:   500, label: "€5",   rare: false, order: 7 },
  { code: "EUR", kind: "coin", value:   200, label: "€2",   rare: false, order: 1 },
  { code: "EUR", kind: "coin", value:   100, label: "€1",   rare: false, order: 2 },
  { code: "EUR", kind: "coin", value:    50, label: "50c",       rare: false, order: 3 },
  { code: "EUR", kind: "coin", value:    20, label: "20c",       rare: false, order: 4 },
  { code: "EUR", kind: "coin", value:    10, label: "10c",       rare: false, order: 5 },
  { code: "EUR", kind: "coin", value:     5, label: "5c",        rare: false, order: 6 },
  { code: "EUR", kind: "coin", value:     2, label: "2c",        rare: false, order: 7 },
  { code: "EUR", kind: "coin", value:     1, label: "1c",        rare: false, order: 8 },

  /* ---------- GBP (12): notes 50/20/10/5, coins 2/1/50p/20p/10p/5p/2p/1p ---------- */
  { code: "GBP", kind: "note", value:  5000, label: "£50", rare: false, order: 1 },
  { code: "GBP", kind: "note", value:  2000, label: "£20", rare: false, order: 2 },
  { code: "GBP", kind: "note", value:  1000, label: "£10", rare: false, order: 3 },
  { code: "GBP", kind: "note", value:   500, label: "£5",  rare: false, order: 4 },
  { code: "GBP", kind: "coin", value:   200, label: "£2",  rare: false, order: 1 },
  { code: "GBP", kind: "coin", value:   100, label: "£1",  rare: false, order: 2 },
  { code: "GBP", kind: "coin", value:    50, label: "50p",      rare: false, order: 3 },
  { code: "GBP", kind: "coin", value:    20, label: "20p",      rare: false, order: 4 },
  { code: "GBP", kind: "coin", value:    10, label: "10p",      rare: false, order: 5 },
  { code: "GBP", kind: "coin", value:     5, label: "5p",       rare: false, order: 6 },
  { code: "GBP", kind: "coin", value:     2, label: "2p",       rare: false, order: 7 },
  { code: "GBP", kind: "coin", value:     1, label: "1p",       rare: false, order: 8 },

  /* ---------- PHP (11): notes 1000/500/200/100/50/20, coins 20/10/5/1/25-sentimo ----------
     PHP200 note circulates less commonly -> rare:true (per brief).
     P20 note largely superseded by the P20 NGC coin but included per brief. */
  { code: "PHP", kind: "note", value: 100000, label: "₱1000", rare: false, order: 1 },
  { code: "PHP", kind: "note", value:  50000, label: "₱500",  rare: false, order: 2 },
  { code: "PHP", kind: "note", value:  20000, label: "₱200",  rare: true,  order: 3 },
  { code: "PHP", kind: "note", value:  10000, label: "₱100",  rare: false, order: 4 },
  { code: "PHP", kind: "note", value:   5000, label: "₱50",   rare: false, order: 5 },
  { code: "PHP", kind: "note", value:   2000, label: "₱20",   rare: false, order: 6 },
  { code: "PHP", kind: "coin", value:   2000, label: "₱20",   rare: false, order: 1 },
  { code: "PHP", kind: "coin", value:   1000, label: "₱10",   rare: false, order: 2 },
  { code: "PHP", kind: "coin", value:    500, label: "₱5",    rare: false, order: 3 },
  { code: "PHP", kind: "coin", value:    100, label: "₱1",    rare: false, order: 4 },
  { code: "PHP", kind: "coin", value:     25, label: "25s",        rare: false, order: 5 }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CORPUS: CORPUS, CURRENCIES: CURRENCIES };
}
