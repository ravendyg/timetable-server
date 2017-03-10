'use strict';

const express = require('express');
const router = new express.Router();
const assert = require('assert');

const crawler = require('../lib/services/crawler');

const logDb = require('../lib/storage/log');
const mapsDb = require('../lib/storage/maps');
const namesDb = require('../lib/storage/names');
const aliasesDb = require('../lib/storage/aliases');

router.use(function log(req, res, next)
{
  console.log(req.headers['x-real-ip']);
  next();
})


router.get(
  '/lists',
  (req, res) =>
  {
    if (!req.query.api_key)
    {
      res.status(404).send();
      return;
    }
    let lists = crawler.getLists(req.query.tsp);
    if (lists)
    {
      res.json(lists);
    }
    else
    {
      res.status(204).send();
    }
    logDb.writeToLog(req.query.api_key, {
      type: 'list'
    });
  }
);

router.get(
  '/sync/:type',
  (req, res) =>
  {
    if (!req.query.api_key)
    {
      res.status(404).send();
      return;
    }
    try
    {
      let info = crawler.syncData(req.params.type, +req.query.tsp, req.query.id);
      assert(info !== null);
      if (info.length > 0)
      {
        info[0].tsp = Date.now();
        res.json(info[0]);
      }
      else
      {
        res.send();
      }
      logDb.writeToLog(req.query.api_key, {
        type: req.params.type,
        id: req.params.id
      });
    }
    catch (err)
    {
      res.status(404).send();
    }
  }
);

router.put(
  '/alias',
  function putAlias(req, res)
  {
    if (!(req.body.type === 'events' && crawler.getEventList().indexOf(req.body.id.replace(/\./g, '')) !== -1 ||
        ['teachers', 'places'].indexOf(req.body.type) !== -1 && crawler.syncData(req.body.type, 0, req.body.id.replace(/\./g, '')).length > 0) ||
        !req.body.alias)
    {
      res.statusCode(400);
      res.end();
    }
    else
    {
      aliasesDb.putAlias({
        type:  req.body.type,
        key:   req.body.id.replace(/\./g, ''),
        value: req.body.alias,
      });
      crawler.reset();
      mapsDb.drop();
      namesDb.drop();
      res.status(204).send();
    }
  }
);

module.exports = router;
