# API coverage: HTTP status codes + OWASP API security

Use whenever the feature touches an `api` target. Express these as API cases in `cases.yaml` with `expect{status, bodyMatch}`. This project authenticates with a **shop-scoped session JWT**, which makes the BOLA/IDOR and mass-assignment groups especially worth testing.

## HTTP status codes worth covering

Pick the ones that are meaningful for the endpoint.

| Status | Scenario to test |
|---|---|
| 200 / 201 | Happy path: successful read / create. |
| 400 | Malformed or incomplete body, broken JSON, wrong types. |
| 401 | Missing, invalid, or expired token. |
| 403 | Valid token but **no permission, or a different shop** (see BOLA below). |
| 404 | Id does not exist. |
| 406 | `Accept` header cannot be satisfied. |
| 409 | Duplicate create or concurrent-modification conflict. |
| 413 | Payload too large. |
| 415 | Wrong `Content-Type`. |
| 429 | Rate limit exceeded. |
| 500 | Server error (input that breaks parsing or a regex) — must not leak a stack trace. |

## OWASP API checklist

Select per endpoint.

- **BOLA / IDOR** *(high priority for shop-scoped apps)* — use shop A's token to request shop B's resource by changing `id` / `companyId`. Must return 403 or 404 and never expose another shop's data. Test both reads and writes (GET/PUT/DELETE).
- **Mass assignment** — send extra privileged fields that the client must not control (`is_admin: true`, `role: "admin"`, a foreign `shop_id`, `status: "ACTIVATED"`). The server must ignore them: no privilege escalation, no silent activation.
- **Authorisation bypass** — a low-privilege role calling a high-privilege endpoint; a token belonging to a deleted or expired user must be rejected.
- **ReDoS / oversized input** — strings over 10k characters into fields backed by a regex must not hang the request (stay within the response-time budget) and must not return a 500 that leaks internals.
- **Sensitive data exposure** — responses must not contain passwords, hashes, secrets, internal ids, or stack traces; headers must not advertise detailed `X-Powered-By` / `Server` values.
- **Rate limiting** — rapid repeated calls (login, invitations) must yield 429 or a brute-force lockout.

## Conventions for API cases

- **Dynamic tokens** — never hard-code a token; obtain it through the target's auth strategy (the runner signs the session JWT itself).
- **Cleanup** — a case that creates data (POST) should either clean up afterwards (DELETE) or be marked as mutating and left manual when it would pollute a shared store.
- **PUT versus PATCH** — verify the correct semantics (full replacement versus partial update) when the endpoint distinguishes them.
