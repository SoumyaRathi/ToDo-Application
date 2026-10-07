const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_FILES = ['todos.json', 'users.json', 'sessions.json'];
const BACKUP_DIR = path.join(os.tmpdir(), 'todo-e2e-data-backup');

module.exports = async () => {
  if (!fs.existsSync(BACKUP_DIR)) return;
  DATA_FILES.forEach(f => fs.copyFileSync(path.join(BACKUP_DIR, f), path.join(ROOT, f)));
  fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
};
