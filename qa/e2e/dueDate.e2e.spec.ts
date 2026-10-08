import { test, expect, Page, APIRequestContext } from '@playwright/test';

const PASSWORD = 'Passw0rd!';
const WELCOME_TITLE = 'Welcome to your To-Do List!';

type Seed = { title: string; dueDate?: string };
type User = { email: string; token: string };

let counter = 0;

// Creates a fresh user through the API and seeds todos (in order) before the UI logs in.
async function createUser(request: APIRequestContext, seeds: Seed[] = []): Promise<User> {
  counter += 1;
  const email = `qa-e2e-${Date.now()}-${counter}@example.com`;
  const signup = await request.post('/signup', { data: { name: 'QA E2E', email, password: PASSWORD } });
  expect(signup.status()).toBe(201);
  const login = await request.post('/login', { data: { email, password: PASSWORD } });
  const { token } = await login.json();
  for (const seed of seeds) {
    const res = await request.post('/todos', {
      headers: { Authorization: token },
      data: { title: seed.title, description: 'seeded', completed: false, ...(seed.dueDate ? { dueDate: seed.dueDate } : {}) },
    });
    expect(res.status()).toBe(201);
  }
  return { email, token };
}

async function uiLogin(page: Page, email: string) {
  await page.goto('/');
  await page.locator('#auth-email').fill(email);
  await page.locator('#auth-password').fill(PASSWORD);
  await page.locator('#auth-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator('#add-todo-btn')).toBeVisible();
  await expect(page.locator('.output').first()).toBeVisible();
}

async function setup(page: Page, request: APIRequestContext, seeds: Seed[] = []) {
  const user = await createUser(request, seeds);
  await uiLogin(page, user.email);
  return user;
}

const card = (page: Page, title: string) => page.locator('.output', { has: page.locator('#title', { hasText: title }) });
const titles = (page: Page) => page.locator('.output #title').allTextContents();
const isTodoWrite = (r: { url(): string; method(): string }, method: string) =>
  new URL(r.url()).pathname.match(/^\/todos(\/\d+)?$/) !== null && r.method() === method;

async function fillAndSave(page: Page, title: string, dueDate?: string) {
  await page.locator('#edit-title').fill(title);
  await page.locator('#edit-desc').fill('e2e description');
  if (dueDate !== undefined) await page.locator('#edit-dueDate').fill(dueDate);
}

async function selectSort(page: Page, value: string) {
  const responded = page.waitForResponse(r => r.url().includes(`sort=${value}`) && r.request().method() === 'GET');
  await page.locator('#sort-select').selectOption(value);
  await responded;
  await expect(page.locator('.output').first()).toBeVisible();
}

test.describe('dueDate UI (KAN-96 / KAN-97)', () => {
  test('E2E-01 KAN-96 S1: create with dueDate sends dueDate in POST body', async ({ page, request }) => {
    await setup(page, request);
    await page.locator('#add-todo-btn').click();
    await fillAndSave(page, 'E2E-01 todo', '2026-05-20');
    const posted = page.waitForRequest(r => isTodoWrite(r, 'POST'));
    await page.locator('#save-edit-btn').click();
    const body = JSON.parse((await posted).postData() || '{}');
    expect(body.dueDate).toBe('2026-05-20');
    await expect(card(page, 'E2E-01 todo').locator('.todoDueDate')).toHaveText('Due: 2026-05-20');
  });

  test('E2E-02 KAN-96 S2: create without dueDate omits dueDate from POST body', async ({ page, request }) => {
    await setup(page, request);
    await page.locator('#add-todo-btn').click();
    await fillAndSave(page, 'E2E-02 todo');
    const posted = page.waitForRequest(r => isTodoWrite(r, 'POST'));
    await page.locator('#save-edit-btn').click();
    const body = JSON.parse((await posted).postData() || '{}');
    expect(body).not.toHaveProperty('dueDate');
    await expect(card(page, 'E2E-02 todo')).toBeVisible();
  });

  test('E2E-03 KAN-96 S3: edit modal pre-populates the due date', async ({ page, request }) => {
    await setup(page, request, [{ title: 'E2E-03 todo', dueDate: '2026-03-15' }]);
    await card(page, 'E2E-03 todo').locator('.todo-btn.edit').click();
    await expect(page.locator('#edit-dueDate')).toHaveValue('2026-03-15');
  });

  test('E2E-04 KAN-96 S4: edit updates dueDate and PUT body carries the new value', async ({ page, request }) => {
    await setup(page, request, [{ title: 'E2E-04 todo', dueDate: '2026-03-15' }]);
    await card(page, 'E2E-04 todo').locator('.todo-btn.edit').click();
    await page.locator('#edit-dueDate').fill('2026-11-30');
    const put = page.waitForRequest(r => isTodoWrite(r, 'PUT'));
    await page.locator('#save-edit-btn').click();
    const body = JSON.parse((await put).postData() || '{}');
    expect(body.dueDate).toBe('2026-11-30');
    await expect(card(page, 'E2E-04 todo').locator('.todoDueDate')).toHaveText('Due: 2026-11-30');
  });

  test('E2E-05 KAN-96 S5: edit clears dueDate and PUT body sends null', async ({ page, request }) => {
    await setup(page, request, [{ title: 'E2E-05 todo', dueDate: '2026-03-15' }]);
    await card(page, 'E2E-05 todo').locator('.todo-btn.edit').click();
    await page.locator('#edit-dueDate').fill('');
    const put = page.waitForRequest(r => isTodoWrite(r, 'PUT'));
    await page.locator('#save-edit-btn').click();
    const body = JSON.parse((await put).postData() || '{}');
    expect(body).toHaveProperty('dueDate', null);
    await expect(card(page, 'E2E-05 todo')).toBeVisible();
    await expect(card(page, 'E2E-05 todo').locator('.todoDueDate')).toHaveCount(0);
  });

  test('E2E-06 KAN-96 S6: malformed due date blocks submission and sends no request', async ({ page, request }) => {
    await setup(page, request, [{ title: 'E2E-06 todo', dueDate: '2026-03-15' }]);
    const writes: string[] = [];
    page.on('request', r => {
      if (isTodoWrite(r, 'POST') || isTodoWrite(r, 'PUT')) writes.push(`${r.method()} ${r.url()}`);
    });
    // The native date input rejects bad text itself, so force a malformed value by making it a text input.
    const forceMalformed = () =>
      page.locator('#edit-dueDate').evaluate((el: HTMLInputElement) => {
        el.type = 'text';
        el.value = '26-1-1';
      });

    await page.locator('#add-todo-btn').click();
    await fillAndSave(page, 'E2E-06 create');
    await forceMalformed();
    await page.locator('#save-edit-btn').click();

    await page.evaluate(() => (window as any).closeEditModal());
    await card(page, 'E2E-06 todo').locator('.todo-btn.edit').click();
    await forceMalformed();
    await page.locator('#save-edit-btn').click();

    await page.waitForTimeout(500);
    await expect(page.locator('#edit-modal')).toBeVisible();
    expect(writes).toEqual([]);
  });

  test('E2E-07 KAN-97 S1: card shows due date when present', async ({ page, request }) => {
    await setup(page, request, [{ title: 'E2E-07 todo', dueDate: '2026-03-15' }]);
    await expect(card(page, 'E2E-07 todo').locator('.todoDueDate')).toHaveText('Due: 2026-03-15');
  });

  test('E2E-08 KAN-97 S2: card omits due date when absent', async ({ page, request }) => {
    await setup(page, request, [{ title: 'E2E-08 todo' }]);
    const target = card(page, 'E2E-08 todo');
    await expect(target).toBeVisible();
    await expect(target.locator('.todoDueDate')).toHaveCount(0);
    await expect(target).not.toContainText('Due:');
    await expect(page.locator('.todoDueDate')).toHaveCount(0);
  });

  test('E2E-09 KAN-97 S3+S4: sort by due date is earliest first with missing last', async ({ page, request }) => {
    await setup(page, request, [
      { title: 'E2E-09 june', dueDate: '2026-06-01' },
      { title: 'E2E-09 january', dueDate: '2026-01-15' },
      { title: 'E2E-09 none' },
      { title: 'E2E-09 march', dueDate: '2026-03-10' },
    ]);
    await selectSort(page, 'dueDate');
    expect(await titles(page)).toEqual([
      'E2E-09 january',
      'E2E-09 march',
      'E2E-09 june',
      WELCOME_TITLE,
      'E2E-09 none',
    ]);
  });

  test('E2E-10 KAN-97 S5+S6: tie order is stable in-session and due string is unchanged', async ({ browser, request }) => {
    // A UTC-negative timezone would shift a naive new Date('YYYY-MM-DD') back a day.
    const context = await browser.newContext({ baseURL: 'http://localhost:3000', timezoneId: 'America/Los_Angeles' });
    const page = await context.newPage();
    try {
      const user = await createUser(request, [
        { title: 'E2E-10 tie1', dueDate: '2026-12-31' },
        { title: 'E2E-10 tie2', dueDate: '2026-12-31' },
        { title: 'E2E-10 tie3', dueDate: '2026-12-31' },
        { title: 'E2E-10 early', dueDate: '2026-01-01' },
      ]);
      await uiLogin(page, user.email);

      await selectSort(page, 'dueDate');
      const expected = ['E2E-10 early', 'E2E-10 tie1', 'E2E-10 tie2', 'E2E-10 tie3', WELCOME_TITLE];
      expect(await titles(page)).toEqual(expected);

      await selectSort(page, 'title');
      await selectSort(page, 'dueDate');
      expect(await titles(page)).toEqual(expected);

      await expect(card(page, 'E2E-10 tie1').locator('.todoDueDate')).toHaveText('Due: 2026-12-31');
      await expect(card(page, 'E2E-10 early').locator('.todoDueDate')).toHaveText('Due: 2026-01-01');
    } finally {
      await context.close();
    }
  });
});
