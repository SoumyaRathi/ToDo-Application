const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const CARDS = '.outputData > .output';

const isReorderRequest = r => r.method() === 'PUT' && new URL(r.url()).pathname === '/todos/reorder';
const isReorderResponse = r => isReorderRequest(r.request());
const isTodosListRequest = r => r.method() === 'GET' && new URL(r.url()).pathname === '/todos';

// Creates a unique user through the real API, seeds extra todos and opens the app logged in.
// Signup already creates one "Welcome" todo, so the user ends up with 1 + extraTitles.length todos
// (or extraTitles.length if removeWelcome is set). Returns todos in server (manual) order.
async function openAppAsNewUser(page, request, { extraTitles = ['Alpha task', 'Bravo task'], removeWelcome = false } = {}) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = 'Passw0rd!';
  const name = 'E2E User';
  expect((await request.post(`${BASE}/signup`, { data: { name, email, password } })).status()).toBe(201);
  const login = await request.post(`${BASE}/login`, { data: { email, password } });
  expect(login.status()).toBe(200);
  const { token } = await login.json();
  const headers = { Authorization: token };

  for (const title of extraTitles) {
    const res = await request.post(`${BASE}/todos`, { headers, data: { title, description: `${title} description`, completed: false } });
    expect(res.status()).toBe(201);
  }
  if (removeWelcome) {
    const first = (await (await request.get(`${BASE}/todos?sort=`, { headers })).json())[0];
    expect((await request.delete(`${BASE}/todos/${first.id}`, { headers })).status()).toBe(200);
  }
  const todos = await (await request.get(`${BASE}/todos?sort=`, { headers })).json();

  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.addInitScript(([t, n, e]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('name', n);
    localStorage.setItem('email', e);
  }, [token, name, email]);
  await page.goto(`${BASE}/`);
  await page.locator(`${CARDS}, .outputData > .empty-state`).first().waitFor();
  return { token, headers, todos };
}

const domIds = page => page.locator(CARDS).evaluateAll(els => els.map(e => Number(e.dataset.id)));
const ids = list => list.map(t => t.id);

function trackReorderRequests(page) {
  const seen = [];
  page.on('request', r => { if (isReorderRequest(r)) seen.push(r); });
  return seen;
}

// HTML5 drag shim: fires the same dragstart/dragover/drop/dragend sequence the app listens for,
// using a real DataTransfer instance.
async function dragCard(page, fromId, toId, { drop = true, end = true } = {}) {
  await page.evaluate(({ fromId, toId, drop, end }) => {
    const card = id => document.querySelector(`.outputData > .output[data-id="${id}"]`);
    const src = card(fromId);
    const dst = card(toId);
    const dt = new DataTransfer();
    const fire = (el, type) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
    fire(src, 'dragstart');
    fire(dst, 'dragenter');
    fire(dst, 'dragover');
    if (drop) fire(dst, 'drop');
    if (end) fire(src, 'dragend');
  }, { fromId, toId, drop, end });
}

async function mouseDragBetween(page, fromLocator, toLocator) {
  const from = await fromLocator.boundingBox();
  const to = await toLocator.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
}

test.describe('KAN-69 drag-and-drop reorder', () => {
  test('E2E-01 KAN-69 S1 drag 3rd card to 1st updates visual order', async ({ page, request }) => {
    const { todos } = await openAppAsNewUser(page, request);
    const [t1, t2, t3] = todos;
    expect(await domIds(page)).toEqual([t1.id, t2.id, t3.id]);
    await expect(page.locator(CARDS).nth(2)).toHaveJSProperty('draggable', true);

    await dragCard(page, t3.id, t1.id);

    expect(await domIds(page)).toEqual([t3.id, t1.id, t2.id]);
    await expect(page.locator(CARDS).nth(0).locator('#title')).toHaveText(t3.title);
  });

  test('E2E-02 KAN-69 S2 drop triggers PUT /todos/reorder with orderedIds matching DOM', async ({ page, request }) => {
    const { todos } = await openAppAsNewUser(page, request);
    const [t1, t2, t3] = todos;
    const reorderReq = page.waitForRequest(isReorderRequest);
    const reorderRes = page.waitForResponse(isReorderResponse);

    await dragCard(page, t3.id, t1.id);

    const req = await reorderReq;
    expect((await reorderRes).status()).toBe(200);
    expect(req.postDataJSON()).toEqual({ orderedIds: [t3.id, t1.id, t2.id] });
    expect(req.postDataJSON().orderedIds).toEqual(await domIds(page));
  });

  test('E2E-03 KAN-69 S3 order persists after page refresh', async ({ page, request }) => {
    const { todos, headers } = await openAppAsNewUser(page, request);
    const [t1, t2, t3] = todos;
    const reorderRes = page.waitForResponse(isReorderResponse);
    await dragCard(page, t3.id, t1.id);
    expect((await reorderRes).status()).toBe(200);

    await page.reload();
    await page.locator(CARDS).first().waitFor();

    expect(await domIds(page)).toEqual([t3.id, t1.id, t2.id]);
    const server = await (await request.get(`${BASE}/todos?sort=`, { headers })).json();
    expect(ids(server)).toEqual([t3.id, t1.id, t2.id]);
  });

  test('E2E-04 KAN-69 S4 with 1 todo, not draggable and no reorder request', async ({ page, request }) => {
    const { todos } = await openAppAsNewUser(page, request, { extraTitles: [] });
    expect(todos).toHaveLength(1);
    const reorderRequests = trackReorderRequests(page);
    const card = page.locator(CARDS);
    await expect(card).toHaveCount(1);

    await expect(card).toHaveJSProperty('draggable', false);
    await expect(card).not.toHaveAttribute('draggable', 'true');
    await dragCard(page, todos[0].id, todos[0].id);
    await mouseDragBetween(page, card, page.locator('.todo-controls'));
    await page.waitForTimeout(500);

    expect(reorderRequests).toHaveLength(0);
    expect(await domIds(page)).toEqual([todos[0].id]);
  });

  test('E2E-05 KAN-69 S4 with 0 todos, empty state and no reorder request', async ({ page, request }) => {
    await openAppAsNewUser(page, request, { extraTitles: [], removeWelcome: true });
    const reorderRequests = trackReorderRequests(page);

    await expect(page.locator('.outputData > .empty-state')).toHaveText('No todos found.');
    await expect(page.locator(CARDS)).toHaveCount(0);
    await page.evaluate(() => {
      const dt = new DataTransfer();
      const box = document.querySelector('.outputData');
      ['dragover', 'drop'].forEach(type => box.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt })));
    });
    await page.waitForTimeout(500);

    expect(reorderRequests).toHaveLength(0);
  });

  test('E2E-06 KAN-69 S5 if reorder request non-OK, client re-fetches and restores server order', async ({ page, request }) => {
    const { todos, headers } = await openAppAsNewUser(page, request);
    const [t1, t2, t3] = todos;
    await page.route('**/todos/reorder', route => route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'rejected for test' }),
    }));
    const reorderReq = page.waitForRequest(isReorderRequest);
    const refetch = page.waitForRequest(isTodosListRequest);

    await dragCard(page, t3.id, t1.id);

    expect((await reorderReq).postDataJSON()).toEqual({ orderedIds: [t3.id, t1.id, t2.id] });
    await refetch;
    await expect.poll(() => domIds(page)).toEqual([t1.id, t2.id, t3.id]);
    const server = await (await request.get(`${BASE}/todos?sort=`, { headers })).json();
    expect(ids(server)).toEqual([t1.id, t2.id, t3.id]);
  });

  test('E2E-07 KAN-69 S1 dragover adds .is-dragover to target', async ({ page, request }) => {
    const { todos } = await openAppAsNewUser(page, request);
    const [t1, , t3] = todos;
    const source = page.locator(`${CARDS}[data-id="${t3.id}"]`);
    const target = page.locator(`${CARDS}[data-id="${t1.id}"]`);

    await dragCard(page, t3.id, t1.id, { drop: false, end: false });

    await expect(target).toHaveClass(/is-dragover/);
    await expect(source).toHaveClass(/is-dragging/);
    await expect(source).not.toHaveClass(/is-dragover/);
  });

  test('E2E-08 KAN-69 S2 orderedIds are numbers', async ({ page, request }) => {
    const { todos } = await openAppAsNewUser(page, request);
    const [t1, , t3] = todos;
    const reorderReq = page.waitForRequest(isReorderRequest);

    await dragCard(page, t3.id, t1.id);

    const { orderedIds } = (await reorderReq).postDataJSON();
    expect(orderedIds).toHaveLength(3);
    orderedIds.forEach(id => {
      expect(typeof id).toBe('number');
      expect(Number.isInteger(id)).toBe(true);
    });
  });

  test('E2E-09 KAN-69 S3 persisted order stable after switching sort away and back to manual, then refresh', async ({ page, request }) => {
    const { todos } = await openAppAsNewUser(page, request);
    const [welcome, alpha, bravo] = todos;
    const reordered = [bravo.id, welcome.id, alpha.id];
    const reorderRes = page.waitForResponse(isReorderResponse);
    await dragCard(page, bravo.id, welcome.id);
    expect((await reorderRes).status()).toBe(200);
    expect(await domIds(page)).toEqual(reordered);

    await page.selectOption('#sort-select', 'title');
    await expect.poll(() => domIds(page)).toEqual([alpha.id, bravo.id, welcome.id]);
    await page.selectOption('#sort-select', { value: '' });
    await expect.poll(() => domIds(page)).toEqual(reordered);

    await page.reload();
    await page.locator(CARDS).first().waitFor();
    expect(await domIds(page)).toEqual(reordered);
  });

  test('E2E-10 KAN-69 S4 search disables reorder (no draggable/no reorder request)', async ({ page, request }) => {
    const { todos } = await openAppAsNewUser(page, request, { extraTitles: ['Findme one', 'Findme two'] });
    const [, f1, f2] = todos;
    const reorderRequests = trackReorderRequests(page);
    await expect(page.locator(CARDS).first()).toHaveJSProperty('draggable', true);

    await page.fill('#search-input', 'findme');
    await expect.poll(() => domIds(page)).toEqual([f1.id, f2.id]);

    await expect(page.locator(CARDS).nth(0)).toHaveJSProperty('draggable', false);
    await expect(page.locator(CARDS).nth(1)).toHaveJSProperty('draggable', false);
    await dragCard(page, f2.id, f1.id);
    await mouseDragBetween(page, page.locator(CARDS).nth(1), page.locator(CARDS).nth(0));
    await page.waitForTimeout(500);

    expect(reorderRequests).toHaveLength(0);
    expect(await domIds(page)).toEqual([f1.id, f2.id]);
  });
});
