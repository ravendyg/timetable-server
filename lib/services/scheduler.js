'use strict';

const crawler = require('./crawler');

function start()
{
  crawler.run();

	setInterval(
    crawler.run,
    1000 * 60 * 2 // 60 * 6
	);
}
module.exports.start = start;