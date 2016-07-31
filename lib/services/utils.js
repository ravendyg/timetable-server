/// <reference path="../../index.d.ts" />

const config = require('../config');

/** generate UNIX timestamp */
function tstmp ()
{
	return Math.round( Date.now() / 1000 );
}
module.exports.tstmp = tstmp;