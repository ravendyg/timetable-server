'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Log =
  mongoose.model(
    'Log',
    new Schema({
      apiKey: String,
      tsp: Number,
      resource: Object
    })
  );

module.exports = {
  writeToLog
};


function writeToLog(apiKey, resource)
{
  let tsp = Date.now();
  let record = {
    apiKey, tsp, resource
  };
  Log.create(record);
}