# Failure taxonomy

Never jump to "the feature is broken". Classify every failing step into one of four categories, then follow the matching remedy.

| Category | Signals | Remedy |
|---|---|---|
| **Locator / environment** | Message contains `[NEEDS-SELECTOR-REVIEW]`; "element not found / detached"; the iframe or app has not rendered; the run was redirected to a login page. | A **spec or environment** problem — do not report a feature defect. Review the selector (`quality-gate.md` section D) or refresh the login session. |
| **Timing** | Intermittent failure that sometimes passes on re-run; the error occurs around a wait. | Replace any fixed sleep or `waitForTimeout` with a web-first assertion (`quality-gate.md` section C). |
| **Data** | Failure caused by data changed or created by an earlier run; unique-constraint collisions; leftover state. | Use concrete, independent data; mutating cases need cleanup or must be split out as manual. |
| **Feature (genuine)** | Failure in a **business assertion** (no `[NEEDS-SELECTOR-REVIEW]` prefix); a value, text or computation contradicts the AC. | This is a real **feature defect**. Point to the cause as `file:line` and cite the ticket AC. |

**Confirming stability:** re-run any automated case suspected of flakiness and trust it only after it **passes twice in a row**. State the failure category explicitly in the report's analysis section so the tester knows whether to fix the spec or raise a defect with the developer.

**Before choosing the environment category, verify it.** Console output alone never establishes that a tunnel, service or session is down — messages tagged `NOISE` (browser extension, third-party host) say nothing about the application. Run a direct check and quote its output (`curl -o /dev/null -w '%{http_code}' <url>`, `pnpm e2e:doctor`, or a screenshot of the unrendered page) before attributing a failure to infrastructure. If nothing confirms it, classify the failure as unclear and list what was ruled out.
