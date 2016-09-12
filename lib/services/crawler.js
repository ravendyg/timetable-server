/// <reference path="../../index.d.ts" />

const request = require('request');
const cheerio = require('cheerio');
const agent = require('socks5-http-client/lib/Agent');

var Iconv = require('iconv').Iconv;
var fromEnc = 'cp1251';
var toEnc = 'UTF-8//IGNORE';// 'utf-8';
var translator = new Iconv(fromEnc,toEnc);

const config = require('../config');
const db = require('./db');
const utils = require('./utils');

const Promise = require('bluebird');

function clearPlace (input)
{
	return input
		// .replace('ауд.', '')
		.replace(/^\s+|\s+$/g,'').replace(/\.$/,'');
};
var counter = 0;

function run ()
{
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
	return new Promise(
		resolve =>
		{
			var out = [];
			for (var i = 0; i < arr.length; i++)
			{
				out = out.concat( arr[i] );
			}

			resolve( out );
		}
	)

	// return [ out[0]/*, out[1], out[2], out[3]*/ ];	// test
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
					console.error(err, 'fetching ' + url);
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
	const out =
		$('ul')[0]
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
	return out;
}


function handleGroups ($, url)
{
	var groups, groupLinks = [];

	groups = $('a[href*="Group"]');
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
	var dayCount = 0;
	const table = $('table')[1];
	var events =
		table
		.children
		.filter( e => e.name === 'tr')	// rows
		// .slice(1)	// no header
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
							if ( !e || !e[0] || !e[0][0] ) { return []; }

							dayCount = (++dayCount) % 7;
							if ( dayCount === 0) { dayCount = 1; }

							var place, person, personId, group,
								position = 0	// no switching by default
								;
							try
							{
								group_name = url.toLowerCase();
								if (!group_name) { debugger; }
								group_name = group_name.match(/[a-zа-я0-9_\.]*$/)[0].replace(/\.html?/,'').replace(/_/g,'.');
							}
							catch (e)
							{
								console.error(e, 'replacing group in ' + url);
								group_name = '';
							}
if ( group_name === '15507.1') { debugger; }
							try
							{
								switch (e2.length)
								{
									case 6:
									case 8:
									case 7:
										eNew = e2.filter(e=>e.type=='text' && e.data.replace(/\r/g,'').replace(/\n/g,'').replace(/\s/g,'').length>0);
										if ( eNew.length === 6 )
										{
											return [
												{ time, name: eNew[0].data, day: dayCount,
													place: clearPlace(eNew[1].data),
													person: eNew[2].data,
													personId: getPersonId(eNew[2], url),
													group_name, position: 1, status: 1 },
												{ time, name: eNew[3].data, day: dayCount,
													place: clearPlace(eNew[4].data),
													person: eNew[5].data,
													personId: getPersonId(eNew[5], url),
													group_name, position: 2,  status: 1 },
												emptyEvent(time, dayCount, group_name, 0)
											];
										}
										if ( eNew.length === 5 )
										{	// two switching with one lecturer
											if (eNew[2].parent.name === 'a')
											{	// person in the first part
												personId = getPersonId(eNew[2], url);
												person = eNew[2].data;

												return [
													{ time, name: eNew[0].data, day: dayCount,
														place: clearPlace(eNew[1].data), person, personId,
														group_name, position: 1, status: 1 },
													{ time, name: eNew[3].data, day: dayCount,
														place: clearPlace(eNew[4].data), person, personId,
														group_name, position: 2,  status: 1 },
													emptyEvent(time, dayCount, group_name, 0)
												];
											}
											else if (eNew[4].parent.name === 'a')
											{
												personId = getPersonId(eNew[4], url);
												person = eNew[4].data;

												return [
													{ time, name: eNew[0].data, day: dayCount,
														place: clearPlace(eNew[1].data), person, personId,
														group_name, position: 1,  status: 1 },
													{ time, name: eNew[2].data, day: dayCount,
														place: clearPlace(eNew[3].data), person, personId,
														group_name, position: 2,  status: 1 },
													emptyEvent(time, dayCount, group_name, 0)
												];
											}
											else { debugger; }
										}
										if ( eNew.length === 4 )
										{	// two switching without a teacher
											personId = 1;
											person = '';

											return [
												{ time, name: eNew[0].data, day: dayCount,
													place: clearPlace(eNew[1].data), person, personId,
													group_name, position: 1, status: 1 },
												{ time, name: eNew[2].data, day: dayCount,
													place: clearPlace(eNew[3].data), person, personId,
													group_name, position: 2,  status: 1 },
												emptyEvent(time, dayCount, group_name, 0)
											];
										}
										else if ( eNew.length === 3 )
										{	// one switching
											personId = getPersonId(eNew[2], url);
											person = eNew[2].data;

											if ( e2[2].data === "\r\n" )
											{
												name = eNew[0].data;
												place = clearPlace(eNew[1].data);
												position = 2;

												return [
													{ time, name, day: dayCount, place, person, personId, group_name, position, status: 1 },
													emptyEvent(time, dayCount, group_name, 0),
													emptyEvent(time, dayCount, group_name, 1)
												];
											}
											else
											{
												name = eNew[0].data;
												place = clearPlace(eNew[1].data);
												position = 1;

												return [
													{ time, name, day: dayCount, place, person, personId, group_name, position, status: 1 },
													emptyEvent(time, dayCount, group_name, 0),
													emptyEvent(time, dayCount, group_name, 2)
												];
											}
										}
										else if ( eNew.length === 2 )
										{	// no teacher
											name = eNew[0].data;
											place = clearPlace(eNew[1].data);
											position1 = e2[1].data ? 1 : 2;
											position2 = e2[1].data ? 2 : 1;

											return [
												{ time, name, day: dayCount, place, person: '', personId: 1, group_name, position: position1, status: 1 },
												emptyEvent(time, dayCount, group_name, 0),
												emptyEvent(time, dayCount, group_name, position2)
											];
										}
										else
										{
											debugger;
											return [
												emptyEvent(time, dayCount, group_name, 0),
												emptyEvent(time, dayCount, group_name, 1),
												emptyEvent(time, dayCount, group_name, 2)
											];
										}


									case 3:				// all data were provided
										return [
											{
												time, day: dayCount, group_name, position: 0,
												place: clearPlace(e2[1].data), person: e2[2].data,
													personId: getPersonId(e2[2], url), name: e2[0].data, status: 1
											},
											emptyEvent(time, dayCount, group_name, 1),
											emptyEvent(time, dayCount, group_name, 2)
										];

									case 2:				// missing one param, guess it's a person, but can be wrong
										var data = e2[1].data;
										if (!data) { debugger; }
										if ( data.match('ауд.') )
										{
											place = clearPlace(e2[1].data);
											person = '';
											personId = 1;
										}
										else
										{
											place = '';
											person = e2[1].data;
											personId = personId = getPersonId(e2[1], url);
										}
										return [
											{
												time, day: dayCount, group_name, position: 0,
												place, person, personId, name: e2[0].data, status: 1
											},
											emptyEvent(time, dayCount, group_name, 1),
											emptyEvent(time, dayCount, group_name, 2)
										];

									case 1:				// shoud be empty, but in case it's a class without a tutor and a place
										if ( !e2[0].data.replace(/\s/g, '') )
										{
											return [
												emptyEvent(time, dayCount, group_name, 0),
												emptyEvent(time, dayCount, group_name, 1),
												emptyEvent(time, dayCount, group_name, 2)
											];
										}
										else
										{
											return [
												{
													time, day: dayCount, group_name, position: 0,
													place: '', person: '', personId: 1, name: e2[0].data, status: 1
												},
												emptyEvent(time, dayCount, group_name, 1),
												emptyEvent(time, dayCount, group_name, 2)
											];
										}
									// let's try to store records for every day/time/place triads
									// and see how much memory and time it consumes
									default:
										return [
											emptyEvent(time, dayCount, group_name, 0),
											emptyEvent(time, dayCount, group_name, 1),
											emptyEvent(time, dayCount, group_name, 2)
										];
								}
							}
							catch (e)
							{
								console.error(e, 'parsing nsu response');
								return [
									emptyEvent(time, dayCount, group_name, 0),
									emptyEvent(time, dayCount, group_name, 1),
									emptyEvent(time, dayCount, group_name, 2)
								];
							}
						}
				)
				;
			}
		)

		var flatEvents = flat( events );

	// // add day
	// day = 1;
	// for (var t = 0; t < flatEvents.length; t++)
	// {
	// 	flatEvents[t].day = day;
	// 	day = day % 6 + 1;
	// }

	db.putToStorage( flatEvents );

	console.log(counter++);


	return;
}

function getPersonId (elem, url)
{
	var href = elem.parent.attribs.href;
	if (!href) { debugger; }
	personId = +href.match(/[0-9].*.htm/)[0].replace('.htm', '');
	if ( url.toLowerCase().match('html_gk') )
	{
		personId += '1';
	}
	else
	{
		personId += '0';
	}

	return +personId;
}

function flat ( arr, acc )
{
    var out;
    if ( !Array.isArray(arr) )
    {
			out = [arr];
    }
    else
    {
			out =
				arr.reduce(
					(acc, e) =>
					{
						var out = acc.concat( flat( e ) );
						return out;
					},
					[]
				);
    }
    return out;
}


function emptyEvent ( time, dayCount, group_name, position )
{
	return {
		time, day: dayCount, group_name, position,
		place: '', person: '', personId: 1, name: '', status: 0
	}
}