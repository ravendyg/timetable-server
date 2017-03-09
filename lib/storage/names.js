'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Bluebird = require('bluebird');

const Name =
  mongoose.model(
    'Name',
    new Schema({
      shortName: {type: String, index: {unique: true} },
      fullName: String
    })
  );

module.exports = {
  getName, putName, drop
};

function getName(shortName)
{
  return new Bluebird((resolve, reject) =>
  {
    Name.findOne({shortName}, (err, doc) =>
    {
      if (doc)
      {
        resolve(doc.fullName);
      }
      else
      {
        reject(new Error('not found'));
      }
    });
  });
}

function putName(shortName, fullName)
{
  Name.findOne({shortName}, (err, res) =>
  {
    if (!res)
    {
      Name.create({
        shortName,
        fullName
      });
    }
    else
    {
      Name.update({
        shortName,
        fullName
      });
    }
  });
}

function drop()
{
  Name.remove({}, err => {
    debugger;
  })
}