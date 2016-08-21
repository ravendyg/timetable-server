module.exports =
{
	PORT: ':3011',

	MONGO_HOST: 'mongodb://localhost:27017',
	DB_NAME: 'timetable',
	SYNC_COLLECTION_NAME: 'sync',
	TECH_COLLECTION_NAME: 'tech',


	RUN_FREQUENCY: 1,			// in hours
	RUN_START: 6,
	RUN_END: 18,

	DAY_MULT: 1000 * 60 * 60 * 24,
	HOUR_MULT: 1000 * 60 * 60,
	TIMEZONE: 7,					// target timezone shift

	ENTER_URLS:
	[
		'http://old.nsu.ru/education/sched/Html_GK/schedule.htm',
		'http://old.nsu.ru/education/sched/Html_LK/schedule.htm'
	]
};