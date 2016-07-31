/// <reference path="./../../typings/tsd.d.ts" />

/**
 * wrap error to make it possible to provide some info fro the user
 */
function wrapError (err, message, source)
{
  Object.assign(
    err,
    { message, source }
  );
  return err;
}
module.exports.wrapError = wrapError;

/**
 * generate new error
 *
 * @code: number,   // http code
 * @message: string
 */
function create (status, message, source)
{
  var error = new Error(message);

  Object.assign(
    error,
    { status, message, source }
  );
  return error;
}
module.exports.create = create;