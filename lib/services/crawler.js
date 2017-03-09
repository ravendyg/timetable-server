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
const mapsStorage = require('../storage/maps');
const aliasStorage = require('../storage/aliases');

const Promise = require('bluebird');

let groupsListMap;
let teachersListMap;
let namesMap;

let groupsMap;
let teachersMap;
let placesMap;

let eventsList;

let aliases;

let nameLists = {};

let firstRun = true;

let pagesCounter;

module.exports =
{
  run,
  getLists,
  syncData, getEventList,
  reset
};

function clearPlace(input, strip)
{
  if (input)
  {
    if (strip)
    {
      input = input.replace(/ауд.?/, '');
    }
    return input.replace(/^\s+|\s+$/g,'').replace(/\.$/,'');
  }
  else
  {
    return '';
  }
};

function reset()
{
  firstRun = true;
}

function run()
{
  let init;
  if (firstRun)
  {
    init = mapsStorage.getMaps()
    .then(maps =>
    {
      groupsListMap = maps.groupsListMap;
      teachersListMap = maps.teachersListMap;
      namesMap = maps.namesMap;
      groupsMap = maps.groupsMap;
      teachersMap = maps.teachersMap;
      placesMap = maps.placesMap;
      eventsList = maps.eventsList;
    })
    .then(aliasStorage.getAliases)
    .then(_aliases =>
    {
      aliases = _aliases;
    });

  }
  else
  {
    init = Promise.resolve();
  }
  utils.debug(['Run crawler: ' + new Date()]);
  init.then(() =>
    // teachers
    Promise.all(
      config.TEACHERS_URL
      .map(e => getHTML(e, handleList, teachersListMap))
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
      links = links.slice(0, 5);

      // remove _***.html - alphabetic lists of teachers
      links = links.filter(e => !/\_[0-9]{3,3}\.html?/.test(e));
      // links = links.filter(e => /44696/.test(e))

      pagesCounter = 0;

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
      links = links.slice(0, 5)
      // .concat(
      //   links.filter(e => e.match('16802.1', '13911.1'))
      // );
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
  .then(() =>
  {
    utils.debug(['finished']);
    mapsStorage.putMaps({
      groupsListMap,
      teachersListMap,
      namesMap,
      groupsMap,
      teachersMap,
      placesMap,
      aliases,
      eventsList,
    });
    firstRun = false;
  })
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
        let _time = map[link.replace(/\./g, '')];
        if (!_time || _time < time)
        { // expired or new
          if (!firstRun)
          {
            utils.debug(['updated ' + link]);
          }
          out.push(link);
          map[link.replace(/\./g, '')] = time;
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
      (/html_gk/.test(url.toLowerCase())
        ? '1'
        : '0')
        ;
    if (!table)
    {
      console.log(url);
      resolve();
      return;
    };
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

    let events = {}

    for (let day = 1; day < 7; day++)
    {
      for (let time = 0; time < 7; time++)
      {
        let index = time * colCounter + day - 1;

        let temp = parseTableCell(tableCells[index], url, extractUnitTeacherData);
        if (temp)
        { // don't need to keep an empty record
          events[day + '|' + time] = temp;
        }
      }
    }

    const shortNameHolder = $('h1');
    let shortName, key;
    let action;
    try
    {
      shortName = shortNameHolder[0].children[0].data || '';

      key = shortName.replace(/\./g, '');

      let name = aliases.teachers[key] || namesMap[key];

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
      namesMap[key] = name;
      teachersMap[teacherId.replace(/\./g, '')] = {
        teacherId,
        teacherName: name,
        events,
        tsp: teachersListMap[url.replace(/\./g, '')]
      };
      resolve();
      if (++pagesCounter % 20 === 0)
      {
        utils.debug([pagesCounter + ' pages processed']);
      }
    })
  });
}


function populatePlaces()
{
  let newPlacesMap = {};
  for (let key of Object.keys(teachersMap))
  {
    let _item = teachersMap[key];
    let events = _item.events;
    let tsp    = _item.tsp;
    if (!events)
    {
      utils.debug([key, _item]);
    }
    for (let _key of Object.keys(events || {}))
    {
      let event = events[_key];
      // let [day, time] = _key.split('|');
      for (let i = 0; i < event.length; i++)
      {
        let item = event[i];
        if (item)
        {
          let placeId = clearPlace(item.placeId, false);
          if (placeId)
          {
            let val = newPlacesMap[placeId.replace(/\./g, '')] || createEmptyPlace(placeId, tsp);
            if (!val.events[_key])
            {
              val.events[_key] = createEvent();
            }
            let newItem =
            {
              groups: item.groups || [],
              teacherId: _item.teacherId,
              teacherName: _item.teacherName,
            }
            val.events[_key][i] = newItem;
            newPlacesMap[placeId.replace(/\./g, '')] = val;
          }
        }
      }
    }
  }
  placesMap = newPlacesMap;
}

function createEmptyPlace(placeId, tsp)
{
  return {
    placeId,
    placeName: aliases.places[placeId] || placeId,
    tsp,
    events: {}
  };
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

  let events = {};

  for (let day = 1; day < 7; day++)
  {
    for (let time = 0; time < 7; time++)
    {
      let index = time * colCounter + day - 1;

      let temp = parseTableCell(tableCells[index], url, extractUnitGroupData);
      if (temp)
      { // don't need to keep an empty record
        events[day + '|' + time] = temp;
      }
    }
  }

  groupsMap[groupId.replace(/\./g, '')] = {
    groupId,
    events,
    tsp: groupsListMap[url.replace(/\./g, '')]
  };

  if (++pagesCounter % 20 === 0)
  {
    utils.debug([pagesCounter + ' pages processed']);
  }
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
            (/html_gk/.test(url.toLowerCase())
              ? '1'
              : '0')
              ;
          item.teacherName = cell.children[0].data;
        }
        else if (/ауд/.test(cell))
        {
          item.placeId = cell;
          item.placeName = aliases.places[cell.replace(/\./g, '')] || cell;
        }
        else
        {
          eventsList[cell.replace(/\./g, '')] = true;
          item.name = aliases.events[cell.replace(/\./g, '')] || cell;
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
          item.placeName = aliases.places[cell.replace(/\./g, '')] || cell;
        }
        else
        {
          eventsList[cell.replace(/\./g, '')] = true;
          item.name = aliases.events[cell.replace(/\./g, '')] || cell;
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
  for (let key of Object.keys(groupsMap))
  {
    let item = groupsMap[key];
    newNameLists.groups.push({name: item.groupId, groupId: item.groupId});
    newNameLists.tsp = Math.max(newNameLists.tsp, item.tsp);
  }
  for (let key of Object.keys(teachersMap))
  {
    let item = teachersMap[key];
    newNameLists.teachers.push({name: item.teacherName, teacherId: item.teacherId});
    newNameLists.tsp = Math.max(newNameLists.tsp, item.tsp);
  }
  for (let key of Object.keys(placesMap))
  {
    let item = placesMap[key];
    newNameLists.places.push({name: item.placeName, placeId: item.placeId});
    newNameLists.tsp = Math.max(newNameLists.tsp, item.tsp);
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
    let info = target[name.replace(/\./g, '')];
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
    let info = [];
    for (let key of Object.keys(target))
    {
      let item = target[key];
      if (item.tsp > tsp)
      {
        info.push(item);
      }
    }
    return info;
  }
}

function getEventList()
{
  return Object.keys(eventsList);
}