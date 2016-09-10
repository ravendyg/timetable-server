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

const Promise = require('bluebird');

function clearPlace (input)
{
	return input
		// .replace('ауд.', '')
		.replace(/^\s+|\s+$/g,'').replace(/\.$/,'');
};


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
	var out = [];
	for (var i = 0; i < arr.length; i++)
	{
		out = out.concat( arr[i] );
	}

	// return out;
	return [ out[0]/*, out[1], out[2], out[3]*/ ];	// test
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
				if ( !e || !e[0] || !e[0][0] ) { return []; }

				var time = e[0][0].data.replace('.', ':');
				return e
					.slice(1)
					.map(
					e2 =>
						{
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

							try
							{
								switch (e2.length)
								{
									case 8:
									case 7:
										eNew = e2.filter(e=>e.type=='text' && e.data.replace(/\r/g,'').replace(/\n/g,'').replace(/\s/g,'').length>0);
										if ( eNew.length === 6 )
										{
											return [
												{ time, name: eNew[0].data,
													place: clearPlace(eNew[1].data),
													person: eNew[2].data,
													personId: getPersonId(eNew[2], url),
													group_name, position: 1, status: 1 },
												{ time, name: eNew[3].data,
													place: clearPlace(eNew[4].data),
													person: eNew[5].data,
													personId: getPersonId(eNew[5], url),
													group_name, position: 2,  status: 1 }
											];
										}
										if ( eNew.length === 5 )
										{	// two swithing with one lecturer
											if (eNew[2].parent.name === 'a')
											{	// person in the first part
												personId = getPersonId(eNew[2], url);
												person = eNew[2].data;

												return [
													{ time, name: eNew[0].data, place: clearPlace(eNew[1].data), person, personId, group_name, position: 1, status: 1 },
													{ time, name: eNew[3].data, place: clearPlace(eNew[4].data), person, personId, group_name, position: 2,  status: 1 }
												];
											}
											else if (eNew[4].parent.name === 'a')
											{
												personId = getPersonId(eNew[4], url);
												person = eNew[4].data;

												return [
													{ time, name: eNew[0].data, place: clearPlace(eNew[1].data), person, personId, group_name, position: 1,  status: 1 },
													{ time, name: eNew[2].data, place: clearPlace(eNew[3].data), person, personId, group_name, position: 2,  status: 1 }
												];
											}
											else { debugger; }
										}
										else if ( eNew.length === 3 )
										{	// one switching
											if ( e2[2].data === "\r\n" )
											{
												name = eNew[0].data;
												place = clearPlace(eNew[1].data);
												position = 2;
											}
											else //if ( e2[2] !== "\r\n" )
											{
												name = eNew[0].data;
												place = clearPlace(eNew[1].data);
												position = 1;
											}
											personId = getPersonId(eNew[2], url);
											person = eNew[2].data;
										}
										else
										{
											debugger;
										}
										return { time, name, place, person, personId, group_name, position, status: 1 }

									case 3:				// all data were provided
										return {
											time,
											name: e2[0].data,
											place: clearPlace(e2[1].data),
											person: e2[2].data,
											personId: personId = getPersonId(e2[2], url),
											group_name,
											position,
											status: 1
										}
									case 2:				// missing one param, guess it's a person, but can be wrong
										var data = e2[1].data;
										if (!data) { debugger; }
										if ( data.match('ауд.') )
										{
											place = clearPlace(e2[1].data);
											person = '';
											personId = 0;
										}
										else
										{
											place = '';
											person = e2[1].data;
											personId = personId = getPersonId(e2[1], url);
										}
										return {
											name: e2[0].data,
											time, place, person, personId, group_name, position,
											status: 1
										}
									case 1:				// shoud be empty, but in case it's a class without a tutor and a place
										if ( !e2[0].data.replace(/\s/g, '') )
										{
											return {
												time,
												status: 0
											};
										}
										else
										{
											return {
												name: e2[0].data,
												time, place: '', person: '', personId: 0, group_name, position,
												status: 1
											}
										}
									// let's try to store records for every day/time/place triads
									// and see how muvh memory and time it consumes
									default:
										return {
											time,
											status: 0
										}
										;
								}
							}
							catch (e)
							{
								console.error(e, 'parsing nsu response');
								return {
											time,
											status: 0
										};
							}
						}
				)
				;
			}
		)

		var flatEvents = flat( events );

	// add day
	day = 1;
	for (var t = 0; t < flatEvents.length; t++)
	{
		flatEvents[t].day = day;
		day = day % 6 + 1;
	}

	db.putToStorage( flatEvents );

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
