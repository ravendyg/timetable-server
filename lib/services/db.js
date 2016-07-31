/// <reference path="../../index.d.ts" />

const MongoClient = require('mongodb').MongoClient;

const config = require('../config');
const scheduler = require('./scheduler');
const utils = require('./utils');


var DB;

MongoClient.connect(
	config.MONGO_HOST + '/' + config.DB_NAME,
	(err, db) =>
	{
		if (db)
		{
			DB = db;
			scheduler.start();
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


function putToStorage ( events )
{
	var timestamp = utils.tstmp();
	for (var i = 0; i < events.length; i++)
	{
		check( events[i], timestamp );
	}
}
module.exports.putToStorage = putToStorage;


function check (item, timestamp)
{
	DB.collection(config.SYNC_COLLECTION_NAME)
	.findOne(
		{
			time: item.time,
			place: item.place
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
				insert( item, timestamp);
			}
			else if
			(
				!compareItems(doc, item)
			)
			{	// smth changed
				update( item, timestamp);
			}
			else
			{
				// nothing changed, do nothing
			}
		}
	);
}


function insert (item, timestamp)
{
	DB.collection(config.SYNC_COLLECTION_NAME)
	.insert(
		{
			time: item.time,
			place: item.place,
			name: item.name,
			group: item.group,
			person: item.person,
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
			time: item.time,
			place: item.place
		},
		{
			$set:
			{
				name: item.name,
				group: item.group,
				person: item.person,
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

function compareItems (item1, item2)
{
	return (
		item1.group 	=== item2.group 	&&
		item1.name 		=== item2.name 		&&
		item1.person 	=== item2.person 	&&
		item1.place 	=== item2.place 	&&
		item1.time 		=== item2.time
	);
}