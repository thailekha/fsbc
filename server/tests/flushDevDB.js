const MongoDBController = require('../core/data/mongodb');

async function flush() {
  try {
    await (new MongoDBController(null)).deleteDocuments();
    console.log('Dev DB flushed');
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }  
}

flush();