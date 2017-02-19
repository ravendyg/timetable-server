'use strict';

const express = require('express');
const router = new express.Router();
const assert = require('assert');

const crawler = require('../lib/services/crawler');
const utils = require('../lib/services/utils');


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
    let info;
    let action = 'get' + utils.capitalizeFirstLetter(req.params.type);
    try
    {
      info = crawler[action](req.query.tsp, req.query.name);
      assert(info !== null);
      res.json(info);
    }
    catch (err)
    {
      res.status(404).send();
    }
  }
);

module.exports = router;
