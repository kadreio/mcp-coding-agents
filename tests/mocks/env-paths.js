// Mock for env-paths module
module.exports = function envPaths(name, options) {
  const path = require('path');
  const os = require('os');
  
  // Simple mock that returns standard paths for testing
  const base = path.join(os.tmpdir(), 'test-' + name);
  
  return {
    data: path.join(base, 'data'),
    config: path.join(base, 'config'),
    cache: path.join(base, 'cache'),
    log: path.join(base, 'log'),
    temp: path.join(base, 'temp')
  };
};