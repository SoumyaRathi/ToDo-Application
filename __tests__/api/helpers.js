const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const ROOT = path.join(__dirname, '..', '..');
const DATA_FILES = ['todos.json', 'users.json', 'sessions.json'].map(f => path.join(ROOT, f));

let backupDir = null;

function backupData() {
  backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-api-backup-'));
  DATA_FILES.forEach(f => fs.copyFileSync(f, path.join(backupDir, path.basename(f))));
}

function restoreData() {
  if (!backupDir) return;
  DATA_FILES.forEach(f => fs.copyFileSync(path.join(backupDir, path.basename(f)), f));
  fs.rmSync(backupDir, { recursive: true, force: true });
  backupDir = null;
}

const readJson = name => JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8'));
const readRaw = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const writeTodosFile = todos => fs.writeFileSync(path.join(ROOT, 'todos.json'), JSON.stringify(todos, null, 2));

let counter = 0;
const uniqueEmail = () => `qa-${Date.now()}-${process.pid}-${counter++}@example.test`;

// Signs up and logs in a user via the real routes; returns { token, userId, email }.
async function createUser(app, name = 'QA User') {
  const email = uniqueEmail();
  const password = 'Passw0rd!';
  await request(app).post('/signup').send({ name, email, password }).expect(201);
  const login = await request(app).post('/login').send({ email, password }).expect(200);
  const userId = readJson('users.json').find(u => u.email === email).id;
  return { token: login.body.token, userId, email };
}

async function addTodo(app, token, title) {
  const res = await request(app)
    .post('/todos')
    .set('Authorization', token)
    .send({ title, description: `${title} description`, completed: false })
    .expect(201);
  return res.body;
}

// Signup creates a welcome todo, so a user starting with `count` todos gets (count - 1) extra ones.
async function createUserWithTodos(app, count) {
  const user = await createUser(app);
  const first = (await request(app).get('/todos').set('Authorization', user.token)).body[0];
  const todos = [first];
  for (let i = 1; i < count; i++) todos.push(await addTodo(app, user.token, `Todo ${String.fromCharCode(65 + i)}`));
  return { ...user, todos };
}

const getTodos = (app, token, query = '') => request(app).get(`/todos${query}`).set('Authorization', token);
const reorder = (app, token, body) => request(app).put('/todos/reorder').set('Authorization', token).send(body);
const ids = list => list.map(t => t.id);

module.exports = {
  backupData, restoreData, readJson, readRaw, writeTodosFile,
  createUser, createUserWithTodos, addTodo, getTodos, reorder, ids,
};
