const request = require('supertest');
const { BASE_URL, startServer, stopServer } = require('../helpers/server-process.cjs');
const { backupAndReset, restore } = require('../helpers/json-fixtures.cjs');

let token;
const api = () => request(BASE_URL);
const authed = req => req.set('Authorization', token);

async function createTodo(extra = {}) {
  const res = await authed(api().post('/todos')).send({
    title: 'api todo',
    description: 'api description',
    completed: false,
    ...extra,
  });
  return res;
}

beforeAll(async () => {
  backupAndReset();
  await startServer();
  const email = `qa-kan95-${Date.now()}@example.com`;
  const password = 'Passw0rd!';
  await api().post('/signup').send({ name: 'QA KAN95', email, password }).expect(201);
  const login = await api().post('/login').send({ email, password }).expect(200);
  token = login.body.token;
});

afterAll(async () => {
  await stopServer();
  restore();
});

describe('dueDate API (KAN-96 / KAN-97)', () => {
  test('API-01 KAN-96 S1: POST /todos with valid dueDate returns 201 and includes dueDate', async () => {
    const res = await createTodo({ title: 'API-01', dueDate: '2026-05-20' });
    expect(res.status).toBe(201);
    expect(res.body.dueDate).toBe('2026-05-20');
  });

  test('API-02 KAN-96 S2: POST /todos without dueDate returns 201 and omits dueDate', async () => {
    const res = await createTodo({ title: 'API-02' });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('dueDate');
  });

  test('API-03 KAN-96 S6: POST /todos with invalid dueDate returns 400 with field=dueDate', async () => {
    const res = await createTodo({ title: 'API-03', dueDate: '2026-99-99' });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('dueDate');
  });

  test('API-04 KAN-96 S4: PUT /todos/:id sets a new dueDate', async () => {
    const created = await createTodo({ title: 'API-04', dueDate: '2026-05-20' });
    const res = await authed(api().put(`/todos/${created.body.id}`)).send({
      title: 'API-04',
      description: 'api description',
      completed: false,
      dueDate: '2026-08-15',
    });
    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBe('2026-08-15');
  });

  test('API-05 KAN-96 S5: PUT /todos/:id with dueDate null clears the dueDate', async () => {
    const created = await createTodo({ title: 'API-05', dueDate: '2026-05-20' });
    const res = await authed(api().put(`/todos/${created.body.id}`)).send({
      title: 'API-05',
      description: 'api description',
      completed: false,
      dueDate: null,
    });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('dueDate');
    const fetched = await authed(api().get(`/todos/${created.body.id}`));
    expect(fetched.body).not.toHaveProperty('dueDate');
  });

  test('API-06 KAN-96 S3: GET /todos/:id returns the stored dueDate', async () => {
    const created = await createTodo({ title: 'API-06', dueDate: '2026-09-09' });
    const res = await authed(api().get(`/todos/${created.body.id}`));
    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBe('2026-09-09');
  });

  test('API-07 KAN-97 S3: GET /todos?sort=dueDate returns ascending dueDate', async () => {
    await createTodo({ title: 'API-07 c', dueDate: '2027-03-01' });
    await createTodo({ title: 'API-07 a', dueDate: '2027-01-15' });
    await createTodo({ title: 'API-07 b', dueDate: '2027-02-10' });
    const res = await authed(api().get('/todos?sort=dueDate'));
    expect(res.status).toBe(200);
    const dates = res.body.filter(t => t.dueDate).map(t => t.dueDate);
    expect(dates.length).toBeGreaterThanOrEqual(3);
    expect(dates).toEqual([...dates].sort());
    const mine = res.body.filter(t => t.title.startsWith('API-07')).map(t => t.title);
    expect(mine).toEqual(['API-07 a', 'API-07 b', 'API-07 c']);
  });

  test('API-08 KAN-97 S4: sort=dueDate places todos without dueDate last', async () => {
    await createTodo({ title: 'API-08 dated', dueDate: '2028-01-01' });
    await createTodo({ title: 'API-08 undated' });
    const res = await authed(api().get('/todos?sort=dueDate'));
    expect(res.status).toBe(200);
    const flags = res.body.map(t => Boolean(t.dueDate));
    expect(flags).toContain(false);
    expect(flags).toContain(true);
    expect(flags.lastIndexOf(true)).toBeLessThan(flags.indexOf(false));
  });

  test('API-09 KAN-97 S5: equal dueDates are ordered deterministically by id', async () => {
    const ids = [];
    for (const n of [1, 2, 3]) {
      const res = await createTodo({ title: `API-09 ${n}`, dueDate: '2031-02-02' });
      ids.push(res.body.id);
    }
    const first = await authed(api().get('/todos?sort=dueDate'));
    const second = await authed(api().get('/todos?sort=dueDate'));
    const pick = body => body.filter(t => t.dueDate === '2031-02-02').map(t => t.id);
    expect(pick(first.body)).toEqual(ids);
    expect(pick(second.body)).toEqual(ids);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  test('API-10 KAN-97 S6: dueDate round-trips unchanged after create and get', async () => {
    for (const date of ['2026-01-01', '2026-12-31', '2024-02-29']) {
      const created = await createTodo({ title: `API-10 ${date}`, dueDate: date });
      expect(created.body.dueDate).toBe(date);
      const fetched = await authed(api().get(`/todos/${created.body.id}`));
      expect(fetched.body.dueDate).toBe(date);
    }
  });
});
