# Quality gate

Two checkpoints: section A runs **before presenting the plan** for approval; section B runs **before treating a spec as finished**. Sections C and D are the coding rules the spec must obey.

## A. Self-quality gate for the PLAN

1. **Unique ids** — one short, stable id per case, identical across plan, yaml, spec and report.
2. **One step ↔ one expectation** — every action has exactly one concrete expected result. No vague wording ("displays correctly"), no case that merely opens a page.
3. **Concrete test data** — state real values (email, amount, company name). Never write "a valid value".
4. **Dimensional coverage, weighted by risk** — the gate is not "one case per cell", it is "no High-risk cell left empty":
   - **Every enum value** must appear in at least one case, but **several enum values may be covered by the same case** when they do not interact.
   - **Pages where the feature must not apply**: one negative case for the whole group of such pages, not one case per page.
   - **Runtime state** (guest/logged-in, on/off): a case per state only when the state changes the business outcome; otherwise fold them together.
   - **Input fields**: follow `field-validation.md` — 1+2 for a field on a High-risk AC, one representative boundary row folded into a shared case for Medium and Low.
   - Record a reason for a **High** cell left empty. Medium and Low cells being folded is expected and needs no per-cell justification.
5. **Risk rating** — every case is tagged High / Medium / Low, and high-risk cases are written and run first. High = money, permissions, or data loss; Medium = core business logic; Low = secondary or cosmetic.

## B. Definition of done for the SPEC

- **Traceability** — every business assertion carries `// AC: <quote from ticket>`.
- **Preconditions separated** — platform and element checks use a message prefixed `[NEEDS-SELECTOR-REVIEW]`; business assertions never carry that prefix.
- **Strict assertions** — verify concrete values and computations, not merely that an element exists.
- **Selectors traceable and unweakened** — every selector in the spec appears verbatim in a `recon.md` row carrying a `Đã xác minh` verdict. None was invented while writing the spec, and none was rewritten into a weaker form than the row it came from (a probed `getByLabel` must not reach the spec as a `getByText`). A selector that has to change is re-probed and the table updated, never changed in the spec alone.
- **Picker interactions confirmed, not assumed** — every step that selects from a picker, modal or popover traces to a confirmed commit mechanism (a `recon.md` row naming the confirm button, an entry under **UI interaction patterns** in `project-notes.md`, or the component source). Where an explicit confirm exists, the spec clicks it and asserts it was **enabled** first. No step reads "click the item and continue" on the assumption that the control self-commits — that assumption fails on a *later* business assertion and is then misread as a product defect.
- **Anchored locators** — no `getByText` scanning the whole page. Every text lookup is scoped to a container (`getByRole('alert')`, a form region, a specific table). An unanchored text lookup matches whatever else the page happens to say and fails as a strict-mode violation only at run time.
- **Clean** — no leftover debug logging, no dead selectors, no hard-coded credentials or sensitive data.
- **Stable** — trust an automated case only after it **passes twice in a row**; if it flickers, see `flaky-taxonomy.md`.
- **Independent** — no reliance on the order of other tests. Cases that mutate real data are marked and isolated.
- **Parallel-ready — a condition that must not be violated.** No `test()` may sit outside a `test.describe` carrying an explicit `configure({ mode: "parallel" })` or `configure({ mode: "serial" })`. Playwright parallelises **at file level** only; a task has a single spec file, so a spec with no describe group runs on **one worker** regardless of `workers: 4` in `playwright.config.ts`. This has been measured, not assumed: specs written without any describe group ran on one worker and took 341s for 19 tests and 501s for 28 tests, while a spec split into four groups ran on four workers and took 318s for 68 tests.

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
