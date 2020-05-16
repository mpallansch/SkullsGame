var es = new EventSource( '/game-events' );
var boardRendered = false;
var gameState;

var STATE_PREBIDDING = 0;
var STATE_BIDDING = 1;
var STATE_FULFILLING = 2;
var STATE_FINISHED = 3;

$( '#begin' ).click( function() {
	$.ajax( { url: '/start?cachebust=' + Math.random() * 1000000 } );
} );

function renderLobbyPlayer( playersEl$, chairObj ) {
	playersEl$.append( '<div class="' + ( chairObj ? '' : 'empty' ) + '">' + ( chairObj ? chairObj.name : 'Empty' ) + '</div>' )
}

function renderChairUpdate( chairIndex, chairObj ) {
	if ( chairObj ) {
		var cardsEl$ = $( '.chair' + chairIndex + ' .card' );
		if ( cardsEl$.length > chairObj.numCards ) {
			cardsEl$.slice( chairObj.numCards ).remove();
		}
		$( '.chair' + chairIndex + ' .card.skull' ).removeClass( 'skull' );
		for ( var i = 0; i < ( chairObj.numCards - chairObj.numPlayed ); i++ ) {
			$( '.chair' + chairIndex + ' .card:nth-child(' + ( i + 1 ) + ')' ).removeClass( 'played' );
			if ( chairIndex === position ) {
				$( '.chair' + chairIndex + ' .card:nth-child(' + ( i + 1 ) + ')' ).addClass( 'up' );
			} else {
				$( '.chair' + chairIndex + ' .card:nth-child(' + ( i + 1 ) + ')' ).removeClass( 'up' );
			}
		}
		for ( var i = ( chairObj.numCards - chairObj.numPlayed ); i < ( chairObj.numCards - chairObj.numPlayed + chairObj.numRevealed ); i++ ) {
			$( '.chair' + chairIndex + ' .card:nth-child(' + ( i + 1 ) + ')' ).addClass( 'played' ).addClass( 'up' );
			if ( ( chairObj.numCards - 1 - i ) === chairObj.skullIndex ) {
				$( '.chair' + chairIndex + ' .card:nth-child(' + ( i + 1 ) + ')' ).addClass( 'skull' );
			}
		}
		for ( var i = ( chairObj.numCards - chairObj.numPlayed + chairObj.numRevealed ); i < chairObj.numCards; i++ ) {
			$( '.chair' + chairIndex + ' .card:nth-child(' + ( i + 1 ) + ')' ).addClass( 'played' ).removeClass( 'up' );
		}
		if ( chairIndex === position ) {
			if ( chairObj.skullIndex !== -1 || !chairObj.hasSkull ) {
				var chairEl$ = $( '.chair' + chairIndex + ' .card.skull' );
			} else {
				$( '.chair' + chairIndex + ' .card:nth-child(1)' ).addClass( 'skull' );
			}
		}
		if ( chairObj.defeated ) {
			$( '.chair' + chairIndex + ' .player-name' ).addClass( 'defeated' );
		}
	}
}

function renderChair( gameBoardEl$, chairIndex, chairObj ) {
	var chairEl$ = $( '<div class="chair chair' + chairIndex + '" data-chair-index="' + chairIndex + '"></div>' );

	if ( chairObj ) {
		for ( var i = 0; i < ( chairObj.numCards - chairObj.numPlayed ); i++ ) {
			var cardEl$ = $( '<div class="card" data-card-index="' + i + '"><div class="front"></div><div class="back"></div></div>' );

			if ( position === chairIndex ) {
				cardEl$.addClass( 'up' );
			}

			if ( i === 0 && chairObj.hasSkull ) {
				cardEl$.addClass( 'skull' );
			}

			cardEl$.click( cardClick );
			chairEl$.append( cardEl$ );
		}

		for ( var i = ( chairObj.numCards - chairObj.numPlayed ); i < chairObj.numCards; i++ ) {
			var cardEl$ = $( '<div class="card played" data-card-index="' + i + '"><div class="front"></div><div class="back"></div></div>' );

			if ( position === chairIndex ) {
				cardEl$.addClass( 'up' );
			}

			cardEl$.click( cardClick );
			chairEl$.append( cardEl$ );

		}
		chairEl$.append( '<p class="player-name">' + chairObj.name + '</p>' );
	} else {
		chairEl$.text( 'Empty' );
	}

	gameBoardEl$.append( chairEl$ );
}

function cardClick( e ) {
	var targetEl$ = $( e.target );
	if ( !targetEl$.hasClass( 'card' ) ) {
		targetEl$ = targetEl$.parent();
	}
	if ( targetEl$.hasClass( 'active' ) ) {
		if ( gameState.phase === STATE_PREBIDDING ) {
			if ( !targetEl$.hasClass( 'played' ) ) {
				$.ajax( { url: '/play-card?skull=' + targetEl$.hasClass( 'skull' ) + '&cachebust=' + Math.random() * 1000000 } );
			}
		} else {
			var chairIndex = parseInt( targetEl$.parent().attr( 'data-chair-index' ) );
			$.ajax( { url: '/reveal-card?chair=' + chairIndex + '&cachebust=' + Math.random() * 1000000 } );
		}
	}
}

function bidClick( e ) {
	var targetEl$ = $( e.target );
	if ( targetEl$.hasClass( 'active' ) ) {
		$.ajax( { url: '/play-bid?value=' + targetEl$.attr( 'data-bid-value' ) + '&cachebust=' + Math.random() * 1000000 } );
	}
}

function passClick( e ) {
	var targetEl$ = $( e.target );
	if ( targetEl$.hasClass( 'active' ) ) {
		$.ajax( { url: '/pass?cachebust=' + Math.random() * 1000000 } );
	}
}

es.onmessage = function( event ) {
	if ( event.data ) {
		try {
			gameState = JSON.parse( event.data );

			if ( !gameState.started ) {
				if ( gameState.phase === STATE_FINISHED ) {
					alert( gameState.chairs[ gameState.highestBidder ].name + ' wins!' );
					$( '#chairs' ).empty();
					boardRendered = false;
				}

				$( '#lobby' ).show();
				$( '#game' ).hide();

				var playersEl$ = $( '#players' );
				playersEl$.empty();

				for ( var i = position; i < gameState.chairs.length; i++ ) {
					renderLobbyPlayer( playersEl$, gameState.chairs[ i ] );
				}

				for ( var i = 0; i < position; i++ ) {
					renderLobbyPlayer( playersEl$, gameState.chairs[ i ] );
				}

				if ( gameState.numPlayers > 2 ) {
					$( '#begin' ).show();
					$( '#not-enough-players' ).hide();
				} else {
					$( '#not-enough-players' ).show();
					$( '#begin' ).hide();
				}
			} else {
				var gameBoardEl$ = $( '#game' );
				gameBoardEl$.show();
				$( '#lobby' ).hide();

				if ( !boardRendered ) {
					for ( var i = position; i < gameState.chairs.length; i++ ) {
						renderChair( gameBoardEl$.find( '#chairs' ), i, gameState.chairs[ i ] );
					}

					for ( var i = 0; i < position; i++ ) {
						renderChair( gameBoardEl$.find( '#chairs' ), i, gameState.chairs[ i ] );
					}
					boardRendered = true;
				} else {
					for ( var i = position; i < gameState.chairs.length; i++ ) {
						renderChairUpdate( i, gameState.chairs[ i ] );
					}

					for ( var i = 0; i < position; i++ ) {
						renderChairUpdate( i, gameState.chairs[ i ] );
					}
				}

				var waiting;

				if ( gameState.turn === position ) {
					$( '.active' ).removeClass( 'active' );
					if ( gameState.phase === STATE_PREBIDDING ) {
						$( '.chair' + position + ' .card' ).each( function() {
							if ( !$( this ).hasClass( 'played' ) ) {
								$( this ).addClass( 'active' );
							}
						} );

						if ( gameState.cardsPlayed >= gameState.numPlayers ) {
							for ( var i = 1; i <= gameState.cardsPlayed; i++ ) {
								var bid$ = $( '<div class="bid active" data-bid-value="' + i + '">' + i + '</div>' );
								bid$.click( bidClick );
								$( '#bidding' ).append( bid$ );
							}
						}
					} else if ( gameState.phase === STATE_BIDDING ) {
						for ( var i = ( gameState.highestBid + 1 ); i <= gameState.cardsPlayed; i++ ) {
							var bid$ = $( '<div class="bid active" data-bid-value="' + i + '">' + i + '</div>' );
							bid$.click( bidClick );
							$( '#bidding' ).append( bid$ );
						}
						var passEl$ = $( '<div class="bid active">Pass</div>' );
						passEl$.click( passClick );
						$( '#bidding' ).append( passEl$ );
					} else if ( gameState.phase === STATE_FULFILLING ) {
						$( '#bidding' ).text( '' );
						if ( gameState.chairs[ position ].numPlayed > gameState.chairs[ position ].numRevealed ) {
							$( '.chair' + position + ' .card:nth-child(' + ( gameState.chairs[ position ].numCards - gameState.chairs[ position ].numPlayed + gameState.chairs[ position ].numRevealed + 1 ) + ')' ).addClass( 'active' );
						} else {
							gameState.chairs.forEach( function( chairObj, index ) {
								if ( chairObj && index !== position && chairObj.numPlayed > chairObj.numRevealed ) {
									$( '.chair' + index + ' .card:nth-child(' + ( chairObj.numCards - chairObj.numPlayed + chairObj.numRevealed + 1 ) + ')' ).addClass( 'active' );
								}
							} );
						}
					}
					waiting = 'Your turn';
				} else {
					$( '#bidding' ).empty();
					$( '.active' ).removeClass( 'active' );
					waiting = 'Waiting on ' + gameState.chairs[ gameState.turn ].name + '...';
				}

				if ( gameState.highestBid ) {
					$( '#bid' ).text( 'Highest Bid: ' + gameState.chairs[ gameState.highestBidder ].name + ' - ' + gameState.highestBid );
				} else {
					$( '#bid' ).text( '' );
				}

				gameState.chairs.forEach( function( chairObj, chairIndex ) {
					if ( chairObj && chairObj.numWins > 0 ) {
						$( '.chair' + chairIndex ).addClass( 'win' );
					}
				} );

				$( '#phase' ).text( ( gameState.phase === STATE_PREBIDDING ? 'Playing Cards' : ( gameState.phase === STATE_BIDDING ? 'Bidding' : ( gameState.phase === STATE_FULFILLING ? 'Fulfilling Bid' : 'Finished' ) ) ) + '  |  ' + waiting );
				$( '#round' ).text( 'Round: ' + gameState.round + ( gameState.lastTurn ? ( ' | ' + gameState.lastTurn ) : '' ) );
			}
		} catch ( e ) {
			console.log( 'Unable to parse game state', e );
		}
	}
};
