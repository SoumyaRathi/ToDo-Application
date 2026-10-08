# Test Execution Results — KAN-95 Due Date UI

- **PR:** https://github.com/SoumyaRathi/ToDo-Application/pull/6
- **Branch:** `feature/KAN-95-due-date-ui`
- **Jira:** Epic KAN-95; Stories KAN-96, KAN-97; Tasks KAN-98, KAN-99, KAN-100, KAN-101
- **Tested commit (application code):** `006ab5d3d800338ba81327ca91e76fb29864bd68`
  (application files `index.html`, `public/script.js`, `public/styles.css`, `todoServer.js` were identical to this commit during the runs; the test files in this report are added on top of it)

## Environment

| Item | Value |
|---|---|
| OS | Microsoft Windows 11 Enterprise, version 10.0.26200.9457 |
| Node | v24.21.0 |
| npm | 11.19.0 |
| Jest | 30.5.2 (with supertest ^6.3.3) |
| Playwright (`@playwright/test`) | 1.64.0 |
| Chromium | 156.0.8078.4 (headless) |
| Server | `node todoServer.js` on http://localhost:3000 |

## Commands executed

```
git fetch origin
git checkout feature/KAN-95-due-date-ui
git pull
npm install --save-dev jest @playwright/test
npx playwright install chromium
npm run test:api
npm run test:e2e
```

## Results summary

| Suite | Total | Passed | Failed | Blocked | Skipped |
|---|---|---|---|---|---|
| API (Jest + supertest) | 10 | 10 | 0 | 0 | 0 |
| E2E (Playwright, Chromium) | 10 | 10 | 0 | 0 | 0 |
| **Overall** | **20** | **20** | **0** | **0** | **0** |

Raw output: API `Tests: 10 passed, 10 total` (Jest 1.165 s); E2E `10 passed (18.2s)`, 0 flaky, 0 retries.

## Per-test results

| ID | Jira scenario | Description | Result |
|---|---|---|---|
| API-01 | KAN-96 S1 | POST /todos with valid dueDate returns 201 and includes dueDate | PASS |
| API-02 | KAN-96 S2 | POST /todos without dueDate returns 201 and omits dueDate | PASS |
| API-03 | KAN-96 S6 | POST /todos with invalid dueDate (2026-99-99) returns 400, field=dueDate | PASS |
| API-04 | KAN-96 S4 | PUT /todos/:id sets a new dueDate | PASS |
| API-05 | KAN-96 S5 | PUT /todos/:id with dueDate null clears dueDate | PASS |
| API-06 | KAN-96 S3 | GET /todos/:id returns the stored dueDate | PASS |
| API-07 | KAN-97 S3 | GET /todos?sort=dueDate returns ascending dueDate | PASS |
| API-08 | KAN-97 S4 | sort=dueDate places todos without dueDate last | PASS |
| API-09 | KAN-97 S5 | Equal dueDates ordered deterministically by id | PASS |
| API-10 | KAN-97 S6 | dueDate round-trips unchanged (incl. 2026-12-31, 2024-02-29) | PASS |
| E2E-01 | KAN-96 S1 | Create with dueDate; POST body includes dueDate | PASS |
| E2E-02 | KAN-96 S2 | Create without dueDate; POST body omits dueDate | PASS |
| E2E-03 | KAN-96 S3 | Edit modal pre-populates due date | PASS |
| E2E-04 | KAN-96 S4 | Edit updates dueDate; PUT body carries new value | PASS |
| E2E-05 | KAN-96 S5 | Edit clears dueDate; PUT body sends `dueDate: null` | PASS |
| E2E-06 | KAN-96 S6 | Malformed due date blocks submission (create and edit); no POST/PUT sent | PASS |
| E2E-07 | KAN-97 S1 | Card shows `Due: YYYY-MM-DD` when present | PASS |
| E2E-08 | KAN-97 S2 | Card omits due date when absent | PASS |
| E2E-09 | KAN-97 S3+S4 | Sort by due date earliest first, missing last | PASS |
| E2E-10 | KAN-97 S5+S6 | Stable tie order in-session; due string unchanged under America/Los_Angeles timezone | PASS |

## Failure evidence

None. All 20 tests passed on the final run.

## Test-validity check (performed during execution)

To confirm the negative test E2E-06 is not vacuous, the client-side date validation in `public/script.js` was temporarily disabled (`if (false) {`) and E2E-06 was run alone. It **failed** (`expect(locator).toBeVisible() failed — Expected: visible, Received: hidden` on `#edit-modal`, because the request was sent and the modal closed). The file was then restored with `git checkout -- public/script.js`; `git diff HEAD -- public index.html todoServer.js` is empty, and the final passing runs above were made on the unmodified code.

## Notes

- Test data isolation: `users.json`, `todos.json` and `sessions.json` are backed up byte-for-byte to the OS temp directory, replaced with empty fixtures for the run, and restored afterwards (API: `beforeAll`/`afterAll`; E2E: Playwright `globalSetup`/`globalTeardown`). After the runs `git status` shows no changes to these files.
- `@playwright/test` (which bundles `playwright`) was added as the devDependency because it provides the `test` runner used by `playwright test`.
- E2E-05 expects `dueDate: null` in the PUT body, which is what the application sends.
- E2E-06 forces a malformed value by changing the date input to `type=text`, since the native date input rejects malformed text on its own.
