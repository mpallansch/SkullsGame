const express = require( 'express' );
const SSE = require( 'express-sse' );
const path = require( 'path' );
const bodyParser = require( 'body-parser' );
const multer = require( 'multer' );
const session = require( 'express-session' );
const cookieParser = require( 'cookie-parser' );
const app = express();
const upload = multer();
const sse = new SSE();

const PORT = process.env.PORT || 3000;

app.use( bodyParser.json() );
app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( upload.array() );
app.use( cookieParser() );
app.use( session( { secret: "skullsskullskulls" } ) );

let STATE_PREBIDDING = 0;
let STATE_BIDDING = 1;
let STATE_FULFILLING = 2;
let STATE_FINISHED = 3;
let STATE_WAITING = 4;

let Users = [
	{
		id: 'Matt',
		password: 'kearneykearneykearney'
	},
	{
		id: 'Joe',
		password: 'daviddaviddavid'
	},
	{
		id: 'Jenn',
		password: 'cullencullencullen'
	},
	{
		id: 'Mom',
		password: 'morelandmorelandmoreland'
	},
	{
		id: 'Cass',
		password: 'antonyantonyantony'
	},
	{
		id: 'Ashley',
		password: 'cowncowncown'
	},
	{
		id: 'Danni',
		password: 'reneereneerenee'
	}
];

let GameState = {
	started: false,
	chairs: [ undefined, undefined, undefined, undefined, undefined ],
	numPlayers: 0,
	turn: 0,
	cardsPlayed: 0,
	numRevealed: 0,
	numPasses: 0,
	round: 1,
	originalTurn: 0,
	lastTurn: '',
	phase: STATE_PREBIDDING
};

function checkSignIn( req, res, next ) {
	if ( req.session.user ) {
		next();     //If session exists, proceed to page
	} else {
		//let err = new Error( 'Not logged in!' );
		console.log( 'Not logged in!' );
		next( 'Not logged in!' );  //Error, trying to access unauthorized page!
	}
}

function nextTurn( res, nextPhase ) {
	console.log( 'originalTurn', GameState.originalTurn );
	GameState.turn++;
	if ( GameState.turn > GameState.numPlayers - 1 ) {
		GameState.turn = 0;
	}
	console.log( 'GameState.turn before', GameState.turn );
	while ( GameState.turn !== GameState.originalTurn &&
		( !GameState.chairs[ GameState.turn ] ||
			GameState.chairs[ GameState.turn ].defeated ||
			GameState.chairs[ GameState.turn ].passed ) ) {
		GameState.turn++;
		if ( GameState.turn > GameState.numPlayers - 1 ) {
			GameState.turn = 0;
		}
	}
	console.log( 'GameState.turn after', GameState.turn );

	console.log( 'GameState.turn after', GameState.turn );
	console.log( 'GameState.highestBidder', GameState.highestBidder );
	console.log( 'GameState.numPasses', GameState.numPasses );

	if ( 'undefined' === typeof GameState.highestBidder && GameState.numPasses === GameState.numPlayers - 1 ) {
		GameState.phase = STATE_BIDDING;
	} else if ( GameState.turn === GameState.originalTurn &&
		GameState.turn === GameState.highestBidder && GameState.numPasses === ( GameState.numPlayers - 1 ) ) {
		GameState.phase = STATE_FULFILLING;
		GameState.turn = GameState.highestBidder;
	}
}

function nextRound() {
	GameState.round++;
	GameState.phase = STATE_PREBIDDING;
	GameState.cardsPlayed = 0;
	GameState.numRevealed = 0;
	GameState.numPlayers = 0;
	GameState.numPasses = 0;
	GameState.lastTurn = '';
	GameState.originalTurn++;
	if ( GameState.originalTurn > GameState.numPlayers - 1 ) {
		GameState.originalTurn = 0;
	}
	delete GameState.highestBid;
	delete GameState.highestBidder;
	GameState.chairs.forEach( function( chairObj ) {
		if ( chairObj ) {
			chairObj.numPlayed = 0;
			chairObj.numRevealed = 0;
			chairObj.skullIndex = -1;
			chairObj.passed = false;
			GameState.numPlayers++;
		}
	} );
}

app.get( '/start', function( req, res ) {
	GameState.started = true;
	GameState.round = 1,
		GameState.phase = STATE_PREBIDDING;
	GameState.turn = 0;
	GameState.cardsPlayed = 0;
	GameState.numRevealed = 0;
	GameState.numPasses = 0;
	GameState.originalTurn = 0;
	GameState.chairs.forEach( function( chairObj ) {
		if ( chairObj ) {
			chairObj.numCards = 4;
			chairObj.numPlayed = 0;
			chairObj.numRevealed = 0;
			chairObj.hasSkull = true;
			chairObj.skullIndex = -1;
			chairObj.numWins = 0;
		}
	} );
	GameState.lastTurn = '';
	sse.send( GameState );
	res.send( 'OK' );
} );

app.get( '/play-card', function( req, res ) {
	if ( req.query.skull === 'true' ) {
		GameState.chairs[ GameState.turn ].skullIndex = GameState.chairs[ GameState.turn ].numPlayed;
	}
	GameState.chairs[ GameState.turn ].numPlayed++;
	GameState.cardsPlayed++;
	if ( GameState.cardsPlayed === GameState.numPlayers * 4 ) {
		GameState.phase = STATE_BIDDING;
	}

	GameState.lastTurn = GameState.chairs[ GameState.turn ].name + ' played a card';

	nextTurn();

	sse.send( GameState );
	res.send( 'OK' );
} );

app.get( '/play-bid', function( req, res ) {
	GameState.highestBid = parseInt( req.query.value );
	GameState.highestBidder = GameState.turn;
	if ( GameState.phase === STATE_PREBIDDING ) {
		GameState.phase = STATE_BIDDING;
	}
	if ( GameState.highestBid === GameState.cardsPlayed ) {
		GameState.phase = STATE_FULFILLING
		GameState.turn = GameState.highestBidder;

		sse.send( GameState );
		res.send( 'OK' );

		return;
	}

	GameState.lastTurn = GameState.chairs[ GameState.turn ].name + ' bid ' + GameState.highestBid;

	nextTurn();

	sse.send( GameState );
	res.send( 'OK' );
} );

app.get( '/reveal-card', function( req, res ) {
	let chairIndex = parseInt( req.query.chair );
	if ( GameState.chairs[ chairIndex ].skullIndex === ( GameState.chairs[ chairIndex ].numPlayed - GameState.chairs[ chairIndex ].numRevealed - 1 ) ) {
		GameState.chairs[ chairIndex ].numRevealed++;
		GameState.numRevealed++;

		GameState.phase = STATE_WAITING;

		GameState.lastTurn = GameState.chairs[ GameState.turn ].name + ' revealed a skull';

		setTimeout( function() {
			if ( GameState.chairs[ GameState.highestBidder ].hasSkull ) {
				if ( Math.random() < ( 1 / GameState.chairs[ GameState.highestBidder ].numCards ) ) {
					GameState.chairs[ GameState.highestBidder ].hasSkull = false;
				}
			}
			GameState.chairs[ GameState.highestBidder ].numCards--;
			if ( GameState.chairs[ GameState.highestBidder ].numCards === 0 ) {
				GameState.chairs[ GameState.highestBidder ].defeated = true;
				GameState.numPlayers--;
				nextTurn();
			}

			nextRound();

			sse.send( GameState );
		}, 5000 );
	} else {
		GameState.chairs[ chairIndex ].numRevealed++;
		GameState.numRevealed++;

		GameState.lastTurn = GameState.chairs[ GameState.turn ].name + ' revealed a flower';

		if ( GameState.numRevealed === GameState.highestBid ) {
			GameState.chairs[ GameState.highestBidder ].numWins++;
			if ( GameState.chairs[ GameState.highestBidder ].numWins === 2 ) {
				GameState.phase = STATE_WAITING;
				setTimeout( function() {
					GameState.phase = STATE_FINISHED;
					GameState.started = false;
					sse.send( GameState );
				}, 5000 );
			} else {
				GameState.phase = STATE_WAITING;
				setTimeout( function() {
					nextRound();

					sse.send( GameState );
				}, 5000 );
			}
		}
	}

	sse.send( GameState );
	res.send( 'OK' );
} );

app.get( '/pass', function( req, res ) {
	GameState.chairs[ GameState.turn ].passed = true;
	GameState.numPasses++;
	GameState.lastTurn = GameState.chairs[ GameState.turn ].name + ' passed';

	nextTurn();

	sse.send( GameState );
	res.send( 'OK' );
} );

app.get( '/game-events', function( req, res, next ) {
	setTimeout( function() {
		sse.send( GameState );
	}, 500 );
	next();
}, sse.init );

app.get( '/game', checkSignIn, function( req, res ) {
	renderGame( res, { id: req.session.user.id, position: req.session.user.position } )
} );

app.get( '/', checkSignIn, function( req, res ) {
	renderGame( res, { id: req.session.user.id, position: req.session.user.position } )
} );

app.get( '/login', function( req, res ) {
	renderLogin( res, { message: '' } );
} );

app.post( '/login', function( req, res ) {
	if ( !req.body.id || !req.body.password ) {
		renderLogin( res, { message: 'Please enter both id and password' } );
	} else {
		for ( let i = 0; i < Users.length; i++ ) {
			if ( Users[ i ].id === req.body.id && Users[ i ].password === req.body.password ) {
				req.session.user = Users[ i ];
				for ( let i = 0; i < GameState.chairs.length; i++ ) {
					let chair = GameState.chairs[ i ];
					if ( 'undefined' === typeof chair ) {
						req.session.user.position = i;
						GameState.chairs[ i ] = { name: req.session.user.id, numCards: 4, numPlayed: 0, numRevealed: 0, hasSkull: true, skullIndex: -1, numWins: 0 };
						break;
					}
				};
				GameState.numPlayers++;
				sse.send( GameState );
				res.redirect( '/game' );
				console.log( 'login GameState', GameState );
				return;
			}
		}
		renderLogin( res, { message: 'Invalid credentials!' } );
	}
} );

app.get( '/logout', function( req, res ) {
	console.log( 'logout', req );
	GameState.chairs[ req.session.user.position ] = undefined;
	GameState.numPlayers--;

	req.session.destroy( function() {
		console.log( "user logged out." )
		res.redirect( '/login' );
		if ( GameState.numPlayers < 3 ) {
			GameState.phase = STATE_WAITING;
		}
		sse.send( GameState );
		console.log( 'GameState', GameState );
	} );
} );

app.get( '/client.js', function( req, res ) {
	res.sendFile( path.join( __dirname + '/client.js' ) );
} );

app.get( '/client.css', function( req, res ) {
	res.sendFile( path.join( __dirname + '/client.css' ) );
} );

app.use( '/game', function( err, req, res, next ) {
	console.log( err );
	//User should be authenticated! Redirect them to log in.
	res.redirect( '/login' );
} );

app.use( '/', function( err, req, res, next ) {
	console.log( err );
	//User should be authenticated! Redirect them to log in.
	res.redirect( '/login' );
} );

app.use( '/images', express.static( __dirname + '/public/images' ) );

function renderLogin( res, params ) {
	res.send(
		`<!DOCTYPE html>
		<html>
			<head>
				<title>Skulls Game Login</title>
				<link rel="stylesheet prefetch" href="/client.css" />
			</head>
			<body>
				<h1>SKULL</h1>
				<p id="message">${params.message }</p>
				<form action="/login" method="POST" enctype="multipart/form-data">
					<label for="id">Username: </label><input id="id" type="text" name="id" /><br/>
					<label for="password">Password: </label><input id="password" type="password" name="password" /><br/>
					<input type="submit" value="Submit" />
				</form>
			</body>
		</html>`
	);
}

function renderGame( res, params ) {
	res.send(
		`<!DOCTYPE html>
		<html>
		<head>
			<title>Skulls Game</title>
			<link rel="stylesheet prefetch" href="/client.css" />
			<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js"></script>
		</head>
		<body>
			<p id="user">${params.id }</p>
			<form id="logout-form" action="/logout" method="GET">
				<input id="logout" type="submit" value="Logout"/>
			</form>

			<div id="lobby">
				<div id="players">

				</div>
				<p id="not-enough-players">There are not enough players to begin the game</p>
				<button id="begin">Begin the game</button>
			</div>

			<div id="game">
				<p id="phase"></p>
				<p id="waiting"></p>
				<div id="bid"></div>
				<div id="bidding"></div>
				<p id="round"></p>
				<div id="chairs"></div>
			</div>

			<script>
				var id = '${params.id }';
				var position = ${params.position };
			</script>
			<script src="/client.js"></script>

		</body>
		</html>`
	);
}

app.listen( PORT );
console.log( `Listening on port ${ PORT }...` );
