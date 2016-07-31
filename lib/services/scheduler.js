/// <reference path="../../index.d.ts" />

const config = require('../config');

const crawler = require('./crawler');

/**
 * run every RUN_FREQUENCY howrs since RUN_START untill RUN_END
 */
const hours = [];
for (var h = config.RUN_START; h <= config.RUN_END; h += config.RUN_FREQUENCY)
{
	hours.push(h);
}

function start ()
{
	checkSchedule();
}
module.exports.start = start;

function checkSchedule ()
{
	var now = Date.now()  + config.TIMEZONE * config.HOUR_MULT;
	var nextRun;
	var dayStart = Math.floor( now / config.DAY_MULT ) * config.DAY_MULT;
	var hour = Math.floor( (now - dayStart) / config.HOUR_MULT );

	if ( hours.indexOf(hour) !== -1 )
	{
		crawler.run();
	}

	// plan next start
	for (var k = 0; k < hours.length - 1; k++)
	{
		if ( hour === hours[k] )
		{
			hour = hours[k+1];
			break;
		}
	}

	if ( k === hours.length - 1 )
	{	// done today
		hour = 24 + hours[0];
	}

	nextRun = dayStart + hour * config.HOUR_MULT;

	setTimeout(
		checkSchedule,
		nextRun - now
	);
}