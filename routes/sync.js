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
		if ( !req.query.time )
		{
			next( errServ.create( 400, 'missing time', 'fetching updated for a user' ) )
		}
		else
		{
			var timestamp = Math.round( (+req.query.timestamp) / 1000 ) || 0;
			db.getAfterThisTime( req.query.time, timestamp )
			.then(
				longChanges =>
				{
					var changes =
						longChanges
						.map(
							e =>
							({
								d: e.day,
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
	}
);

module.exports = router;
