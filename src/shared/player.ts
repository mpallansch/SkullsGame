export class Player {
	public displayName: string;
	protected _username: string;
	protected _password: String;
	protected _authenticated: boolean = false;
	protected _defeated: boolean;
	protected _passed: boolean;
	protected _numCards: number;
	protected _numPlayed: number;
	protected _numRevealed: number;
	protected _skullIndex:number;
	protected _hasSkull: boolean;
	protected _numWins: number;

	constructor( displayName?: string ) {
		this.displayName = displayName;
		this._authenticated = false;
		this._numCards = 4;
		this._numPlayed = 0;
		this._numRevealed = 0;
		this._skullIndex = -1;
		this._hasSkull = true;
		this._numWins = 0;
	}

	get numCards(): number {
		return this._numCards;
	}
	set numCards( value: number ) {
		this._numCards = value;
	}
	get numPlayed(): number {
		return this._numPlayed;
	}
	set numPlayed( value: number ) {
		this._numPlayed = value;
	}
	get numRevealed(): number {
		return this._numRevealed;
	}
	set numRevealed( value: number ) {
		this._numRevealed = value;
	}
	get numWins(): number {
		return this._numWins;
	}
	set numWins( value: number ) {
		this._numWins = value;
	}
	get skullIndex(): number {
		return this._skullIndex;
	}
	set skullIndex( value: number ) {
		this._skullIndex - value;
	}
	get defeated(): boolean {
		return this._defeated;
	}
	set defeated( value: boolean ) {
		this._defeated = value;
	}
	get passed(): boolean {
		return this._passed;
	}
	set passed( value: boolean ) {
		this._passed = value;
	}
	get hasSkull(): boolean {
		return this._hasSkull;
	}
	set hasSkull( value: boolean ) {
		this._hasSkull = value;
	}

	public register( username: string, password: string, displayName?: string ): boolean {
		// TODO:  persist player info to database
		this.displayName = displayName;
		return true;
	}

	public logon( username: string, password: string ): boolean {
		// TODO:  database lookup and username/password validation
		return true;
	}

	public isAuthenticated(): boolean {
		return this._authenticated;
	}

	public startRound() {
		this._numCards = 4;
		this._numPlayed = 0;
		this._numRevealed = 0;
		this._skullIndex = -1;
		this._hasSkull = true;
		this._passed = false;
		this._defeated = false;
		this._numWins = 0;
	}

	public nextRound() {
		this._numCards = 4;
		this._numPlayed = 0;
		this._numRevealed = 0;
		this._skullIndex = -1;
		this._hasSkull = true;
		this._passed = false;
		this._defeated = false;
	}

}
