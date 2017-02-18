## Global dependencies
```
node 6.9.5

swagger
```

## Set up
```
npm i
```

## Run
```
npm start			// development
```

## API

### Synchronization
```

GET /sync?timestamp=..&time=..

timestamp - time of last synchronization (0 - never before)
time      - lesson time (to reduce query response size)

response:
{
	d: number,           // day
	t: string,           // time
	p: string,           // place
	n?: string,          // name
	g?: string,          // group_name
	ps?: number,         // position: 0 - every week, 1 - every uneven, 2 - every even
	pn?: string,         // person
	pi?: number,         // person id
	f?: string,          // full name
	s: number,				   // is it exists
	ts: number           // timestamp when modified
} []
```