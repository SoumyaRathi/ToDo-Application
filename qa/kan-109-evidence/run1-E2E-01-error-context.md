# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dueDate.e2e.spec.js >> E2E-01 create with due date 2030-12-31 shows "Due: 2030-12-31" on the card
- Location: test\e2e\dueDate.e2e.spec.js:45:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.outputData .output').filter({ hasText: 'e2e-with-due' }).locator('.todoDueDate')
Expected substring: "Due: 2030-12-31"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" locator('.outputData .output').filter({ hasText: 'e2e-with-due' }).locator('.todoDueDate') with timeout 5000ms
  - waiting for locator('.outputData .output').filter({ hasText: 'e2e-with-due' }).locator('.todoDueDate')

```

```yaml
- banner:
  - text: check_circle Pro To-Do QA User (kan109-1791909048218-1@example.com)
  - button "logout"
- main:
  - textbox "Search todos..."
  - button "×"
  - combobox:
    - option "All" [selected]
    - option "Active"
    - option "Completed"
  - combobox:
    - option "Sort by Created" [selected]
    - option "Sort by Updated"
    - option "Sort by Title"
    - option "Due date"
  - button "filter_alt_off"
  - text: Active
  - paragraph: e2e-with-due2030-12-31
  - paragraph: description
  - text: "Created: 10/13/2026, 10:00:50 PM | Updated: 10/13/2026, 10:00:50 PM"
  - button "Edit"
  - button "Delete"
  - button "Mark Complete"
  - text: Active
  - paragraph: Welcome to your To-Do List!
  - paragraph: This is your first todo. You can edit or delete it.
  - text: "Created: 10/13/2026, 10:00:49 PM | Updated: 10/13/2026, 10:00:49 PM"
  - button "Edit"
  - button "Delete"
  - button "Mark Complete"
  - button "add"
  - text: "Sort: Sort by Created"
```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | const { backupData, restoreData, uniqueEmail, ymd } = require('../api/testUtils');
  3   | 
  4   | // KAN-109 (Epic) / KAN-110 / KAN-111: due date UI. Each test signs up a fresh user through the UI.
  5   | // Every new user starts with one default "Welcome" todo that has no due date.
  6   | const PASSWORD = 'Passw0rd!';
  7   | 
  8   | test.beforeAll(() => backupData());
  9   | test.afterAll(() => restoreData());
  10  | 
  11  | test.beforeEach(async ({ page }) => {
  12  |   const email = uniqueEmail();
  13  |   await page.goto('/');
  14  |   await expect(page.locator('#auth-modal')).toBeVisible();
  15  |   await page.click('#auth-toggle-link');
  16  |   await page.fill('#auth-name', 'QA User');
  17  |   await page.fill('#auth-email', email);
  18  |   await page.fill('#auth-password', PASSWORD);
  19  |   await page.click('#auth-submit-btn');
  20  |   await expect(page.locator('#auth-error')).toContainText('Signup successful');
  21  |   await page.fill('#auth-email', email);
  22  |   await page.fill('#auth-password', PASSWORD);
  23  |   await page.click('#auth-submit-btn');
  24  |   await expect(page.locator('#auth-modal')).toBeHidden();
  25  |   await expect(page.locator('.outputData .output')).toHaveCount(1);
  26  | });
  27  | 
  28  | const card = (page, title) => page.locator('.outputData .output', { hasText: title });
  29  | 
  30  | async function openAddModal(page, { title, dueDate }) {
  31  |   await page.click('#add-todo-btn');
  32  |   await expect(page.locator('#edit-modal')).toBeVisible();
  33  |   await page.fill('#edit-title', title);
  34  |   await page.fill('#edit-desc', 'description');
  35  |   if (dueDate !== undefined) await page.fill('#edit-dueDate', dueDate);
  36  | }
  37  | 
  38  | async function createTodo(page, { title, dueDate }) {
  39  |   await openAddModal(page, { title, dueDate });
  40  |   await page.click('#save-edit-btn');
  41  |   await expect(page.locator('#edit-modal')).toBeHidden();
  42  |   await expect(card(page, title)).toBeVisible();
  43  | }
  44  | 
  45  | test('E2E-01 create with due date 2030-12-31 shows "Due: 2030-12-31" on the card', async ({ page }) => {
  46  |   await createTodo(page, { title: 'e2e-with-due', dueDate: '2030-12-31' });
> 47  |   await expect(card(page, 'e2e-with-due').locator('.todoDueDate')).toContainText('Due: 2030-12-31');
      |                                                                    ^ Error: expect(locator).toContainText(expected) failed
  48  | });
  49  | 
  50  | test('E2E-02 create with empty due date renders no due line', async ({ page }) => {
  51  |   await createTodo(page, { title: 'e2e-empty-due', dueDate: '' });
  52  |   await expect(card(page, 'e2e-empty-due').locator('.todoDueDate')).toHaveCount(0);
  53  | });
  54  | 
  55  | test('E2E-03 invalid due date 12/31/2030 shows inline error, sends no request, adds no todo', async ({ page }) => {
  56  |   const posts = [];
  57  |   page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/todos') posts.push(r.url()); });
  58  |   const before = await page.locator('.outputData .output').count();
  59  |   await openAddModal(page, { title: 'e2e-invalid-due', dueDate: '12/31/2030' });
  60  |   await page.click('#save-edit-btn');
  61  |   await expect(page.locator('#dueDate-error')).toBeVisible();
  62  |   await expect(page.locator('#dueDate-error')).toContainText('YYYY-MM-DD');
  63  |   await expect(page.locator('#edit-modal')).toBeVisible();
  64  |   expect(posts).toHaveLength(0);
  65  |   await expect(page.locator('.outputData .output')).toHaveCount(before);
  66  | });
  67  | 
  68  | test('E2E-04 edit modal pre-populates the existing due date', async ({ page }) => {
  69  |   await createTodo(page, { title: 'e2e-prefill', dueDate: '2030-12-31' });
  70  |   await card(page, 'e2e-prefill').locator('.todo-btn.edit').click();
  71  |   await expect(page.locator('#edit-modal')).toBeVisible();
  72  |   await expect(page.locator('#edit-dueDate')).toHaveValue('2030-12-31');
  73  | });
  74  | 
  75  | test('E2E-05 clearing the due date on edit removes the due line', async ({ page }) => {
  76  |   await createTodo(page, { title: 'e2e-clear', dueDate: '2030-12-31' });
  77  |   await expect(card(page, 'e2e-clear').locator('.todoDueDate')).toBeVisible();
  78  |   await card(page, 'e2e-clear').locator('.todo-btn.edit').click();
  79  |   await page.fill('#edit-dueDate', '');
  80  |   await page.click('#save-edit-btn');
  81  |   await expect(page.locator('#edit-modal')).toBeHidden();
  82  |   await expect(card(page, 'e2e-clear').locator('.todoDueDate')).toHaveCount(0);
  83  | });
  84  | 
  85  | test('E2E-06 past due date on an active todo shows the Overdue badge', async ({ page }) => {
  86  |   await createTodo(page, { title: 'e2e-overdue', dueDate: ymd(-1) });
  87  |   await expect(card(page, 'e2e-overdue').locator('.dueBadge--overdue')).toHaveText('Overdue');
  88  | });
  89  | 
  90  | test('E2E-07 today as due date shows the Due today badge', async ({ page }) => {
  91  |   await createTodo(page, { title: 'e2e-today', dueDate: ymd(0) });
  92  |   await expect(card(page, 'e2e-today').locator('.dueBadge--due-today')).toHaveText('Due today');
  93  | });
  94  | 
  95  | test('E2E-08 future due date shows the Upcoming badge', async ({ page }) => {
  96  |   await createTodo(page, { title: 'e2e-upcoming', dueDate: ymd(1) });
  97  |   await expect(card(page, 'e2e-upcoming').locator('.dueBadge--upcoming')).toHaveText('Upcoming');
  98  | });
  99  | 
  100 | test('E2E-09 todo without a due date shows no badge and no due line', async ({ page }) => {
  101 |   await createTodo(page, { title: 'e2e-no-indicator' });
  102 |   const c = card(page, 'e2e-no-indicator');
  103 |   await expect(c.locator('.todoDueDate')).toHaveCount(0);
  104 |   await expect(c.locator('.dueBadge')).toHaveCount(0);
  105 | });
  106 | 
  107 | test('E2E-10 selecting "Due date" sort requests GET /todos?sort=dueDate and orders by due date', async ({ page }) => {
  108 |   await createTodo(page, { title: 'e2e-sort-late', dueDate: '2030-02-01' });
  109 |   await createTodo(page, { title: 'e2e-sort-early', dueDate: '2030-01-01' });
  110 |   const sortRequest = page.waitForRequest(r =>
  111 |     r.method() === 'GET' &&
  112 |     new URL(r.url()).pathname === '/todos' &&
  113 |     new URL(r.url()).searchParams.get('sort') === 'dueDate');
  114 |   await page.selectOption('#sort-select', 'dueDate');
  115 |   await sortRequest;
  116 |   const cards = page.locator('.outputData .output');
  117 |   await expect(cards.nth(0)).toContainText('e2e-sort-early');
  118 |   await expect(cards.nth(1)).toContainText('e2e-sort-late');
  119 |   await expect(cards.nth(2)).toContainText('Welcome to your To-Do List!');
  120 | });
  121 | 
```