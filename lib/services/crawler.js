'use strict';

const request = require('request');
const cheerio = require('cheerio');

var Iconv = require('iconv').Iconv;
var fromEnc = 'cp1251';
var toEnc = 'UTF-8//IGNORE';// 'utf-8';
var translator = new Iconv(fromEnc,toEnc);

const config = require('../config');
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
  syncData
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
      links = links.slice(0,5);

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
      links = links.slice(0,5).concat(
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

function flatArray(acc, arr)
{
  return acc.concat(arr);
}

function removeTimeColumn(col)
{
  return (e, i) => i % (col + 1) === 0 ? false : true;
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

    let teacherEvents = {}

    for (let day = 1; day < 7; day++)
    {
      for (let bell = 0; bell < 7; bell++)
      {
        let index = bell * colCounter + day - 1;
        let time = config.BELLS[bell];

        let temp = parseTableCell(tableCells[index], url, extractUnitTeacherData);
        if (temp)
        { // don't need to keep an empty record
          teacherEvents[day + '|' + time] = temp;
        }
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
    for (let _key of Object.keys(teacherEvents))
    {
      let event = teacherEvents[_key];
      // let [day, time] = _key.split('|');
      for (let i = 0; i < event.length; i++)
      {
        let item = event[i];
        if (item)
        {
          let placeId = clearPlace(item.placeId, false);
          if (placeId)
          {
            let val = newPlacesMap.get(placeId) || createEmptyPlace(placeId, tsp);
            if (!val.placeEvents[_key])
            {
              val.placeEvents[_key] = createEvent();
            }
            let newItem =
            {
              groups: item.groups || [],
              name: item.name,
              teacherId: unit.value.teacherId,
              teacherName: unit.value.name,
            }
            val.placeEvents[_key][i] = newItem;
            newPlacesMap.set(placeId, val);
          }
        }
      }
    }
    unit = iterator.next();
  }
  placesMap = newPlacesMap;
}

function createEmptyPlace(placeId, tsp)
{
  return {placeId, tsp, placeEvents: {}};
}

function createEvent()
{
  return [[], [], []];
}

/** parse one table
 * and write data to db
 * !!! mutating state
 */
function handleGroupTable($, url)
{
  // console.log( (new Date()).toLocaleString(), url );

  let groupId;
  const table = $('table')[1];
  try
  {
    groupId = url.toLowerCase();
    groupId = groupId.match(/[a-zа-я0-9_\.]*$/)[0].replace(/\.html?/,'').replace(/_/g,'.');
  }
  catch (e)
  {
    console.error(e, 'replacing group in ' + url);
    groupId = '';
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

  let groupEvents = {};

  for (let day = 1; day < 7; day++)
  {
    for (let time = 0; time < 7; time++)
    {
      let index = time * colCounter + day - 1;

      let temp = parseTableCell(tableCells[index], url, extractUnitGroupData);
      if (temp)
      { // don't need to keep an empty record
        groupEvents[day + '|' + time] = temp;
      }
    }
  }

  groupsMap.set(groupId,
    {
      groupId,
      groupEvents,
      tsp: groupsListMap.get(url)
    }
  );
}

function parseTableCell(cell, url, cb)
{
  let temp = utils.getTextAndA(cell);
  if (temp.length === 0)
  {
    return null;
  }
  let units = createEvent();
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

  const out = cb({units, url});

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
          item.placeId = cell;
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
          item.placeId = cell;
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


function createNameLists()
{
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
    newNameLists.groups.push(record.value.groupId);
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
    newNameLists.places.push(record.value.placeId);
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

function syncData(type, tsp, name)
{
  let target;
  switch (type)
  {
    case 'groups':
      target = groupsMap;
    break;

    case 'teachers':
      target = teachersMap;
    break;

    case 'places':
      target = placesMap;
    break;
  }
  if (name)
  {
    let info = target.get(name);
    if (info)
    {
      return info.tsp > tsp ? [info] : [];
    }
    else
    {
      return null;
    }
  }
  else
  {
    let iterator = target.values();
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
