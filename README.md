# Research Archive: public metadata feed

This repository runs a weekly GitHub Actions job without a personal computer. It collects public listing metadata from AQR, Hana Securities, Mirae Asset Securities, Goldman Sachs, and J.P. Morgan. `data/reports.json` is an append-only catalog of titles, dates, brief public descriptions, and links to publishers. It contains no downloaded PDFs, report full text, bookmarks, notes, credentials, or user identities.

The private [Research Archive](https://research-archive-kr-us-2026.snu-chatgpt-5678.chatgpt.site/) reads this public catalog and stores newly found records in its own cloud database. Reading state remains in that private database. A failed source check keeps prior records; `data/status.json` records the result of every check.

The workflow runs every Monday at 09:17 Asia/Seoul and can also be started from GitHub Actions using **Run workflow**. Each run commits the check status, even when no new reports appear, so the repository remains active. Source layouts and access policies can change; review `data/status.json` and the Actions run when a source shows an error. GitHub may delay or drop a scheduled run during high load, so the status timestamp is the evidence of a completed check.

To run locally for maintenance: `node --test tests/*.test.mjs` and `node scripts/collect.mjs`. The scheduled job itself needs no repository secrets or local PC.

