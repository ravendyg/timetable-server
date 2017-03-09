'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Bluebird = require('bluebird');

const Alias =
  mongoose.model(
    'Alias',
    new Schema({
      id: Number,
      teachers: Object,
      places:   Object,
      events:   Object,
    })
  );

let obj;

let _obj = {
  id: 1,
  teachers: {'0': ''},
  places:   {'0': ''},
  events:   {'0': ''},
};


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
        obj = doc;
        resolve(obj);
      }
      else
      {
        Alias.create([_obj], () =>
        {
          Alias.findOne({id: 1}, (err2, __doc) =>
          {
            if (err2)
            {
              reject(err2);
            }
            else if (doc)
            {
              obj = __doc;
              resolve(obj);
            }
          });
        });
      }
    });
  });
}

function putAlias({type, key, value})
{
  let temp = obj[type];
  temp[key] = value;
  obj[type] = temp;
  Alias.update({id: 1},
  {
    events: obj.events,
    places: obj.places,
    teachers: obj.teachers,
  }, err =>
  {
    debugger;
  });
}

function removeAlias({type, key})
{
  let temp = obj[type];
  delete temp[key];
  obj[type] = temp;
  Alias.update({id: 1},
  {
    events: obj.events,
    places: obj.places,
    teachers: obj.teachers,
  }, err =>
  {
    debugger;
  });
}