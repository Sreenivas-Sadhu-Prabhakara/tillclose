# Sources — tillclose denomination corpus

Every denomination value in `data/denominations.js` is a mechanical, publicly
published fact (the face value of a circulating note or coin). Each currency's
set was eyeball-verified against the relevant central-bank / mint page during
authoring on **2026-07-22**. These are facts about currency, not health or
statutory figures, but they carry provenance so the corpus is inspectable.

The structural invariants (integer minor-unit values, strictly descending order
per currency+kind, uniqueness, and the exact per-currency counts
INR 11 / USD 11 / EUR 15 / GBP 12 / PHP 11 = 60) are additionally proven in
`test/tillclose.test.js`.

## INR — Indian Rupee (11: notes 500/200/100/50/20/10, coins 20/10/5/2/1)

- **Source:** Reserve Bank of India — *Indian Currency* FAQ (updated 15 Apr 2025).
  <https://www.rbi.org.in/commonman/Upload/English/FAQs/PDFs/INDIANCURRENCY15042025.pdf>
- **Note:** The ₹2000 banknote is **deliberately excluded** — the RBI began
  withdrawing it from circulation in **May 2023** (RBI Annual Report 2023-24
  confirms ~98% returned by 31 Mar 2025). It is handled via the app's *Other
  amount* adjustment row, not the count grid.
- Coins verified: 50 paise is no longer commonly circulated; ₹1/₹2/₹5/₹10/₹20
  coins are the current set (₹20 coin issued from 2020).

## USD — US Dollar (11: notes 100/50/20/10/5/2/1, coins 25¢/10¢/5¢/1¢)

- **Source:** U.S. Currency Education Program (denominations) & U.S. Mint
  (circulating coins). <https://www.uscurrency.gov/denominations>
- The **$2 note** is legal tender but rarely seen in daily commerce → marked
  `rare: true`.
- The half-dollar and $1 coin are excluded as uncommon in circulation → use the
  adjustment row.

## EUR — Euro (15: notes 500/200/100/50/20/10/5, coins €2/€1/50/20/10/5/2/1c)

- **Source:** European Central Bank — euro banknotes & coins.
  <https://www.ecb.europa.eu/euro/html/index.en.html>
- The **€500 note** has not been issued since 2019 but **remains legal tender**
  → marked `rare: true`.

## GBP — Pound Sterling (12: notes 50/20/10/5, coins £2/£1/50/20/10/5/2/1p)

- **Source:** Bank of England (current banknotes) & The Royal Mint (coins).
  <https://www.bankofengland.co.uk/banknotes/current-banknotes>
  <https://www.royalmint.com/discover/uk-coins/coin-design-and-specifications/>
- All four current notes (£5/£10/£20/£50) are polymer.

## PHP — Philippine Peso (11: notes 1000/500/200/100/50/20, coins 20/10/5/1/25s)

- **Source:** Bangko Sentral ng Pilipinas — New Generation Currency (banknotes
  and coins). <https://www.bsp.gov.ph/SitePages/CoinsAndNotes/NewGenerationCurrencyBanknotes.aspx>
- The **₱200 note** circulates less commonly → marked `rare: true`.
- The ₱20 note is largely superseded by the ₱20 NGC coin (2020) but is kept in
  the set; use the adjustment row for anything demonetised locally.

_Verification method: each central-bank / mint page above was opened at
authoring time and the note/coin denominations recorded. Any value that could
not be confirmed from an official page would have been dropped rather than
guessed; none were._
