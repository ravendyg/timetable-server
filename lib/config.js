module.exports =
{
  PORT: ':3033',

  RUN_FREQUENCY: 6,      // in hours
  RUN_START: 6,
  RUN_END: 18,

  DAY_MULT: 1000 * 60 * 60 * 24,
  HOUR_MULT: 1000 * 60 * 60,
  TIMEZONE: 7,          // target timezone shift

  ENTER_URLS: [
    'http://nsu.ru/education/sched/Html_GK/schedule.htm',
    'http://nsu.ru/education/sched/Html_LK/schedule.htm',
  ],

  TEACHERS_URL: [
    'http://nsu.ru/education/sched/Html_GK/Teachers/',
    'http://nsu.ru/education/sched/Html_LK/Teachers/',
  ],

  BELLS: ['9:00', '10:50', '12:40', '14:30', '16:20', '18:10', '20:00'],

  CRITICAL_TIME_DIFFERENCE: 1000 * 60 * 60 * 24 * 7 * 2,     // two weeks

  RESET_TIMESTAMP: 1478263099,

  GROUP_RECORD_VALID_FOR: 1000 * 60 * 60 * 24 * 30,

  PROXY_URL: 'http://192.168.1.121:3012/echo',

  DROP_CACHE_AFTER: 0,

};