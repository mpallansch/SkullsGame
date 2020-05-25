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
app.use( (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*'); // TODO, set this to be specific domains

  next();
} );

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

app.get( '/check-username-availability', function( req: Request, res: Response ) {
    // TODO check username availability
    res.send( { status: 'OK', available: Math.random() > 0.5 ? true : false} );
} );

app.post( '/register', function( req, res ) {
    res.send( { status: 'OK', player: checkSignIn( req ), game: undefined } ); // TODO validate data and register new user
} );

app.post( '/login', function( req, res ) {
    let newPlayer: Player;
    if ( !req.body.id || !req.body.password ) {
        newPlayer = new Player( req.session.id );
        newPlayer.message = 'Please enter both id and password';
        res.send( JSON.stringify( { status: 'OK', player: newPlayer } ) );
    } else {
        newPlayer = checkSignIn( req );
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

app.get( '/logout', function( req, res ) {
    // TODO:  Need to make sure the user is removed for any ongoing games.
    let player: Player = checkSignIn( req );
    if ( player ) {
        player.logout();
    }
    // game.chairs[ req.session.user.position ] = undefined;
    // game.numPlayers--;

    // req.session.destroy( function() {
    //  console.log( "user logged out." )
    //  res.redirect( '/login' );
    //  if ( game.numPlayers < 3 ) {
    //      game.phase = STATE_WAITING;
    //  }
    //  sse.send( GameState );
    //  console.log( 'GameState', GameState );
    // } );
} );

app.post( '/create', function( req: Request, res: Response ) {
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
		sse.send( { status: 'OK', player: player, game: game } );
		res.send( { status: 'OK', player: player, game: game } );
	} else {
		res.send( { status: 'FAILED', message: 'Game not found', player: player, game: undefined } );
	}
} );

app.get( '/end', function( req: Request, res: Response ) {
	let player: Player = checkSignIn( req );
	let gameId: string = req.query.id as string;
	let games: GameState[] = GameServer.Games.filter( item => item.id === gameId );
	if ( games && 1 === games.length ) {
		let game: GameState = games[ 0 ];
		if ( GameServer.endGame( game ) ) {
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

app.get( '/game-events',  sse.init );

app.post( '/join', function( req, res ) {
	let player: Player = checkSignIn( req );
	let gameId: string = req.query.id as string;
	let games: GameState[] = GameServer.Games.filter( item => item.id === gameId );
	let game: GameState;
	if ( games && 1 === games.length ) {
		game = games[ 0 ];
	} else {
        game = new GameState( 4 );
        GameServer.Games.push(game);
	}
	let status = 'OK'
    if ( game.numPlayers < game.maxNumPlayers ) {
        console.log('game before player');
        console.log(game);
		game.addPlayer( player, game.numPlayers );
        console.log('game after player');
        console.log(game);
	} else {
		player.message = 'Game is full!';
		status = 'ERROR'
	}
	sse.send( { status: status, player: player, game: game } );
	res.send( { status: status, player: player, game: game } );
} );

app.get( '/', function( req: Request, res: Response ) {
	let player: Player = checkSignIn( req );
	sse.send( { status: 'OK', player: player, game: undefined } );
	res.send( { status: 'OK', player: player, game: undefined } );
} );

app.listen( PORT );
console.log( `Listening on port ${PORT}...` );
