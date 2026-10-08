const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const EMPTY_FIXTURES = { 'users.json': '[]', 'todos.json': '[]', 'sessions.json': '{}' };
const BACKUP_DIR = path.join(os.tmpdir(), 'todo-kan95-qa-backup');

function restore() {
  if (!fs.existsSync(BACKUP_DIR)) return;
  for (const file of Object.keys(EMPTY_FIXTURES)) {
    const target = path.join(ROOT, file);
    const backup = path.join(BACKUP_DIR, file);
    if (fs.existsSync(backup)) fs.copyFileSync(backup, target);
    else if (fs.existsSync(backup + '.absent')) fs.rmSync(target, { force: true });
  }
  fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
}

// Byte-exact backup of the real data files, then swap in empty fixtures.
function backupAndReset() {
  restore(); // recovers the originals if a previous run crashed before restoring
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  for (const [file, empty] of Object.entries(EMPTY_FIXTURES)) {
    const target = path.join(ROOT, file);
    if (fs.existsSync(target)) fs.copyFileSync(target, path.join(BACKUP_DIR, file));
    else fs.writeFileSync(path.join(BACKUP_DIR, file + '.absent'), '');
    fs.writeFileSync(target, empty);
  }
}

module.exports = { backupAndReset, restore };
