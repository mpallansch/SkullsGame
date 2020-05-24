import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import SSE from 'express-sse';

import { Player } from './shared/player';
import { Chair } from './shared/chair';
import { GameState } from './shared/game-state';
import * as PHASES from './shared/phases';

class GameServer {
	static Players = new Array<Player>();
	static Games = new Array<GameState>();

	static setupGame( numberOfPlayers: number ): GameState {
		let newGame = new GameState( numberOfPlayers );
		// TODO:  find better way to persist games on server to handle server restarts, etc.
		this.Games.push( newGame );
		return newGame;
	}

	static startGame( game: GameState ): boolean {
		let result: boolean = false;
		// TODO:  concurrency issues?
		let theGame = this.Games.filter( ( item: GameState ) => item.id === game.id );
		if ( theGame && 1 === theGame.length ) {
			theGame[ 0 ].started = true;
			theGame[ 0 ].phase = PHASES.STATE_WAITING;
			result = true;
		}
		return result;
	}

	static endGame( game: GameState ): boolean {
		let result: boolean = false;
		// TODO:  concurrency issues?
		this.Games.forEach( ( item: GameState, index: number ) => {
			if ( item.id === game.id ) {
				this.Games.splice( index, 1 );
				result = true;
			}
		} );
		return result;
	}

}

const app = express();
const sse = new SSE();

const PORT = process.env.PORT || 3000;

app.use( bodyParser.json() );
app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( cookieParser() );
app.use( session( { secret: "skullsskullskulls" } ) );

function checkSignIn( req: Request ): Player {
	let player: Player;
	let playerInSession: Player = req.session.user as Player;
	if ( ! playerInSession ) {
		let newPlayer = new Player( req.session.id );
		if ( newPlayer.logon( req.body.id, req.body.password ) ) {
			player = newPlayer;
		} else {
			player.message = 'Logon failed!';
		}
	} else {
		console.log( 'Not logged in!' );
		player = new Player( req.session.id );
	}
	return player;
}

app.get( '/create', function( req: Request, res: Response ) {
	console.log( 'create', req );
	let player: Player = checkSignIn( req );
	let numberOfPlayers: string = req.query.players as string;
	let newGame: GameState = GameServer.setupGame( parseInt( numberOfPlayers ) );
	if ( newGame ) {
		newGame.addPlayer( player, 0 );
		sse.send( { status: 'OK', player: player, game: newGame } );
		res.send( { status: 'OK', player: player, game: newGame } );
	} else {
		sse.send( { status: 'FAILED', player: player, game: undefined } );
		res.send( { status: 'FAILED', player: player, game: undefined } );
	}
} );

app.get( '/start', function( req: Request, res: Response ) {
	let player: Player = checkSignIn( req );
	let gameId: string = req.query.id as string;
	let games: GameState[] = GameServer.Games.filter( item => item.id === gameId );
	if ( games && 1 === games.length ) {
		let game: GameState = games[ 0 ];
		game.start();
		console.log( 'start', game );
		sse.send( { status: 'OK', player: player, game: game } );
		res.send( { status: 'OK', player: player, game: game } );
	} else {
		sse.send( { status: 'FAILED', player: player, game: undefined } );
		res.send( { status: 'FAILED', player: player, game: undefined } );
	}
} );

app.get( '/play-card', function( req: Request, res: Response ) {
	let player: Player = checkSignIn( req );
	let gameId: string = req.query.id as string;
	let games: GameState[] = GameServer.Games.filter( item => item.id === gameId );
	if ( games && 1 === games.length ) {
		let game: GameState = games[ 0 ];
		let card: string = req.query.skull === 'true' ? 'skull' : 'rose';
		if ( game.playCard( req.session.user.id, card ) ) {
			sse.send( { status: 'OK', player: player, game: game } );
			res.send( { status: 'OK', player: player, game: game } );
		} else {
			sse.send( { status: 'FAILED', player: player, game: game } );
			res.send( { status: 'FAILED', player: player, game: game } );
		}
	}
} );

app.get( '/play-bid', function( req: Request, res: Response ) {
	let player: Player = checkSignIn( req );
	let gameId: string = req.query.id as string;
	let games: GameState[] = GameServer.Games.filter( item => item.id === gameId );
	if ( games && 1 === games.length ) {
		let game: GameState = games[ 0 ];
		let bid: number = parseInt( req.query.value as string );
		if ( game.bid( req.session.user.id, bid ) ) {
			sse.send( { status: 'OK', player: player, game: game } );
			res.send( { status: 'OK', player: player, game: game } );
		} else {
			sse.send( { status: 'FAILED', player: player, game: game } );
			res.send( { status: 'FAILED', player: player, game: game } );
		}
	}
} );

app.get( '/reveal-card', function( req, res ) {
	let player: Player = checkSignIn( req );
	let gameId: string = req.query.id as string;
	let games: GameState[] = GameServer.Games.filter( item => item.id === gameId );
	if ( games && 1 === games.length ) {
		let game = games[ 0 ];
		let chairIndex = parseInt( req.query.chair as string );
		if ( game.chairs[ chairIndex ].player.skullIndex === ( game.chairs[ chairIndex ].player.numPlayed - game.chairs[ chairIndex ].player.numRevealed - 1 ) ) {
			game.chairs[ chairIndex ].player.numRevealed++;
			game.numRevealed++;

			game.phase = PHASES.STATE_WAITING;

			game.lastTurn = game.chairs[ game.turn ].player.displayName + ' revealed a skull';

			setTimeout( function() {
				if ( game.chairs[ game.highestBidder ].player.hasSkull ) {
					if ( Math.random() < ( 1 / game.chairs[ game.highestBidder ].player.numCards ) ) {
						game.chairs[ game.highestBidder ].player.hasSkull = false;
					}
				}
				game.chairs[ game.highestBidder ].player.numCards--;
				if ( game.chairs[ game.highestBidder ].player.numCards === 0 ) {
					game.chairs[ game.highestBidder ].player.defeated = true;
					game.numPlayers--;
					game.nextTurn();
				}

				game.nextRound();

				sse.send( GameState );
			}, 5000 );
		} else {
			game.chairs[ chairIndex ].player.numRevealed++;
			game.numRevealed++;

			game.lastTurn = game.chairs[ game.turn ].player.displayName + ' revealed a flower';

			if ( game.numRevealed === game.highestBid ) {
				game.chairs[ game.highestBidder ].player.numWins++;
				if ( game.chairs[ game.highestBidder ].player.numWins === 2 ) {
					game.phase = PHASES.STATE_WAITING;
					setTimeout( function() {
						game.phase = PHASES.STATE_FINISHED;
						game.started = false;
						sse.send( GameState );
					}, 5000 );
				} else {
					game.phase = PHASES.STATE_WAITING;
					setTimeout( function() {
						game.nextRound();
						sse.send( GameState );
					}, 5000 );
				}
			}
		}

		sse.send( { status: 'OK', player: player, game: game } );
		res.send( { status: 'OK', player: player, game: game } );
	}
} );

app.get( '/pass', function( req, res ) {
	let player: Player = checkSignIn( req );
	let gameId: string = req.query.id as string;
	let games: GameState[] = GameServer.Games.filter( item => item.id === gameId );
	if ( games && 1 === games.length ) {
		let game = games[ 0 ];
		if ( game.pass( req.session.user.id ) ) {
			sse.send( { status: 'OK', player: player, game: game } );
			res.send( { status: 'OK', player: player, game: game } );
		} else {
			sse.send( { status: 'FAILED', player: player, game: game } );
			res.send( { status: 'FAILED', player: player, game: game } );
		}
	}
} );

app.get( '/game-events', function( req: Request, res: Response, next: CallableFunction ) {
	// setTimeout( function() {
	// 	sse.send( GameState );
	// }, 500 );
	// next();
}, sse.init );

app.post( '/login', function( req, res ) {
	let newPlayer: Player;
	if ( !req.body.id || !req.body.password ) {
		newPlayer = new Player( req.session.id );
		newPlayer.message = 'Please enter both id and password';
		res.write( JSON.stringify( { status: 'OK', player: newPlayer } ) );
	} else {
		newPlayer = this.checkSignIn( req.body.id, req.body.password );
		if ( newPlayer.authenticated ) {
			let findPlayer: Player[] = GameServer.Players.filter( ( player: Player ) => player.username === newPlayer.username );
			if ( findPlayer || 0 === findPlayer.length ) {
				newPlayer = new Player( req.session.id );
				GameServer.Players.push( newPlayer );
			} else {
				newPlayer = findPlayer[ 0 ];
			}
			res.write( JSON.stringify( { status: 'OK', player: newPlayer } ) );
		}
		// for ( let i = 0; i < Users.length; i++ ) {
		// 	if ( Users[ i ].id === req.body.id && Users[ i ].password === req.body.password ) {
		// 		req.session.user = Users[ i ];
		// 		for ( let i = 0; i < game.chairs.length; i++ ) {
		// 			let chair = game.chairs[ i ];
		// 			if ( 'undefined' === typeof chair ) {
		// 				req.session.user.position = i;
		// 				game.chairs[ i ] = { name: req.session.user.id, numCards: 4, numPlayed: 0, numRevealed: 0, hasSkull: true, skullIndex: -1, numWins: 0 };
		// 				break;
		// 			}
		// 		};
		// 		game.numPlayers++;
		// 		sse.send( GameState );
		// 		res.redirect( '/game' );
		// 		console.log( 'login GameState', GameState );
		// 		return;
		// 	}
		// }
		//renderLogin( res, { message: 'Invalid credentials!' } );
	}
} );

app.get( '/logout', function( req, res ) {
	// console.log( 'logout', req );
	// game.chairs[ req.session.user.position ] = undefined;
	// game.numPlayers--;

	// req.session.destroy( function() {
	// 	console.log( "user logged out." )
	// 	res.redirect( '/login' );
	// 	if ( game.numPlayers < 3 ) {
	// 		game.phase = STATE_WAITING;
	// 	}
	// 	sse.send( GameState );
	// 	console.log( 'GameState', GameState );
	// } );
} );

app.get( '/join', function( req, res ) {
	console.log( 'join', req );
	let player: Player = checkSignIn( req );
	let gameId: string = req.query.id as string;
	let games: GameState[] = GameServer.Games.filter( item => item.id === gameId );
	let game: GameState;
	if ( games && 1 === games.length ) {
		game = games[ 0 ];
	} else {
		game = new GameState( 4 );
	}
	let status = 'OK'
	if ( game.numPlayers < game.maxNumPlayers ) {
		game.addPlayer( player, game.numPlayers );
	} else {
		player.message = 'Game is full!';
		status = 'ERROR'
	}
	sse.send( { status: status, player: player, game: game } );
	console.log( 'join GameState', game );
} );

app.use( '/', function( err, req, res, next ) {
	console.log( err );
	//User should be authenticated! Redirect them to log in.
	res.redirect( '/public/index.html' );
} );

app.use( '/images', express.static( __dirname + '/public/images' ) );
app.use( '/js', express.static( __dirname + '/public/js' ) );
app.use( '/css', express.static( __dirname + '/public/css' ) );

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
				<p id="message">${params.message}</p>
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
			<p id="user">${params.id}</p>
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
				var id = '${params.id}';
				var position = ${params.position};
			</script>
			<script src="/client.js"></script>

		</body>
		</html>`
	);
}

app.listen( PORT );
console.log( `Listening on port ${PORT}...` );
