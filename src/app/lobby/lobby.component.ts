import { Component, OnInit } from '@angular/core';
import { GameService } from '../game.service';

@Component({
  selector: 'app-lobby',
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.scss']
})
export class LobbyComponent implements OnInit {

  private loading: boolean = false;
  private message: string = '';

  constructor(private gameService: GameService) { }

  ngOnInit() {
  }

  startGame() {
    this.loading = true;
    this.gameService.startGame().subscribe((message: string) => {
      this.loading = false;
      this.message = message;
    });
  }

}
