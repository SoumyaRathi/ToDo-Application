const http = require('http');
const { spawn } = require('child_process');
const { ROOT, backup } = require('../support/data');

const URL_ROOT = 'http://localhost:3000/';

const isUp = () => new Promise(resolve => {
  const req = http.get(URL_ROOT, res => { res.resume(); resolve(true); });
  req.on('error', () => resolve(false));
  req.setTimeout(1000, () => { req.destroy(); resolve(false); });
});

// todoServer.js does not export `app`, so start the real server and let supertest hit it by URL.
module.exports = async () => {
  backup();
  if (await isUp()) return;
  globalThis.__QA_SERVER__ = spawn(process.execPath, ['todoServer.js'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    if (await isUp()) return;
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('todoServer.js did not start on http://localhost:3000');
};
