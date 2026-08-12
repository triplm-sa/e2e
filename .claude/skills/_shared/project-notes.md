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
| A company member exists | `POST /company-accounts/:id/members` → accept/approve endpoint to activate |
| Member removed | `DELETE /company-accounts/:id/members/:memberId` |
| A second buyer identity | log in the `storefront-2` / `proxy-2` persona slot once (`PERSONA2_PROFILE` in `.env`) |
| A shipping option exists (BR-52) | `POST /shipping-rates` (full body: scopes + `tiers[]`) → `DELETE /shipping-rates/:id` to clean up |
| Shipping option active / inactive | `PATCH /shipping-rates/:id/active` `{is_active}` |
| A duplicated shipping option | `POST /shipping-rates/:id/duplicate` (always created inactive, name + ` (copy of)`) |
| Shipping-rates empty state | `GET /shipping-rates` → `DELETE` every id (re-seed in teardown) |
| Resolved shipping rate for a hypothetical cart | `POST /shipping-rates/resolve-for-cart` `{items[{product_id,tags,quantity,weight,price}], customerTags, marketId, customerId}` — pure read, no side effect: covers the whole rate engine without a real cart. **`customerTags` is what actually matches a customer group** (not a group id) — pass the group's `customer_tags` value. **`marketId` is the numeric part of the market's GID** (`gid://shopify/Market/3324969128` → pass `"3324969128"`), not the market name. |
| `shipping_rate_usage` rows | **no direct endpoint** — only the `orders/paid` webhook writes them, reading the `shipping_rate_id` order attribute. Reaching the "limit hit" branch needs a really-paid order. |
| **A buyer cart the app can see** | ⚠ **The app does NOT use the Shopify theme cart.** The proxy pages read a **Storefront-API cart** whose id is kept in `localStorage` under `b2bridge-cart-<store>` (`utils/cart.ts#checkExistCart` → `createCartSession`). Adding lines via `/cart/add` or `/cart.js` fills the *theme* cart and the app still shows "Your cart is empty". Reach the real state through the app's own UI: `/apps/b2bridge/quick-order` → "Add to cart" (many demo products are out of stock — take the first enabled button). |
| Reference data for rate scopes | `GET /customer-groups` (also gives `customer_tags`), `GET /markets`, `GET /products`, `GET /pricing-lists` |
| **Shipping Rate wizard is 4 steps, not 5** | Docs/BRD say "5-step configuration" (`Step N / 5`); the live UI (`cms` `/shipping-rates/add`) shows `STEP N / 4` — *Rate details → Applies to → Rate → Review*. Nothing is missing content-wise, only the step count differs from the ticket. |
| **"Set active" toggle defaults ON, not OFF** | Contradicts the BR-52 ticket's FR-04 ("mặc định tắt khi tạo mới"). Verified live on `/shipping-rates/add` — toggle is green/Active on a fresh wizard. Treat the live behavior as ground truth unless a tester says otherwise. |
| Settings → Shipping rate tab route | `cms` `/settings?tab=shipping-rates` — a **query param** on the generic Settings route, not its own path. |

## Switchable settings

Switching a setting is a `phase: setup` step, never a reason to skip a case. Restore the original value in `phase: teardown`.

| Setting | How to read / switch |
|---|---|
| **Account type** (`CUSTOMER_GROUP` ↔ `COMPANY_ACCOUNT`) | `GET /general-settings` → `POST /general-settings` with `accountType` |
| Finance report sections, row counts | same endpoint, field `paymentReportSettings` |
| Payment terms, credit limits | company-account routes (`/company-accounts/:id`) |
| **Shipping conflict resolution** (`lowest`/`highest`/`sum`) and **display behavior** (`override`/`coexist`) | `GET /shipping-settings` → `PUT /shipping-settings` — upsert of both fields at once, so read first and post the whole object back. `display_behavior` also pushes the `secret_keys.shipping_display_behavior` metafield to Shopify. Shop-wide → group the cases per mode. **`sum` ("Add all rates together") is a real third mode** — the DB enum and the Settings UI both have it even though the BR-52 Jira ticket's own data-model table only lists `lowest`/`highest`; trust the code/BRD, not that table. |

> ⚠️ **`POST /general-settings` is a full upsert with defaults, not a patch.** Fields you omit are reset — `paymentReportSettings` becomes `null`, `isEnabledOverridePrice` becomes `true`, `isShowWatermark` becomes `false`. Always **read the current settings first, change only the field you need, and post the whole object back**; otherwise a setup step that flips the account type will silently wipe the report configuration other cases depend on.

Because this setting is shop-wide, group the cases that need a given mode together so the switch happens once rather than per case.

## UI interaction patterns

**How a control commits a value is not guessable from its appearance.** A field that opens a list of
options may commit on click, or may hold the selection in local state until an explicit button is
pressed — and dismissing it any other way (Cancel, click-outside, Escape) then discards everything.
Writing a spec on the wrong assumption produces a test that fails on a *later* business assertion,
which reads as a product bug and sends the whole repair loop in the wrong direction.

Verified by reading `b2bridge-cms/web/frontend/components/ui/resources/picker/` (labels resolved
against `locales/en/`). Confirm-button labels are the **English UI strings** a locator must match:

| Component | Surface | How the selection commits | Confirm label (en) |
|---|---|---|---|
| `CustomerGroupPickerV2` | Polaris `Modal` | `primaryAction` — click item only toggles local state | **Add** |
| `CustomerPickerV2` | `Modal` | `primaryAction` | **Add** |
| `PriceListPicker` | `Modal` | `primaryAction` | **Add** |
| `CollectionPicker` | `Modal` | `primaryAction` (secondary **Cancel**) | **Add** |
| `CustomerGroupPicker` (v1) | `Modal` | `primaryAction` — **different label from V2** | **Select** |
| `RFPicker` | `Modal` | `primaryAction` | **Continue** |
| `ProductPickerV2` | `Modal` (an inner `Popover` is only the filter activator) | `primaryAction`, computed per `modalType`; **disabled until ≥1 item selected** | **Add**, but **Select** when `modalType` is `product-tag` or `collection` |
| `CompanyAccountPicker` | `Modal`, **multi-step** | `primaryAction` from `getPrimaryAction()`, changes per step | **Add** / **Next** / **Save**, plus **Back**, **Cancel** |
| `ProductPickerMO` | `Modal` | a plain `<Button variant="primary">` inside `Modal.Section` — **not** `primaryAction`; **disabled until ≥1 variant** | **Add** (secondary **Discard**) |
| `MarketPicker` | `Modal` | **no confirm button** — `onSelectionChange` → `onSelection(...)` commits immediately on click | — |
| `MarketCondition` (reused for shipping-rate "Specific markets", `resources/condition/MarketCondition.tsx`) | `Modal` | **different component from `MarketPicker` above — has** `primaryAction` | **Select** (`price-list.json#marketSection.modal.selectButtonContent`) |
| `TagPicker` | `Popover` + `Listbox` | commits on click via `onSelectionChange` | — |
| `DatePicker` | `Popover` | commits on date click | — |
| `CustomerPicker`, `ProductPicker` | not pickers | render already-selected values (`SelectedOptionGraph`); no interaction to commit | — |

Two traps this table exists to prevent:

- **The label is not always "Add".** v1 and V2 of the customer-group picker differ (**Select** vs
  **Add**), `RFPicker` says **Continue**, and `ProductPickerV2` switches between **Add** and
  **Select** depending on what it is picking.
- **A confirm button that is `disabled` looks exactly like a missing one.** `ProductPickerV2` and
  `ProductPickerMO` disable it until something is selected, so a click on it times out after the
  full action budget while reporting only that the locator never became stable. Select first, then
  assert the button is enabled, then click.

`setup-dev/bplus-cms/` holds a scaffold copy of these components; the app actually under test is
`b2bridge-cms/`. Read the latter.

**Polaris `TextField`/`Select` with `labelHidden` still exposes the label as the accessible name —
use `getByLabel`, never guess a `placeholder`.** `RateTierTable.tsx` (shipping-rate tiers, BR-52) sets
`label={...} labelHidden` on every column (`From`, `To`, `Amount type`, `Amount`) — visually there is
no label, but Playwright's `getByLabel` still resolves it. The `Amount` column shows its currency
symbol via a Polaris `prefix` prop, **not** a `placeholder` — `input[placeholder="$"]` matches nothing.
Only the `To` column genuinely has a `placeholder` ("No limit", for the open-ended last row). A wrong
guess here was written into a spec straight from a screenshot instead of the component source, and
only failed once the suite actually ran — read the source for any Polaris field before trusting how
it looks on screen. Multiple tier rows share the same label per column, so scope with `.nth(index)`
or a row container, the same trap as the picker confirm buttons above.

**`getByLabel('Amount')` on the Shipping Rate wizard is ambiguous — it also matches the "Rate is
measured by" radio button literally labelled "Amount".** That radio sits earlier in the DOM than the
tier table, so `.first()` silently grabs the radio instead of the currency `TextField`, and an
assertion like `toBeDisabled()` fails with `Received: enabled` while pointing at a `type="radio"`
element — easy to misread as "the lock feature is broken" when it is only the wrong element. Use `getByRole('spinbutton', { name: 'Amount' })` for the tier fields instead — this excludes the
radio (role `radio`) entirely. **Note the role is `spinbutton`, not `textbox`**: a Polaris `TextField`
with `type="number"` renders a native `<input type="number">`, whose implicit ARIA role is
`spinbutton` — `getByRole('textbox', ...)` matches **zero** elements for it. Same rule applies to the
tier table's `From`/`To` columns.

**A short label can be a substring of longer radio labels — use `exact: true`.** The usage-limit
number field is labelled "Limit"; the three radios above it are labelled "No limit", "Limit total
uses across all customers" and "Limit uses per customer". `getByLabel('Limit')` without `exact: true`
matches all four (Playwright's default name matching is substring/normalized, not exact), throwing a
strict-mode violation. Also watch for duplicated field-level error text: Polaris renders the same
validation message both in a top banner (`getByRole('alert')`) and inline under the field — a bare
`getByText('<message>')` after any Continue-triggered validation on this wizard needs `.first()`.

## Environment checks for this project

- API health: `GET <API_BASE_URL>/health/live` (some services also expose `/life-check`).
- `pnpm e2e:doctor` verifies Chrome, config resolution, token signing, login profiles and API reachability in one go.
