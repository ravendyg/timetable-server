'use strict';

const express = require('express');
const router = new express.Router();
const assert = require('assert');

const crawler = require('../lib/services/crawler');
const utils = require('../lib/services/utils');
const config = require('../lib/config');


router.get(
  '/lists',
  (req, res) =>
  {
    let lists = crawler.getLists(req.query.tsp);
    if (lists)
    {
      res.json(lists);
    }
    else
    {
      res.status(204).send();
    }
  }
);

router.get(
  '/sync/:type',
  (req, res) =>
  {
    try
    {
      let drop = req.query.tsp < config.DROP_CACHE_AFTER; // use to force cache drop when smth changed
      let info = crawler.syncData(req.params.type, drop ? 0 : req.query.tsp, req.query.id);
      assert(info !== null);
      res.json({info, drop});
    }
    catch (err)
    {
      res.status(404).send();
    }
  }
);

module.exports = router;
