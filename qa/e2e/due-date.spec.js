const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const CARDS = '.outputData > .output';
const EVIDENCE_DIR = path.join(__dirname, '..', 'evidence', 'due-date');

let counter = 0;

const shot = async (page, name) => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${name}.png`), fullPage: true, animations: 'disabled' });
};

// Creates a unique user via the real API so each test owns its data.
async function newUser(request) {
  const email = `e2e-kan88-${Date.now()}-${counter++}@example.test`;
  const password = 'Passw0rd!';
  const name = 'E2E User';
  expect((await request.post(`${BASE}/signup`, { data: { name, email, password } })).status()).toBe(201);
  const login = await request.post(`${BASE}/login`, { data: { email, password } });
  expect(login.status()).toBe(200);
  const { token } = await login.json();
  return { token, name, email, headers: { Authorization: token } };
}

async function seed(request, user, title, dueDate) {
  const data = { title, description: `${title} description`, completed: false };
  if (dueDate) data.dueDate = dueDate;
  const res = await request.post(`${BASE}/todos`, { headers: user.headers, data });
  expect(res.status()).toBe(201);
  return res.json();
}

// Opens the app logged in as `user`; returns the page errors collected during the test.
async function openApp(page, user) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.addInitScript(([t, n, e]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('name', n);
    localStorage.setItem('email', e);
  }, [user.token, user.name, user.email]);
  await page.goto(`${BASE}/`);
  await page.locator(CARDS).first().waitFor();
  return errors;
}

const card = (page, title) => page.locator(CARDS).filter({ hasText: title });
const dueOf = (page, title) => card(page, title).locator('.todo-due-date');
const listedTitles = async page => (await page.locator(`${CARDS} #title`).allTextContents());

// The modal focuses the title field after 100ms; waiting for that avoids typing into a moving target.
async function openCreate(page) {
  await page.click('#add-todo-btn');
  await expect(page.locator('#edit-title')).toBeFocused();
}
async function openEdit(page, title) {
  await card(page, title).locator('.todo-btn.edit').click();
  await expect(page.locator('#edit-title')).toBeFocused();
}
async function fillAndSave(page, { title, dueDate }) {
  if (title !== undefined) {
    await page.fill('#edit-title', title);
    await page.fill('#edit-desc', `${title} description`);
  }
  if (dueDate !== undefined) await page.fill('#todoDueDate', dueDate);
  await page.click('#save-edit-btn');
}

async function sortByDueDate(page) {
  const reqPromise = page.waitForRequest(r => r.method() === 'GET' && r.url().includes('/todos?') && r.url().includes('sort=dueDate'));
  await page.selectOption('#sort-select', 'dueDate');
  const req = await reqPromise;
  const resp = await req.response();
  return { req, resp };
}

test.describe('KAN-88 due date UI (KAN-89 create/edit, KAN-90 display/sort)', () => {
  test('TC-E2E-01 KAN-89 S1 create a todo with a valid due date and see it on the card', async ({ page, request }) => {
    const user = await newUser(request);
    const errors = await openApp(page, user);

    await openCreate(page);
    const postPromise = page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/todos'));
    await fillAndSave(page, { title: 'E01 dated', dueDate: '2026-10-31' });

    expect((await postPromise).postDataJSON().dueDate).toBe('2026-10-31');
    await expect(dueOf(page, 'E01 dated')).toHaveText('Due: 2026-10-31');
    await shot(page, 'TC-E2E-01-create-with-due-date');
    expect(errors).toEqual([]);
  });

  test('TC-E2E-02 KAN-89 S2 / KAN-90 S2 create a todo without a due date shows no due-date display', async ({ page, request }) => {
    const user = await newUser(request);
    const errors = await openApp(page, user);

    await openCreate(page);
    await expect(page.locator('#todoDueDate')).toHaveValue('');
    const postPromise = page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/todos'));
    await fillAndSave(page, { title: 'E02 undated' });

    expect((await postPromise).postDataJSON()).not.toHaveProperty('dueDate');
    await expect(card(page, 'E02 undated')).toBeVisible();
    await expect(dueOf(page, 'E02 undated')).toHaveCount(0);
    await expect(card(page, 'E02 undated')).not.toContainText('Due');
    await shot(page, 'TC-E2E-02-create-without-due-date');
    expect(errors).toEqual([]);
  });

  test('TC-E2E-03 KAN-89 S3 edit a todo and add a due date', async ({ page, request }) => {
    const user = await newUser(request);
    await seed(request, user, 'E03 add due');
    const errors = await openApp(page, user);

    await openEdit(page, 'E03 add due');
    await expect(page.locator('#todoDueDate')).toHaveValue('');
    const putPromise = page.waitForRequest(r => r.method() === 'PUT' && r.url().includes('/todos/'));
    await fillAndSave(page, { dueDate: '2026-11-01' });

    expect((await putPromise).postDataJSON().dueDate).toBe('2026-11-01');
    await expect(dueOf(page, 'E03 add due')).toHaveText('Due: 2026-11-01');
    await shot(page, 'TC-E2E-03-edit-add-due-date');
    expect(errors).toEqual([]);
  });

  test('TC-E2E-04 KAN-89 S4 edit a todo and clear its due date', async ({ page, request }) => {
    const user = await newUser(request);
    await seed(request, user, 'E04 clear due', '2026-10-31');
    const errors = await openApp(page, user);
    await expect(dueOf(page, 'E04 clear due')).toHaveText('Due: 2026-10-31');

    await openEdit(page, 'E04 clear due');
    await expect(page.locator('#todoDueDate')).toHaveValue('2026-10-31');
    const putPromise = page.waitForRequest(r => r.method() === 'PUT' && r.url().includes('/todos/'));
    await fillAndSave(page, { dueDate: '' });

    expect((await putPromise).postDataJSON().dueDate).toBe('');
    await expect(dueOf(page, 'E04 clear due')).toHaveCount(0);
    await shot(page, 'TC-E2E-04-edit-clear-due-date');
    expect(errors).toEqual([]);
  });

  test('TC-E2E-05 KAN-89 S5 an invalid due date is blocked with an inline message and no request', async ({ page, request }) => {
    const user = await newUser(request);
    const errors = await openApp(page, user);
    const writes = [];
    page.on('request', r => { if (['POST', 'PUT'].includes(r.method()) && r.url().includes('/todos')) writes.push(r.url()); });

    for (const bad of ['10/31/2026', '2026-1-1']) {
      await openCreate(page);
      await fillAndSave(page, { title: 'E05 invalid', dueDate: bad });

      await expect(page.locator('#todoDueDate-error')).toBeVisible();
      await expect(page.locator('#todoDueDate-error')).toContainText('YYYY-MM-DD');
      await expect(page.locator('#edit-modal')).toHaveCSS('display', 'flex');
      if (bad === '10/31/2026') await shot(page, 'TC-E2E-05-invalid-due-date-blocked');
      await page.click('#close-modal');
    }

    expect(writes).toEqual([]);
    await expect(card(page, 'E05 invalid')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('TC-E2E-06 KAN-90 S1 a todo with a due date shows exactly that date, with no timezone shift', async ({ page, request }) => {
    const user = await newUser(request);
    await seed(request, user, 'E06 new year', '2026-01-01');
    await seed(request, user, 'E06 year end', '2026-12-31');
    const errors = await openApp(page, user);

    await expect(dueOf(page, 'E06 new year')).toHaveText('Due: 2026-01-01');
    await expect(dueOf(page, 'E06 year end')).toHaveText('Due: 2026-12-31');
    await shot(page, 'TC-E2E-06-card-shows-due-date');
    expect(errors).toEqual([]);
  });

  test('TC-E2E-07 KAN-90 S2 a todo without a due date has no due-date display', async ({ page, request }) => {
    const user = await newUser(request);
    await seed(request, user, 'E07 undated');
    const errors = await openApp(page, user);

    await expect(card(page, 'E07 undated')).toBeVisible();
    await expect(dueOf(page, 'E07 undated')).toHaveCount(0);
    await expect(card(page, 'E07 undated')).not.toContainText('Due');
    await expect(page.locator('.todo-due-date')).toHaveCount(0);
    await shot(page, 'TC-E2E-07-card-without-due-date');
    expect(errors).toEqual([]);
  });

  test('TC-E2E-08 KAN-90 S3 selecting Due date sort sends GET /todos with sort=dueDate', async ({ page, request }) => {
    const user = await newUser(request);
    await seed(request, user, 'E08 item', '2026-10-01');
    const errors = await openApp(page, user);
    await expect(page.locator('#sort-select option[value="dueDate"]')).toHaveText('Sort by Due date');

    const { req, resp } = await sortByDueDate(page);

    expect(new URL(req.url()).searchParams.get('sort')).toBe('dueDate');
    expect(resp.status()).toBe(200);
    await expect(page.locator('#sort-select')).toHaveValue('dueDate');
    await shot(page, 'TC-E2E-08-sort-request');
    expect(errors).toEqual([]);
  });

  test('TC-E2E-09 KAN-90 S4 two dated todos are ordered earliest due date first', async ({ page, request }) => {
    const user = await newUser(request);
    await seed(request, user, 'E09 later', '2026-10-15');
    await seed(request, user, 'E09 earlier', '2026-10-01');
    const errors = await openApp(page, user);

    await sortByDueDate(page);

    await expect.poll(async () => (await listedTitles(page)).filter(t => t.startsWith('E09'))).toEqual(['E09 earlier', 'E09 later']);
    await shot(page, 'TC-E2E-09-earliest-first');
    expect(errors).toEqual([]);
  });

  test('TC-E2E-10 KAN-90 S5 mixed dated and undated todos sort without UI errors or invalid dates', async ({ page, request }) => {
    const user = await newUser(request);
    await seed(request, user, 'E10 undated', '');
    await seed(request, user, 'E10 late', '2026-12-01');
    await seed(request, user, 'E10 early', '2026-10-01');
    const errors = await openApp(page, user);

    await sortByDueDate(page);

    await expect.poll(async () => (await listedTitles(page)).filter(t => t.startsWith('E10'))).toEqual(['E10 early', 'E10 late', 'E10 undated']);
    await expect(dueOf(page, 'E10 early')).toHaveText('Due: 2026-10-01');
    await expect(dueOf(page, 'E10 late')).toHaveText('Due: 2026-12-01');
    await expect(dueOf(page, 'E10 undated')).toHaveCount(0);
    await expect(page.locator('.todo-due-date')).toHaveCount(2);
    const text = await page.locator('.outputData').innerText();
    expect(text).not.toMatch(/Invalid Date|undefined|NaN|Due: null/);
    await shot(page, 'TC-E2E-10-mixed-sort');
    expect(errors).toEqual([]);
  });
});
