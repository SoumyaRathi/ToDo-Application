# QA Test Execution Results – Due Date UI (KAN-116 / KAN-117 / KAN-118)

- **PR:** https://github.com/SoumyaRathi/ToDo-Application/pull/9
- **Branch:** `feature/due-date-ui` (base `master`)
- **Jira:** KAN-116 (Epic) https://soumyarathi57.atlassian.net/browse/KAN-116 · KAN-117 (Story) https://soumyarathi57.atlassian.net/browse/KAN-117 · KAN-118 (Story) https://soumyarathi57.atlassian.net/browse/KAN-118
- **Tested commit SHA:** `ba431271af716ecff72d0b827f4fdfcc63740b5a` (`git rev-parse HEAD`, working tree clean for tracked source files at run time; the only modified files were the pre-existing uncommitted `sessions.json`, `todos.json`, `users.json`, which the tests snapshot and restore)
- **Executed:** 2026-10-22

## Environment

| Item | Value |
|---|---|
| OS | Windows 11 Enterprise 10.0.26200 |
| Node | v24.21.0 |
| npm | 11.19.0 |
| Jest | 30.5.2 (+ supertest ^6.3.3) |
| Playwright (`@playwright/test`) | 1.64.1 |
| Browser | Chromium 156.0.8078.4 (headless, project `chromium`) |
| App server (E2E) | `node todoServer.js` on http://localhost:3000, started by Playwright `webServer` (not nodemon) |

## Commands executed (final recorded run, in order)

| # | Command | Exit code |
|---|---|---|
| 1 | `npm install` | 0 |
| 2 | `npx playwright install chromium` | 0 (already installed, nothing to download) |
| 3 | `npm run test:api` (run with `-- --json --outputFile=...` to capture per-test data) | 0 |
| 4 | `npm run test:e2e` | 0 |

## Results summary

| Suite | Total | Passed | Failed | Blocked | Skipped |
|---|---|---|---|---|---|
| API (Jest + supertest) | 10 | 10 | 0 | 0 | 0 |
| E2E (Playwright + Chromium) | 10 | 10 | 0 | 0 | 0 |
| **Overall** | **20** | **20** | **0** | **0** | **0** |

Raw output: API `Tests: 10 passed, 10 total` (0.957 s); E2E `10 passed (29.3s)`.

## Per-test status

### API – `__tests__/api/dueDate.api.test.js`

| ID | Story / Scenario | Status | Time |
|---|---|---|---|
| API-01 | KAN-117 S1 – POST with dueDate returns 201, persists in GET /todos/:id | PASS | 19 ms |
| API-02 | KAN-117 S2 – POST without dueDate returns 201, no dueDate | PASS | 14 ms |
| API-03 | KAN-117 S6 – dueDate `2026/10/22` → 400, `field=dueDate` | PASS | 5 ms |
| API-04 | KAN-117 S6 – dueDate `2026-02-30` → 400, `field=dueDate` | PASS | 5 ms |
| API-05 | KAN-117 S3 – created dueDate returned unchanged by GET | PASS | 13 ms |
| API-06 | KAN-117 S4 – PUT updates dueDate, persists | PASS | 16 ms |
| API-07 | KAN-117 S5 – PUT `dueDate: null` clears | PASS | 15 ms |
| API-08 | KAN-117 S5 – PUT `dueDate: ""` clears | PASS | 16 ms |
| API-09 | KAN-118 S6 – `sort=dueDate`: dated before undated, all items returned | PASS | 27 ms |
| API-10 | KAN-118 S4 – `sort=dueDate`: dated items ascending | PASS | 21 ms |

### E2E – `e2e/dueDate.spec.js`

| ID | Story / Scenario | Status | Time |
|---|---|---|---|
| E2E-01 | KAN-117 S1 – create with due date → card shows `Due:` line | PASS | 1.6 s |
| E2E-02 | KAN-117 S2 – create without due date → card omits due line | PASS | 1.9 s |
| E2E-03 | KAN-117 S3 – edit modal pre-populates due date | PASS | 2.7 s |
| E2E-04 | KAN-117 S4 – update due date → card shows new date | PASS | 3.1 s |
| E2E-05 | KAN-117 S5 – Clear button removes due date; still gone after reload | PASS | 3.8 s |
| E2E-06 | KAN-117 S6 – invalid value → `#dueDate-error` visible, no POST/PUT sent | PASS | 2.3 s |
| E2E-07 | KAN-118 S1 – due date visible when present (also after reload) | PASS | 1.8 s |
| E2E-08 | KAN-118 S2 – dated card shows line, undated card omits it | PASS | 2.3 s |
| E2E-09 | KAN-118 S3 – selecting Sort by Due Date sends GET `/todos?...sort=dueDate` | PASS | 0.9 s |
| E2E-10 | KAN-118 S6 – mixed presence sorted by due date, `#todo-error` hidden, all items present, order early → late → none | PASS | 3.0 s |

## Failures and flakiness history (disclosed)

No test failed in the final recorded run. Earlier in the same session:

1. **First E2E development run – 1 failed / 9 did not run (E2E-01).** `addTodo()` filled `#edit-desc` and the text landed in `#edit-title`. The app's `openCreateModal()` calls `setTimeout(() => #edit-title.focus(), 100)`, which steals focus mid-`fill()`; native `required` validation then blocked the submit. Fixed in the spec by waiting for `#edit-title` to be focused (commit `3beba05`).
2. **First recorded run against `3beba05` – `npm run test:e2e` exit 1 (1 failed / 9 did not run).** The failure was in the suite's `beforeAll` UI signup, not in the due date feature: `expect(#auth-error).toContainText('Signup successful')` received `""`. Same root cause class: `showAuthModal()` focuses its first field after 100 ms and interrupted `fill()`. Fixed by waiting for `#auth-name` / `#auth-email` to be focused (commit `ba43127`). After the fix the E2E suite was run 5 consecutive times, 10/10 passed each time (27.2 s, 24.8 s, 25.3 s, 25.9 s, 28.2 s), and then once more as the final recorded run above.
   - The screenshot/video/trace artifacts from those two failed runs were overwritten by later runs (Playwright clears its `outputDir`). On a passing run no artifacts are produced (`screenshot`/`video`/`trace` are retain-on-failure), so none are attached for the final run.

Both root causes are test-timing issues against the app's delayed-focus behaviour; no application defect was found. The delayed `focus()` can also interrupt a very fast human or automated typist, which may be worth a follow-up outside this PR's scope.

## Notes and deviations

- `todoServer.js` was changed minimally to be importable by supertest: `app.listen` is wrapped in `if (require.main === module)` and `module.exports = app;` is added. Launch via `node todoServer.js` / `npm start` is unchanged (the Playwright `webServer` uses `node todoServer.js` and works).
- The brief asked for the `playwright` devDependency; `@playwright/test` was added instead, because it provides the `playwright test` runner and the `require('@playwright/test')` API (it is also what the repo's existing `qa/playwright.config.js` uses).
- Configs target only the new spec files (`jest.config.js` → `__tests__/api/dueDate.api.test.js`; `playwright.config.js` → `e2e/dueDate.spec.js`) so unrelated, untracked suites in the working tree (`priority.*`, `qa/api`, `qa/e2e`) are not run.
- Data isolation: `test-support/data-backup.js` snapshots `todos.json`, `users.json`, `sessions.json` before each suite and restores them afterwards (removing a file that did not exist before). Verified after every run that the three files are byte-identical to their pre-run state.
- Each suite creates its own unique user (timestamp email) via real signup/login.
- Test counts are exactly 10 + 10 = 20.

## QA recommendation

**Pass / ready for approval from a test perspective.** All 20 acceptance-mapped tests pass against commit `ba43127` (KAN-117 scenarios S1–S6 and KAN-118 scenarios S1–S4, S6 are covered; KAN-118 S5 "clearing updates card display" is covered by E2E-05; KAN-118 S2 and S3 by E2E-08/09). No open defects were found. Residual risk: the suites exercise a single user and Chromium only; invalid-date handling in the browser is tested by forcing a text value into the date input, since a real date picker cannot produce one.
