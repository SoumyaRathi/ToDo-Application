const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FILES = ['todos.json', 'users.json', 'sessions.json'];
const BACKUP_DIR = path.join(os.tmpdir(), 'todo-kan88-qa-backup');

function restore() {
  if (!fs.existsSync(BACKUP_DIR)) return;
  FILES.forEach(f => fs.copyFileSync(path.join(BACKUP_DIR, f), path.join(ROOT, f)));
  fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
}

// Snapshot the flat-file data so QA users/todos never leak into the repo.
// A leftover backup means a previous run crashed; restore it first so we snapshot clean data.
function backup() {
  restore();
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  FILES.forEach(f => fs.copyFileSync(path.join(ROOT, f), path.join(BACKUP_DIR, f)));
}

module.exports = { ROOT, backup, restore };
