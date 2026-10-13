const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const ROOT = path.join(__dirname, '..', '..');
const DATA_FILES = ['todos.json', 'users.json', 'sessions.json'];
const FIXTURES = { 'todos.json': '[]', 'users.json': '[]', 'sessions.json': '{}' };

let backupDir = null;
let emailCounter = 0;

// The app persists to flat JSON files in the repo root, so snapshot them before tests and restore afterwards.
function backupData() {
  if (backupDir) return;
  backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kan109-data-'));
  DATA_FILES.forEach(f => fs.copyFileSync(path.join(ROOT, f), path.join(backupDir, f)));
}

function resetData() {
  DATA_FILES.forEach(f => fs.writeFileSync(path.join(ROOT, f), FIXTURES[f]));
}

function restoreData() {
  if (!backupDir) return;
  DATA_FILES.forEach(f => fs.copyFileSync(path.join(backupDir, f), path.join(ROOT, f)));
  fs.rmSync(backupDir, { recursive: true, force: true });
  backupDir = null;
}

function uniqueEmail() {
  emailCounter += 1;
  return `kan109-${Date.now()}-${emailCounter}@example.com`;
}

// YYYY-MM-DD for today + offsetDays, using the UTC date (same basis as the UI's badge logic).
function ymd(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

async function signupAndLogin(app) {
  const email = uniqueEmail();
  const password = 'Passw0rd!';
  await request(app).post('/signup').send({ name: 'QA User', email, password }).expect(201);
  const res = await request(app).post('/login').send({ email, password }).expect(200);
  return { token: res.body.token, email, password };
}

module.exports = { backupData, resetData, restoreData, uniqueEmail, ymd, signupAndLogin };
