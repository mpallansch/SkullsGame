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

app.use( '/images', express.static( __dirname + '/public/images' ) );
app.use( '/js', express.static( __dirname + '/public/js' ) );
app.use( '/css', express.static( __dirname + '/public/css' ) );


let checkSignIn = function( req: Request ): Player {
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
};

app.get( '/', function( req: Request, res: Response ) {
	let player: Player = checkSignIn( req );
	sse.send( { status: 'OK', player: player, game: undefined } );
	res.send( { status: 'OK', player: player, game: undefined } );
} );

app.post( '/login', function( req: Request, res: Response ) {
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
			sse.send( { status: 'OK', player: newPlayer, game: undefined } );
			res.send( { status: 'OK', player: newPlayer, game: undefined } );
		} else {
			sse.send( { status: 'FAILED', player: newPlayer, game: undefined } );
			res.send( { status: 'FAILED', player: newPlayer, game: undefined } );
		}
	}
} );

app.get( '/logout', function( req: Request, res: Response ) {
	console.log( 'logout', req );
	let player: Player = checkSignIn( req );
	if ( player ) {
		player.logout();
		// TODO:  Need to make sure the user is removed for any ongoing games.
	}
	// Whether or not we found the player go ahead and destroy the session.
	req.session.destroy( function() {
		console.log( 'user logged out.' )
		sse.send( { status: 'OK', player: undefined, game: undefined } );
		res.send( { status: 'OK', player: undefined, game: undefined } );
	} );
} );


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

app.get( '/join', function( req: Request, res: Response ) {
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
	res.send( { status: status, player: player, game: game } );
	console.log( 'join GameState', game );
} );

app.get( '/start', function( req: Request, res: Response ) {
	let player: Player = checkSignIn( req );
	let gameId: string = req.query.id as string;
	let games: GameState[] = GameServer.Games.filter( item => item.id === gameId );
	if ( games && 1 === games.length ) {
		let game: GameState = games[ 0 ];
		game.start();
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
		if ( game.playCard( player, card ) ) {
			sse.send( { status: 'OK', player: player, game: game } );
			res.send( { status: 'OK', player: player, game: game } );
		} else {
			sse.send( { status: 'FAILED', player: player, game: game } );
			res.send( { status: 'FAILED', player: player, game: game } );
		}
	}
} );


app.get( '/bid', function( req: Request, res: Response ) {
	let player: Player = checkSignIn( req );
	let gameId: string = req.query.id as string;
	let games: GameState[] = GameServer.Games.filter( item => item.id === gameId );
	if ( games && 1 === games.length ) {
		let game: GameState = games[ 0 ];
		let bid: number = parseInt( req.query.value as string );
		if ( game.bid( player, bid ) ) {
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
	let chairIndex = parseInt( req.query.chair as string );
	let games: GameState[] = GameServer.Games.filter( item => item.id === gameId );
	if ( games && 1 === games.length ) {
		let game = games[ 0 ];
		if ( game.revealCard( player, chairIndex ) ) {
			setTimeout( function() {
				sse.send( game );
			}, 5000 );
			sse.send( { status: 'OK', player: player, game: game } );
			res.send( { status: 'OK', player: player, game: game } );
		} else {
			sse.send( { status: 'FAILED', player: player, game: game } );
			res.send( { status: 'FAILED', player: player, game: game } );
		}
	} else {
		sse.send( { status: 'FAILED', player: player, game: undefined } );
		res.send( { status: 'FAILED', player: player, game: undefined } );
	}
} );

app.get( '/pass', function( req, res ) {
	let player: Player = checkSignIn( req );
	let gameId: string = req.query.id as string;
	let games: GameState[] = GameServer.Games.filter( item => item.id === gameId );
	if ( games && 1 === games.length ) {
		let game = games[ 0 ];
		if ( game.pass( player ) ) {
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

app.get( '/end', function( req: Request, res: Response ) {
	let player: Player = checkSignIn( req );
	let gameId: string = req.query.id as string;
	let games: GameState[] = GameServer.Games.filter( item => item.id === gameId );
	if ( games && 1 === games.length ) {
		let game: GameState = games[ 0 ];
		console.log( 'GameSever.Games before', GameServer.Games );
		if ( GameServer.endGame( game ) ) {
			console.log( 'GameSever.Games after', GameServer.Games );
			sse.send( { status: 'OK', player: player, game: undefined } );
			res.send( { status: 'OK', player: player, game: undefined } );
		} else {
			player.message = 'Failed to end game!';
			sse.send( { status: 'FAILED', player: player, game: undefined } );
			res.send( { status: 'FAILED', player: player, game: undefined } );
		}
	} else {
		player.message = 'Game not found!';
		sse.send( { status: 'FAILED', player: player, game: undefined } );
		res.send( { status: 'FAILED', player: player, game: undefined } );
	}
} );


app.listen( PORT );
console.log( `Listening on port ${PORT}...` );
