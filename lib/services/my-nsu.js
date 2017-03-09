'use strict';

const request = require('request');
const cheerio = require('cheerio');

const utils = require('./utils');
const config = require('../config');

const Promise = require('bluebird');

const nameStore = require('../storage/names');

const search = 'http://my.nsu.ru/public/search.jsp?public.search.onlyTeachers=on&public.search.searchString=';

function reverse(str)
{
  let out = '';
  for (let i = str.length - 1; i >= 0; i--)
  {
    out += str.charAt(i);
  }
  return out;
}

function getFullName(shortName)
{
	function main(resolve)
	{
    nameStore.getName(shortName)
    .then(resolve)
		.catch(() =>
    {
      try
      {
        let trimedName = shortName.replace(/[\.\,]/g, ' ');
        // there english letters out there!!!
        let matches = trimedName.match(/[А-Я][а-яa-z\s\.]{1,}[А-ЯA-Z][а-яa-z\s\.]{1,}[А-ЯA-Z][а-яa-z\s\.]{1,}$/);
        if (!matches)
        {
          matches = trimedName.match(/[А-Я][а-яa-z\s\.]{1,}[А-ЯA-Z][а-яa-z\s\.]{1,}$/);
          if (!matches)
          { // at least last name
            matches = trimedName.match(/\s[А-Я][а-я]{1,}/);
            if (!matches)
            {
              resolve(shortName);
              return;
            }
          }
        }

        let nameArr = matches[0]
          .replace('A', 'А')
          .replace('C', 'С')
          .replace('E', 'Е')
          .replace('a', 'а')
          .replace('c', 'с')
          .replace('e', 'е')
          .split(/(\.|\s)/).filter(e => e && !/(\.|\s)/.test(e))
          ;

        if (nameArr[1])
        {
          nameArr[1] = nameArr[1].charAt(0);
        }
        if (nameArr[2])
        {
          nameArr[2] = nameArr[2].charAt(0);
        }



        var uri = search + nameArr[0];
        request(
          {
            url: config.PROXY_URL,
            method: 'GET',
            followAllRedirects: true,
            qs: { url: encodeURI(uri) }
          },
          createResponseHandler(resolve, shortName, uri, nameArr)
        );
      }
      catch (err)
      {
        resolve(shortName);
      }
    });
	}
	return new Promise(main);
}
module.exports.getFullName = getFullName;

function createResponseHandler(resolve, shortName, uri, nameArr)
{
  return function handleRequestResponse(err, httpResp, body)
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
        lis
        .map(parseNameHolder)
        .map(
          person =>
          {
            var temp =
              person
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
              acc[e.replace(/\s/g, '').toLowerCase()] = e.replace(/(П|п)реподаватель/, '');
              return acc
            },
            {}
          );
        fullNames = [];
        for (var key of Object.keys(fullNamesObj))
        {
          fullNames.push(fullNamesObj[key]);
        }
        let fullName =
          fullNames
          .find(e =>
          {
            for (let nameItem of nameArr)
            {
              let regexp = new RegExp(nameItem);
              if (!regexp.test(e))
              {
                return false;
              }
              e = e.replace(regexp, '');
            }
            return true;
          })
          .replace(/([А-Я])/g, ' $1')
          .trim()
          ;
      utils.debug([fullName]);

      fullName = fullName || shortName;

      nameStore.putName(shortName, fullName);

      resolve(fullName);
    }
  }
}


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