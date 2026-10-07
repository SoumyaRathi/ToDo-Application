const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_FILES = ['todos.json', 'users.json', 'sessions.json'];
const BACKUP_DIR = path.join(os.tmpdir(), 'todo-e2e-data-backup');

// Snapshot the flat-file data so test users/todos do not leak into the repo.
module.exports = async () => {
  fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  DATA_FILES.forEach(f => fs.copyFileSync(path.join(ROOT, f), path.join(BACKUP_DIR, f)));
};
