# QA Test Execution Report

**PR:** https://github.com/SoumyaRathi/ToDo-Application/pull/3 (branch `feature/KAN-67-dnd-ordering`)
**Scope:** Jira KAN-68 (per-user ordering API) and KAN-69 (drag-and-drop reorder UI)
**Executed:** 2026-10-07, local Windows 11 machine

## Environment

| Item | Value |
| --- | --- |
| Node / npm | v24.21.0 / 11.19.0 |
| Jest / supertest | 30.5.2 / 6.3.3 |
| Playwright (`@playwright/test`) | 1.63.0, Chromium (headless, `chromium-1243`) |
| App under test | `node todoServer.js` on http://localhost:3000 (started by Playwright `webServer`; API tests import the Express app directly) |
| Data isolation | `todos.json`, `users.json`, `sessions.json` are backed up and restored (per test for API, once per run for E2E). `git status` shows no data-file changes after runs. |

## Commands run

```
npm run test:api     # jest --runInBand
npx playwright install chromium
npm run test:e2e     # playwright test --project=chromium
```

## Summary

| Suite | Total | Passed | Failed | Skipped | Duration |
| --- | --- | --- | --- | --- | --- |
| API (Jest + supertest) | 10 | 10 | 0 | 0 | ~1.0 s |
| E2E (Playwright, Chromium) | 10 | 10 | 0 | 0 | ~12.1 s |
| **Total** | **20** | **20** | **0** | **0** | |

## API results (`__tests__/api/todo-ordering.test.js`)

| ID | Jira | Title | Result | Time |
| --- | --- | --- | --- | --- |
| API-01 | KAN-68 S1 | migrate assigns order preserving file order | PASS | 69 ms |
| API-02 | KAN-68 S1 | migration per-user isolation | PASS | 43 ms |
| API-03 | KAN-68 S2 | GET /todos sorted by order when sort is empty string | PASS | 22 ms |
| API-04 | KAN-68 S2 | GET /todos default ordering by order asc | PASS | 42 ms |
| API-05 | KAN-68 S3 | bulk reorder persists for subsequent reads | PASS | 37 ms |
| API-06 | KAN-68 S3 | reorder updates todos.json order fields 1..N | PASS | 46 ms |
| API-07 | KAN-68 S4 | reorder rejects unknown/unowned id and does not change order | PASS | 48 ms |
| API-08 | KAN-68 S4 | reorder rejects length mismatch and does not change order | PASS | 32 ms |
| API-09 | KAN-68 S5 | idempotent reorder returns OK with "Order unchanged." | PASS | 36 ms |
| API-10 | KAN-68 S5 | idempotent reorder does not modify stored order values | PASS | 30 ms |

## E2E results (`e2e/todo-reorder.spec.js`)

| ID | Jira | Title | Result | Time |
| --- | --- | --- | --- | --- |
| E2E-01 | KAN-69 S1 | drag 3rd card to 1st updates visual order | PASS | 689 ms |
| E2E-02 | KAN-69 S2 | drop triggers PUT /todos/reorder with orderedIds matching DOM | PASS | 535 ms |
| E2E-03 | KAN-69 S3 | order persists after page refresh | PASS | 812 ms |
| E2E-04 | KAN-69 S4 | with 1 todo, not draggable and no reorder request | PASS | 2.0 s |
| E2E-05 | KAN-69 S4 | with 0 todos, empty state and no reorder request | PASS | 1.4 s |
| E2E-06 | KAN-69 S5 | non-OK reorder: client re-fetches and restores server order | PASS | 913 ms |
| E2E-07 | KAN-69 S1 | dragover adds .is-dragover to target | PASS | 856 ms |
| E2E-08 | KAN-69 S2 | orderedIds are numbers | PASS | 787 ms |
| E2E-09 | KAN-69 S3 | order stable after switching sort away and back to manual, then refresh | PASS | 1.1 s |
| E2E-10 | KAN-69 S4 | search disables reorder (no draggable / no reorder request) | PASS | 1.4 s |

## Test-sensitivity check (mutation run)

To confirm the tests can fail, the app was temporarily broken and then reverted (the final results above are from the unmodified code):

| Temporary change | Observed result |
| --- | --- |
| Server: reorder ownership check removed and message changed from "Order unchanged." | API: 2 failed / 8 passed (API-07 and API-09 failed as expected) |
| Client: drag enabled whenever there are 2+ todos (filter/search/sort conditions ignored) | E2E: 1 failed / 9 passed (E2E-10 failed as expected) |

## Evidence

Committed screenshots (taken by Playwright at the end of the test):

- `qa/evidence/E2E-01-after-drag.png`
- `qa/evidence/E2E-06-restored-after-non-ok.png`
- `qa/evidence/E2E-07-dragover.png`

Local, git-ignored artifacts after a run: `test-results/` (screenshot per test, `e2e-results.json`, video/trace for failures) and `playwright-report/` (HTML report).

## Notes and limitations

- **Drag is simulated.** The helper dispatches `dragstart`, `dragenter`, `dragover`, `drop` and `dragend` with a real `DataTransfer`, which exercises the app's handlers but not the browser's native drag gesture. E2E-04 and E2E-10 additionally attempt a real mouse drag to confirm nothing is sent when dragging is disabled.
- **E2E-06 stubs the server response.** `PUT /todos/reorder` is intercepted and answered with 400; the "server order" is then verified against the real `GET /todos`.
- **Google Fonts/Material Icons are blocked** in E2E to avoid network dependence, so icon glyphs show as text in the screenshots (for example "check_circle"). This does not affect behavior.
- **Negative assertions** (no reorder request) wait 500 ms before asserting.
- `npm run start` uses nodemon, which restarts on `.json` changes. Playwright therefore starts the server with `node todoServer.js`; if a server is already on port 3000 it is reused.
- Not covered: KAN-68 and KAN-69 behavior outside the listed scenarios, cross-browser runs, and any native-drag or touch behavior.
