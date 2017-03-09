'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Bluebird = require('bluebird');

const Maps =
  mongoose.model(
    'Maps',
    new Schema({
      id: Number,
      groupsListMap: Object,
      teachersListMap: Object,
      namesMap: Object,
      groupsMap: Object,
      teachersMap: Object,
      placesMap: Object,
    })
  );

module.exports = {
  getMaps, putMaps
};

function getMaps()
{
  return new Bluebird(resolve =>
  {
    Maps.findOne({id: 1}, (err, doc) =>
    {
      if (doc)
      {
        resolve(doc);
      }
      else
      {
        resolve({
          groupsListMap: {},
          teachersListMap: {},
          namesMap: {},
          groupsMap: {},
          teachersMap: {},
          placesMap: {},
        });
      }
    });
  });
}

function putMaps({
  groupsListMap,
  teachersListMap,
  namesMap,
  groupsMap,
  teachersMap,
  placesMap,
})
{
  Maps.findOne({id: 1}, (err, res) =>
  {
    if (!res)
    {
      Maps.create({
        id: 1,
        groupsListMap,
        teachersListMap,
        namesMap,
        groupsMap,
        teachersMap,
        placesMap,
      });
    }
    else
    {
      Maps.update({
        id: 1,
        groupsListMap,
        teachersListMap,
        namesMap,
        groupsMap,
        teachersMap,
        placesMap,
      });
    }
  });
}