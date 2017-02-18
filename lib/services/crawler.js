'use strict';

const request = require('request');
const cheerio = require('cheerio');

var Iconv = require('iconv').Iconv;
var fromEnc = 'cp1251';
var toEnc = 'UTF-8//IGNORE';// 'utf-8';
var translator = new Iconv(fromEnc,toEnc);

const config = require('../config');
const db = require('./db');
const utils = require('./utils');

const Promise = require('bluebird');

const groupsListTsp = new Map();
const teachersListMap = new Map();

const groupsMap = new Map();
const teachersMap = new Map();
const placesMap = new Map();

const teachersForRecalculation  = new Set();
const placesForRecalculation    = new Set();


function clearPlace(input)
{
  return input
    // .replace('ауд.', '')
    .replace(/^\s+|\s+$/g,'').replace(/\.$/,'');
};


function run(lastRun)
{
  Promise.all(
    config.ENTER_URLS
    .map(e => e.replace(/schedule\.html?/, 'Groups/'))
    .map(e => getHTML(e, handleGroupList))
  )
  .then(
    arrs =>
    {
      return arrs.reduce(concat, []);
    }
  )
  .then(
    links =>
    {
      var j, temp;
      // links = links.slice(0,3);

      links = links.slice(0,3).concat(
        links.filter( e => e.match('16802.1', '13911.1') )
      );
      // links = links.filter( e => e.match('13911.1') );

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
  .then( () => { console.log('finished'); })
  .catch(
    err =>
    {
      console.error(err);
    }
  )
  ;
}
module.exports.run = run;

function splitLink( link )
{
  let temp = link.split('/');
  let out = temp[ temp.length - 1 ].split('$');
  return { link: link.replace(/\$.*/, ''), group: out[0], tsp: out[1] };
}


function flat ( arr )
{
  return new Promise(
    resolve =>
    {
      let out = arr.reduce( flatArray, [] );
      resolve( out );
    }
  );
}

function getHTML (url, foo, params)
{
  function main (resolve, reject)
  {
    request(
      url,
      {
        url: config.PROXY_URL,
        method: 'GET',
        encoding: null,
        followAllRedirects: true,
        qs: { url: encodeURI(url) }
      },
      (err, httpResp, body) =>
      {
        if (err)
        {
          console.error(err, 'fetching ' + url);
          resolve([]);
        }
        else if ( httpResp.statusCode !== 200 || !body || body.length === 0 )
        {
          console.error('smth wrong with (not error) ' + url);
          resolve([]);
        }
        else
        {
          const $ = cheerio.load(
            translator.convert(body).toString()
          );
          try
          {
            resolve( foo($, url, params) );
          }
          catch (e)
          {
            console.error( e );
            resolve([]);
          }
        }
      }
    );
  }
  return new Promise( main );
}


function selectUpdatedGroups( $, url, { lastRun } )
{
  const links = $('td>a').slice(1);
  let out = [];
  let tempDate;
  for ( let i = 1; i < links.length; i++ )
  {
    if (
      links[i].attribs &&
      links[i].attribs.href &&
      links[i].parent &&
      links[i].parent.next &&
      links[i].parent.next.children.length > 0 &&
      links[i].parent.next.children[0].data )
    {
      tempDate = Date.parse( links[i].parent.next.children[0].data );
      if ( tempDate > lastRun )
      {
        out.push( url + links[i].attribs.href + '$' + tempDate );
      }
    }
  }

  return out;
}

function extractGroupHref( e )
{
  let out;
  if ( e.attribs && e.attribs.href )
  {
    out = e.attribs.href;
  }
  else
  {
    out = '';
  }
  return out;
}

function identity( e )
{
  return e;
}

function concat(acc, e)
{
  return acc.concat(e);
}

function handleGroupList($, url)
{
  let out = [];
  let links = $('td>a');

  for (let i = 0; i < links.length; i++)
  {
    let _url = links[i].attribs.href;
    if (/[^\/]*\.html?$/.test(_url))
    {
      try
      {
        let link = url + _url;
        let time = Date.parse(links[i].parent.next.children[0].data);
        let _time = groupsListTsp.get(link);
        if (!_time || _time < time)
        { // expired or new
          out.push(link);
          groupsListTsp.set(link, time);
        }
      }
      catch (err)
      { // skip
      }
    }
  }

  return out;
}

function handleDeps ($, url)
{
  let temp1 = $('ul')[0].children;

  let temp2 = temp1.filter( getListElements );

  let out =
    temp2
    .map(
      e =>
      {
        return url.replace(
          /[a-z\.]*$/,
          e.children[0].attribs.href
        );
      }
    );

  return out;
}

function getListElements( e )
{
  return e.name === 'li';
}

function getTr( e )
{
  return e.name === 'tr'
}

function getTd( e )
{
  return e.name === 'td'
}

function getChildren( e )
{
  return e.children;
}

function getText( e )
{
  return e.type === 'text';
}

function flatArray( acc, arr)
{
  return acc.concat( arr );
}

function removeTimeColumn(col)
{
  return (e, i) => i % (col + 1) === 0 ? false : true;
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
function handleTable($, url)
{
  // console.log( (new Date()).toLocaleString(), url );

  let group_name;
  const table = $('table')[1];
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

  let tableRows = table.children.filter( getTr );

  let tableCells =
    tableRows
    .map( getChildren )
    .reduce( flatArray, [] )
    .filter( getTd )
    .reduce( flatArray, [] )
    ;
  let colCounter = tableCells.length > 49 ? 7 : 6
  tableCells  = tableCells.filter( removeTimeColumn(colCounter) );

  let events = [];
  let groupEvents = []

  // keep track of dependants to recalculate later
  const teachersSet = new Set(), placesSet = new Set();
  const temp = groupsMap.get(group_name);

  for ( let day = 1; day < colCounter; day++ )
  {
    for ( let bell = 0; bell < 7; bell++ )
    {
      let index = bell * colCounter + day - 1;
      let time = config.BELLS[ bell ];

      let e2 =
        utils.flatElement( tableCells[index] )
        .filter( getText )
        ;

      switch ( e2.length )
      {
        case 6:
        case 8:
        case 7:
          var eNew =
            e2
            .filter(e=>e.type=='text' && e.data.replace(/\r/g,'').replace(/\n/g,'').replace(/\s/g,'').length>0);
          if ( eNew.length === 6 )
          {
            events.push([
              { time, name: eNew[0].data, day,
                place: clearPlace(eNew[1].data),
                person: eNew[2].data,
                personId: getPersonId(eNew[2], url),
                group_name, position: 1, status: 1 },
              { time, name: eNew[3].data, day,
                place: clearPlace(eNew[4].data),
                person: eNew[5].data,
                personId: getPersonId(eNew[5], url),
                group_name, position: 2,  status: 1 },
              emptyEvent(time, day, group_name, 0)
            ]);
          }
          else if ( eNew.length === 5 )
          {  // two switching with one lecturer
            if (eNew[2].parent.name === 'a')
            {  // person in the first part
              personId = getPersonId(eNew[2], url);
              person = eNew[2].data;

              events.push([
                { time, name: eNew[0].data, day,
                  place: clearPlace(eNew[1].data), person, personId,
                  group_name, position: 1, status: 1 },
                { time, name: eNew[3].data, day,
                  place: clearPlace(eNew[4].data), person, personId,
                  group_name, position: 2,  status: 1 },
                emptyEvent(time, day, group_name, 0)
              ]);
            }
            else if (eNew[4].parent.name === 'a')
            {
              personId = getPersonId(eNew[4], url);
              person = eNew[4].data;

              events.push([
                { time, name: eNew[0].data, day,
                  place: clearPlace(eNew[1].data), person, personId,
                  group_name, position: 1,  status: 1 },
                { time, name: eNew[2].data, day,
                  place: clearPlace(eNew[3].data), person, personId,
                  group_name, position: 2,  status: 1 },
                emptyEvent(time, day, group_name, 0)
              ]);
            }
            else { debugger; }
          }
          else if ( eNew.length === 4 )
          {  // two switching without a teacher
            personId = 1;
            person = '';

            events.push([
              { time, name: eNew[0].data, day,
                place: clearPlace(eNew[1].data), person, personId,
                group_name, position: 1, status: 1 },
              { time, name: eNew[2].data, day,
                place: clearPlace(eNew[3].data), person, personId,
                group_name, position: 2,  status: 1 },
              emptyEvent(time, day, group_name, 0)
            ]);
          }
          else if ( eNew.length === 3 )
          {  // one switching
            personId = getPersonId(eNew[2], url);
            person = eNew[2].data;

            if ( e2[2].data === "\r\n" )
            {
              name = eNew[0].data;
              place = clearPlace(eNew[1].data);
              position = 2;

              events.push([
                { time, name, day, place, person, personId, group_name, position, status: 1 },
                emptyEvent(time, day, group_name, 0),
                emptyEvent(time, day, group_name, 1)
              ]);
            }
            else
            {
              var name = eNew[0].data;
              place = clearPlace(eNew[1].data);
              var position = 1;

              events.push([
                { time, name, day, place, person, personId, group_name, position, status: 1 },
                emptyEvent(time, day, group_name, 0),
                emptyEvent(time, day, group_name, 2)
              ]);
            }
          }
          else if ( eNew.length === 2 )
          {  // no teacher
            name = eNew[0].data;
            place = clearPlace(eNew[1].data);
            position1 = e2[1].data ? 1 : 2;
            position2 = e2[1].data ? 2 : 1;

            events.push([
              { time, name, day, place, person: '', personId: 1, group_name, position: position1, status: 1 },
              emptyEvent(time, day, group_name, 0),
              emptyEvent(time, day, group_name, position2)
            ]);
          }
          else
          {
            debugger;
            events.push([
              emptyEvent(time, day, group_name, 0),
              emptyEvent(time, day, group_name, 1),
              emptyEvent(time, day, group_name, 2)
            ]);
          }
        break;

        case 3:        // all data were provided
          events.push([
            {
              time, day, group_name, position: 0,
              place: clearPlace(e2[1].data), person: e2[2].data,
              personId: getPersonId(e2[2], url), name: e2[0].data, status: 1
            },
            emptyEvent(time, day, group_name, 1),
            emptyEvent(time, day, group_name, 2)
          ]);
        break;

        case 2:        // missing one param, guess it's a person, but can be wrong
          var data = e2[1].data;
          if (!data) { debugger; }
          if ( data.match('ауд.') )
          {
            var place = clearPlace(e2[1].data);
            var person = '';
            var personId = 1;
          }
          else
          {
            place = '';
            person = e2[1].data;
            personId = personId = getPersonId(e2[1], url);
          }
          events.push([
            {
              time, day, group_name, position: 0,
              place, person, personId, name: e2[0].data, status: 1
            },
            emptyEvent(time, day, group_name, 1),
            emptyEvent(time, day, group_name, 2)
          ]);
        break;

        case 1:        // shoud be empty, but in case it's a class without a tutor and a place
          if ( !e2[0].data.replace(/\s/g, '') )
          {
            events.push([
              emptyEvent(time, day, group_name, 0),
              emptyEvent(time, day, group_name, 1),
              emptyEvent(time, day, group_name, 2)
            ]);
          }
          else
          {
            events.push([
              {
                time, day, group_name, position: 0,
                place: '', person: '', personId: 1, name: e2[0].data, status: 1
              },
              emptyEvent(time, day, group_name, 1),
              emptyEvent(time, day, group_name, 2)
            ]);
          }
        break;

        default:
          events.push([
            emptyEvent(time, day, group_name, 0),
            emptyEvent(time, day, group_name, 1),
            emptyEvent(time, day, group_name, 2)
          ]);
      }

      groupEvents.push(
        parseTableCell(tableCells[index], url, day, bell)
      );
    }
  }


  groupsMap.set(group_name,
    {
      groupEvents,
      tsp: groupsListTsp.get(url)
    }
  );



  var flatEvents = events.reduce( flatArray, [] );

  db.putToStorage( flatEvents );

  return;
}

function parseTableCell(cell, url, day, bell)
{
  let temp = utils.getTextAndA(cell);
  let items = [[], [], []];
  let pointer = 0;
  for (let _cell of temp)
  {
    if (_cell == 'TR')
    {
      pointer++;
    }
    else
    {
      items[pointer].push(_cell);
    }
  }

  // if (temp.length > 0) { debugger; }

  const out =
  {
    time: config.BELLS[bell], day, type: 'g',
    items: extractUnitGroupData(items, url, teachersSet, placesSet)
  };



  return out;
}

function extractUnitGroupData(units, url, teachersSet, placesSet)
{
  let out = [];
  for (let unit of units)
  {
    if (unit.length === 0)
    {
      out.push(null);
    }
    else
    {
      let item = {};
      for (let cell of unit)
      {
        if (cell.type)
        {
          item.teacherId =
            cell.attribs.href.match(/[0-9].*.htm/)[0].replace(/\.html?/, '') +
            (/html_gk/.test(url.toLowerCase)
              ? '1'
              : '0')
              ;
          item.teacherName = cell.children[0].data;
          teachersSet.add(item.teacherId);
        }
        else if (/ауд/.test(cell))
        {
          item.place = cell;
          let pl = clearPlace(cell.replace(/ауд\.?/, ''));
          if (pl)
          {
            placesSet.add(pl);
          }
        }
        else
        {
          item.name = cell;
        }
      }
      out.push(item);
    }
  }
  return out;
}

function getPersonId (elem, url)
{
  var href = elem.parent.attribs.href;
  if (!href) { debugger; }
  let personId = href.match(/[0-9].*.htm/)[0].replace('.htm', '');
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


function emptyEvent ( time, day, group_name, position )
{
  return {
    time, day, group_name, position,
    place: '', person: '', personId: 1, name: '', status: 0
  }
}


function getPopulatedArrays( arr )
{
  return arr && arr.length > 0;
}

function dehydrateEvents(events, url)
{
  const groupEvents = {'1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': []};






}