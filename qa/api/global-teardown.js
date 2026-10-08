const { restore } = require('../support/data');

module.exports = async () => {
  const server = globalThis.__QA_SERVER__;
  if (server) {
    await new Promise(resolve => { server.once('exit', resolve); server.kill(); });
  }
  restore();
};
