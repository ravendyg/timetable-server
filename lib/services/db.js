/// <reference path="../../index.d.ts" />

const Promise = require('bluebird');

const config = require('../config');
const scheduler = require('./scheduler');
const utils = require('./utils');

const myNsu = require('./my-nsu');

// var syncChecked = false;

// db set up
const mysql = require('mysql');
var connection;

function handleDisconnect ()
{
 	connection =
		mysql.createConnection({
			host     : config.DB_HOST,
			user     : config.DB_USER,
			password : config.DB_PAS,
			database : config.DB_NAME,
			charset: 'utf8mb4'
		});

  connection.connect(
    err =>
    {
      if ( err )
      {
        console.error( (new Date()).toLocaleString(), 'error connecting to db', err);
        setTimeout( () => { handleDisconnect(); }, 200 );
      }
			// if ( !syncChecked )
			// {
			// 	getLastSync();
			// }
    }
  );

  connection.on(
    'error',
    err =>
    {
      console.error( (new Date()).toLocaleString(), 'connection error', err);
      if ( err.code === 'PROTOCOL_CONNECTION_LOST' )
      {
        handleDisconnect();
      }
      else
      {
        throw(err);
      }
    }
  );
}

handleDisconnect();


/*
CREATE TABLE tech (
	type CHAR(20) NOT NULL UNIQUE,
	day_start BIGINT UNSIGNED NOT NULL,
	hour TINYINT NOT NULL,
	last_run BIGINT NOT NULL DEFAULT 0
) character set utf8;

CREATE TABLE teachers (
	id INT UNSIGNED NOT NULL,
	name CHAR(50) NOT NULL,
	full_name CHAR(150) NOT NULL,
	PRIMARY KEY (id)
) character set utf8;

CREATE TABLE sync (
	day TINYINT UNSIGNED NOT NULL,
	time CHAR(6) NOT NULL,
	place CHAR(20) NOT NULL,
	group_name CHAR(20),

	name CHAR(60),
	position TINYINT,
	person INT UNSIGNED,
	status TINYINT UNSIGNED NOT NULL,
	modified TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
	PRIMARY KEY (day, time, group_name, position)
) character set utf8;
 */

function getLastSync ()
{
	// syncChecked = true;

  return new Promise(
    resolve =>
    {
      connection.query(
        'SELECT day_start, hour, last_run FROM tech WHERE type="lastsync";',
        (err, res) =>
        {
          if ( err || res.length === 0)
          {
            resolve({
              day_start: 0,
              hour: 0,
              last_run: 0
            });
          }
          else
          {
            resolve( res[0] );
          }
        }
      );
    }
  );
}
module.exports.getLastSync = getLastSync;


function recordRun (params)
{
	connection.query(
		'UPDATE tech SET day_start=?, hour=?, last_run=? WHERE type="lastsync";',
		[ params.dayStart, params.hour, params.now ],
		(err, res) =>
		{
			if (err)
			{
				console.error(err, 'record run');
			}
		}
	);
}
module.exports.recordRun = recordRun;


function putToStorage ( events )
{
	for ( let i = 0; i < events.length; i++ )
	{
		check( events[i] );
	}
}
module.exports.putToStorage = putToStorage;

const allQuery =
	'SELECT *, sync.name AS lesson_name, teachers.name AS person_name,' +
			'UNIX_TIMESTAMP(sync.modified) AS timestamp ' +
	'FROM sync ' +
		'INNER JOIN teachers ' +
		'ON sync.person=teachers.id ' +
	'WHERE status=1;';

const afterQuery =
	'SELECT *, sync.name AS lesson_name, teachers.name AS person_name,' +
			'UNIX_TIMESTAMP(sync.modified) AS timestamp ' +
	'FROM sync ' +
		'INNER JOIN teachers ' +
		'ON sync.person=teachers.id ' +
	'WHERE UNIX_TIMESTAMP(modified)>?;';

const allWithTimeQuery =
	'SELECT *, sync.name AS lesson_name, teachers.name AS person_name,' +
			'UNIX_TIMESTAMP(sync.modified) AS timestamp ' +
	'FROM sync ' +
		'INNER JOIN teachers ' +
		'ON sync.person=teachers.id ' +
	'WHERE status=1 AND time=?;';

const afterWithTimeQuery =
	'SELECT *, sync.name AS lesson_name, teachers.name AS person_name,' +
			'UNIX_TIMESTAMP(sync.modified) AS timestamp ' +
	'FROM sync ' +
		'INNER JOIN teachers ' +
		'ON sync.person=teachers.id ' +
	'WHERE UNIX_TIMESTAMP(modified)>? AND time=?;';

function getAfterThisTime (tmst, time)
{
	var query, data;

	if (Date.now() - config.CRITICAL_TIME_DIFFERENCE > tmst * 1000)
	{	// to much time passed
		if (time)
		{
			query = allWithTimeQuery;
			data = [ time ];
		}
		else
		{
			query = allQuery;
			data = [];
		}
	}
	else
	{	// just updates, that can include status === 0
		if (time)
		{
			query = afterWithTimeQuery;
			data = [ tmst, time ];
		}
		else
		{
			query = afterQuery;
			data = [ tmst ];
		}
	}

	return new Promise(
		(resolve, reject) =>
		{
			connection.query(
				query, data,
				(err, res) =>
				{
					if (err)
					{
						console.error(err, getAfterThisTime, tmst, time);
						res = [];
					}

					resolve( res );
				}
			);
		}
	);
}
module.exports.getAfterThisTime = getAfterThisTime;


function check ( item )
{
	connection.query(
		'SELECT day, time, place, group_name, sync.name AS name, position, person AS personId, status, ' +
				'UNIX_TIMESTAMP(modified) AS timestamp, ' +
				'teachers.name as person, teachers.full_name as fullName ' +
		'FROM sync ' +
			'INNER JOIN teachers ' +
				'ON sync.person=teachers.id ' +
		'WHERE day=? AND time=? AND group_name=? AND position=? ' +
		'LIMIT 1;',
		[ item.day, item.time, item.group_name, item.position ],
		(err, res) =>
		{
			if (err)
			{
				console.error(err, 'updating db');
			}
			else if ( res.length === 0 )
			{	// completely new one
				if (item.status === 1 && item.personId)
				{
console.log('new', item);

					myNsu.getFullName( item.person, item.personId )
					.then(
						personId =>
						{
							item.personId = personId;
							insert( item );
						}
					);
				}
				else if (item.status === 1)
				{	// no need for a name, but don't insert status === 0
					insert( item );
				}
			}
			else if
			(
				res[0].place !== item.place 				||
				res[0].name !== item.name 				||
				res[0].personId !== item.personId ||
				res[0].position !== item.position
			)
			{	// smth changed
console.log('changed', item, res[0]);
				if (item.status === 1 && item.person)
				{
					myNsu.getFullName( item.person, item.personId )
					.then(
						personId =>
						{
							item.personId = personId;
							insert( item );
						}
					);
				}
				else
				{	// no need for a name, and can update to status === 0
					insert( item );
				}
			}
			else
			{
				// console.log('nothing changed, do nothing');
			}
		}
	)
}


function insert ( item )
{
	connection.query(
		'INSERT INTO sync ' +
		'(day, time, group_name, position, ' +
				'place, name, person, status) ' +
			'VALUES (?, ?, ?, ?, ?, ?, ?, ?) ' +
		'ON DUPLICATE KEY UPDATE ' +
		'place=?, name=?, person=?, status=?, modified=NOW();',
		[ item.day, item.time, item.group_name, item.position,
				item.place, item.name, item.personId, item.status,
				item.place, item.name, item.personId, item.status
		],
		(err, res) =>
		{
			// console.log(res);

			if (err)
			{
				console.error(err, 'inserting into db', item);
			}
		}
	);
}

function getNameById ( nameId )
{
	function main (resolve, reject)
	{
		connection.query(
			'SELECT name ' +
			'FROM teachers ' +
			'WHERE id=? ' +
			'LIMIT 1;',
			[ nameId ],
			(err, res) =>
			{
				if (err)
				{
					console.error(err, 'get full name');
				}
				else if ( res.length === 0 )
				{
					resolve( '' );
				}
				else
				{
					resolve( res[0].name )
				}
			}
		);
	}

	return new Promise ( main );
}
module.exports.getNameById = getNameById;


function putFullNameInStorage (nameId, shortName, fullName)
{
	function main ( resolve )
	{
		connection.query(
			'INSERT INTO teachers ' +
			'SET id=?, name=?, full_name=? ' +
			'ON DUPLICATE KEY UPDATE ' +
			'name=?, full_name=?;',
			[ nameId, shortName, fullName, shortName, fullName ],
			(err, res) =>
			{
				if (err)
				{
					console.error(err, 'upserting full name');
					resolve( 0 );
				}
				resolve( nameId );
			}
		);
	}
	return new Promise( main );
}
module.exports.putFullNameInStorage = putFullNameInStorage;