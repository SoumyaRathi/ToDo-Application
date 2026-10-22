const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_FILES = ['todos.json', 'users.json', 'sessions.json'];

// The server persists to flat JSON files in the repo root; snapshot them so tests leave no residue.
function backupData() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-data-backup-'));
  const present = {};
  DATA_FILES.forEach(f => {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(dir, f));
      present[f] = true;
    }
  });
  return { dir, present };
}

// A file that did not exist before is removed again (the server treats a missing file as empty).
function restoreData(snapshot) {
  DATA_FILES.forEach(f => {
    const dest = path.join(ROOT, f);
    if (snapshot.present[f]) fs.copyFileSync(path.join(snapshot.dir, f), dest);
    else fs.rmSync(dest, { force: true });
  });
  fs.rmSync(snapshot.dir, { recursive: true, force: true });
}

module.exports = { backupData, restoreData };
