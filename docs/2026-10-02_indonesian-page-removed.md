# Indonesian version of the presale site removed

2 October 2026

- Removed: `id.html` (repository root)
- SHA-256 of the removed file: `16e012b750c3d1a1529cb7d3799d136e03cd3a92a9104a5d2a83ebe57924875e`

The owner has dropped the Indonesian angle. The page was removed on the
owner's decision of 2 October 2026.

From the deployment of this change `/id.html` returns 404. There is no
redirect. No other page linked to it.

The two references to the page in `main.js` and `web3.js` were removed.

`sitemap.xml` listed five dead URLs (`/presale`, `/tokenomics`, `/roadmap`,
`/faq` and `/contact`), all returning 404. They were removed; this closes
follow-up (d) in `2026-10-01_information-document.md`.

`set-phase.html` (owner admin page for the presale contract) is excluded
from deployment via `.vercelignore` from this change; it remains in the
repository for local use. Protection of the admin functions rests on the
contract's owner check, confirmed by simulation on 2 Oct 2026: at Base
block 52069903, `toggleSale`, `forcePhaseChange` and `setPurchaseLimits`
each revert with "Not the owner" for a non-owner caller.
