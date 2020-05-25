import { Component, OnInit } from '@angular/core';
import { GameService } from '../game.service';


@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  private lobbyName: string = '';
  private lobbyPassword: string = '';
  private loading: boolean = false;
  private message: string = '';

  constructor(private gameService: GameService) { }

  ngOnInit() {

  }

  joinLobby() {
    this.gameService.joinLobby(this.lobbyName, this.lobbyPassword).subscribe((message: string) => {
      this.loading = false;
      this.message = message;
    });
  }

  createLobby() {
    this.gameService.createLobby(this.lobbyName, this.lobbyPassword).subscribe((message: string) => {
      this.loading = false;
      this.message = message;
    });
  }

}
