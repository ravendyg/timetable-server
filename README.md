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
time			- lessont time (to reduce query response size)

response:
{
	time: string,
	place: string,
	name?: string,
	group?: string,
	person?: string,
	fullName?: string,
	day: number,
	status: false				// is it exists
} []
```