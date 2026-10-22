# Tooling

- Prefers DaisyUI (Tailwind CSS component library) for frontend styling. Confidence: 0.6
- Works from concrete reference designs/examples (e.g. pointing at an existing folder or screenshot as the target look) when asking for UI changes. Confidence: 0.7
- Prefers a real Tailwind + DaisyUI build pipeline (CLI build step producing committed CSS) over CDN/browser-compiled Tailwind for production-grade results. Confidence: 0.6
- Uses the "antislop" skill set (github.com/miqdadbadjuber/anti-slop) to keep UI, copy, and code from looking AI-generated. Confidence: 0.6
- Expects restyling/theme work to be purely visual: existing functionality (handlers, filters, i18n) must keep working, and layouts must stay fully responsive. Confidence: 0.6
- Cares about visual polish and expects the agent to actually inspect the rendered UI (real screenshots / browser automation against the running app) to find and confirm design issues, not merely assert that changes are done. Confidence: 0.6
- When pushing, prefers to include everything rather than selectively stage: wants a single "push all" (`git add -A`) covering local config/secrets (settings.json), the SQLite DB, screenshots, and `.commandcode/` (explicit: "push aja semua"). Is fine with the agent flagging security/data-hygiene risks (rotate exposed secrets, DB shows up as ongoing diff) as advice, but does not want files withheld from the push. Also relaxed about leaving local data/binary files untracked — agreed to stop tracking the SQLite DB snapshot (`git rm --cached database/billing.db` + `.gitignore`, "snapshot gak usah gapapa"), treating it as local runtime data rather than something that must live in Git. Confidence: 0.55
- Deploys/self-hosts their Node app via Docker (Easypanel PaaS); wants deployment artifacts (Dockerfile, entrypoint, .dockerignore, volume mapping) prepared so persistent data survives redeploys. Confidence: 0.5
