const request = require('supertest');
const app = require('../../todoServer');
const { backupData, restoreData } = require('../../test-support/data-backup');

let snapshot;
let token;

const auth = () => ({ Authorization: token });

async function createTodo(body) {
  return request(app).post('/todos').set(auth()).send({ description: 'api test', completed: false, ...body });
}

beforeAll(async () => {
  snapshot = backupData();
  const email = `api-duedate-${Date.now()}@test.com`;
  const signup = await request(app).post('/signup').send({ name: 'API Tester', email, password: 'pw12345' });
  expect(signup.status).toBe(201);
  const login = await request(app).post('/login').send({ email, password: 'pw12345' });
  expect(login.status).toBe(200);
  token = login.body.token;
});

afterAll(() => {
  restoreData(snapshot);
});

describe('Due date API (KAN-116 / KAN-117 / KAN-118)', () => {
  test('API-01 (KAN-117 S1): POST with dueDate returns 201 with dueDate and persists', async () => {
    const res = await createTodo({ title: 'API-01', dueDate: '2030-05-17' });
    expect(res.status).toBe(201);
    expect(res.body.dueDate).toBe('2030-05-17');
    const get = await request(app).get(`/todos/${res.body.id}`).set(auth());
    expect(get.status).toBe(200);
    expect(get.body.dueDate).toBe('2030-05-17');
  });

  test('API-02 (KAN-117 S2): POST without dueDate returns 201 and no dueDate', async () => {
    const res = await createTodo({ title: 'API-02' });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('dueDate');
    const get = await request(app).get(`/todos/${res.body.id}`).set(auth());
    expect(get.body).not.toHaveProperty('dueDate');
  });

  test('API-03 (KAN-117 S6): POST with dueDate 2026/10/22 returns 400 with field dueDate', async () => {
    const res = await createTodo({ title: 'API-03', dueDate: '2026/10/22' });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('dueDate');
  });

  test('API-04 (KAN-117 S6): POST with impossible date 2026-02-30 returns 400 with field dueDate', async () => {
    const res = await createTodo({ title: 'API-04', dueDate: '2026-02-30' });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('dueDate');
  });

  test('API-05 (KAN-117 S3): created dueDate is returned unchanged by GET /todos/:id', async () => {
    const created = await createTodo({ title: 'API-05', dueDate: '2031-12-31' });
    expect(created.status).toBe(201);
    const get = await request(app).get(`/todos/${created.body.id}`).set(auth());
    expect(get.status).toBe(200);
    expect(get.body.dueDate).toBe(created.body.dueDate);
    expect(get.body.dueDate).toBe('2031-12-31');
  });

  test('API-06 (KAN-117 S4): PUT updates dueDate and persists', async () => {
    const created = await createTodo({ title: 'API-06', dueDate: '2030-01-01' });
    const put = await request(app).put(`/todos/${created.body.id}`).set(auth())
      .send({ title: 'API-06', description: 'api test', completed: false, dueDate: '2032-06-18' });
    expect(put.status).toBe(200);
    expect(put.body.dueDate).toBe('2032-06-18');
    const get = await request(app).get(`/todos/${created.body.id}`).set(auth());
    expect(get.body.dueDate).toBe('2032-06-18');
  });

  test('API-07 (KAN-117 S5): PUT with dueDate null clears the due date', async () => {
    const created = await createTodo({ title: 'API-07', dueDate: '2030-01-01' });
    const put = await request(app).put(`/todos/${created.body.id}`).set(auth())
      .send({ title: 'API-07', description: 'api test', completed: false, dueDate: null });
    expect(put.status).toBe(200);
    const get = await request(app).get(`/todos/${created.body.id}`).set(auth());
    expect(get.body).not.toHaveProperty('dueDate');
  });

  test('API-08 (KAN-117 S5): PUT with dueDate empty string clears the due date', async () => {
    const created = await createTodo({ title: 'API-08', dueDate: '2030-01-01' });
    const put = await request(app).put(`/todos/${created.body.id}`).set(auth())
      .send({ title: 'API-08', description: 'api test', completed: false, dueDate: '' });
    expect(put.status).toBe(200);
    const get = await request(app).get(`/todos/${created.body.id}`).set(auth());
    expect(get.body).not.toHaveProperty('dueDate');
  });

  test('API-09 (KAN-118 S6): sort=dueDate puts dated items before undated and returns all items', async () => {
    await createTodo({ title: 'API-09 undated A' });
    await createTodo({ title: 'API-09 dated', dueDate: '2033-03-03' });
    await createTodo({ title: 'API-09 undated B' });
    const unsorted = await request(app).get('/todos').set(auth());
    const sorted = await request(app).get('/todos?sort=dueDate').set(auth());
    expect(sorted.status).toBe(200);
    expect(sorted.body.map(t => t.id).sort((a, b) => a - b)).toEqual(unsorted.body.map(t => t.id).sort((a, b) => a - b));
    const firstUndated = sorted.body.findIndex(t => !t.dueDate);
    expect(firstUndated).toBeGreaterThan(-1);
    expect(sorted.body.slice(firstUndated).every(t => !t.dueDate)).toBe(true);
    expect(sorted.body.slice(0, firstUndated).every(t => !!t.dueDate)).toBe(true);
  });

  test('API-10 (KAN-118 S4): sort=dueDate orders dated items ascending', async () => {
    await createTodo({ title: 'API-10 late', dueDate: '2040-09-09' });
    await createTodo({ title: 'API-10 early', dueDate: '2034-01-01' });
    await createTodo({ title: 'API-10 middle', dueDate: '2037-05-05' });
    const sorted = await request(app).get('/todos?sort=dueDate').set(auth());
    expect(sorted.status).toBe(200);
    const dates = sorted.body.filter(t => t.dueDate).map(t => t.dueDate);
    expect(dates.length).toBeGreaterThanOrEqual(3);
    expect(dates).toEqual([...dates].sort());
  });
});
