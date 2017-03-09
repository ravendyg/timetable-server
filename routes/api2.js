'use strict';

const express = require('express');
const router = new express.Router();
const assert = require('assert');

const crawler = require('../lib/services/crawler');

const logDb = require('../lib/storage/log');


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

module.exports = router;
