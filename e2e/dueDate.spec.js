const { test, expect } = require('@playwright/test');
const { backupData, restoreData } = require('../test-support/data-backup');

test.describe.configure({ mode: 'serial' });

let snapshot;
let session; // { token, name, email } captured after a real UI signup + login

const card = (page, title) => page.locator('.outputData .output', { hasText: title });

// The app focuses the title field ~100ms after the modal opens; wait for that so fill() is not interrupted.
async function openAddModal(page) {
  await page.click('#add-todo-btn');
  await expect(page.locator('#edit-modal')).toBeVisible();
  await expect(page.locator('#edit-title')).toBeFocused();
}

async function addTodo(page, title, dueDate) {
  await openAddModal(page);
  await page.fill('#edit-title', title);
  await page.fill('#edit-desc', `${title} description`);
  if (dueDate) await page.fill('#edit-dueDate', dueDate);
  await page.click('#save-edit-btn');
  await expect(page.locator('#edit-modal')).toBeHidden();
  await expect(card(page, title)).toBeVisible();
}

async function openEdit(page, title) {
  await card(page, title).locator('.todo-btn.edit').click();
  await expect(page.locator('#edit-modal')).toBeVisible();
  await expect(page.locator('#edit-title')).toBeFocused();
}

test.beforeAll(async ({ browser }) => {
  snapshot = backupData();
  const email = `e2e-duedate-${Date.now()}@test.com`;
  const context = await browser.newContext({ baseURL: 'http://localhost:3000' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('#auth-modal')).toBeVisible();
  await page.click('#auth-toggle-link');
  // showAuthModal() focuses its first field after ~100ms; wait for that so fill() is not interrupted.
  await expect(page.locator('#auth-name')).toBeFocused();
  await page.fill('#auth-name', 'E2E Tester');
  await page.fill('#auth-email', email);
  await page.fill('#auth-password', 'pw12345');
  await page.click('#auth-form button[type=submit]');
  await expect(page.locator('#auth-error')).toContainText('Signup successful');
  await expect(page.locator('#auth-email')).toBeFocused();
  await page.fill('#auth-email', email);
  await page.fill('#auth-password', 'pw12345');
  await page.click('#auth-form button[type=submit]');
  await expect(page.locator('.outputData .output').first()).toBeVisible();
  session = await page.evaluate(() => ({
    token: localStorage.getItem('token'),
    name: localStorage.getItem('name'),
    email: localStorage.getItem('email'),
  }));
  expect(session.token).toBeTruthy();
  await context.close();
});

test.afterAll(() => {
  restoreData(snapshot);
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(s => {
    localStorage.setItem('token', s.token);
    localStorage.setItem('name', s.name);
    localStorage.setItem('email', s.email);
  }, session);
  await page.goto('/');
  await expect(page.locator('.outputData .output').first()).toBeVisible();
});

test.describe('Due date UI (KAN-116 / KAN-117 / KAN-118)', () => {
  test('E2E-01 (KAN-117 S1): create todo with due date -> card shows Due line', async ({ page }) => {
    await addTodo(page, 'E2E-01 dated', '2030-05-17');
    await expect(card(page, 'E2E-01 dated').locator('.todo-due-date')).toHaveText('Due: 2030-05-17');
  });

  test('E2E-02 (KAN-117 S2): create todo without due date -> card omits due date line', async ({ page }) => {
    await addTodo(page, 'E2E-02 undated');
    await expect(card(page, 'E2E-02 undated').locator('.todo-due-date')).toHaveCount(0);
  });

  test('E2E-03 (KAN-117 S3): edit modal pre-populates due date', async ({ page }) => {
    await addTodo(page, 'E2E-03 dated', '2031-02-03');
    await openEdit(page, 'E2E-03 dated');
    await expect(page.locator('#edit-dueDate')).toHaveValue('2031-02-03');
  });

  test('E2E-04 (KAN-117 S4): update due date -> card shows the new date', async ({ page }) => {
    await addTodo(page, 'E2E-04 dated', '2030-01-01');
    await openEdit(page, 'E2E-04 dated');
    await page.fill('#edit-dueDate', '2032-06-18');
    await page.click('#save-edit-btn');
    await expect(page.locator('#edit-modal')).toBeHidden();
    await expect(card(page, 'E2E-04 dated').locator('.todo-due-date')).toHaveText('Due: 2032-06-18');
  });

  test('E2E-05 (KAN-117 S5): clear button removes due date, still gone after reload', async ({ page }) => {
    await addTodo(page, 'E2E-05 dated', '2030-07-07');
    await openEdit(page, 'E2E-05 dated');
    await page.click('#clear-dueDate-btn');
    await expect(page.locator('#edit-dueDate')).toHaveValue('');
    await page.click('#save-edit-btn');
    await expect(page.locator('#edit-modal')).toBeHidden();
    await expect(card(page, 'E2E-05 dated')).toBeVisible();
    await page.reload();
    await expect(card(page, 'E2E-05 dated')).toBeVisible();
    await expect(card(page, 'E2E-05 dated').locator('.todo-due-date')).toHaveCount(0);
  });

  test('E2E-06 (KAN-117 S6): invalid dueDate shows #dueDate-error and sends no POST/PUT', async ({ page }) => {
    const writes = [];
    page.on('request', r => {
      if (/\/todos(\/\d+)?$/.test(new URL(r.url()).pathname) && ['POST', 'PUT'].includes(r.method())) writes.push(r.method());
    });
    await openAddModal(page);
    await page.fill('#edit-title', 'E2E-06 invalid');
    await page.fill('#edit-desc', 'invalid date');
    // A real date input rejects bad text, so force the field to a plain text input holding an invalid value.
    await page.evaluate(() => {
      const el = document.getElementById('edit-dueDate');
      el.type = 'text';
      el.value = '2025-13-45';
    });
    await page.click('#save-edit-btn');
    await expect(page.locator('#dueDate-error')).toBeVisible();
    await expect(page.locator('#edit-modal')).toBeVisible();
    await page.waitForTimeout(500);
    expect(writes).toEqual([]);
  });

  test('E2E-07 (KAN-118 S1): due date is visible on the card when present, also after reload', async ({ page }) => {
    await addTodo(page, 'E2E-07 dated', '2035-11-30');
    await page.reload();
    const due = card(page, 'E2E-07 dated').locator('.todo-due-date');
    await expect(due).toBeVisible();
    await expect(due).toHaveText(/^Due: \d{4}-\d{2}-\d{2}$/);
    await expect(due).toHaveText('Due: 2035-11-30');
  });

  test('E2E-08 (KAN-118 S2): only the dated card shows a due line, undated card omits it', async ({ page }) => {
    await addTodo(page, 'E2E-08 dated', '2036-01-15');
    await addTodo(page, 'E2E-08 undated');
    await page.reload();
    await expect(card(page, 'E2E-08 dated').locator('.todo-due-date')).toHaveCount(1);
    await expect(card(page, 'E2E-08 undated').locator('.todo-due-date')).toHaveCount(0);
  });

  test('E2E-09 (KAN-118 S3): selecting Sort by Due Date sends GET /todos with sort=dueDate', async ({ page }) => {
    const [req] = await Promise.all([
      page.waitForRequest(r => r.method() === 'GET' && new URL(r.url()).pathname === '/todos' && new URL(r.url()).searchParams.get('sort') === 'dueDate'),
      page.selectOption('#sort-select', 'dueDate'),
    ]);
    expect(req.url()).toContain('sort=dueDate');
  });

  test('E2E-10 (KAN-118 S6): mixed due date presence sorted by due date renders all items, no error', async ({ page }) => {
    await addTodo(page, 'E2E-10 late', '2041-09-09');
    await addTodo(page, 'E2E-10 none');
    await addTodo(page, 'E2E-10 early', '2038-01-01');
    await Promise.all([
      page.waitForResponse(r => r.url().includes('sort=dueDate') && r.status() === 200),
      page.selectOption('#sort-select', 'dueDate'),
    ]);
    await expect(page.locator('#todo-error')).toBeHidden();
    for (const t of ['E2E-10 late', 'E2E-10 none', 'E2E-10 early']) await expect(card(page, t)).toBeVisible();
    const titles = await page.locator('.outputData .output #title').allTextContents();
    const mine = titles.filter(t => t.startsWith('E2E-10'));
    expect(mine).toEqual(['E2E-10 early', 'E2E-10 late', 'E2E-10 none']);
  });
});
