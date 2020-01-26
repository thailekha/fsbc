const MongoDBController = require('../core/data/mongodb');

async function flush() {
  try {
    await (new MongoDBController(process.env.ATLAS_CREDS)).deleteDocuments();
    console.log('DB flushed');
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }  
}

flush();