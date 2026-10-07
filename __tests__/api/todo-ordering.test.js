const app = require('../../todoServer');
const {
  backupData, restoreData, readJson, readRaw, writeTodosFile,
  createUser, createUserWithTodos, getTodos, reorder, ids,
} = require('./helpers');

const legacyTodo = (id, userId, title) => ({
  id,
  userId,
  title,
  description: `${title} description`,
  completed: false,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
});

beforeEach(backupData);
afterEach(restoreData);

describe('KAN-68 per-user todo ordering API', () => {
  test('API-01 KAN-68 S1 migrate assigns order preserving file order', async () => {
    const user = await createUser(app);
    // Legacy data: no `order` field; file order deliberately differs from id order.
    writeTodosFile([legacyTodo(30, user.userId, 'First in file'), legacyTodo(10, user.userId, 'Second in file'), legacyTodo(20, user.userId, 'Third in file')]);

    const res = await getTodos(app, user.token, '?sort=');

    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual([30, 10, 20]);
    expect(res.body.map(t => t.order)).toEqual([1, 2, 3]);
    const stored = readJson('todos.json').filter(t => t.userId === user.userId);
    expect(stored.map(t => [t.id, t.order])).toEqual([[30, 1], [10, 2], [20, 3]]);
  });

  test('API-02 KAN-68 S1 migration per-user isolation', async () => {
    const a = await createUser(app, 'User A');
    const b = await createUser(app, 'User B');
    // A is legacy (no order, interleaved with B in the file); B already has non-contiguous order values.
    writeTodosFile([
      legacyTodo(30, a.userId, 'A1'),
      { ...legacyTodo(40, b.userId, 'B1'), order: 7 },
      legacyTodo(10, a.userId, 'A2'),
      { ...legacyTodo(50, b.userId, 'B2'), order: 3 },
      legacyTodo(20, a.userId, 'A3'),
    ]);

    const resA = await getTodos(app, a.token, '?sort=');
    expect(ids(resA.body)).toEqual([30, 10, 20]);
    expect(resA.body.map(t => t.order)).toEqual([1, 2, 3]);

    const storedB = readJson('todos.json').filter(t => t.userId === b.userId);
    expect(storedB.map(t => [t.id, t.order])).toEqual([[40, 7], [50, 3]]);
    const resB = await getTodos(app, b.token, '?sort=');
    expect(ids(resB.body)).toEqual([50, 40]);
  });

  test('API-03 KAN-68 S2 GET /todos sorted by order when sort is empty string', async () => {
    const user = await createUser(app);
    writeTodosFile([
      { ...legacyTodo(1, user.userId, 'Three'), order: 3 },
      { ...legacyTodo(2, user.userId, 'One'), order: 1 },
      { ...legacyTodo(3, user.userId, 'Two'), order: 2 },
    ]);

    const res = await getTodos(app, user.token, '?sort=');

    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual([2, 3, 1]);
    expect(res.body.map(t => t.order)).toEqual([1, 2, 3]);
  });

  test('API-04 KAN-68 S2 GET /todos default ordering by order asc', async () => {
    const user = await createUserWithTodos(app, 3);
    const [a, b, c] = ids(user.todos);
    await reorder(app, user.token, { orderedIds: [c, a, b] }).expect(200);

    const res = await getTodos(app, user.token);

    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual([c, a, b]);
    const orders = res.body.map(t => t.order);
    expect(orders).toEqual([...orders].sort((x, y) => x - y));
  });

  test('API-05 KAN-68 S3 bulk reorder persists for subsequent reads', async () => {
    const user = await createUserWithTodos(app, 3);
    const [a, b, c] = ids(user.todos);

    const res = await reorder(app, user.token, { orderedIds: [c, a, b] });

    expect(res.status).toBe(200);
    expect(ids((await getTodos(app, user.token)).body)).toEqual([c, a, b]);
    expect(ids((await getTodos(app, user.token, '?sort=')).body)).toEqual([c, a, b]);
  });

  test('API-06 KAN-68 S3 reorder updates todos.json order fields 1..N', async () => {
    const user = await createUserWithTodos(app, 3);
    const [a, b, c] = ids(user.todos);
    const other = await createUserWithTodos(app, 2);
    const otherBefore = readJson('todos.json').filter(t => t.userId === other.userId);

    await reorder(app, user.token, { orderedIds: [c, a, b] }).expect(200);

    const stored = readJson('todos.json');
    const mine = Object.fromEntries(stored.filter(t => t.userId === user.userId).map(t => [t.id, t.order]));
    expect(mine).toEqual({ [c]: 1, [a]: 2, [b]: 3 });
    expect(stored.filter(t => t.userId === other.userId)).toEqual(otherBefore);
  });

  test('API-07 KAN-68 S4 reorder rejects unknown/unowned id and does not change order', async () => {
    const user = await createUserWithTodos(app, 3);
    const [a, b, c] = ids(user.todos);
    const other = await createUserWithTodos(app, 1);
    const otherTodoId = other.todos[0].id;
    const before = readRaw('todos.json');

    const unknown = await reorder(app, user.token, { orderedIds: [999999, a, b] });
    const unowned = await reorder(app, user.token, { orderedIds: [otherTodoId, a, b] });

    expect(unknown.status).toBe(400);
    expect(unowned.status).toBe(400);
    expect(readRaw('todos.json')).toBe(before);
    expect(ids((await getTodos(app, user.token, '?sort=')).body)).toEqual([a, b, c]);
  });

  test('API-08 KAN-68 S4 reorder rejects length mismatch and does not change order', async () => {
    const user = await createUserWithTodos(app, 3);
    const [a, b, c] = ids(user.todos);
    const before = readRaw('todos.json');

    const shorter = await reorder(app, user.token, { orderedIds: [b, a] });
    const empty = await reorder(app, user.token, { orderedIds: [] });

    expect(shorter.status).toBe(400);
    expect(empty.status).toBe(400);
    expect(readRaw('todos.json')).toBe(before);
    expect(ids((await getTodos(app, user.token, '?sort=')).body)).toEqual([a, b, c]);
  });

  test('API-09 KAN-68 S5 idempotent reorder returns OK with "Order unchanged."', async () => {
    const user = await createUserWithTodos(app, 3);
    const same = ids(user.todos);

    const first = await reorder(app, user.token, { orderedIds: same });
    const second = await reorder(app, user.token, { orderedIds: same });

    expect(first.status).toBe(200);
    expect(first.body.message).toBe('Order unchanged.');
    expect(second.status).toBe(200);
    expect(second.body.message).toBe('Order unchanged.');
    expect(ids((await getTodos(app, user.token, '?sort=')).body)).toEqual(same);
  });

  test('API-10 KAN-68 S5 idempotent reorder does not modify stored order values', async () => {
    const user = await createUserWithTodos(app, 3);
    const [a, b, c] = ids(user.todos);
    await reorder(app, user.token, { orderedIds: [c, a, b] }).expect(200);
    const before = readRaw('todos.json');

    const res = await reorder(app, user.token, { orderedIds: [c, a, b] });

    expect(res.status).toBe(200);
    expect(readRaw('todos.json')).toBe(before);
  });
});
