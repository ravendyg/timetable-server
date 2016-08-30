/// <reference path="../index.d.ts" />

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

		var timestamp = Math.round( (+req.query.timestamp) / 1000 ) || 0;
		db.getAfterThisTime( timestamp, req.query.time )
		.then(
			longChanges =>
			{
				var changes =
					longChanges
					.map(
						e =>
						({
							d: e.day,
							t: e.time,
							p: e.place,
							n: e.name,
							g: e.group,
							ps: e.position,
							pn: e.person,
							pi: e.personId,
							f: e.fullName,
							s: e.status,
							ts: e.timestamp
						})
					);

				res.json({
					changes,
					flag: Date.now() - config.CRITICAL_TIME_DIFFERENCE > timestamp ? 'new' : 'upd'
				});
			}
		)
		.catch(
			err => next( errServ.wrapError( err, '', 'fetching updated for a user' ) )
		)
		;
	}
);

module.exports = router;
