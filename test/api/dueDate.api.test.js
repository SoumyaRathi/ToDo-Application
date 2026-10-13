const request = require('supertest');
const app = require('../../todoServer');
const { backupData, resetData, restoreData, ymd, signupAndLogin } = require('./testUtils');

// KAN-109 (Epic) / KAN-110 / KAN-111: dueDate behaviour exposed by the existing API.
let token;

const createTodo = (body) =>
  request(app).post('/todos').set('Authorization', token).send({ description: 'desc', completed: false, ...body });

beforeAll(() => backupData());
afterAll(() => restoreData());
beforeEach(async () => {
  resetData();
  ({ token } = await signupAndLogin(app));
});

test('API-01 POST /todos with dueDate 2030-12-31 returns 201 and echoes dueDate', async () => {
  const res = await createTodo({ title: 'with due', dueDate: '2030-12-31' });
  expect(res.status).toBe(201);
  expect(res.body.dueDate).toBe('2030-12-31');
});

test('API-02 POST /todos without dueDate returns 201 and no dueDate property', async () => {
  const res = await createTodo({ title: 'no due' });
  expect(res.status).toBe(201);
  expect(res.body).not.toHaveProperty('dueDate');
});

test('API-03 POST /todos with dueDate 12/31/2030 returns 400 with field dueDate', async () => {
  const res = await createTodo({ title: 'bad due', dueDate: '12/31/2030' });
  expect(res.status).toBe(400);
  expect(res.body.field).toBe('dueDate');
});

test('API-04 GET /todos/:id returns the dueDate of a created todo', async () => {
  const created = await createTodo({ title: 'fetch me', dueDate: '2030-12-31' });
  const res = await request(app).get(`/todos/${created.body.id}`).set('Authorization', token);
  expect(res.status).toBe(200);
  expect(res.body.dueDate).toBe('2030-12-31');
});

test('API-05 PUT /todos/:id with dueDate null returns 200 and removes dueDate', async () => {
  const created = await createTodo({ title: 'clear me', dueDate: '2030-12-31' });
  const res = await request(app)
    .put(`/todos/${created.body.id}`)
    .set('Authorization', token)
    .send({ title: 'clear me', description: 'desc', completed: false, dueDate: null });
  expect(res.status).toBe(200);
  expect(res.body.dueDate).toBeUndefined();
});

test('API-06 GET /todos?sort=dueDate lists dated todos ascending, undated last', async () => {
  await createTodo({ title: 'later', dueDate: '2030-01-02' });
  await createTodo({ title: 'earlier', dueDate: '2030-01-01' });
  await createTodo({ title: 'undated' });
  const res = await request(app).get('/todos?sort=dueDate').set('Authorization', token);
  expect(res.status).toBe(200);
  expect(res.body.slice(0, 2).map(t => t.title)).toEqual(['earlier', 'later']);
  expect(res.body.slice(0, 2).map(t => t.dueDate)).toEqual(['2030-01-01', '2030-01-02']);
  const rest = res.body.slice(2);
  expect(rest.map(t => t.title)).toContain('undated');
  expect(rest.every(t => !t.dueDate)).toBe(true);
});

test('API-07 GET /todos without Authorization returns 401', async () => {
  const res = await request(app).get('/todos');
  expect(res.status).toBe(401);
});

test('API-08 GET /todos includes a todo with dueDate after creation', async () => {
  await createTodo({ title: 'listed', dueDate: '2030-12-31' });
  const res = await request(app).get('/todos').set('Authorization', token);
  expect(res.status).toBe(200);
  const found = res.body.find(t => t.title === 'listed');
  expect(found).toBeDefined();
  expect(found.dueDate).toBe('2030-12-31');
});

test('API-09 past, today and future dueDates are all stored and returned by GET /todos', async () => {
  const dates = { past: ymd(-1), today: ymd(0), future: ymd(1) };
  for (const [title, dueDate] of Object.entries(dates)) {
    const res = await createTodo({ title, dueDate });
    expect(res.status).toBe(201);
  }
  const res = await request(app).get('/todos').set('Authorization', token);
  expect(res.status).toBe(200);
  for (const [title, dueDate] of Object.entries(dates)) {
    expect(res.body.find(t => t.title === title).dueDate).toBe(dueDate);
  }
});

test('API-10 PUT /todos/:id with invalid dueDate returns 400 with field dueDate', async () => {
  const created = await createTodo({ title: 'update me', dueDate: '2030-12-31' });
  const res = await request(app)
    .put(`/todos/${created.body.id}`)
    .set('Authorization', token)
    .send({ title: 'update me', description: 'desc', completed: false, dueDate: '12/31/2030' });
  expect(res.status).toBe(400);
  expect(res.body.field).toBe('dueDate');
});
