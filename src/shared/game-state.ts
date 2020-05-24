import { Player } from './player';
import { Chair } from './chair';
import * as PHASES from './phases';

export class GameState {
	protected _id: string;
	protected _started: boolean;
	protected _chairs: Array<Chair>;
	protected _maxNumPlayers: number;
	protected _numPlayers: number;
	protected _turn: number;
	protected _cardsPlayed: number;
	protected _numRevealed: number;
	protected _numPasses: number;
	protected _highestBidder: number;
	protected _highestBid: number;
	protected _round: number;
	protected _originalTurn: number;
	protected _lastTurn: string;
	protected _phase: number;

	protected makeId( length: number ): string {
		let result: string = '';
		let characters: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let charactersLength: number = characters.length;
		for ( let i: number = 0; i < length; i++ ) {
			result += characters.charAt( Math.floor( Math.random() * charactersLength ) );
		}
		return result;
	}

	constructor( maxNumberOfPlayers?: number ) {
		this._id = this.makeId( 7 );  // Generate a randome ID for the game here...
		this._started = false;
		this._chairs = new Array<Chair>( maxNumberOfPlayers ? maxNumberOfPlayers : 4 );
		this._maxNumPlayers = maxNumberOfPlayers ? maxNumberOfPlayers : 4;
		this._numPlayers = 0;
		this._turn = 0;
		this._cardsPlayed = 0;
		this._numRevealed = 0;
		this._numPasses = 0;
		this._highestBidder = -1;
		this._highestBid = 0;
		this._round = 1;
		this._originalTurn = 0;
		this._lastTurn = '';
		this._phase = PHASES.STATE_PREBIDDING;
	}

	get id(): string {
		return this._id;
	}
	get started(): boolean {
		return this._started;
	}
	set started( value: boolean ) {
		this._started = value;
	}
	get chairs(): Array<Chair> {
		return this._chairs;
	}
	get numPlayers(): number {
		return this._numPlayers;
	}
	set numPlayers( value: number ) {
		this._numPlayers = value;
	}
	get maxNumPlayers(): number {
		return this._maxNumPlayers;
	}
	get turn(): number {
		return this._turn;
	}
	set turn( value: number ) {
		this._turn = value;
	}
	get cardsPlayed(): number {
		return this._cardsPlayed;
	}
	set cardsPlayed( value: number ) {
		this._cardsPlayed = value;
	}
	get numRevealed(): number {
		return this._numRevealed;
	}
	set numRevealed( value: number ) {
		this._numRevealed = value;
	}
	get numPasses(): number {
		return this._numPasses;
	}
	get highestBidder(): number {
		return this._highestBidder;
	}
	set highestBidder( value: number ) {
		this._highestBidder = value;
	}
	get highestBid(): number {
		return this._highestBid;
	}
	set highestBid( value: number ) {
		this._highestBid = value;
	}
	get round(): number {
		return this._round;
	}
	get originalTurn(): number {
		return this._originalTurn;
	}
	get lastTurn(): string {
		return this._lastTurn;
	}
	set lastTurn( value: string ) {
		this._lastTurn = value;
	}
	get phase(): number {
		return this._phase;
	}
	set phase( value: number ) {
		this._phase = value;
	}

	public addPlayer( player: Player, position: number ): boolean {
		let result = false;
		let newChair = new Chair( position );
		newChair.player = player;
		this.chairs[ position ] = newChair;
		return result;
	}

	start() {
		this._started = true;
		this._round = 1;
		this._phase = PHASES.STATE_PREBIDDING;
		this._turn = 0;
		this._cardsPlayed = 0;
		this._numRevealed = 0;
		this._numPasses = 0;
		this._originalTurn = 0;
		this._chairs.forEach( function( chair ) {
			if ( chair && chair.player ) {
				chair.player.startRound();
				this._numPlayers++;
			}
		} );
		this._lastTurn = '';
	}

	public nextRound() {
		this._round++;
		this._phase = PHASES.STATE_PREBIDDING;
		this._cardsPlayed = 0;
		this._numRevealed = 0;
		this._numPlayers = 0;
		this._numPasses = 0;
		this._lastTurn = '';
		this._originalTurn++;
		if ( this._originalTurn > this._numPlayers - 1 ) {
			this._originalTurn = 0;
		}
		delete this._highestBid;
		delete this._highestBidder;
		this._chairs.forEach( function( chair ) {
			if ( chair && chair.player ) {
				chair.player.nextRound();
				this._numPlayers++;
			}
		} );
	}

	public pass( userId: string ): boolean {
		let result = false;
		try {
			this._chairs[ this._turn ].player.passed = true;
			this._numPasses++;
			this._lastTurn = this._chairs[ this._turn ].player.displayName + ' passed';
			this.nextTurn();
			result = true;
		} catch ( ex ) {
			console.log( ex );
		}
		return result;
	}

	playCard( userId: string, card: string ): boolean {
		let result = false;
		try {
			if ( 'skull' === card ) {
				this._chairs[ this._turn ].player.skullIndex = this._chairs[ this._turn ].player.numPlayed;
			}
			this._chairs[ this._turn ].player.numPlayed++;
			this._cardsPlayed++;
			if ( this._cardsPlayed === this._numPlayers * 4 ) {
				this._phase = PHASES.STATE_BIDDING;
				this.nextTurn();
			}

			this._lastTurn = this._chairs[ this._turn ].player.displayName + ' played a card';
			result = true;
		} catch ( ex ) {
			console.log( ex );
		}
		return result;
	}

	public bid( userId: string, value: number ): boolean {
		let result = false;
		try {
			this._highestBid = value;
			this._highestBidder = this._turn;
			if ( this._phase === PHASES.STATE_PREBIDDING ) {
				this._phase = PHASES.STATE_BIDDING;
			}
			if ( this._highestBid === this._cardsPlayed ) {
				this._phase = PHASES.STATE_FULFILLING
				this._turn = this._highestBidder;
				this.nextTurn();
			} else {
				this._lastTurn = this._chairs[ this._turn ].player.displayName + ' bid ' + this._highestBid;
			}
			result = true;
		} catch ( ex ) {
			console.log( ex );
		}
		return result;
	}

	public nextTurn() {
		console.log( 'originalTurn', this._originalTurn );
		this._turn++;
		if ( this._turn > this._numPlayers - 1 ) {
			this._turn = 0;
		}
		console.log( 'this._turn before', this._turn );
		while ( this._turn !== this._originalTurn &&
			( !this._chairs[ this._turn ] ||
				this._chairs[ this._turn ].player.defeated ||
				this._chairs[ this._turn ].player.passed ) ) {
			this._turn++;
			if ( this._turn > this._numPlayers - 1 ) {
				this._turn = 0;
			}
		}
		console.log( 'this._turn after', this._turn );
		console.log( 'this._highestBidder', this._highestBidder );
		console.log( 'this._numPasses', this._numPasses );

		if ( 'undefined' === typeof this._highestBidder && this._numPasses === this._numPlayers - 1 ) {
			this._phase = PHASES.STATE_BIDDING;
		} else if ( this._turn === this._originalTurn &&
			this._turn === this._highestBidder && this._numPasses === ( this._numPlayers - 1 ) ) {
			this._phase = PHASES.STATE_FULFILLING;
			this._turn = this._highestBidder;
		}
	}

}
