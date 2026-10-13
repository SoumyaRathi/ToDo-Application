const { test, expect } = require('@playwright/test');
const { backupData, restoreData, uniqueEmail, ymd } = require('../api/testUtils');

// KAN-109 (Epic) / KAN-110 / KAN-111: due date UI. Each test signs up a fresh user through the UI.
// Every new user starts with one default "Welcome" todo that has no due date.
const PASSWORD = 'Passw0rd!';

test.beforeAll(() => backupData());
test.afterAll(() => restoreData());

test.beforeEach(async ({ page }) => {
  const email = uniqueEmail();
  await page.goto('/');
  await expect(page.locator('#auth-modal')).toBeVisible();
  await page.click('#auth-toggle-link');
  await page.fill('#auth-name', 'QA User');
  await page.fill('#auth-email', email);
  await page.fill('#auth-password', PASSWORD);
  await page.click('#auth-submit-btn');
  await expect(page.locator('#auth-error')).toContainText('Signup successful');
  await page.fill('#auth-email', email);
  await page.fill('#auth-password', PASSWORD);
  await page.click('#auth-submit-btn');
  await expect(page.locator('#auth-modal')).toBeHidden();
  await expect(page.locator('.outputData .output')).toHaveCount(1);
});

const card = (page, title) => page.locator('.outputData .output', { hasText: title });

async function openAddModal(page, { title, dueDate }) {
  await page.click('#add-todo-btn');
  await expect(page.locator('#edit-modal')).toBeVisible();
  await page.fill('#edit-title', title);
  await page.fill('#edit-desc', 'description');
  if (dueDate !== undefined) await page.fill('#edit-dueDate', dueDate);
}

async function createTodo(page, { title, dueDate }) {
  await openAddModal(page, { title, dueDate });
  await page.click('#save-edit-btn');
  await expect(page.locator('#edit-modal')).toBeHidden();
  await expect(card(page, title)).toBeVisible();
}

test('E2E-01 create with due date 2030-12-31 shows "Due: 2030-12-31" on the card', async ({ page }) => {
  await createTodo(page, { title: 'e2e-with-due', dueDate: '2030-12-31' });
  await expect(card(page, 'e2e-with-due').locator('.todoDueDate')).toContainText('Due: 2030-12-31');
});

test('E2E-02 create with empty due date renders no due line', async ({ page }) => {
  await createTodo(page, { title: 'e2e-empty-due', dueDate: '' });
  await expect(card(page, 'e2e-empty-due').locator('.todoDueDate')).toHaveCount(0);
});

test('E2E-03 invalid due date 12/31/2030 shows inline error, sends no request, adds no todo', async ({ page }) => {
  const posts = [];
  page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/todos') posts.push(r.url()); });
  const before = await page.locator('.outputData .output').count();
  await openAddModal(page, { title: 'e2e-invalid-due', dueDate: '12/31/2030' });
  await page.click('#save-edit-btn');
  await expect(page.locator('#dueDate-error')).toBeVisible();
  await expect(page.locator('#dueDate-error')).toContainText('YYYY-MM-DD');
  await expect(page.locator('#edit-modal')).toBeVisible();
  expect(posts).toHaveLength(0);
  await expect(page.locator('.outputData .output')).toHaveCount(before);
});

test('E2E-04 edit modal pre-populates the existing due date', async ({ page }) => {
  await createTodo(page, { title: 'e2e-prefill', dueDate: '2030-12-31' });
  await card(page, 'e2e-prefill').locator('.todo-btn.edit').click();
  await expect(page.locator('#edit-modal')).toBeVisible();
  await expect(page.locator('#edit-dueDate')).toHaveValue('2030-12-31');
});

test('E2E-05 clearing the due date on edit removes the due line', async ({ page }) => {
  await createTodo(page, { title: 'e2e-clear', dueDate: '2030-12-31' });
  await expect(card(page, 'e2e-clear').locator('.todoDueDate')).toBeVisible();
  await card(page, 'e2e-clear').locator('.todo-btn.edit').click();
  await page.fill('#edit-dueDate', '');
  await page.click('#save-edit-btn');
  await expect(page.locator('#edit-modal')).toBeHidden();
  await expect(card(page, 'e2e-clear').locator('.todoDueDate')).toHaveCount(0);
});

test('E2E-06 past due date on an active todo shows the Overdue badge', async ({ page }) => {
  await createTodo(page, { title: 'e2e-overdue', dueDate: ymd(-1) });
  await expect(card(page, 'e2e-overdue').locator('.dueBadge--overdue')).toHaveText('Overdue');
});

test('E2E-07 today as due date shows the Due today badge', async ({ page }) => {
  await createTodo(page, { title: 'e2e-today', dueDate: ymd(0) });
  await expect(card(page, 'e2e-today').locator('.dueBadge--due-today')).toHaveText('Due today');
});

test('E2E-08 future due date shows the Upcoming badge', async ({ page }) => {
  await createTodo(page, { title: 'e2e-upcoming', dueDate: ymd(1) });
  await expect(card(page, 'e2e-upcoming').locator('.dueBadge--upcoming')).toHaveText('Upcoming');
});

test('E2E-09 todo without a due date shows no badge and no due line', async ({ page }) => {
  await createTodo(page, { title: 'e2e-no-indicator' });
  const c = card(page, 'e2e-no-indicator');
  await expect(c.locator('.todoDueDate')).toHaveCount(0);
  await expect(c.locator('.dueBadge')).toHaveCount(0);
});

test('E2E-10 selecting "Due date" sort requests GET /todos?sort=dueDate and orders by due date', async ({ page }) => {
  await createTodo(page, { title: 'e2e-sort-late', dueDate: '2030-02-01' });
  await createTodo(page, { title: 'e2e-sort-early', dueDate: '2030-01-01' });
  const sortRequest = page.waitForRequest(r =>
    r.method() === 'GET' &&
    new URL(r.url()).pathname === '/todos' &&
    new URL(r.url()).searchParams.get('sort') === 'dueDate');
  await page.selectOption('#sort-select', 'dueDate');
  await sortRequest;
  const cards = page.locator('.outputData .output');
  await expect(cards.nth(0)).toContainText('e2e-sort-early');
  await expect(cards.nth(1)).toContainText('e2e-sort-late');
  await expect(cards.nth(2)).toContainText('Welcome to your To-Do List!');
});
