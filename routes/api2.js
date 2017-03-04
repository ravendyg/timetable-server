'use strict';

const express = require('express');
const router = new express.Router();
const assert = require('assert');

const crawler = require('../lib/services/crawler');
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
    }
    catch (err)
    {
      res.status(404).send();
    }
  }
);

module.exports = router;
