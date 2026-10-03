# Cdiscount / Octopia production readiness

## Status

Cdiscount is **not production-ready** in ShopOpti.

The current production baseline only exposes Cdiscount in catalogue/UI metadata and legacy supplier types. Historical PRs #21, #24, #89 and #91 were closed without merge and did not establish a production connector.

## Source of truth

Cdiscount Marketplace documents its seller automation through the Octopia API. A production connector must therefore be implemented against verified Octopia endpoints and credentials, server-side only.

## P0 contract

The connector must remain fail-closed until all of the following are proven in staging with a real seller account:

- server-side credential exchange/validation;
- no raw Cdiscount/Octopia secret persisted in browser-readable storage;
- seller/account identity persisted with ownership checks;
- product catalogue lookup and product existence check;
- product creation/update with durable remote identifiers;
- offer creation/update;
- stock synchronization;
- price synchronization;
- order retrieval;
- order acknowledgement/processing where required;
- shipment/tracking update;
- cancellation/refund handling where supported;
- pagination;
- API throttling/rate-limit handling;
- retry policy limited to safe/idempotent operations;
- idempotency/ledger for writes;
- ambiguous remote write outcomes reconciled before retry;
- durable sync checkpoints;
- structured error persistence and operator-visible retry/replay;
- audit trail with source and timestamp;
- staging Golden Path evidence.

## Golden Path

1. Connect a real Cdiscount/Octopia seller account.
2. Verify the remote account identity.
3. Read catalogue/product reference data.
4. Publish or link one test product.
5. Create/update an offer.
6. Change price and stock from ShopOpti and confirm remotely.
7. Retrieve a real test order.
8. Process the order without duplicate execution.
9. Send shipment + carrier + tracking and confirm remotely.
10. Re-run sync and prove idempotence.
11. Disconnect/reconnect without leaking credentials or corrupting state.

## Current blockers

- No verified Octopia runtime on main.
- No Cdiscount-specific server-side credential validation.
- No proven product/offer write path.
- No proven stock/price sync.
- No proven order lifecycle.
- No proven shipment/tracking update.
- No staging Golden Path with a real Cdiscount seller account.

## Merge gate

Do not mark Cdiscount as connected, synchronized, production-ready, or 100% complete until the Golden Path above has evidence and all required CI/security/migration checks are green.
