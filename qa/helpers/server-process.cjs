const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function isPortInUse(port = PORT) {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

function ping() {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/' }, res => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
  });
}

let child = null;

async function startServer(timeoutMs = 15000) {
  if (await isPortInUse()) throw new Error(`Port ${PORT} is already in use; stop the running server first.`);
  child = spawn(process.execPath, ['todoServer.js'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', d => { output += d; });
  child.stderr.on('data', d => { output += d; });
  let exited = false;
  child.once('exit', () => { exited = true; });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited) throw new Error(`Server exited during startup:\n${output}`);
    if (await ping()) return;
    await new Promise(r => setTimeout(r, 150));
  }
  await stopServer();
  throw new Error(`Server did not become ready within ${timeoutMs}ms:\n${output}`);
}

function stopServer() {
  return new Promise(resolve => {
    if (!child || child.exitCode !== null) { child = null; return resolve(); }
    child.once('exit', () => { child = null; resolve(); });
    child.kill();
  });
}

module.exports = { BASE_URL, PORT, isPortInUse, startServer, stopServer };
