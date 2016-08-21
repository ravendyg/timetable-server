/// <reference path="../index.d.ts" />

const express = require('express');
const router = express.Router();

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
			var timestamp = req.query.timestamp || 0;
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
								pn: e.person,
								pi: e.personId,
								f: e.fullName,
								s: e.status,
								ts: e.timestamp
							})
						);
					res.json(changes);
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
