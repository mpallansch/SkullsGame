import { Injectable } from '@angular/core';

@Injectable( {
	providedIn: 'root'
} )
export class GameService {

	public STATE_LOGIN: number = 0;
	public STATE_HOME: number = 1;
	public STATE_LOBBY: number = 2;
	public STATE_GAME: number = 3;

	public state;

	constructor() {
		this.state = this.STATE_LOGIN;
	}
}
