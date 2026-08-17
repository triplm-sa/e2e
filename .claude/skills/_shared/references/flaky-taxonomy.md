# Failure taxonomy

Never jump to "the feature is broken". Classify every failing step into one of five categories, then follow the matching remedy.

| Category | Signals | Remedy |
|---|---|---|
| **Locator / environment** | Message contains `[NEEDS-SELECTOR-REVIEW]`; "element not found / detached"; the iframe or app has not rendered; the run was redirected to a login page. | A **spec or environment** problem — do not report a feature defect. Review the selector (`quality-gate.md` section D) or refresh the login session. |
| **Timing** | Intermittent failure that sometimes passes on re-run; the error occurs around a wait. | Replace any fixed sleep or `waitForTimeout` with a web-first assertion (`quality-gate.md` section C). |
| **Data** | Failure caused by data changed or created by an earlier run; unique-constraint collisions; leftover state. | Use concrete, independent data; mutating cases need cleanup or must be split out as manual. |
| **Stale expectation** | The case used to pass; the value the app returns now is *plausible* but differs from the literal in the spec; nobody changed the code. The real data behind the expectation moved instead — new records exist, a config was edited, a date threshold was crossed. | Neither a feature defect nor flakiness: the expectation expired, not the feature. Convert the case to the **live-baseline** pattern in `test-oracle.md` so the expectation is recomputed each run. **Do not** simply rewrite the literal to the current number — see the rebaselining ban in `e2e-flaky`; the new number needs its own independent check before it can be trusted. |
| **Feature (genuine)** | Failure in a **business assertion** (no `[NEEDS-SELECTOR-REVIEW]` prefix); a value, text or computation contradicts the AC. | This is a real **feature defect**. Point to the cause as `file:line` and cite the ticket AC. |

**Telling `Stale expectation` apart from `Feature (genuine)`** — both surface as "a value no longer matches". The discriminator is *what* it fails against: recompute the expectation from current inputs using the AC's rule (`analysis.md`'s formula ledger). If the app's value satisfies the rule and only the frozen literal is out of date → `Stale expectation`. If the app's value breaks the rule itself → `Feature (genuine)`, regardless of whether the data also moved. Never resolve this by guessing which is more likely; a `derived` expectation that fails is a defect signal until the recomputation says otherwise.

**Confirming stability:** re-run any automated case suspected of flakiness and trust it only after it **passes twice in a row**. State the failure category explicitly in the report's analysis section so the tester knows whether to fix the spec or raise a defect with the developer.

**Before choosing the environment category, verify it.** Console output alone never establishes that a tunnel, service or session is down — messages tagged `NOISE` (browser extension, third-party host) say nothing about the application. Run a direct check and quote its output (`curl -o /dev/null -w '%{http_code}' <url>`, `pnpm e2e:doctor`, or a screenshot of the unrendered page) before attributing a failure to infrastructure. If nothing confirms it, classify the failure as unclear and list what was ruled out.
