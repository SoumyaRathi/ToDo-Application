# QA Test Execution Report — KAN-88 Todo Due Date UI

## References
- PR: https://github.com/SoumyaRathi/ToDo-Application/pull/5
- Epic: KAN-88 https://soumyarathi57.atlassian.net/browse/KAN-88
- Story: KAN-89 (due date create/edit/validation) https://soumyarathi57.atlassian.net/browse/KAN-89
- Story: KAN-90 (due date display/sorting) https://soumyarathi57.atlassian.net/browse/KAN-90
- Branch: `feature/KAN-88-due-date-ui`
- Tested commit SHA (application code under test): `55d8655` — "KAN-88 Consolidate modal click handler and remove duplicate fetchAndRenderTodos". The commit that adds these tests sits on top of it and changes no production files.

## Environment
- OS: Windows 11 Enterprise 10.0.26200
- Node.js v24.21.0, npm 11.19.0
- Jest 30.5.2, supertest 6.3.3
- Playwright 1.63.0, Chromium (Desktop Chrome profile, headless)
- App: `node todoServer.js` on http://localhost:3000 (repo's `npm start` uses nodemon, which would restart the server on every JSON write during tests, so plain `node` is used)
- Data notes:
  - Tests write to the real `todos.json`/`users.json`/`sessions.json`. `qa/support/data.js` snapshots them before each suite and restores them after; `git status` showed these files clean after every run.
  - Every test signs up its own unique user, so tests share no data and do not depend on execution order. The signup "Welcome" todo is undated.
  - E2E blocks Google Fonts requests so runs do not depend on the network; Material Icons therefore render as text in screenshots.
  - No production file was modified. `todoServer.js` does not export `app`, so the Jest global setup starts the real server and supertest targets it by URL (`request('http://localhost:3000')`).

## Commands actually executed
```bash
# API (10 tests)
npx jest --runInBand --config qa/jest.config.js --verbose --json --outputFile=qa/evidence/due-date/api-results.json

# E2E (10 tests)
npx playwright test --config qa/playwright.config.js --project=chromium
```
Why `--config` instead of bare `npx jest --runInBand` / `npx playwright test --project=chromium`: the repo's root `jest.config.js` only matches `__tests__/api/**` (older KAN-74 priority tests that `require('../../todoServer')` as a module, which this branch does not export) and the root `playwright.config.js` uses `testDir: ./e2e`. Rather than change that existing configuration, dedicated configs were added under `qa/`. There is no `npm test` script in `package.json`.

## Results summary
| Suite | Total | Passed | Failed | Blocked | Skipped |
|---|---:|---:|---:|---:|---:|
| API (Jest + supertest) | 10 | 10 | 0 | 0 | 0 |
| E2E (Playwright, Chromium) | 10 | 10 | 0 | 0 | 0 |
| **Total** | **20** | **20** | **0** | **0** | **0** |

Jest: 1 suite, 10 tests passed, ~1.1 s. Playwright: 10 passed, 0 flaky, ~17 s.

Acceptance-criteria scenario labels (S1-S5) follow the scenario order in the KAN-89 / KAN-90 Jira stories: KAN-89 S1 POST includes dueDate when set, S2 POST omits it when empty, S3 PUT adds it, S4 PUT clears it, S5 invalid format blocked with a validation message; KAN-90 S1 card shows the date, S2 card omits it when absent, S3 choosing the sort sends `GET /todos?sort=dueDate`, S4 earliest first, S5 mixed dated/undated.

## API results (`qa/api/due-date.api.test.js`)
| ID | Maps to | Test | Result |
|---|---|---|---|
| TC-API-01 | KAN-89 S1 | POST with a valid `dueDate` (`2026-10-31`) returns 201 and the same `dueDate` | PASS |
| TC-API-02 | KAN-89 S2 | POST without `dueDate`: response, `todos.json` and `GET /todos/:id` have no `dueDate` key (no placeholder) | PASS |
| TC-API-03 | KAN-89 S3 | PUT adds `dueDate` `2026-11-01` to an existing undated todo; response and `todos.json` show it | PASS |
| TC-API-04 | KAN-89 S4 | PUT with `dueDate: ''` clears it (key removed from response and file); a re-added date is also cleared by `dueDate: null` | PASS |
| TC-API-05 | KAN-89 S1/S3 | Stored `dueDate` `2026-01-01` is identical (no timezone shift) in `GET /todos/:id`, `GET /todos` and `todos.json`, and is kept when a later PUT omits the field | PASS |
| TC-API-06 | KAN-90 S3 | `GET /todos?sort=dueDate` returns 200 and an array with the same todos as the unsorted list | PASS |
| TC-API-07 | KAN-90 S4 | Three todos created Dec/Oct/Nov come back Oct, Nov, Dec | PASS |
| TC-API-08 | KAN-90 S5 | Dated todos first (ascending), undated todos after and without a `dueDate` key | PASS |
| TC-API-09 | KAN-90 S3/S5 | `sort=dueDate` combined with `filter=active`/`completed` and `search=alpha` returns the right subsets in the right order | PASS |
| TC-API-10 | KAN-89 S2 / KAN-90 S2 | Never-dated and cleared todos have no `dueDate` key in unsorted and sorted lists; any `dueDate` present matches `YYYY-MM-DD`; payload contains no `Invalid Date`, `undefined`, `"dueDate":null` or `"dueDate":""` | PASS |

## E2E results (`qa/e2e/due-date.spec.js`)
| ID | Maps to | Test | Result |
|---|---|---|---|
| TC-E2E-01 | KAN-89 S1 | Create with `2026-10-31` via the modal: POST payload has `dueDate`, card shows `Due: 2026-10-31` | PASS |
| TC-E2E-02 | KAN-89 S2 / KAN-90 S2 | Create without a date: POST payload has no `dueDate`, card has no due element and no "Due" text | PASS |
| TC-E2E-03 | KAN-89 S3 | Edit an undated todo, enter `2026-11-01`: PUT payload has it, card shows `Due: 2026-11-01` | PASS |
| TC-E2E-04 | KAN-89 S4 | Edit a dated todo (field prefilled), clear it: PUT payload `dueDate` is `''`, due line disappears | PASS |
| TC-E2E-05 | KAN-89 S5 | Typing `10/31/2026` and `2026-1-1`: inline `#todoDueDate-error` shown (mentions `YYYY-MM-DD`), modal stays open, no POST/PUT sent, no card created | PASS |
| TC-E2E-06 | KAN-90 S1 | Cards seeded with `2026-01-01` and `2026-12-31` show exactly `Due: 2026-01-01` / `Due: 2026-12-31` | PASS |
| TC-E2E-07 | KAN-90 S2 | Seeded undated card has no `.todo-due-date`, no "Due" text; no due elements on the page | PASS |
| TC-E2E-08 | KAN-90 S3 | The "Sort by Due date" option exists; selecting it makes a GET `/todos?...sort=dueDate` that returns 200 | PASS |
| TC-E2E-09 | KAN-90 S4 | Todos seeded Oct 15 then Oct 1 display Oct 1 first after sorting | PASS |
| TC-E2E-10 | KAN-90 S5 | Mixed todos display early, late, undated; exactly 2 due lines; no `Invalid Date`/`undefined`/`NaN`/`Due: null` text; no page or console errors | PASS |

## Defects / issues found
No defects were found in the KAN-88 scope; all 20 tests pass against `55d8655`.

Observations (not defects in scope, no action taken):
1. `todoServer.js` does not export `app`, so the older `__tests__/api/priority.test.js` (KAN-74, untracked, belongs to another branch) cannot run on this branch. It is out of scope and was not run or changed.
2. Test-side race (fixed in the tests, not the app): the modal focuses the title field 100 ms after opening, which can swallow text typed immediately. The E2E tests wait for `#edit-title` to be focused before typing.
3. API validation of malformed `dueDate` values (the server's 400 response) was not among the 10 requested API tests and is not covered here; invalid-format behavior is covered only through the UI (TC-E2E-05).
4. The pre-existing KAN-74 report that was at `qa/test-execution-report.md` was renamed to `qa/priority-KAN-74-test-execution-report.md` (untracked, content unchanged) so it was not overwritten.

Test-effectiveness check: as a one-off, the card label in `public/script.js` was temporarily changed from `Due:` to `Dxx:` (then restored with `git checkout`). The E2E suite then failed TC-E2E-01, 03, 04, 06 and 10, confirming the display assertions detect regressions.

## Evidence
- `qa/evidence/due-date/api-results.json` — Jest JSON results
- `qa/evidence/due-date/e2e-results.json` — Playwright JSON results
- `qa/evidence/due-date/TC-E2E-01…10-*.png` — one named screenshot per E2E test
- Test source: `qa/api/due-date.api.test.js`, `qa/e2e/due-date.spec.js`; configs `qa/jest.config.js`, `qa/playwright.config.js`; shared data backup helper `qa/support/data.js`

## Final QA recommendation
**Pass — recommend approval of PR #5 from a QA standpoint.** All 20 automated tests (10 API, 10 E2E) covering KAN-89 and KAN-90 acceptance criteria passed on `55d8655` with no failures, blocked or skipped tests, and the data files were left unchanged. Residual risk: only Chromium was exercised, and the server-side 400 on a malformed `dueDate` is not covered by an automated test.
