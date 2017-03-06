'use strict';

const mongoose = require('mongoose');

const config = require('../config');

function connectToDb(cb)
{
  mongoose.Promise = Promise;
  mongoose.connect(`mongodb://${config.MONGO_HOST}:${config.MONGO_PORT}/${config.MONGO_DB_NAME}`);
  const db = mongoose.connection;

  db.on(
    'error',
    err =>
    {
      console.error(err.stack, 'connection failed');
      if (err.code !== 18 && err.message !== 'connection timeout')
      { // not auth failure
        connectToDb();
      }
    }
  );

  if (cb)
  {
    db.once(
      'open',
      cb
    );
  }
}
module.exports.connectToDb = connectToDb;