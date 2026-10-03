# Ecosystem & $HVNA Information Document v8.1

3 October 2026

- Filename: `Havana_Elephant_Ecosystem_HVNA_Information_Document_v8.1.pdf` (repository root)
- SHA-256: `84185d6666c855eacf7a568a886a62652d303b37e2e5fe15b5aefde91334f11c`
- Pages: 15

Replaces v8.0 with v8.1 at the four places that linked it:

- `index.html` "Read the Information Document" button and footer "Information Document" link
- `api/email-subscribe.js` purchase confirmation email, HTML and plain-text versions

`Havana_Elephant_Ecosystem_HVNA_Information_Document_v8.0.pdf` remains in the
repository root and continues to be served, because purchase confirmation
emails already sent to buyers carry its absolute URL. If it is ever removed,
add a 308 redirect from the v8.0 path to the v8.1 path in `vercel.json` first.
