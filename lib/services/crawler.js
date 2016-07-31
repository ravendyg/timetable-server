/// <reference path="../../index.d.ts" />

const request = require('request');
const cheerio = require('cheerio');
const agent = require('socks5-http-client/lib/Agent');

const config = require('../config');

function run ()
{
	Promise.all(
		config.ENTER_URLS.map(
			e => getList(e, handleDeps)
		)
	)
	.then( flat )
	.then(
		links =>
			Promise.all(
				links.map( e => getList(e, handleGroups) )
			)
	)
	.then( flat )
	.then(
		links =>
		{
			console.log(links);
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


function getList (url, foo)
{
	function main (resolve, reject)
	{
		request(
			url,
			{
				method: 'GET',
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
					const $ = cheerio.load(body);
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
