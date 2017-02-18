'use strict';

module.exports =
{
  tstmp,
  flatElement,
  getTextAndA,
  trim
}

/** generate UNIX timestamp */
function tstmp()
{
	return Math.round(Date.now() / 1000);
}

function flatElement(arr)
{
	if (!arr) {debugger;}
	var out = [];
	if (arr.children && arr.children.length > 0)
	{
		for (var i = 0; i < arr.children.length; i++)
    {
		  out = out.concat(flatElement(arr.children[i]))
    }
	}
	else
	{
		out = [ arr ]
	}
	return out;
}

function getTextAndA(item)
{
  let out = [];
  if (item.type === 'text' && item.data.replace(/[\s\r\n\t]/g, '').length > 0)
  {
    out = out.concat(item.data);
  }
  else if (item.name === 'a')
  {
    out = out.concat(item);
  }
  else if (item.children && item.children.length > 0)
  {
    if (item.name === 'tr')
    {
      out = out.concat('TR');
    }
    for (let i = 0; i < item.children.length; i++)
    {
      out = out.concat(getTextAndA(item.children[i]));
    }
  }
  return out;
}

function trim(str)
{
  return str.replace(/(^[\s\t]*|[\t\s]*$)/g, '')
}