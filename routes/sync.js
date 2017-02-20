'use strict';

const express = require('express');
const router = express.Router();

const config = require('../lib/config');
const db = require('../lib/services/db');
const errServ = require('../lib/services/error');

/* GET home page. */
router.get(
	'/',
	(req, res, next) =>
	{
		console.log(req.headers['x-real-ip']);

    let timestamp = Math.round( (+req.query.timestamp) / 1000 ) || 0;

    let flag =
      ( Date.now() - config.CRITICAL_TIME_DIFFERENCE > timestamp * 1000 ||
        timestamp < config.RESET_TIMESTAMP
      )
      ? 'new'
      : 'upd'
      ;

		db.getAfterThisTime( flag === 'new' ? 0 : timestamp, req.query.time )
		.then(
			longChanges =>
			{
				var changes =
					longChanges
					.map(
						e =>
						{
							var out =
							{
								d: e.day,
								t: e.time,
								p: e.place,
								n: e.lesson_name,
								g: e.group_name,
								ps: e.position,
								pn: e.person_name,
								pi: e.person,
								f: e.full_name,
								s: e.status,
								ts: e.timestamp
							};
							return out;
						}
					);

				res.json({ changes, flag });
			}
		)
		.catch(
			err => next( errServ.wrapError( err, '', 'fetching updated for a user' ) )
		)
		;
	}
);

module.exports = router;
