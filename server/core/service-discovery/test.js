const assert = require('assert');

const ipfs = require('../storage/ipfs');
const sd = require('./controller');

describe('1 IPFS daemon to be discovered', function() {
  it('should discover services when there is no saved service', async() => {
    await ipfs.startDaemon();
    const ipfsService = await sd.getService(ipfs.validator);
    assert.equal(ipfsService, '0.0.0.0');
    await ipfs.killDaemon();
  });
});

// describe('2 IPFS daemons to be discovered', function() {
// });