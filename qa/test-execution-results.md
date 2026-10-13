# Test Execution Results: Due Date UI (KAN-109)

- **PR:** https://github.com/SoumyaRathi/ToDo-Application/pull/8
- **Jira:** KAN-109 (Epic), KAN-110 (Story), KAN-111 (Story)
- **Branch:** `feature/KAN-109-due-date-ui` (target `master`)
- **Tested commit SHA:** `07e847ae3433cb265010c42950a1c3261bff8b2f` (`git rev-parse HEAD` at the time of the final run; no source or test files were uncommitted; the only modified tracked files were the pre-existing local data files `todos.json`, `users.json`, `sessions.json`, which the tests back up and restore; this report was added in the next commit)

## Environment

| Item | Value |
|---|---|
| OS | Microsoft Windows 11 Enterprise 10.0.26200 |
| Node | v24.21.0 |
| npm | 11.19.0 |
| Jest / supertest | 30.5.2 / 6.3.3 |
| Playwright (`@playwright/test`) | 1.64.0 |
| Chromium | 156.0.8078.4 (Playwright project `chromium`) |
| Server | `npm run start:server` (`node todoServer.js`) on http://localhost:3000, started and stopped by Playwright `webServer`; API tests import the exported express `app` via supertest (no port) |

## Commands executed

```
git status ; git rev-parse HEAD
node -v ; npm -v ; npx playwright --version
npm install
npx playwright install chromium            # --with-deps is Linux-only; browser was already installed (no-op)
npm run test:api -- --verbose --json --outputFile=<tmp>/api.json
npm run test:e2e                            # = playwright test --project=chromium (json reporter -> test-results/kan-109-e2e-results.json)
```

Diagnostics run while investigating the Run 1 failure (not counted in the results below):
`npx playwright test --project=chromium --repeat-each=3` and `--repeat-each=5`.

## Results summary (final run, commit `07e847a`)

| Suite | Total | Passed | Failed | Blocked | Skipped |
|---|---|---|---|---|---|
| API (Jest + supertest) | 10 | 10 | 0 | 0 | 0 |
| E2E (Playwright, Chromium) | 10 | 10 | 0 | 0 | 0 |
| **Total** | **20** | **20** | **0** | **0** | **0** |

Playwright reported `expected: 10, unexpected: 0, flaky: 0, skipped: 0` (34.6 s). Jest: `Tests: 10 passed, 10 total` (1.1 s).

## Run history (all runs, including the failure)

| Run | Commit | API | E2E | Notes |
|---|---|---|---|---|
| Dry runs while authoring | uncommitted | 10/10 | 10/10 | One E2E dry run, before committing |
| **Run 1 (first official run)** | `cc3a48b` | 10/10 | **9/10, 1 failed** | E2E-01 failed (details below) |
| Diagnostic A | `cc3a48b` | n/a | 29/30 (`--repeat-each=3`) | E2E-01 failed again, same symptom |
| Diagnostic B | `cc3a48b` + todo-modal wait only | n/a | 49/50 (`--repeat-each=5`) | E2E-01 failed in the `beforeEach` login step (password typed into the email field) |
| Diagnostic C | `cc3a48b` + todo-modal and auth-modal waits | n/a | 50/50 (`--repeat-each=5`) | No failures |
| **Final run** | `07e847a` | **10/10** | **10/10** | All green |

### Run 1 failure: E2E-01, root cause and fix

- **Symptom:** the created card's title was `e2e-with-due2030-12-31` and it had no due line, so `.todoDueDate` was never found (`element(s) not found`).
- **Root cause (test-side race, not a due-date defect):** the app focuses a field with `setTimeout(..., 100)` after opening a modal (`openCreateModal`, `openEditModal`, `showAuthModal`). Playwright's `fill()` focuses a field and then inserts text; when that 100 ms timer fires in between, focus jumps back and the text is typed into the wrong field (due date into the title; later, password into the email field). It showed up in the first test of each pass because that test is the slowest (about 8 s vs about 2.5 s).
- **Fix (commit `07e847a`, test code only):** wait for the autofocus to land (`toBeFocused()`) before typing in the auth modal and the todo modal. No application code was changed for this.
- **Evidence:** `qa/kan-109-evidence/run1-E2E-01-failure.png`, `qa/kan-109-evidence/run1-E2E-01-error-context.md`, `qa/kan-109-evidence/run1-e2e-output.txt`. Video and trace from that run were not kept in git (about 4 MB); the artifacts of the later Diagnostic B failure were overwritten by subsequent runs.
- The final run has no failures, so it produced no failure artifacts (`screenshot: only-on-failure`, `video`/`trace`: `retain-on-failure`, output in `test-results/kan-109/`).

## Test results (final run)

| # | ID | Test | Jira scope | Status |
|---|---|---|---|---|
| 1 | API-01 | POST /todos with dueDate 2030-12-31 returns 201 and echoes dueDate | KAN-110 S1 | Passed |
| 2 | API-02 | POST /todos without dueDate returns 201 and no dueDate property | KAN-110 S2 | Passed |
| 3 | API-03 | POST /todos with dueDate 12/31/2030 returns 400 with field dueDate | KAN-110 S3 (server side) | Passed |
| 4 | API-04 | GET /todos/:id returns the dueDate of a created todo | KAN-110 S4 / KAN-111 S1 | Passed |
| 5 | API-05 | PUT /todos/:id with dueDate null returns 200 and removes dueDate | KAN-110 S5 | Passed |
| 6 | API-06 | GET /todos?sort=dueDate lists dated todos ascending, undated last | KAN-111 S6 | Passed |
| 7 | API-07 | GET /todos without Authorization returns 401 | Auth guard | Passed |
| 8 | API-08 | GET /todos includes a todo with dueDate after creation | KAN-111 S1 | Passed |
| 9 | API-09 | past, today and future dueDates are all stored and returned by GET /todos | KAN-111 S2-S4 (data) | Passed |
| 10 | API-10 | PUT /todos/:id with invalid dueDate returns 400 with field dueDate | KAN-110 S3 (server side) | Passed |
| 11 | E2E-01 | create with due date 2030-12-31 shows "Due: 2030-12-31" on the card | KAN-110 S1 / KAN-111 S1 | Passed |
| 12 | E2E-02 | create with empty due date renders no due line | KAN-110 S2 | Passed |
| 13 | E2E-03 | invalid due date 12/31/2030 shows inline error, sends no request, adds no todo | KAN-110 S3 | Passed |
| 14 | E2E-04 | edit modal pre-populates the existing due date | KAN-110 S4 | Passed |
| 15 | E2E-05 | clearing the due date on edit removes the due line | KAN-110 S5 | Passed |
| 16 | E2E-06 | past due date on an active todo shows the Overdue badge | KAN-111 S2 | Passed |
| 17 | E2E-07 | today as due date shows the Due today badge | KAN-111 S3 | Passed |
| 18 | E2E-08 | future due date shows the Upcoming badge | KAN-111 S4 | Passed |
| 19 | E2E-09 | todo without a due date shows no badge and no due line | KAN-111 S5 | Passed |
| 20 | E2E-10 | selecting "Due date" sort requests GET /todos?sort=dueDate and orders by due date | KAN-111 S6 | Passed |

## Isolation and side effects

- The app persists to `todos.json`, `users.json`, `sessions.json` in the repo root. Both suites back these up before running and restore them afterwards (`test/api/testUtils.js`); API tests also reset them to empty fixtures before each test. After the final run no `kan109` users remained in `users.json`.
- The E2E suite uses `reuseExistingServer: false`, so port 3000 must be free (stop any `npm start` dev server first). Playwright stops the server it starts; port 3000 was confirmed free afterwards.
- `todoServer.js` was changed minimally for testability (`module.exports = app;` and `app.listen` only when run directly). `node todoServer.js` behaves as before.

## Coverage gaps and observations

- **PUT payload shape is not asserted in E2E.** The "omit `dueDate` unless changed, send `null` when cleared" behaviour (review blocker 2) is verified manually and in a headless-browser check earlier in this PR, but no automated test asserts the PUT request body. E2E-05 covers the user-visible effect and API-05 covers the server side.
- **Impossible calendar dates are not covered.** The UI regex accepts well-formed but impossible dates such as `2030-13-45`; the backend rejects them with 400 and the UI then closes the modal without an error message. No test exercises this; it is a known open item from the PR re-review.
- **"Today" is the UTC date** in both the app and the tests (`toISOString().slice(0,10)`), so E2E-06/07/08 are consistent with each other, but they are not a check against the user's local date.
- Tests were not mutation-checked against deliberately broken code.

## QA recommendation

All 20 automated tests (10 API, 10 E2E) pass on commit `07e847a`, and every KAN-110 and KAN-111 scenario has at least one passing automated test. The one failure seen along the way (Run 1, E2E-01) was traced to a test-side focus race, fixed in test code only, and then passed 50/50 repeated executions plus the final run. Recommendation: **ready for Release and Deployment sign-off**, with the two coverage gaps above (PUT body assertion, impossible calendar dates) noted as accepted risks or follow-up items.
