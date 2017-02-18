module.exports =
{
  PORT: ':3011',

  DB_NAME: 'timetable',
  SYNC_TABLE_NAME: 'sync',
  TECH_TABLE_NAME: 'tech',
  NAME_TABLE_NAME: 'names',
  TEACHERS_TABLE_NAME: 'teachers',

  DB_HOST: '127.0.0.1',
  DB_USER: 'timetable',
  DB_PAS: 'azerty',


  RUN_FREQUENCY: 6,      // in hours
  RUN_START: 6,
  RUN_END: 18,

  DAY_MULT: 1000 * 60 * 60 * 24,
  HOUR_MULT: 1000 * 60 * 60,
  TIMEZONE: 7,          // target timezone shift

  ENTER_URLS: [
    // 'http://old.nsu.ru/education/sched/Html_GK/schedule.htm',
    // 'http://old.nsu.ru/education/sched/Html_LK/schedule.htm'
    // 'http://old.nsu.ru/education/sched/Html_GK/',
    // 'http://nsu.ru/education/sched/Html_LK/',
    // 'http://old.nsu.ru/education/sched/Html_LK1/'
    'http://nsu.ru/education/sched/Html_GK/schedule.htm',
    'http://nsu.ru/education/sched/Html_LK/schedule.htm',
    // 'http://nsu.ru/education/sched/Html_LK1/schedule.htm'
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

};