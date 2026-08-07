# Project notes

> **The only file tied to one particular app.** The rest of `_shared/` holds rules true for any Shopify app.
> When adopting this harness for a different app, replace the contents below and keep the headings —
> the skills read this file for concrete facts they must not guess.

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

## Switchable settings

Switching a setting is a `phase: setup` step, never a reason to skip a case. Restore the original value in `phase: teardown`.

| Setting | How to read / switch |
|---|---|
| **Account type** (`CUSTOMER_GROUP` ↔ `COMPANY_ACCOUNT`) | `GET /general-settings` → `POST /general-settings` with `accountType` |
| Finance report sections, row counts | same endpoint, field `paymentReportSettings` |
| Payment terms, credit limits | company-account routes (`/company-accounts/:id`) |

> ⚠️ **`POST /general-settings` is a full upsert with defaults, not a patch.** Fields you omit are reset — `paymentReportSettings` becomes `null`, `isEnabledOverridePrice` becomes `true`, `isShowWatermark` becomes `false`. Always **read the current settings first, change only the field you need, and post the whole object back**; otherwise a setup step that flips the account type will silently wipe the report configuration other cases depend on.

Because this setting is shop-wide, group the cases that need a given mode together so the switch happens once rather than per case.

## Environment checks for this project

- API health: `GET <API_BASE_URL>/health/live` (some services also expose `/life-check`).
- `pnpm e2e:doctor` verifies Chrome, config resolution, token signing, login profiles and API reachability in one go.
