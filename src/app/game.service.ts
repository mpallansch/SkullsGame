import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, Observable } from 'rxjs';

import { environment } from '../environments/environment';
import { GameState } from '../shared/game-state';
import { Player } from '../shared/player';
import { Chair } from '../shared/chair';

@Injectable( {
	providedIn: 'root'
} )
export class GameService {

    public STATE_LOADING: number = 0;
    public STATE_ERROR: number = 1;
	public STATE_LOGIN: number = 2;
	public STATE_HOME: number = 3;
	public STATE_LOBBY: number = 4;
	public STATE_GAME: number = 5;

    public state;
    public player: Player;
    public game: GameState;
    private es: any;

	constructor(private http: HttpClient) {
        this.state = this.STATE_LOADING;

        this.es = new EventSource(environment.apiRoot + '/game-events' );
        this.es.onmessage = (message: any) => {
            let messageData: any;
            try {
                messageData = JSON.parse(message.data);
            } catch (error) {
                // TODO handle sse error
                return;
            }
            if (messageData.status === 'OK') {
                this.updateState(messageData.game);
                this.updatePlayer(messageData.player);
            } else {
                // TODO handle sse error
            }
        };

        this.es.onerror = (event, error) => {
            //TODO handle sse error
        };

        this.http.post(environment.apiRoot + '/login', new FormData()).subscribe((response: any) => {
            if(response.status === 'OK' && response.player.authenticated){
                if(response.game){
                    this.state = this.STATE_GAME;
                } else {
                    this.state = this.STATE_HOME;
                }
            } else {
                this.state = this.STATE_LOGIN;
            }
        }, (error) => {
            this.state = this.STATE_ERROR;
        });
    }

    updateState(game: any) {
        this.game = new GameState();
        Object.assign(this.game, game);
        this.game.chairs.forEach((chair: any, index) => {
            if(chair){
                let newChair = new Chair(undefined);
                Object.assign(newChair, chair);
                let newPlayer = new Player(undefined);
                Object.assign(newPlayer, newChair.player);
                newChair.player = newPlayer;
                this.game.chairs[index] = newChair;
            }
        });
    }

    updatePlayer(player: any) {
        this.player = new Player(undefined);
        Object.assign(this.player, player);
    }

    checkUsernameAvailability(username: string) {
        return this.http.get(environment.apiRoot + '/check-username-availability?username=' + encodeURIComponent(username));
    }

    login(username: string, password: string) {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);

        return new Observable((observer) => {
            this.http.post(environment.apiRoot + '/login', formData).subscribe((response: any) => {
                if (response.status === 'OK') {
                this.updatePlayer(response.player);
                    this.state = this.STATE_HOME;
                } else {
                    observer.next(response.message);
                }
                observer.complete();
            }, () => {
                observer.next('Can\'t connect to server ');
                observer.complete();
            });
        });
    }

    register(username: string, password: string, email: string) {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        formData.append('email', email);

        return new Observable((observer) => {
            this.http.post(environment.apiRoot + '/register', formData).subscribe((response: any) => {
                if (response.status === 'OK') {
                this.updatePlayer(response.player);
                    this.state = this.STATE_HOME;
                } else {
                    observer.next(response.message);
                }
                observer.complete();
            }, () => {
                observer.next('Can\'t connect to server ');
                observer.complete();
            });
        });
    }

    joinLobby(lobbyName: string, lobbyPassword: string) {
        const formData = new FormData();
        formData.append('name', lobbyName);
        formData.append('password', lobbyPassword);

        return new Observable((observer) => {
            this.http.post(environment.apiRoot + '/join', formData).subscribe((response: any) => {
                if (response.status === 'OK') {
                this.updateState(response.game);
                    this.state = this.STATE_LOBBY;
                } else {
                    observer.next(response.message);
                }
                observer.complete();
            }, () => {
                observer.next('Can\'t connect to server ');
                observer.complete();
            });
        });
    }

    createLobby(lobbyName: string, lobbyPassword: string) {
        const formData = new FormData();
        formData.append('name', lobbyName);
        formData.append('password', lobbyPassword);

        return new Observable((observer) => {
            this.http.post(environment.apiRoot + '/create', formData).subscribe((response: any) => {
                if (response.status === 'OK') {
                this.updateState(response.game);
                    this.state = this.STATE_LOBBY;
                } else {
                    observer.next(response.message);
                }
                observer.complete();
            }, () => {
                observer.next('Can\'t connect to server ');
                observer.complete();
            });
        });
    }

    startGame() {
        return new Observable((observer) => {
            this.http.get(environment.apiRoot + '/start?id=' + encodeURIComponent(this.game.id)).subscribe((response: any) => {
                if (response.status === 'OK') {
                    this.state = this.STATE_GAME;
                } else {
                    observer.next(response.message);
                }
                observer.complete();
            }, () => {
                observer.next('Can\'t connect to server ');
                observer.complete();
            });
        });
    }
}
