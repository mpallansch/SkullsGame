export class Player {
	protected _sessionId: string;
	protected _displayName: string;
	protected _emailAddress: string;
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
	protected _message: string;

	constructor( sessionId: string ) {
		this._sessionId = sessionId;
		this._displayName = '';
		this._emailAddress = '';
		this._authenticated = false;
		this._numCards = 4;
		this._numPlayed = 0;
		this._numRevealed = 0;
		this._skullIndex = -1;
		this._hasSkull = true;
		this._numWins = 0;
		this._message = '';
	}

	get sessionId(): string {
		return this._sessionId;
	}
	get displayName(): string {
		return this._displayName;
	}
	set displayName( value: string ) {
		this._displayName = value;
	}
	get username(): string {
		return this._username;
	}
	get emailAddress(): string {
		return this._emailAddress;
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
	get message(): string {
		return this._message;
	}
	set message( value: string ) {
		this._message = value;
	}
	get autenticated(): boolean {
		return this._authenticated;
	}

	public register( username: string, password: string, displayName?: string, emailAddress?: string ): boolean {
		// TODO:  persist player info to database
		this._displayName = displayName;
		this._emailAddress = emailAddress;
		this._username = username;
		this._authenticated = false;
		return true;
	}

	public logon( username: string, password: string ): boolean {
		// TODO:  database lookup and username/password validation
		this._username = username;
		this._authenticated = true;
		return true;
	}

	public get authenticated(): boolean {
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
		this._message = '';
	}

	public nextRound() {
		this._numCards = 4;
		this._numPlayed = 0;
		this._numRevealed = 0;
		this._skullIndex = -1;
		this._hasSkull = true;
		this._passed = false;
		this._defeated = false;
		this._message = '';
	}

}
