'use strict';

var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

const scheduler = require('./lib/services/scheduler');

const api2 = require('./routes/api2');

var app = express();

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * allow cors
 */
app.use('/', function (req, res, next)
{
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With');
  next();
});

app.use('/api2', api2);

// catch 404 and forward to error handler
app.use(function (req, res, next)
{
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});


console.log(app.get('env'));

app.use(
  function (err, req, res)
  {
    console.error(err.stack);
    res.status(err.status || 500);
    res.send();
  }
);

module.exports = app;

scheduler.start();