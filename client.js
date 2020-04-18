var express = require('express');
var SSE = require('express-sse');
var bodyParser = require('body-parser');
var multer = require('multer');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var app = express();
var upload = multer();
var sse = new SSE();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(upload.array());
app.use(cookieParser());
app.use(session({secret: "skullsskullskulls"}));

var STATE_PREBIDDING = 0;
var STATE_BIDDING = 1;
var STATE_FULFILLING = 2;
var STATE_FINISHED = 3;
var STATE_WAITING = 4;

var Users = [
    {
        id: 'Matt',
        password: 'kearneykearneykearney'
    },
    {
        id: 'Joe',
        password: 'daviddaviddavid'
    },
    {
        id: 'Jenn',
        password: 'cullencullencullen'
    },
    {
        id: 'Mom',
        password: 'morelandmorelandmoreland'
    },
    {
        id: 'Cass',
        password: 'antonyantonyantony'
    },
    {
        id: 'Ashley',
        password: 'cowncowncown'
    },
    {
        id: 'Danni',
        password: 'reneereneerenee'
    }
];

var GameState = {
    started: false,
    chairs: [undefined, undefined, undefined, undefined, undefined],
    numPlayers: 0,
    turn: 0,
    cardsPlayed: 0,
    numRevealed: 0,
    numPasses: 0,
    round: 1,
    lastTurn: '',
    phase: STATE_PREBIDDING
};

function checkSignIn(req, res, next){
   if(req.session.user){
      next();     //If session exists, proceed to page
   } else {
      var err = new Error("Not logged in!");
      console.log(req.session.user);
      next(err);  //Error, trying to access unauthorized page!
   }
}

function nextTurn(res, nextPhase){
    var originalTurn = GameState.turn;
    GameState.turn++;
    while(GameState.turn !== originalTurn && (!GameState.chairs[GameState.turn] || GameState.chairs[GameState.turn].defeated || GameState.chairs[GameState.turn].passed)) {
        GameState.turn++;
        if (GameState.turn === 5) {
            GameState.turn = 0;
        }
    }

    if (GameState.turn === originalTurn || (GameState.turn === GameState.highestBidder && GameState.numPasses === (GameState.numPlayers - 1))) {
        GameState.phase = STATE_FULFILLING;
        GameState.turn = GameState.highestBidder;
    }
}

function nextRound(){
    GameState.round++;
    GameState.phase = STATE_PREBIDDING;
    GameState.cardsPlayed = 0;
    GameState.numRevealed = 0;
    GameState.numPlayers = 0;
    GameState.numPasses = 0;
    GameState.lastTurn = '';
    delete GameState.highestBid;
    delete GameState.highestBidder;
    GameState.chairs.forEach(function(chairObj){
        if(chairObj){
            chairObj.numPlayed = 0;
            chairObj.numRevealed = 0;
            chairObj.skullIndex = -1;
            chairObj.passed = false;
            GameState.numPlayers++;
        }
    });
}

app.get('/start', function(req, res){
    GameState.started = true;
    GameState.round = 1,
    GameState.phase = STATE_PREBIDDING;
    GameState.turn = 0;
    GameState.cardsPlayed = 0;
    GameState.numRevealed = 0;
    GameState.numPasses = 0;
    GameState.chairs.forEach(function(chairObj){
        if (chairObj) {
            chairObj.numCards = 4;
            chairObj.numPlayed = 0;
            chairObj.numRevealed = 0;
            chairObj.hasSkull = true;
            chairObj.skullIndex = -1;
            chairObj.numWins = 0;
        }
    });
    GameState.lastTurn = '';
    sse.send(GameState);
    res.send('OK');
});

app.get('/play-card', function(req, res){
    if (req.query.skull === 'true') {
        GameState.chairs[GameState.turn].skullIndex = GameState.chairs[GameState.turn].numPlayed;
    }
    GameState.chairs[GameState.turn].numPlayed++;
    GameState.cardsPlayed++;
    if (GameState.cardsPlayed === GameState.numPlayers * 4) {
        GameState.phase = STATE.bidding;
    }

    GameState.lastTurn = GameState.chairs[GameState.turn].name + ' played a card';

    nextTurn();

    sse.send(GameState);
    res.send('OK');
});

app.get('/play-bid', function(req, res){
    GameState.highestBid = parseInt(req.query.value);
    GameState.highestBidder = GameState.turn;
    if (GameState.phase === STATE_PREBIDDING) {
        GameState.phase = STATE_BIDDING;
    }
    if(GameState.highestBid === GameState.cardsPlayed) {
        GameState.phase = STATE_FULFILLING
        GameState.turn = GameState.highestBidder;

        sse.send(GameState);
        res.send('OK');

        return;
    }

    GameState.lastTurn = GameState.chairs[GameState.turn].name + ' bid ' + GameState.highestBid;

    nextTurn();

    sse.send(GameState);
    res.send('OK');
});

app.get('/reveal-card', function(req, res){
    var chairIndex = parseInt(req.query.chair);
    if (GameState.chairs[chairIndex].skullIndex === (GameState.chairs[chairIndex].numPlayed - GameState.chairs[chairIndex].numRevealed - 1)) {
        GameState.chairs[chairIndex].numRevealed++;
        GameState.numRevealed++;

        GameState.phase = STATE_WAITING;

        GameState.lastTurn = GameState.chairs[GameState.turn].name + ' revealed a skull';

        setTimeout(function(){
            if (GameState.chairs[GameState.highestBidder].hasSkull) {
                if (Math.random() < (1 / GameState.chairs[GameState.highestBidder].numCards)) {
                    GameState.chairs[GameState.highestBidder].hasSkull = false;
                }
            }
            GameState.chairs[GameState.highestBidder].numCards--;
            if (GameState.chairs[GameState.highestBidder].numCards === 0) {
                GameState.chairs[GameState.highestBidder].defeated = true;
                GameState.numPlayers--;
                nextTurn();
            }

            nextRound();

            sse.send(GameState);
        }, 5000);
    } else {
        GameState.chairs[chairIndex].numRevealed++;
        GameState.numRevealed++;

        GameState.lastTurn = GameState.chairs[GameState.turn].name + ' revealed a flower';

        if (GameState.numRevealed === GameState.highestBid) {
            GameState.chairs[GameState.highestBidder].numWins++;
            if (GameState.chairs[GameState.highestBidder].numWins === 2) {
                GameState.phase = STATE_WAITING;
                setTimeout(function(){
                    GameState.phase = STATE_FINISHED;
                    GameState.started = false;
                    sse.send(GameState);
                }, 5000);
            } else {
                GameState.phase = STATE_WAITING;
                setTimeout(function(){
                    nextRound();

                    sse.send(GameState);
                }, 5000);
            }
        }
    }

    sse.send(GameState);
    res.send('OK');
});

app.get('/pass', function(req, res){
    GameState.chairs[GameState.turn].passed = true;
    GameState.numPasses++;
    GameState.lastTurn = GameState.chairs[GameState.turn].name + ' passed';

    nextTurn();

    sse.send(GameState);
    res.send('OK');
});

app.get('/game-events', function(req, res, next){
    setTimeout(function(){
        sse.send(GameState);
    }, 500);
    next();
}, sse.init);

app.get('/game', checkSignIn, function(req, res){
   renderGame(res, {id: req.session.user.id, position: req.session.user.position})
});

app.get('/', checkSignIn, function(req, res){
   renderGame(res, {id: req.session.user.id, position: req.session.user.position})
});

app.get('/login', function(req, res){
    renderLogin(res, {message: ''});
});

app.post('/login', function(req, res){
    if(!req.body.id || !req.body.password){
      renderLogin(res, {message: 'Please enter both id and password'});
    } else {
      for (var i = 0; i < Users.length; i++) {
        if(Users[i].id === req.body.id && Users[i].password === req.body.password){
            req.session.user = Users[i];
            req.session.user.position = GameState.numPlayers;
            GameState.chairs[GameState.numPlayers] = {name: req.session.user.id, numCards: 4, numPlayed: 0, numRevealed: 0, hasSkull: true, skullIndex: -1, numWins: 0};
            GameState.numPlayers++;
            sse.send(GameState);
            res.redirect('/game');
            return;
         }
      }
      renderLogin(res, {message: 'Invalid credentials!'});
   }
});

app.get('/logout', function(req, res){
   GameState.chairs[req.session.user.position] = undefined;
   GameState.numPlayers--;
   sse.send(GameState);
   req.session.destroy(function(){
      console.log("user logged out.")
   });
   res.redirect('/login');
});

app.use('/game', function(err, req, res, next){
   console.log(err);
   //User should be authenticated! Redirect them to log in.
   res.redirect('/login');
});

app.use('/', function(err, req, res, next){
   console.log(err);
   //User should be authenticated! Redirect them to log in.
   res.redirect('/login');
});

app.use('/images', express.static(__dirname + '/public/images'));

function renderLogin(res, params) {
    res.send(
    `<!DOCTYPE html>
    <html>
        <head>
            <title>Skulls Game Login</title>
            <style>
                html {
                    height: 100%;
                    overflow: hidden;
                }

                body {
                    height: 100%;
                    background-image: url('images/background.jpg');
                    background-size: 100% 100%;
                    margin: 0;
                    color: gray;
                    font-family: sans-serif;
                    font-size: x-large;
                }

                h1 {
                    text-align: center;
                    padding-top: 10%;
                    font-size: -webkit-xxx-large;
                }

                #message {
                    text-align: center;
                    color: red;
                }

                form {
                    text-align: center;
                } 

                input[type="text"], input[type="password"]{
                    margin: 10px;
                    background-color: transparent;
                    color: white;
                    border: 2px solid darkgray;
                    padding: 5px;
                    border-radius: 5px;
                    font-size: x-large;
                }

                input[type="submit"]{
                    appearance: none;
                    -webkit-appearance: none;
                    padding: 10px 40px;
                    border-radius: 5px;
                    background-color: lightgray;
                    margin-top: 5%;
                }
            </style>
        </head>
        <body>
            <h1>SKULL</h1>
            <p id="message">${params.message}</p>
            <form action="/login" method="POST" enctype="multipart/form-data">
                <label for="id">Username: </label><input id="id" type="text" name="id" /><br/>
                <label for="password">Password: </label><input id="password" type="password" name="password" /><br/>
                <input type="submit" value="Submit" />
            </form>
        </body>
    </html>`
    );
}

function renderGame(res, params) {
    res.send(
    `<!DOCTYPE html>
    <html>
        <head>
            <title>Skulls Game</title>
            <style>
                html {
                    height: 100%;
                    overflow: hidden;
                }

                body {
                    height: 100%;
                    background-image: url('images/background.jpg');
                    background-size: 100% 100%;
                    margin: 0;
                    color: gray;
                    font-family: sans-serif;
                    font-size: x-large;
                }

                #user {
                    margin: 10px;
                    display: inline-block;
                }

                #round, #phase, #bid {
                    position: absolute;
                    width: 50%;
                    left: 25%;
                    top: 10px;
                    margin: 0;
                    text-align: center;
                }

                #phase {
                    top: 45px;
                }

                #bid {
                    top: 80px;
                }

                #bidding {
                    position: absolute;
                    left: 10px;
                    bottom: 10px;
                }

                #bidding .bid {
                    display: inline-block;
                    background-color: lightgray;
                    color: black;
                    border-radius: 5px;
                    padding: 5px 10px;
                    border-bottom: 2px solid gray;
                    border-right: 2px solid gray;
                    margin-right: 5px;
                    box-shadow: 0px 0px 5px 5px yellow;
                }

                #logout-form {
                    float: right;
                }

                #logout {
                    margin: 10px;
                    appearance: none;
                    -webkit-appearance: none;
                    padding: 10px 40px;
                    border-radius: 5px;
                    background-color: lightgray;
                    margin-top: 5%;
                    font-size: large;
                }   

                #not-enough-players {
                    position: absolute;
                    top: 45%;
                    text-align: center;
                    width: 100%;
                    color: red;
                }

                #begin {
                    display: none;
                    position: absolute;
                    width: 20%;
                    left: 40%;
                    top: 45%;
                    appearance: none;
                    -webkit-appearance: none;
                    padding: 10px 40px;
                    border-radius: 5px;
                    background-color: lightgreen;
                    font-size: x-large;
                }

                #players div, #chairs .chair {
                    position: absolute;
                    width: 30%;
                    height: 10%;
                    text-align: center;
                    box-sizing: border-box;
                }

                #players div {
                    padding-top: 4%;
                    color: green;
                }

                #players div.empty {
                    color: gray;
                }

                #players div:nth-child(1), #chairs .chair:nth-child(1){
                    bottom: 50px;
                    left: 35%;
                }

                #players div:nth-child(2), #chairs .chair:nth-child(2){
                    bottom: 20%;
                    left: 5%;
                }

                #players div:nth-child(3), #chairs .chair:nth-child(3){
                    top: 15%;
                    left: 5%;
                }

                #players div:nth-child(4), #chairs .chair:nth-child(4){
                    top: 15%;
                    right: 5%;
                }

                #players div:nth-child(5), #chairs .chair:nth-child(5){
                    bottom: 20%;
                    right: 5%;
                }

                #chairs .chair:nth-child(2){
                    transform: rotate(45deg);
                }

                #chairs .chair:nth-child(3){
                    transform: rotate(135deg);
                }

                #chairs .chair:nth-child(4){
                    transform: rotate(225deg);
                }

                #chairs .chair:nth-child(5){
                    transform: rotate(315deg);
                }

                #chairs .chair::before {
                    content: ' ';
                    position: absolute;
                    top: -102px;
                    left: calc(50% - 32px);
                    width: 65px;
                    height: 65px;
                    border-radius: 5px;
                    background-color: rgb(20, 20, 20);
                }

                #chairs .chair.win::before {
                    background-color: pink;
                }

                .player-name {
                    color: green;
                }

                .player-name.defeated {
                    color: red;
                }

                .card {
                    position: relative;
                    display: inline-block;
                    width: 50px;
                    height: 50px;
                    margin: 5px;

                    transition: transform .5s linear 0s;
                    -webkit-transition: -webkit-transform .5s linear 0s;
                    -moz-transition: -moz-transform .5s linear 0s;
                    -o-transition: -o-transform .5s linear 0s;
                }

                .card .front, .card .back {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    background-image: url(images/skulls-flower.png);
                    background-size: 100% 100%;

                    transition: transform .5s linear 0s;
                    -webkit-transition: -webkit-transform .5s linear 0s;
                    -moz-transition: -moz-transform .5s linear 0s;
                    -o-transition: -o-transform .5s linear 0s;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                }

                .card.skull .front {
                    background-image: url(images/skulls-skull.png);   
                }

                .card .back {
                    background-image: url(images/skulls-down.png);
                }

                .card.up .front {
                    transform: rotateY(0deg);
                    -webkit-transform: rotateY(0deg);
                    -moz-transform: rotateY(0deg);
                    -o-transform: rotateY(0deg);
                }

                .card.up .back {
                    transform: rotateY(180deg);
                    -webkit-transform: rotateY(180deg);
                    -moz-transform: rotateY(180deg);
                    -o-transform: rotateY(180deg);
                }

                .card.active {
                    border-radius: 25px;
                    box-shadow: 0px 0px 5px 5px yellow;
                }

                .card.played {
                    transform: translate(-90px,-100px);
                    z-index: 1;
                }

                .card.played.up {
                    transform: translate(-90px,-200px);
                    z-index: 4;
                }

                .card:nth-child(1).played {
                    transform: translate(60px, -100px);
                    z-index: 4;
                }

                .card:nth-child(1).played.up {
                    transform: translate(60px, -200px);
                    z-index: 1;
                }

                .card:nth-child(2).played {
                    transform: translate(10px, -100px);
                    z-index: 3;
                }

                .card:nth-child(2).played.up {
                    transform: translate(10px, -200px);
                    z-index: 2;
                }

                .card:nth-child(3).played {
                    transform: translate(-40px, -100px);
                    z-index: 2;
                }

                .card:nth-child(3).played.up {
                    transform: translate(-40px, -200px);
                    z-index: 3;
                }
            </style>
            <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js"></script>
        </head>
        <body>
            <p id="user">${params.id}</p>
            <form id="logout-form" action="/logout" method="GET">
                <input id="logout" type="submit" value="Logout"/>
            </form>

            <div id="lobby">
                <div id="players">
                    
                </div>
                <p id="not-enough-players">There are not enough players to begin the game</p>
                <button id="begin">Begin the game</button>
            </div>

            <div id="game">
                <p id="phase"></p>
                <p id="waiting"></p>
                <div id="bid"></div>
                <div id="bidding"></div>
                <p id="round"></p>
                <div id="chairs"></div>
            </div>

            <script>
                var id = '${params.id}';
                var position = ${params.position};
                var es = new EventSource('/game-events');
                var boardRendered = false;
                var gameState;

                var STATE_PREBIDDING = 0;
                var STATE_BIDDING = 1;
                var STATE_FULFILLING = 2;
                var STATE_FINISHED = 3;

                $('#begin').click(function(){
                    $.ajax({url:'/start?cachebust=' + Math.random() * 1000000});
                });

                function renderLobbyPlayer(playersEl$, chairObj) {
                    playersEl$.append('<div class="' + (chairObj ? '' : 'empty') + '">' + (chairObj ? chairObj.name : 'Empty') + '</div>')
                }

                function renderChairUpdate(chairIndex, chairObj){
                    if(chairObj){
                        var cardsEl$ = $('.chair' + chairIndex + ' .card');
                        if(cardsEl$.length > chairObj.numCards){
                            cardsEl$.slice(chairObj.numCards).remove();
                        }
                        $('.chair' + chairIndex + ' .card.skull').removeClass('skull');
                        for(var i = 0; i < (chairObj.numCards - chairObj.numPlayed); i++){
                            $('.chair' + chairIndex + ' .card:nth-child(' + (i + 1) + ')').removeClass('played');
                            if(chairIndex === position){
                                $('.chair' + chairIndex + ' .card:nth-child(' + (i + 1) + ')').addClass('up');
                            } else {
                                $('.chair' + chairIndex + ' .card:nth-child(' + (i + 1) + ')').removeClass('up');
                            }
                        }
                        for(var i = (chairObj.numCards - chairObj.numPlayed); i < (chairObj.numCards - chairObj.numPlayed + chairObj.numRevealed); i++){
                            $('.chair' + chairIndex + ' .card:nth-child(' + (i + 1) + ')').addClass('played').addClass('up');
                            if((chairObj.numCards - 1 - i) === chairObj.skullIndex){
                                $('.chair' + chairIndex + ' .card:nth-child(' + (i + 1) + ')').addClass('skull');
                            }
                        }
                        for(var i = (chairObj.numCards - chairObj.numPlayed + chairObj.numRevealed); i < chairObj.numCards; i++){
                            $('.chair' + chairIndex + ' .card:nth-child(' + (i + 1) + ')').addClass('played').removeClass('up');
                        }
                        if(chairIndex === position){
                            if(chairObj.skullIndex !== -1 || !chairObj.hasSkull){
                                var chairEl$ = $('.chair' + chairIndex + ' .card.skull');
                            } else {
                                $('.chair' + chairIndex + ' .card:nth-child(1)').addClass('skull');
                            }
                        }
                        if(chairObj.defeated){
                            $('.chair' + chairIndex + ' .player-name').addClass('defeated');
                        }
                    }
                }

                function renderChair(gameBoardEl$, chairIndex, chairObj){
                    var chairEl$ = $('<div class="chair chair' + chairIndex + '" data-chair-index="' + chairIndex + '"></div>');

                    if(chairObj){
                        for(var i = 0; i < (chairObj.numCards - chairObj.numPlayed); i++){
                            var cardEl$ = $('<div class="card" data-card-index="' + i + '"><div class="front"></div><div class="back"></div></div>');

                            if(position === chairIndex){
                                cardEl$.addClass('up');
                            }

                            if(i === 0 && chairObj.hasSkull){
                                cardEl$.addClass('skull');
                            }

                            cardEl$.click(cardClick);
                            chairEl$.append(cardEl$);
                        }

                        for(var i = (chairObj.numCards - chairObj.numPlayed); i < chairObj.numCards; i++){
                            var cardEl$ = $('<div class="card played" data-card-index="' + i + '"><div class="front"></div><div class="back"></div></div>');

                            if(position === chairIndex){
                                cardEl$.addClass('up');
                            }

                            cardEl$.click(cardClick);
                            chairEl$.append(cardEl$);

                        }
                        chairEl$.append('<p class="player-name">' + chairObj.name + '</p>');
                    } else {
                        chairEl$.text('Empty');
                    }

                    gameBoardEl$.append(chairEl$);
                }

                function cardClick(e){
                    var targetEl$ = $(e.target);
                    if(!targetEl$.hasClass('card')){
                        targetEl$ = targetEl$.parent();
                    }
                    if(targetEl$.hasClass('active')){
                        if(gameState.phase === STATE_PREBIDDING){
                            if(!targetEl$.hasClass('played')){
                                $.ajax({url: '/play-card?skull=' + targetEl$.hasClass('skull') + '&cachebust=' + Math.random() * 1000000});
                            }
                        } else {
                            var chairIndex = parseInt(targetEl$.parent().attr('data-chair-index'));
                            $.ajax({url: '/reveal-card?chair=' + chairIndex + '&cachebust=' + Math.random() * 1000000});
                        }
                    }
                }

                function bidClick(e){
                    var targetEl$ = $(e.target);
                    if(targetEl$.hasClass('active')){
                        $.ajax({url: '/play-bid?value=' + targetEl$.attr('data-bid-value') + '&cachebust=' + Math.random() * 1000000});
                    }
                }

                function passClick(e){
                    var targetEl$ = $(e.target);
                    if(targetEl$.hasClass('active')){
                        $.ajax({url: '/pass?cachebust=' + Math.random() * 1000000});
                    }
                }

                es.onmessage = function (event) {
                  if(event.data){
                    try {
                        gameState = JSON.parse(event.data);
                        
                        if(!gameState.started) {
                            if(gameState.phase === STATE_FINISHED){
                                alert(gameState.chairs[gameState.highestBidder].name + ' wins!');
                                $('#chairs').empty();
                                boardRendered = false;
                            }

                            $('#lobby').show();
                            $('#game').hide();

                            var playersEl$ = $('#players');
                            playersEl$.empty();

                            for(var i = position; i < gameState.chairs.length; i++){
                                renderLobbyPlayer(playersEl$, gameState.chairs[i]);
                            }

                            for(var i = 0; i < position; i++){
                                renderLobbyPlayer(playersEl$, gameState.chairs[i]);
                            }
                            
                            if(gameState.numPlayers > 2) {
                                $('#begin').show();
                                $('#not-enough-players').hide();
                            } else {
                                $('#not-enough-players').show();
                                $('#begin').hide();
                            }
                        } else {
                            var gameBoardEl$ = $('#game');
                            gameBoardEl$.show();
                            $('#lobby').hide();

                            if(!boardRendered){
                                for(var i = position; i < gameState.chairs.length; i++){
                                    renderChair(gameBoardEl$.find('#chairs'), i, gameState.chairs[i]);
                                }

                                for(var i = 0; i < position; i++){
                                    renderChair(gameBoardEl$.find('#chairs'), i, gameState.chairs[i]);
                                }
                                boardRendered = true;
                            } else {
                                for(var i = position; i < gameState.chairs.length; i++){
                                    renderChairUpdate(i, gameState.chairs[i]);
                                }

                                for(var i = 0; i < position; i++){
                                    renderChairUpdate(i, gameState.chairs[i]);
                                }
                            }

                            var waiting;

                            if(gameState.turn === position){
                                $('.active').removeClass('active');
                                if(gameState.phase === STATE_PREBIDDING){
                                    $('.chair' + position + ' .card').each(function(){
                                        if(!$(this).hasClass('played')){
                                            $(this).addClass('active');
                                        }
                                    });

                                    if(gameState.cardsPlayed >= gameState.numPlayers){
                                        for(var i = 1; i <= gameState.cardsPlayed; i++){
                                            var bid$ = $('<div class="bid active" data-bid-value="' + i + '">' + i + '</div>');
                                            bid$.click(bidClick);
                                            $('#bidding').append(bid$);
                                        }
                                    }
                                } else if(gameState.phase === STATE_BIDDING){
                                    for(var i = (gameState.highestBid + 1); i <= gameState.cardsPlayed; i++){
                                        var bid$ = $('<div class="bid active" data-bid-value="' + i + '">' + i + '</div>');
                                        bid$.click(bidClick);
                                        $('#bidding').append(bid$);
                                    }
                                    var passEl$ = $('<div class="bid active">Pass</div>');
                                    passEl$.click(passClick);
                                    $('#bidding').append(passEl$);
                                } else if(gameState.phase === STATE_FULFILLING){
                                    $('#bidding').text('');
                                    if(gameState.chairs[position].numPlayed > gameState.chairs[position].numRevealed){
                                        $('.chair' + position + ' .card:nth-child(' + (gameState.chairs[position].numCards - gameState.chairs[position].numPlayed + gameState.chairs[position].numRevealed + 1) + ')').addClass('active');
                                    } else {
                                        gameState.chairs.forEach(function(chairObj, index){
                                            if(chairObj && index !== position && chairObj.numPlayed > chairObj.numRevealed){
                                                $('.chair' + index + ' .card:nth-child(' + (chairObj.numCards - chairObj.numPlayed + chairObj.numRevealed + 1) + ')').addClass('active');
                                            }
                                        });
                                    }
                                }
                                waiting = 'Your turn';
                            } else {
                                $('#bidding').empty();
                                $('.active').removeClass('active');
                                waiting = 'Waiting on ' + gameState.chairs[gameState.turn].name + '...';
                            }           

                            if(gameState.highestBid){
                                $('#bid').text('Highest Bid: ' + gameState.chairs[gameState.highestBidder].name + ' - ' + gameState.highestBid);
                            } else {
                                $('#bid').text('');
                            }

                            gameState.chairs.forEach(function(chairObj, chairIndex){
                                if(chairObj && chairObj.numWins > 0){
                                    $('.chair' + chairIndex).addClass('win');
                                }
                            });

                            $('#phase').text((gameState.phase === STATE_PREBIDDING ? 'Playing Cards' : (gameState.phase === STATE_BIDDING ? 'Bidding' : (gameState.phase === STATE_FULFILLING ? 'Fulfilling Bid' : 'Finished'))) + '  |  ' + waiting);
                            $('#round').text('Round: ' + gameState.round + (gameState.lastTurn ? (' | ' + gameState.lastTurn) : ''));
                        }
                    } catch(e) {
                        console.log('Unable to parse game state', e);
                    }
                  }
                };
            </script>           
        </body>
    </html>`
    );
}

app.listen(3000);