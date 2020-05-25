import { Player } from './player';

export class Chair {
	protected _position: number;
	protected _player: Player;

	constructor( position: number ) {
		this._position = position;
	}

	public get player(): Player {
		return this._player;
	}

    public set player( value: Player ) {
        //TODO re-enable this check
		//if ( value.authenticated ) {
			this._player = value;
		//}
	}

}
