/// <reference path="../../index.d.ts" />

const config = require('../config');

/** generate UNIX timestamp */
function tstmp ()
{
	return Math.round( Date.now() / 1000 );
}
module.exports.tstmp = tstmp;

function flatElement (arr)
{
	var out = [];
	if (arr.children && arr.children.length > 0)
	{
		for (var i = 0; i < arr.children.length; i++)
		out = out.concat( flatElement(arr.children[i]) )
	}
	else
	{
		out = [ arr ]
	}
	return out;
}
module.exports.flatElement = flatElement;