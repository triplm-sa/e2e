# Non-functional and deep-scenario dimensions

Not every feature needs all of these. Pick the dimensions that carry **real risk** for the feature under test and add them to the plan; mark a dimension as manual when automating it is impractical. Record a reason for anything skipped.

- **Race conditions and double submit** — clicking an action twice in quick succession (approve, save, purchase) must not create duplicates or double-charge; two tabs editing the same record must not silently overwrite each other. *Particularly relevant for any mutating control.*
- **Session and network resilience** — a session or token expiring mid-form must produce a clear message without discarding the user's input; losing connectivity during submit must surface a retry or an error; a slow connection must not hang indefinitely.
- **Localisation, UTF-8 and emoji** — fully accented Vietnamese text, emoji, and CJK/RTL strings must be stored and rendered correctly, without breaking layout or producing mojibake.
- **Keyboard accessibility** — correct tab order; Enter and Space activate buttons and checkboxes; focus is visibly indicated; modals trap focus and close on Escape.
- **Empty, loading and error states** — an empty list shows the correct empty state; loading shows a skeleton or spinner; a failed load shows a message without crashing.
- **Permissions and visibility scope** — a user outside the scope must not see gated controls or sections; navigating directly to a restricted route must redirect or return 403 without leaking data.

**Applying this to the plan:** add a deep-scenario group when relevant, with one case per dimension and a concrete expected result.
