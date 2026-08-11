# Field-type validation checklist

Use when the feature under test has a form or input fields. **How much to spend on a field depends on the risk of the AC it belongs to** — this checklist is a menu, not a quota.

- **Field belonging to a High-risk AC** (money, permissions, data loss): give that field its own cases, at least **1 positive + 2 negative/boundary**.
- **Field belonging to a Medium or Low AC**: **fold several fields into one case**, taking **one representative boundary row** per field — the row that breaks the business rule most clearly, not the whole group. A single case that fills four fields wrongly and asserts four error messages is correct, not a loophole.

This section used to demand 1+2 for **every** field, and that was one of the multipliers that pushed a recent large feature past a hundred cases. Case count is not a measure of quality; coverage of the High-risk ACs is.

Identify the type of every field on the UI or API payload, then take the matching group below. Only include rows that are meaningful for the feature; record a reason for any row you deliberately skip.

- **Text** — required/optional; min & max length; whitespace only; special characters `<>&"'`; XSS `<script>alert(1)</script>`; SQL injection `' OR 1=1--`; unicode & emoji; leading/trailing whitespace trimming.
- **Email** — valid address; missing `@`; missing domain; malformed domain; multiple `@`; unusual characters before `@`; over-length; case sensitivity; duplicate (when the field must be unique).
- **Phone** — digits only; valid prefix; min & max length; letters mixed in; separators `-` `.` and spaces; invalid area code.
- **Date / DateTime** — wrong format; non-existent date `31/02`; leap day `29/02`; past & future values; min & max bounds; timezone handling.
- **Number / Currency** — min & max; negative; zero; decimals; non-numeric input; overflow; leading zeros; currency formatting.
- **Dropdown / Select** — default value; each option selected; empty option; a value not present in the list (injected via API).
- **Checkbox / Radio** — required selection; left blank; mutually exclusive choices.
- **File upload** — wrong type; over size limit; 0 KB file; unusual characters in filename; multiple files; drag-and-drop versus button.
- **Password** — min & max length; upper/lower/digit/symbol rules; paste blocked or allowed; show/hide toggle; confirmation match.
- **Textarea** — max length; line breaks; HTML tags; character counter accuracy.
- **OTP / MFA** — auto-focus to the next box; pasting the whole code; expiry; retry limit and lockout; resend rate limit.
- **Date range / Time picker** — end before start; conflicting times; exceeding the allowed span (e.g. 30 days); past & future values.
- **Rich text / WYSIWYG** — sanitising `<script>` and `<iframe>`; pasting formatted content and images; character count on raw text versus HTML.
- **Multi-select / Tag input** — tag count limit; duplicate tags; removal via backspace and the X control; tags with unusual characters.
- **Range slider / Stepper** — min & max; step increment violations; manual entry versus dragging.

**Applying this to the plan:** list every field along with the risk of its AC. For a High field, turn each matching checklist row into its own case. For a Medium or Low field, pick one representative row and fold it into a shared case. Record a reason only for a **High** field's row left out — Medium and Low rows are expected to be folded, so they need no per-row justification.
