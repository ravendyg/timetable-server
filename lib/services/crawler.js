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
const myNsu = require('./my-nsu');

const Promise = require('bluebird');

const groupsListMap = new Map();
const teachersListMap = new Map();
const namesMap = new Map();

const groupsMap = new Map();
const teachersMap = new Map();
let   placesMap = new Map();

let nameLists = {};

module.exports =
{
  run,
  getLists,
  getGroups
};


function clearPlace(input, strip)
{
  if (strip)
  {
    input = input.replace(/ауд.?/, '');
  }
  return input.replace(/^\s+|\s+$/g,'').replace(/\.$/,'');
};


function run()
{
  // teachers
  Promise.all(
    config.TEACHERS_URL
    .map(e => getHTML(e, handleList, teachersListMap))
  )
  .then(
    arrs =>
    {
      return arrs.reduce(flatArray, []);
    }
  )
  .then(
    links =>
    {
      links = links.slice(0,3);

      return links.reduce(
        (acc, e) =>
        {
          return acc.then(
            () => getHTML(e, handleTeacherTable)
          )
        },
        Promise.resolve()
      );
    }
  )
  // places
  .then(populatePlaces)
  // groups
  .then(
    () => Promise.all(
            config.ENTER_URLS
            .map(e => e.replace(/schedule\.html?/, 'Groups/'))
            .map(e => getHTML(e, handleList, groupsListMap))
          )
  )
  .then(
    arrs =>
    {
      return arrs.reduce(flatArray, []);
    }
  )
  .then(
    links =>
    {
      links = links.slice(0,3).concat(
        links.filter(e => e.match('16802.1', '13911.1'))
      );
      // links = links.filter( e => e.match('13911.1') );

      return links.reduce(
        (acc, e) =>
        {
          return acc.then(
            () => getHTML(e, handleGroupTable)
          )
        },
        Promise.resolve()
      );
    }
  )
  .then(createNameLists)
  .then(() => { console.log('finished'); })
  .catch(
    err =>
    {
      console.error(err);
    }
  )
  ;
}

function splitLink(link)
{
  let temp = link.split('/');
  let out = temp[ temp.length - 1 ].split('$');
  return { link: link.replace(/\$.*/, ''), group: out[0], tsp: out[1] };
}


function flat(arr)
{
  return new Promise(
    resolve =>
    {
      let out = arr.reduce(flatArray, []);
      resolve(out);
    }
  );
}

function getHTML(url, foo, params)
{
  function main(resolve)
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
        else if (httpResp.statusCode !== 200 || !body || body.length === 0)
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
            resolve(foo($, url, params));
          }
          catch (e)
          {
            console.error(e);
            resolve([]);
          }
        }
      }
    );
  }
  return new Promise(main);
}


function selectUpdatedGroups($, url, { lastRun })
{
  const links = $('td>a').slice(1);
  let out = [];
  let tempDate;
  for (let i = 1; i < links.length; i++)
  {
    if (
      links[i].attribs &&
      links[i].attribs.href &&
      links[i].parent &&
      links[i].parent.next &&
      links[i].parent.next.children.length > 0 &&
      links[i].parent.next.children[0].data)
    {
      tempDate = Date.parse(links[i].parent.next.children[0].data);
      if (tempDate > lastRun)
      {
        out.push(url + links[i].attribs.href + '$' + tempDate);
      }
    }
  }

  return out;
}

function extractGroupHref(e)
{
  let out;
  if (e.attribs && e.attribs.href)
  {
    out = e.attribs.href;
  }
  else
  {
    out = '';
  }
  return out;
}

function identity(e)
{
  return e;
}

function handleList($, url, map)
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
        let _time = map.get(link);
        if (!_time || _time < time)
        { // expired or new
          out.push(link);
          map.set(link, time);
        }
      }
      catch (err)
      { // skip
      }
    }
  }

  return out;
}


function handleDeps($, url)
{
  let temp1 = $('ul')[0].children;

  let temp2 = temp1.filter(getListElements);

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

function getListElements(e)
{
  return e.name === 'li';
}

function getTr(e)
{
  return e.name === 'tr'
}

function getTd(e)
{
  return e.name === 'td'
}

function getChildren(e)
{
  return e.children;
}

function getText(e)
{
  return e.type === 'text';
}

function flatArray(acc, arr)
{
  return acc.concat(arr);
}

function removeTimeColumn(col)
{
  return (e, i) => i % (col + 1) === 0 ? false : true;
}

function handleGroups($, url)
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

function handleTeacherTable($, url)
{
  return new Promise(resolve =>
  {
    const table = $('table')[1];
    const teacherId =
      url.match(/[0-9].*.htm/)[0].replace(/\.html?/, '') +
      (/html_gk/.test(url.toLowerCase)
        ? '1'
        : '0')
        ;

    let tableRows = table.children.filter(getTr);

    let tableCells =
      tableRows
      .map(getChildren)
      .reduce(flatArray, [])
      .filter(getTd)
      .reduce(flatArray, [])
      ;
    let colCounter = tableCells.length > 49 ? 7 : 6
    tableCells  = tableCells.filter(removeTimeColumn(colCounter));

    let teacherEvents = []

    for (let day = 1; day < 7; day++)
    {
      for (let bell = 0; bell < 7; bell++)
      {
        let index = bell * colCounter + day - 1;
        let time = config.BELLS[ bell ];

        teacherEvents.push(
          parseTableCell(tableCells[index], url, day, time, 't', extractUnitTeacherData)
        );
      }
    }

    const shortNameHolder = $('h1');
    let shortName, _shortName;
    let action;
    try
    {
      _shortName = shortNameHolder[0].children[0].data || '';
      shortName = _shortName.match(/[А-Я][^\s]*/)[0];

      let name = namesMap.get(shortName);

      action =
        name
          ? Promise.resolve(name)
          : myNsu.getFullName(shortName, 0, true)
          ;
    }
    catch (err)
    {
      action = Promise.resolve('');
    }

    action
    .then(name =>
    {
      let arr = name.split('|');
      if (arr.length > 0)
      {
        let initials = _shortName.match(/[А-Я]/g);
        name = _shortName;
        for (let _name of arr)
        {
          let score = initials.length;
          for (let ini of initials)
          {
            if ((new RegExp(ini)).test(_name))
            {
              score--;
            }
          }
          if (score === 0)
          {
            name = utils.trim(_name);
            break;
          }
        }
      }
      namesMap.set(shortName, name);
      teachersMap.set(teacherId,
        {
          teacherId,
          teacherEvents,
          name,
          tsp: teachersListMap.get(url)
        }
      );
      resolve();
    })
  });
}


function populatePlaces()
{
  let newPlacesMap = new Map();
  let iterator = teachersMap.values();
  let unit = iterator.next();
  while (!unit.done)
  {
    let teacherEvents = unit.value.teacherEvents;
    let tsp           = unit.value.tsp;
    for (let event of teacherEvents)
    {
      for (let i = 0; i < event.items.length; i++)
      {
        let item = event.items[i];
        if (item)
        {
          let place = clearPlace(item.place, true);
          if (place)
          {
            let val = newPlacesMap.get(place) || createEmptyPlace(place, tsp);
            val.placeEvents[event.day * 6 + config.BELLS.indexOf(event.time)].items[i] = item;
            newPlacesMap.set(place, val);
          }
        }
      }
    }
    unit = iterator.next();
  }
  placesMap = newPlacesMap;
}

function createEmptyPlace(place, tsp)
{
  let placeEvents = [];
  for (let day = 1; day <= 7; day++)
  {
    for (let time of config.BELLS)
    {
      placeEvents.push({
        day, time, type: 'p', items: [[], [], []]
      })
    }
  }
  return {place, tsp, placeEvents};
}

/** parse one table
 * and write data to db
 * !!! mutating state
 */
function handleGroupTable($, url)
{
  // console.log( (new Date()).toLocaleString(), url );

  let group_name;
  const table = $('table')[1];
  try
  {
    group_name = url.toLowerCase();
    group_name = group_name.match(/[a-zа-я0-9_\.]*$/)[0].replace(/\.html?/,'').replace(/_/g,'.');
  }
  catch (e)
  {
    console.error(e, 'replacing group in ' + url);
    group_name = '';
  }

  let tableRows = table.children.filter(getTr);

  let tableCells =
    tableRows
    .map(getChildren)
    .reduce(flatArray, [])
    .filter(getTd)
    .reduce(flatArray, [])
    ;
  let colCounter = tableCells.length > 49 ? 7 : 6
  tableCells  = tableCells.filter(removeTimeColumn(colCounter));

  let events = [];
  let groupEvents = []

  for (let day = 1; day < 7; day++)
  {
    for (let bell = 0; bell < 7; bell++)
    {
      let index = bell * colCounter + day - 1;
      let time = config.BELLS[ bell ];

      let e2 =
        utils.flatElement(tableCells[index])
        .filter(getText)
        ;

      switch (e2.length)
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
          if (data.match('ауд.'))
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
        parseTableCell(tableCells[index], url, day, time, 'g', extractUnitGroupData)
      );
    }
  }


  groupsMap.set(group_name,
    {
      groupName: group_name,
      groupEvents,
      tsp: groupsListMap.get(url)
    }
  );



  var flatEvents = events.reduce(flatArray, []);
  db.putToStorage(flatEvents);

  return;
}

function parseTableCell(cell, url, day, time, type, cb)
{
  let temp = utils.getTextAndA(cell);
  let units = [[], [], []];
  let pointer = 0;
  for (let _cell of temp)
  {
    if (_cell === 'TR')
    {
      pointer++;
    }
    else
    {
      units[pointer].push(_cell);
    }
  }

  const out =
  {
    time, day, type,
    items: cb({units, url, day, time})
  };



  return out;
}

function extractUnitGroupData({units, url})
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
        }
        else if (/ауд/.test(cell))
        {
          item.place = cell;
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

function extractUnitTeacherData({units})
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
        if (cell.replace(/[0-9]/g, '').length * 2 < cell.length)
        {
          item.groups = cell.split(',').map(utils.trim);
        }
        else if (/ауд/.test(cell))
        {
          item.place = cell;
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

function getPersonId(elem, url)
{
  var href = elem.parent.attribs.href;
  if (!href) { debugger; }
  let personId = href.match(/[0-9].*.htm/)[0].replace('.htm', '');
  if (url.toLowerCase().match('html_gk'))
  {
    personId += '1';
  }
  else
  {
    personId += '0';
  }

  return +personId;
}


function emptyEvent(time, day, groupName, position)
{
  return {
    time, day, 'group_name': groupName, position,
    place: '', person: '', personId: 1, name: '', status: 0
  }
}


function getPopulatedArrays(arr)
{
  return arr && arr.length > 0;
}


function createNameLists()
{
//   groupsMap
// teachersMap
// placesMap
  let newNameLists =
  {
    groups: [],
    teachers: [],
    places: [],
    tsp: 0
  };
  let iterator = groupsMap.values();
  let record = iterator.next();
  while (!record.done)
  {
    newNameLists.groups.push(record.value.groupName);
    newNameLists.tsp = Math.max(newNameLists.tsp, record.value.tsp);
    record = iterator.next();
  }
  iterator = teachersMap.values();
  record = iterator.next();
  while (!record.done)
  {
    newNameLists.teachers.push({name: record.value.name, teacherId: record.value.teacherId});
    newNameLists.tsp = Math.max(newNameLists.tsp, record.value.tsp);
    record = iterator.next();
  }
  iterator = placesMap.values();
  record = iterator.next();
  while (!record.done)
  {
    newNameLists.places.push(record.value.place);
    newNameLists.tsp = Math.max(newNameLists.tsp, record.value.tsp);
    record = iterator.next();
  }
  nameLists = newNameLists;
}


function getLists(tsp)
{
  return tsp < nameLists.tsp
    ? nameLists
    : null
    ;
}

function getGroups(tsp, groupName)
{
  if (groupName)
  {
    let groupInfo = groupsMap.get(groupName);
    if (groupInfo)
    {
      return groupInfo.tsp > tsp ? [groupInfo] : [];
    }
    else
    {
      return null;
    }
  }
  else
  {
    let iterator = groupsMap.values();
    let unit = iterator.next();
    let info = [];
    while (!unit.done)
    {
      if (unit.value.tsp > tsp)
      {
        info.push(unit.value);
      }
      unit = iterator.next();
    }
    return info;
  }
}