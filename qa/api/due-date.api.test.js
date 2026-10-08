const fs = require('fs');
const path = require('path');
const request = require('supertest');

const BASE = 'http://localhost:3000';
const ROOT = path.join(__dirname, '..', '..');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

let counter = 0;

// Every test signs up its own user through the real routes, so tests share no data.
async function createUser() {
  const email = `qa-kan88-${Date.now()}-${process.pid}-${counter++}@example.test`;
  const password = 'Passw0rd!';
  await request(BASE).post('/signup').send({ name: 'QA User', email, password }).expect(201);
  const login = await request(BASE).post('/login').send({ email, password }).expect(200);
  return { token: login.body.token };
}

const body = (title, extra = {}) => ({ title, description: `${title} description`, completed: false, ...extra });
const post = (u, data) => request(BASE).post('/todos').set('Authorization', u.token).send(data);
const put = (u, id, data) => request(BASE).put(`/todos/${id}`).set('Authorization', u.token).send(data);
const list = (u, query = '') => request(BASE).get(`/todos${query}`).set('Authorization', u.token);
const one = (u, id) => request(BASE).get(`/todos/${id}`).set('Authorization', u.token);
const toggle = (u, id) => request(BASE).patch(`/todos/${id}/toggle`).set('Authorization', u.token);
const stored = id => JSON.parse(fs.readFileSync(path.join(ROOT, 'todos.json'), 'utf8')).find(t => t.id === id);
const titles = res => res.body.map(t => t.title);

describe('KAN-88 due date API (KAN-89 create/edit, KAN-90 sort)', () => {
  test('TC-API-01 KAN-89 S1 POST with a valid dueDate returns it', async () => {
    const u = await createUser();

    const res = await post(u, body('Dated', { dueDate: '2026-10-31' }));

    expect(res.status).toBe(201);
    expect(res.body.dueDate).toBe('2026-10-31');
  });

  test('TC-API-02 KAN-89 S2 POST without dueDate stores no dueDate or placeholder', async () => {
    const u = await createUser();

    const res = await post(u, body('Undated'));

    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('dueDate');
    expect(stored(res.body.id)).not.toHaveProperty('dueDate');
    expect((await one(u, res.body.id)).body).not.toHaveProperty('dueDate');
  });

  test('TC-API-03 KAN-89 S3 PUT adds a dueDate to an existing todo', async () => {
    const u = await createUser();
    const created = (await post(u, body('Later dated'))).body;

    const res = await put(u, created.id, body('Later dated', { dueDate: '2026-11-01' }));

    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBe('2026-11-01');
    expect(stored(created.id).dueDate).toBe('2026-11-01');
  });

  test('TC-API-04 KAN-89 S4 PUT with an empty dueDate (and with null) clears it', async () => {
    const u = await createUser();
    const created = (await post(u, body('To clear', { dueDate: '2026-10-31' }))).body;

    const cleared = await put(u, created.id, body('To clear', { dueDate: '' }));
    expect(cleared.status).toBe(200);
    expect(cleared.body).not.toHaveProperty('dueDate');
    expect(stored(created.id)).not.toHaveProperty('dueDate');

    await put(u, created.id, body('To clear', { dueDate: '2026-12-25' })).expect(200);
    const clearedByNull = await put(u, created.id, body('To clear', { dueDate: null }));
    expect(clearedByNull.status).toBe(200);
    expect(clearedByNull.body).not.toHaveProperty('dueDate');
  });

  test('TC-API-05 KAN-89 S1/S3 stored dueDate is returned unchanged by GET and kept when a PUT omits the field', async () => {
    const u = await createUser();
    const created = (await post(u, body('Stable', { dueDate: '2026-01-01' }))).body;

    expect((await one(u, created.id)).body.dueDate).toBe('2026-01-01');
    expect((await list(u)).body.find(t => t.id === created.id).dueDate).toBe('2026-01-01');
    expect(stored(created.id).dueDate).toBe('2026-01-01');

    const edited = await put(u, created.id, body('Stable renamed'));
    expect(edited.status).toBe(200);
    expect(edited.body.dueDate).toBe('2026-01-01');
    expect(stored(created.id).dueDate).toBe('2026-01-01');
  });

  test('TC-API-06 KAN-90 S3 GET /todos?sort=dueDate responds 200 with all of the user todos', async () => {
    const u = await createUser();
    await post(u, body('One', { dueDate: '2026-10-01' })).expect(201);
    await post(u, body('Two')).expect(201);
    const unsorted = (await list(u)).body;

    const res = await list(u, '?sort=dueDate');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map(t => t.id).sort()).toEqual(unsorted.map(t => t.id).sort());
  });

  test('TC-API-07 KAN-90 S4 earlier due dates come first', async () => {
    const u = await createUser();
    await post(u, body('Dec', { dueDate: '2026-12-01' })).expect(201);
    await post(u, body('Oct', { dueDate: '2026-10-01' })).expect(201);
    await post(u, body('Nov', { dueDate: '2026-11-15' })).expect(201);

    const res = await list(u, '?sort=dueDate');

    expect(titles(res).slice(0, 3)).toEqual(['Oct', 'Nov', 'Dec']);
    expect(res.body.slice(0, 3).map(t => t.dueDate)).toEqual(['2026-10-01', '2026-11-15', '2026-12-01']);
  });

  test('TC-API-08 KAN-90 S5 mixed dated and undated todos sort dated first, undated last', async () => {
    const u = await createUser();
    await post(u, body('Undated A')).expect(201);
    await post(u, body('Dated Late', { dueDate: '2026-12-01' })).expect(201);
    await post(u, body('Undated B')).expect(201);
    await post(u, body('Dated Early', { dueDate: '2026-10-01' })).expect(201);

    const res = await list(u, '?sort=dueDate');

    expect(res.status).toBe(200);
    expect(titles(res).slice(0, 2)).toEqual(['Dated Early', 'Dated Late']);
    const undated = res.body.slice(2);
    expect(undated.length).toBeGreaterThanOrEqual(2);
    undated.forEach(t => expect(t).not.toHaveProperty('dueDate'));
    expect(titles({ body: undated })).toEqual(expect.arrayContaining(['Undated A', 'Undated B']));
  });

  test('TC-API-09 KAN-90 S3/S5 due date sort combines with search and filter params', async () => {
    const u = await createUser();
    await post(u, body('alpha late', { dueDate: '2026-12-01' })).expect(201);
    const done = (await post(u, body('alpha done', { dueDate: '2026-10-01' }))).body;
    await toggle(u, done.id).expect(200);
    await post(u, body('beta other', { dueDate: '2026-09-01' })).expect(201);
    await post(u, body('alpha none')).expect(201);

    const active = await list(u, '?filter=active&search=alpha&sort=dueDate');
    expect(active.status).toBe(200);
    expect(titles(active)).toEqual(['alpha late', 'alpha none']);

    const completed = await list(u, '?filter=completed&search=alpha&sort=dueDate');
    expect(titles(completed)).toEqual(['alpha done']);

    const searchOnly = await list(u, '?search=alpha&sort=dueDate');
    expect(titles(searchOnly)).toEqual(['alpha done', 'alpha late', 'alpha none']);
  });

  test('TC-API-10 KAN-89 S2 / KAN-90 S2 undated todos never carry an invalid or placeholder dueDate', async () => {
    const u = await createUser();
    await post(u, body('Never dated')).expect(201);
    const cleared = (await post(u, body('Cleared', { dueDate: '2026-10-31' }))).body;
    await put(u, cleared.id, body('Cleared', { dueDate: '' })).expect(200);
    await post(u, body('Dated', { dueDate: '2026-10-31' })).expect(201);

    for (const query of ['', '?sort=dueDate']) {
      const res = await list(u, query);
      expect(res.status).toBe(200);
      res.body.forEach(t => {
        if ('dueDate' in t) {
          expect(t.dueDate).toMatch(ISO_DATE);
        }
      });
      const undated = res.body.filter(t => ['Never dated', 'Cleared'].includes(t.title));
      expect(undated).toHaveLength(2);
      undated.forEach(t => expect(t).not.toHaveProperty('dueDate'));
    }
    const raw = JSON.stringify((await list(u, '?sort=dueDate')).body);
    expect(raw).not.toMatch(/Invalid Date|undefined|"dueDate":null|"dueDate":""/);
  });
});
