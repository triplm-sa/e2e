# Quality gate

Two checkpoints: section A runs **before presenting the plan** for approval; section B runs **before treating a spec as finished**. Sections C and D are the coding rules the spec must obey.

## A. Self-quality gate for the PLAN

1. **Unique ids** — one short, stable id per case, identical across plan, coverage, yaml, spec and report.
2. **One step ↔ one expectation** — every action has exactly one concrete expected result. No vague wording ("displays correctly"), no case that merely opens a page.
3. **Concrete test data** — state real values (email, amount, company name). Never write "a valid value".
4. **Full dimensional coverage** — at least one case per enum value, per page (including pages where the feature must *not* apply), and per runtime state; at least 1 positive plus 2 negative/boundary cases per input field (see `field-validation.md`). Record a reason for anything skipped.
5. **Risk rating** — every case is tagged High / Medium / Low, and high-risk cases are written and run first. High = money, permissions, or data loss; Medium = core business logic; Low = secondary or cosmetic.

## B. Definition of done for the SPEC

- **Traceability** — every business assertion carries `// AC: <quote from ticket>`.
- **Preconditions separated** — platform and element checks use a message prefixed `[NEEDS-SELECTOR-REVIEW]`; business assertions never carry that prefix.
- **Strict assertions** — verify concrete values and computations, not merely that an element exists.
- **Clean** — no leftover debug logging, no dead selectors, no hard-coded credentials or sensitive data.
- **Stable** — trust an automated case only after it **passes twice in a row**; if it flickers, see `flaky-taxonomy.md`.
- **Independent** — no reliance on the order of other tests. Cases that mutate real data are marked and isolated.

## C. Wait strategy

- Forbidden: `page.waitForTimeout(...)`, hand-rolled `setTimeout`, any fixed sleep.
- Required: Playwright auto-waiting plus web-first assertions — `await expect(locator).toBeVisible() / toHaveText() / toBeEnabled()`, `locator.waitFor()`. Raise a timeout only where genuinely needed (`{ timeout: 10_000 }`).

## D. Locator priority

1. User-visible role, label or text: `getByRole`, `getByLabel`, `getByPlaceholder`, `getByText`.
2. Dedicated test attributes: `getByTestId` (`data-testid`, `data-test`, `data-qa`).
3. Stable `id` or `name`.
4. Semantic CSS.
5. XPath — last resort.

- Forbidden: hashed dynamic class names (`css-1n2xyz`), `nth-child` when a better option exists, absolute positional XPath (`//div[3]/div[2]/...`), auto-generated ids.
- Every locator must match exactly one element, be interactable, and survive a reload and each page state (loading, loaded, empty).
