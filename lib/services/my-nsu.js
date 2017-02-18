'use strict';

const request = require('request');
const cheerio = require('cheerio');

const utils = require('./utils');
const config = require('../config');
const db = require('./db');

const Promise = require('bluebird');

const search = 'http://my.nsu.ru/public/search.jsp?public.search.searchString=';

function getFullName(shortName, nameId, skipDb)
{
	function checkNameInStorage(resolve, reject)
	{
		if (skipDb)
		{
			reject(new Error());
		}
    else
    {
      db.getNameById(nameId)
      .then(
        name => resolve(name)
      )
      .catch(
        () => reject(new Error())
      );
    }
	}
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
					resolve(skipDb ? '' : false);
				}
				else if (httpResp.statusCode !== 200 || !body || body.length === 0)
				{
					console.error('smth wrong with (not error) ' + uri);
					resolve(skipDb ? '' : false);
				}
				else
				{
					const $ = cheerio.load(body);
					const results = $('.search-results>li');
					// convert to array
					var lis = [];
					for (var j = 0; j < results.length; j++)
					{
						lis.push(results[j].children);
					}

					var fullNames =
						lis.map(
							e =>
							{
								var link, name = '';
								for (var k = 0; k < e.length; k++)
								{
									if (e[k].name === 'a')
									{
										link = e[k];
									}
									if (link && e[k].type === 'text')
									{
										name += e[k].data;
									}
									else if (link && e[k].name === 'b' && e[k].children[0].type === 'text')
									{
										name += e[k].children[0].data;
									}
								}
								name = name.toLowerCase().replace(/[^а-я]/g, '');
								return { link, name };
							}
						)
						.filter(e => e.name === 'преподаватель')
						.map(
							e => e.link.children
						)
						.map(
							person =>
							{
								var temp =
									person
									.map(
										e => utils.flatElement(e)
									)
									.reduce(
										(acc, e) => acc.concat(e),
										[]
									)
									.filter(
										e => e.type === 'text'
									)
									.map(
										e => e.data
									)
									.join('')
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
console.log(fullName);
					if (fullName.match(/\|/) && !skipDb)
					{
						fullName = shortName;
					}

          if (skipDb)
          {
            resolve(fullName);
          }
          else
          {
            db.putFullNameInStorage(nameId, shortName, fullName)
            .then(
              id =>
              {
                resolve(id);
              }
            )
            .catch(
              err2 =>
              {
                resolve(0);
                console.error(err2, 'my nsu: putFullNameInStorage');
              }
            );
          }
				}
			}
		);
	}
	return new Promise(checkNameInStorage)
		.then(
			name =>
			{
				if (name)
				{
					return Promise.resolve(name);
				}
				else
				{
					return new Promise(main);
				}
			}
		)
		.catch(
			() =>
      {
        return new Promise(main);
      }
		)
		;
	// return new Promise( main );
}
module.exports.getFullName = getFullName;

function flat ( arr )
{
	var out = [];
	for (var i = 0; i < arr.length; i++)
	{
		out = out.concat( arr[i] );
	}

	return out;
}