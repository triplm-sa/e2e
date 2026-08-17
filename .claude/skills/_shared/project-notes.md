# Project notes

> **A living record of what has been learned about one particular app.** The rest of `_shared/`
> holds rules true for any Shopify app; only this file is app-specific.
>
> **Starting empty is normal and expected.** Nothing here has to be written up front. Every section
> may be blank: the skills then discover what they need from the code and **append what they find**,
> so the file grows richer with each task and later runs start from a better map.
>
> **When adopting the harness for a different app, empty the sections but keep the headings.**
> Leaving another app's endpoints in place is worse than leaving them blank — the skills would
> trust them and chase routes that do not exist.

## Targets

Declared in `e2e.config.yaml`: `api`, `cms` (app embedded in Shopify Admin), `storefront`, `proxy`, plus the generic persona slots `storefront-2` / `proxy-2`.

Store, app handle, domains and secrets are **not written here** — they resolve from `e2e/.env` (`STORE`, `APP_HANDLE`, `APP_DOMAIN`, `API_BASE_URL`, `PERSONA2_PROFILE`).

## Known state chains

Sequences that reach a required state — extend this list as you discover more:

| Required state | Chain |
|---|---|
| A real order exists | `POST /orders/create-draft-order` → `POST /orders/complete-draft-order` |
| An unpaid order (credit / payment-term scenarios) | same chain, completed with payment pending |
| Draft order removed | `POST /orders/delete-draft-order` |
| A company member exists | `POST /company-accounts/:id/members` (= `sendInvitation`, body `{email, role_id}`; role `id=2` "Default" is non-admin, `id=1` "Admin") → creates a **PENDING/invited** row, sends a real email. `GET /company-accounts/:id/members` only returns **ACTIVATED** members — the new invite will NOT show up there. To force-activate without the email link: `PUT /company-accounts/:id/members/:memberId` `{status:"ACTIVATED"}` (grab the new member's id straight from the invite response's `data.member.id`, not from a follow-up GET). |
| Member removed | `DELETE /company-accounts/:id/members/:memberId` |
| A second buyer identity | log in the `storefront-2` / `proxy-2` persona slot once (`PERSONA2_PROFILE` in `.env`) |
| A shipping option exists (BR-52) | `POST /shipping-rates` (full body: scopes + `tiers[]`) → `DELETE /shipping-rates/:id` to clean up |
| Shipping option active / inactive | `PATCH /shipping-rates/:id/active` `{is_active}` |
| A duplicated shipping option | `POST /shipping-rates/:id/duplicate` (always created inactive, name + ` (copy of)`) |
| Shipping-rates empty state | `GET /shipping-rates` → `DELETE` every id (re-seed in teardown) |
| Resolved shipping rate for a hypothetical cart | `POST /shipping-rates/resolve-for-cart` `{items[{product_id,tags,quantity,weight,price}], customerTags, marketId, customerId}` — pure read, no side effect: covers the whole rate engine without a real cart |
| `shipping_rate_usage` rows | **no direct endpoint** — only the `orders/paid` webhook writes them, reading the `shipping_rate_id` order attribute. Reaching the "limit hit" branch needs a really-paid order. |
| **A buyer cart the app can see** | ⚠ **The app does NOT use the Shopify theme cart.** The proxy pages read a **Storefront-API cart** whose id is kept in `localStorage` under `b2bridge-cart-<store>` (`utils/cart.ts#checkExistCart` → `createCartSession`). Adding lines via `/cart/add` or `/cart.js` fills the *theme* cart and the app still shows "Your cart is empty". Reach the real state through the app's own UI: `/apps/b2bridge/quick-order` → "Add to cart" (many demo products are out of stock — take the first enabled button). |
| Reference data for rate scopes | `GET /customer-groups` (also gives `customer_tags`), `GET /markets`, `GET /products`, `GET /pricing-lists` |
| Overdue / not-yet-overdue order with a real payment schedule (BR-55) | **No endpoint sets a schedule due date directly.** `GET /orders/payment-terms-summary/:customerId` reflects whatever the shop already has — check for existing "Fixed"-payment-term orders first (`GET /orders/customer-orders/:customerId`) before creating anything; a "Due on receipt" order never produces a `paymentSchedules` entry at all, so it's useless for overdue/next-payment-due assertions. |

## Switchable settings

Switching a setting is a `phase: setup` step, never a reason to skip a case. Restore the original value in `phase: teardown`.

| Setting | How to read / switch |
|---|---|
| **Account type** (`CUSTOMER_GROUP` ↔ `COMPANY_ACCOUNT`) | `GET /general-settings` → `POST /general-settings` with `accountType` |
| Finance report sections, row counts | same endpoint, field `paymentReportSettings` |
| Payment terms, credit limits | company-account routes (`/company-accounts/:id`) |
| **Shipping conflict resolution** (`lowest`/`highest`/`sum`) and **display behavior** (`override`/`coexist`) | `GET /shipping-settings` → `PUT /shipping-settings` — upsert of both fields at once, so read first and post the whole object back. `display_behavior` also pushes the `secret_keys.shipping_display_behavior` metafield to Shopify. Shop-wide → group the cases per mode. |

> ⚠️ **`POST /general-settings` is a full upsert with defaults, not a patch.** Fields you omit are reset — `paymentReportSettings` becomes `null`, `isEnabledOverridePrice` becomes `true`, `isShowWatermark` becomes `false`. Always **read the current settings first, change only the field you need, and post the whole object back**; otherwise a setup step that flips the account type will silently wipe the report configuration other cases depend on.

Because this setting is shop-wide, group the cases that need a given mode together so the switch happens once rather than per case.

> ⚠️ **Switching `accountType` and immediately reading the report on a different persona can race.** The proxy appears to cache/revalidate the merchant's `accountType` for a few seconds — a test that flips it, restores it, then opens a report page for another persona right away can transiently see `$NaN` credit values. Not a feature bug (confirmed: same case passes cleanly in isolation) — give the page a settle-reload if it renders "$NaN", or space out accountType-mutating cases (BR-55 `openReportSettled()` helper in `browser/BR-55.spec.ts`).

## CMS (embedded app) locator gotchas

- **App Bridge `<SaveBar>` (`ContextualSaveBar` wrapper) renders in the Admin top-level chrome, NOT inside the app iframe** — the component only wires `onClick` handlers onto empty `<button>`s; the actual "Save"/"Discard" buttons and labels are drawn by Shopify outside `frameLocator`. Target them on the top-level page object, not through `app.getByRole(...)`.
- Custom dropdown menus built on Radix/shadcn `DropdownMenu` (e.g. report range/activity filters) expose items with role **`menuitem`**, not `option` — `getByRole("option", ...)` will silently time out.

## Environment checks for this project

- API health: `GET <API_BASE_URL>/health/live` (some services also expose `/life-check`).
- `pnpm e2e:doctor` verifies Chrome, config resolution, token signing, login profiles and API reachability in one go.
