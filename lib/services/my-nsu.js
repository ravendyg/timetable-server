'use strict';

const request = require('request');
const cheerio = require('cheerio');

const utils = require('./utils');
const config = require('../config');

const Promise = require('bluebird');

const search = 'http://my.nsu.ru/public/search.jsp?public.search.onlyTeachers=on&public.search.searchString=';

function getFullName(shortName)
{
	function main(resolve)
	{
		var uri = search + shortName.replace(/[\.\,]/g, ' ');
		request(
			{
				url: config.PROXY_URL,
				method: 'GET',
				followAllRedirects: true,
				qs: { url: encodeURI(uri) }
			},
			(err, httpResp, body) =>
			{
				if (err)
				{
					console.error(err, 'fetching ' + uri);
					resolve('');
				}
				else if (httpResp.statusCode !== 200 || !body || body.length === 0)
				{
					console.error('smth wrong with (not error) ' + uri);
					resolve('');
				}
				else
				{
					const $ = cheerio.load(body);
					const results = $('.search-results>li');
					// convert to array
					var lis = [];
					for (var j = 0; j < results.length; j++)
					{
						lis.push(results[j]);
					}

					var fullNames =
						lis.map(parseNameHolder)
						.map(
							person =>
							{
								var temp =
									person
                  .filter(e => !/препо/.test(e.toLowerCase()))
                  .map(e => e.split(/(\s|\r|\n)/))
									.reduce(
										(acc, e) => acc.concat(e),
										[]
									)
                  .map(e => e.replace(/(\s|\r|\n)/g, ''))
									.filter(e => e)
									.join(' ')
									;
									return temp;
							}
						)
						.map(
							e =>
							{
								return e.replace(/[^а-яА-Я\-]/g, '');
							}
						);
						var fullNamesObj =
							fullNames.reduce(
								(acc, e) =>
								{
									acc[e.replace(/\s/g, '').toLowerCase()] = e;
									return acc
								},
								{}
							);
						fullNames = [];
						for (var key of Object.keys(fullNamesObj))
						{
							fullNames.push(fullNamesObj[key]);
						}
						var fullName =
							fullNames
							.reduce(	// in case there are still several people matching the criteria
								(acc, e) =>
								{
									return acc ? acc + ' | ' + e : e
								},
								''
							)
							.replace(/([А-Я])/g, ' $1')
							.trim()
							;
					utils.debug([fullName]);

          resolve(fullName);
				}
			}
		);
	}
	return new Promise(main);
}
module.exports.getFullName = getFullName;

function parseNameHolder(item)
{
  let out = [];
  if (item.type === 'text' && item.data.replace(/[\s\r\n\t]/g, '').length > 0)
  {
    out = out.concat(item.data);
  }
  else if (item.children && item.children.length > 0)
  {
    for (let i = 0; i < item.children.length; i++)
    {
      out = out.concat(parseNameHolder(item.children[i]));
    }
  }
  return out;
}