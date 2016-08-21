/// <reference path="../../index.d.ts" />

const request = require('request');
const cheerio = require('cheerio');
const agent = require('socks5-http-client/lib/Agent');

var Iconv = require('iconv').Iconv;
var fromEnc = 'cp1251';
var toEnc = 'utf-8';
var translator = new Iconv(fromEnc,toEnc);

const config = require('../config');
const db = require('./db');
const utils = require('./utils');

var timestamp;

function clearPlace (input)
{
	return input.replace('ауд.', '').replace(/^\s+|\s+$/g,'').replace(/\.$/,'');
};


function run ()
{
	timestamp = utils.tstmp();
	Promise.all(
		config.ENTER_URLS.map(
			e => getHTML(e, handleDeps)
		)
	)
	.then( flat )
	.then(
		links =>
		{
			return Promise.all(
				links.map( e => getHTML(e, handleGroups) )
			);
		}
	)
	.then( flat )
	.then(
		links =>
		{
			return links.reduce(
				(acc, e) =>
				{
					return acc.then(
						() => getHTML(e, handleTable)
					)
				},
				Promise.resolve()
			);
		}
	)
	.catch(
		err =>
		{
			console.error(err);
		}
	)
	;
}
module.exports.run = run;

function getGroupTable ( url )
{

}

function flat ( arr )
{
	var out = [];
	for (var i = 0; i < arr.length; i++)
	{
		out = out.concat( arr[i] );
	}

	// return out;
	return [ out[0] ];	// test
}


function getHTML (url, foo)
{
	function main (resolve, reject)
	{
		request(
			url,
			{
				method: 'GET',
				encoding: null,
				followAllRedirects: true,
				agentClass: agent,
				agentOptions:
				{
					socksHost: '127.0.0.1',
					socksPort: 9050
				}
			},
			(err, httpResp, body) =>
			{
				if (err)
				{
					console.error(error, 'fetching ' + url);
					reject();
				}
				else if ( httpResp.statusCode !== 200 || !body || body.length === 0 )
				{
					console.error('smth wrong with (not error) ' + url);
					reject();
				}
				else
				{
					const $ = cheerio.load(
						translator.convert(body).toString()
					);
					try {
						resolve( foo($, url) );
					}
					catch (e)
					{
						reject(e);
					}
				}
			}
		);
	}
	return new Promise( main );
}


function handleDeps ($, url)
{
	return $('ul')[0]
		.children
		.filter( e => e.name === 'li')
		.map(
			e =>
			{
				return url.replace(
					/[a-z\.]*$/,
					e.children[0].attribs.href
				);
			}
		)
		;
}


function handleGroups ($, url)
{
	var groups, groupLinks = [];

	groups = $('a[href*="group"]');
	for (var i = 0; i < groups.length; i++)
	{
		groupLinks.push(
			url.replace(
				/[a-z\.]*$/,
				groups[i].attribs.href
			)
		);
	}
	return groupLinks;
}

/** parse one table
 * and write data to db
 * !!! mutating state
 */
function handleTable ($, url)
{
	var groupName;

	const table = $('table')[1];
	var events =
		table
		.children
		.filter( e => e.name === 'tr')	// rows
		.slice(1)	// no header
		.map(	// each row is an array of columns
			e =>
				e
				.children
				.filter( el => el.name === 'td')
		)
		.map(	// flat out column content
			e =>
				e.map(
					e2 => utils.flatElement(e2).filter(e3 => e3.type === 'text')
				)
		)
		.map(	// each row is an array of objects with
					// time, place, person, name, group	params
			e =>
			{
				var time = e[0][0].data.replace('.', ':');
				return e
					.slice(1)
					.map(
					e2 =>
						{
							var place, person, group;
							try
							{
								group = url.toLowerCase().match(/[a-zа-я0-9_\.]*$/)[0].replace(/\.html?/,'').replace(/_/g,'.');
							}
							catch (e)
							{
								console.error(e, 'replacing group in ' + url);
								group = '';
							}
							groupName = group;
							switch (e2.length)
							{
								case 3:				// all data were provided
									return {
										time,
										name: e2[0].data,
										place: clearPlace(e2[1].data),
										person: e2[2].data,
										group,
										status: true
									}
								case 2:				// missing one param, guess it's a persom, but can be wrong
									if ( e2[1].data.match('ауд.') )
									{
										place = clearPlace(e2[1].data);
										person = '';
									}
									else
									{
										place = '';
										person = e2[1].data;
									}
									return {
										name: e2[0].data,
										time, place, person, group,
										status: true
									}
								case 1:				// shoud be empty, but in case it's a class without a tutor and a place
									if ( !e2[0].data.replace(/\s/g, '') )
									{
										return {
											time,
											status: false
										};
									}
									else
									{
										return {
											name: e2[0].data,
											time, place: '', person: '', group,
											status: true
										}
									}
								// let's try to store records for every day/time/place triads
								// and see how muvh memory and time it consumes
								default:
									return {
										time,
										status: false
									}
									;
							}
						}
				)
				// .filter( e => e)
				;
			}
		)
		.reduce(	// final flat
			(acc, e) => acc.concat( e ),
			[]
		)
		;

	// add day
	day = 1;
	for (var t = 0; t < events.length; t++)
	{
		events[t].day = day;
		day = day % 6 + 1;
	}

	// // remove empty
	// events = events.filter( e => e.status );

	// // select all unique places
	// var places = events.reduce(
	// 	(acc, e) =>
	// 	{
	// 		if (e.place)
	// 		{
	// 			acc[e.place] = true;
	// 		}
	// 		return acc;
	// 	},
	// 	{}
	// );

	// var allPossibleEvents = [];
	// for (var z = 0; z < config.BELLS.length; z++)
	// {
	// 	for (var day = 1; day <=7; day++)
	// 	{
	// 		for (var place in places)
	// 		{
	// 			allPossibleEvents.push({
	// 				status: false,
	// 				day,
	// 				time: config.BELLS[z],
	// 				place
	// 			})
	// 		}
	// 	}
	// }

	// // merge events
	// for (var j = 0; j < events.length; j++)
	// {
	// 	for (var q = 0; q < allPossibleEvents.length; q++)
	// 	{
	// 		if(
	// 			allPossibleEvents[q].day   === events[j].day &&
	// 			allPossibleEvents[q].time  === events[j].time &&
	// 			allPossibleEvents[q].place === events[j].place
	// 		)
	// 		{
	// 			allPossibleEvents[q] = events[j];
	// 			break;
	// 		}
	// 	}
	// }

	db.putToStorage( events, timestamp );

	return;
}
