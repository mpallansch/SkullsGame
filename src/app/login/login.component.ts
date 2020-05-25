import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { GameService } from '../game.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {

  private USERNAME_AVAILABLE = 1;
  private USERNAME_UNAVAILABLE = 2;
  private USERNAME_ERROR = 3;

  private register: boolean = false;
  private username: string = '';
  private password: string = '';
  private email: string = '';
  private message: string = '';
  private availability: number = 0;
  private loading: boolean = false;

  constructor(private gameService: GameService) { }

  ngOnInit() {

  }

  onSubmit() {
      this.loading = true;
      if(this.register){
          this.gameService.register(this.username, this.password, this.email).subscribe((message: string) => {
            this.loading = false;
            this.message = message;
          });
      } else {
          this.gameService.login(this.username, this.password).subscribe((message: string) => {
            this.loading = false;
            this.message = message;
          });
      }
  }

  checkUsernameAvailability() {
      this.gameService.checkUsernameAvailability(this.username).subscribe((response: any) => {
        if (response.status === 'OK') {
          if (response.available) {
            this.availability = this.USERNAME_AVAILABLE;
          } else {
            this.availability = this.USERNAME_UNAVAILABLE;
          }
        } else {
          this.availability = this.USERNAME_ERROR;
        }
      }, () => {
        this.availability = this.USERNAME_ERROR;
      });
  }

}
