'use strict';

var express = require('express');
var router = new express.Router();

const crawler = require('../lib/services/crawler');


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
  '/sync/groups',
  (req, res) =>
  {
    let info = crawler.getGroups(req.query.tsp, req.query.groupName);
    if (info)
    {
      res.json(info);
    }
    else
    {
      res.status(404).send();
    }
  }
);

module.exports = router;
