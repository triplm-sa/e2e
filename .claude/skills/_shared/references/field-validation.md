# Field-type validation checklist

Use when the feature under test has a form or input fields. Give **each field its own cases** — never merge several fields into one case. Minimum per field: **1 positive + at least 2 negative/boundary** cases.

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

**Applying this to the plan:** in the invalid-input group, list every field, pick the matching checklist rows, and turn each row into one case with its own id. Record a reason for every row intentionally left out.
