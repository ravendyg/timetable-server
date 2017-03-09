'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Bluebird = require('bluebird');

const Alias =
  mongoose.model(
    'Alias',
    new Schema({
      aliases: Object,
      id: String
    })
  );


module.exports = {
  putAlias, getAliases, removeAlias
};

function getAliases()
{
  return new Bluebird((resolve, reject) =>
  {
    Alias.findOne({id: 1}, (err, doc) =>
    {
      if (err)
      {
        reject(err);
      }
      else if (doc)
      {
        resolve(doc);
      }
      else
      {
        Alias.create({id: 1}, {}, () =>
        {
          resolve({});
        });
      }
    });
  });
}

function putAlias(key, value, obj)
{
  obj[key] = value;
  Alias.update({id: 1}, obj);
}

function removeAlias(key, obj)
{
  delete obj[key];
  Alias.update({id: 1}, obj);
}