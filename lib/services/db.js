/// <reference path="../../index.d.ts" />
require('mongodb');
var MongoClient

setTimeout(
	() =>
	{
 		MongoClient = require('mongodb').MongoClient;
	},
	200
);

const config = require('../config');
const scheduler = require('./scheduler');
const utils = require('./utils');

const myNsu = require('./my-nsu');


var DB;

MongoClient.connect(
	config.MONGO_HOST + '/' + config.DB_NAME,
	(err, db) =>
	{
		if (db)
		{
			DB = db;
			DB.collection(config.TECH_COLLECTION_NAME)
			.findOne(
				{ type: 'lastSync' },
				(err, res) =>
				{
					if (err)
					{
						console.error(err, 'getting last sync');
					}
					else if ( !res )
					{
						scheduler.start({ dayStart: 0, hour: 0 });
					}
					else
					{
						scheduler.start({ dayStart: res.dayStart, hour: res.hour });
					}
				}
			);
		}
		else if (err)
		{
			console.error(err, 'starting mongo');
		}
		else
		{
			console.error(err, database, 'db wtf');
		}
	}
);

function recordRun (params)
{
	DB.collection(config.TECH_COLLECTION_NAME)
	.update(
		{ type: 'lastSync' },
		{
				type: 'lastSync',
				dayStart: params.dayStart,
				hour: params.hour
		},
		{upsert: true},
		(err, res) =>
		{
			if (err) { console.log(err, 'updating last sync'); }
		}
	);
}
module.exports.recordRun = recordRun;


function putToStorage ( events )
{
	for (var i = 0; i < events.length; i++)
	{
		check( events[i] );
	}
}
module.exports.putToStorage = putToStorage;

function getAfterThisTime (tmst, time)
{
	var query = {};

	if (Date.now() - config.CRITICAL_TIME_DIFFERENCE > tmst * 1000)
	{	// to much time passed
		query.status = 1;
	}
	else
	{	// just updates, that can include status === 0
		query.timestamp = { $gt: tmst };
	}

	if (time)
	{
		query.time = time;
	}

	return DB
		.collection(config.SYNC_COLLECTION_NAME)
		.find(
			query,
			{_id: false}
		)
		.toArray();
}
module.exports.getAfterThisTime = getAfterThisTime;


function check (item)
{
	var timestamp = utils.tstmp();

	DB.collection(config.SYNC_COLLECTION_NAME)
	.findOne(
		{
			day:	 item.day,
			time:  item.time,
			place: item.place,
			group: item.group
		},
		{
			_id: 0
		},
		(err, doc) =>
		{
			if (err)
			{
				console.error(err, 'updating db');
			}
			else if ( !doc )
			{	// completely new one
				if (item.status === 1 && item.personId)
				{
					myNsu.getFullName(item.person, item.personId)
					.then(
						fullName =>
						{
							item.fullName = fullName || '';
							insert( item, timestamp);
						}
					);
				}
				else if (item.status === 1)
				{	// no need for a name, but don't insert status === 0
					item.fullName = "";
					insert( item, timestamp);
				}
			}
			else if
			(
				doc.name !== item.name || doc.person !== item.person ||
				doc.personId !== item.personId || doc.position !== item.position
			)
			{	// smth changed
				if (item.status === 1 && item.person)
				{
					myNsu.getFullName(item.person)
					.then(
						fullName =>
						{
							item.fullName = fullName || '';
							// later implement garbage collector to removeold records
							update( item, timestamp);
						}
					);
				}
				else
				{	// no need for a name, and can update to status === 0
					item.fullName = "";
					update( item, timestamp);
				}
			}
			else
			{
				// console.log('nothing changed, do nothing');
			}
		}
	);
}


function insert (item, timestamp)
{
	DB.collection(config.SYNC_COLLECTION_NAME)
	.insert(
		{
			day:			item.day,
			time: 		item.time,
			place: 		item.place,
			group: 		item.group,

			name: 		item.name,
			position: item.position,
			person: 	item.person,
			personId: item.personId,
			fullName: item.fullName,
			status: 	item.status,
			timestamp
		},
		(err, res) =>
		{
			if (err)
			{
				console.error(err, 'inserting in db');
			}
		}
	);
}


function update (item, timestamp)
{
	DB.collection(config.SYNC_COLLECTION_NAME)
	.update(
		{
			day:		item.day,
			time: 	item.time,
			place: 	item.place,
			group: 		item.group,
		},
		{
			$set:
			{
				name: 		item.name,
				position: item.position,
				person: 	item.person,
				personId: item.personId,
				fullName: item.fullName,
				status: 	item.status,
				timestamp
			}
		},
		(err, res) =>
		{
			if (err)
			{
				console.error(err, 'updating in db');
			}
		}
	);
}

// function compareItems (item1, item2)
// {
// 	return (
// 		(item1.group 	=== item2.group 	&&
// 		item1.name 		=== item2.name 		&&
// 		item1.person 	=== item2.person 	&&
// 		item1.place 	=== item2.place 	&&
// 		item1.time 		=== item2.time)
// 		// empty
// 		|| (item1.status === 0 && item2.status === 0)
// 	);
// }

function getFullNameById (nameId)
{
	return new Promise (
		(resolve, reject) =>
		{
			DB.collection(config.NAME_COLLECTION_NAME)
			.findOne(
				{ nameId },
				(err, doc) =>
				{
					if (err)
					{
						console.error(err, 'get full name');
					}
					else if (!doc)
					{
						reject(false);
					}
					else
					{
						resolve(doc.fullName)
					}
				}
			)
		}
	);
}
module.exports.getFullNameById = getFullNameById;


function putFullNameInStorage (nameId, fullName)
{
	DB.collection(config.NAME_COLLECTION_NAME)
	.update(
		{nameId},
		{ $set: { fullName } },
		{ upsert: true },
		(err, res) =>
		{
			if (err)
			{
				console.error(err, 'upserting full name');
			}
		}
	);
}
module.exports.putFullNameInStorage = putFullNameInStorage;