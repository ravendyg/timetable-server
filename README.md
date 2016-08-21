## Global dependencies
```
node > 4.0 (5.12 used)
tsd
```

## Set up
```
npm i
tsd install
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
	p: string,           // place
	n?: string,          // name
	g?: string,          // group
	pn?: string,         // person
	pi?: number,         // person id
	f?: string,          // full name
	s: number,				   // is it exists
	ts: number           // timestamp when modified
} []
```