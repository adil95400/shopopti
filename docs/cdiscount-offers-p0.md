# Cdiscount offers — P0 contract

This P0 establishes a fail-closed local contract from the two Cdiscount/Octopia Excel templates supplied for ShopOpti review on 2026-09-30.

## Source templates

- Full offer template: `int_off_import_template_238039.fr.xlsx`
- Existing-offer stock/price template: `int_off_import_stockprice_template.fr.xlsx`

The repository does not embed seller credentials or perform a remote Cdiscount write in this P0.

## Verified stock/price contract

The stock/price workbook states that it updates offers that already exist and cannot create offers.

Column order:

1. `Votre référence` — mandatory, alphanumeric, 1–50 characters, no invisible characters or `|`
2. `EAN` — optional, numeric, 13 characters
3. `Stock` — mandatory, numeric, up to 10 characters; zero prevents publication
4. `Prix (€)(TTC)` — mandatory, TTC excluding shipping, price must be greater than 1 €, decimal comma, no euro sign and no thousands separator

ShopOpti validates these rules before constructing an export row.

## Stock/price workbook generator

`buildCdiscountStockPriceWorkbook` accepts the official workbook bytes plus verified ShopOpti offer values.

It:

- requires the exact `Fichier Intégration Offre` worksheet
- verifies row 4 before writing
- rejects the whole export when any offer row is invalid
- clears stale rows in the data area before writing
- writes from row 5, matching the official template
- preserves the other worksheets and merge definitions processed by the XLSX library
- outputs an Excel workbook without performing any remote marketplace write

The generator deliberately consumes the official template rather than rebuilding its instructional sheets from scratch.

## Verified full-offer contract

The full Cdiscount workbook contains 28 offer columns covering product identity, condition, stock, TTC price, taxes, Cdiscount-specific conditioning/comment fields, sales settings, price competition, preparation delay, and shipping-cost fields.

P0 records the exact 28-column contract so future export code can reject template drift instead of silently shifting values into the wrong column.

The complete-offer workbook writer is not yet enabled: additional field constraints must be encoded and tested before ShopOpti can populate those 28 columns safely.

## Out of scope for this P0

- remote Cdiscount/Octopia API authentication
- remote offer creation/update
- order ingestion and acknowledgement
- shipment/tracking updates
- asynchronous integration-report retrieval
- production Supabase changes
- automatic publication

Those capabilities remain unverified until they are implemented and exercised against a seller/staging environment.
