pragma solidity ^0.4.17;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "./Mortal.sol";

contract RockPaperScissors is Mortal {
  using SafeMath for uint;

  uint constant ROCK = 0;
  uint constant PAPER = 1;
  uint constant SCISSORS = 2;

  uint constant public REVEAL_PERIOD = 1440;

  struct Game {
    address player1;
    address player2;
    mapping(address => bytes32) committedMoves;
    mapping(address => uint8) revealedMoves;
    uint8 winner;
    mapping(address => uint) bets;
    GameStatus status;
    uint256 joinDate;
    mapping(address => bool) hasRevealed;
  }

  // Status of a game
  enum GameStatus { Created, Joined, Revealed, Claimed, Rescinded }

  // Number of games created. Also used for sequential identifiers
  uint public totalGames;

  // Mapping game id => game info
  mapping (uint256 => Game) public games;

  uint8[3][3] public winnerLookup;

  // Modifiers
  modifier isValidMove(uint8 move) {
    require(move >= 0 && move < 3);
    _;
  }

  // Events
  event LogCreate(uint indexed gameId, uint amount, bytes32 indexed encryptedMove, address indexed sender);
  event LogJoin(uint indexed gameId, uint amount, bytes32 indexed encryptedMove, address indexed sender);
  event LogReveal(uint indexed gameId, uint8 indexed move, bytes32 secret, address indexed sender);
  event LogWinner(uint indexed gameId, uint8 indexed winner, address indexed sender);
  event LogWithdraw(uint indexed gameId, uint amount, address indexed sender);
  event LogClaim(uint indexed gameId, uint amount, address indexed sender);
  event LogRescind(uint indexed gameId, uint amount, address indexed sender);
  
  function RockPaperScissors () public {
    winnerLookup[ROCK][ROCK] = 0; // tie
    winnerLookup[PAPER][PAPER] = 0; // tie
    winnerLookup[SCISSORS][SCISSORS] = 0; // tie
    winnerLookup[PAPER][ROCK] = 1; // player 1 wins (paper beats rock)
    winnerLookup[ROCK][PAPER] = 2; // player 2 wins (paper beats rock)
    winnerLookup[SCISSORS][PAPER] = 1; // player 1 wins (scissors beats paper)
    winnerLookup[PAPER][SCISSORS] = 2; // player 2 wins (scissors beats paper)
    winnerLookup[ROCK][SCISSORS] = 1; // player 1 wins (rock beats scissors)
    winnerLookup[SCISSORS][ROCK] = 2; // player 2 wins (rock beats scissors)
  }

  function createGame(bytes32 encryptedMove) public payable {
    Game storage game = games[totalGames];
    games[totalGames] = game;
    game.player1 = msg.sender;
    game.bets[msg.sender] = msg.value;
    game.committedMoves[msg.sender] = encryptedMove;

    // Increment number of created games
    totalGames = totalGames.add(1);
    game.status = GameStatus.Created;
    
    LogCreate(totalGames, msg.value, encryptedMove, msg.sender);
  }

  function joinGame(bytes32 encryptedMove, uint gameId) public payable {
    Game storage game = games[gameId];

    // Can only join if game is in a 'Created' state
    require(game.status == GameStatus.Created);
    // ensure no one else has joined yet
    require(game.player2 == address(0));
    // ensure player 2 matches the bet  
    require(msg.value == game.bets[game.player1]);

    game.committedMoves[msg.sender] = encryptedMove;
    game.player2 = msg.sender;
    game.joinDate = block.timestamp;
    game.bets[msg.sender] = msg.value;
    game.status = GameStatus.Joined;
    
    LogJoin(gameId, msg.value, encryptedMove, msg.sender);
  }

  function reveal(uint gameId, uint8 playerMove, bytes32 secret) public isValidMove(playerMove) {
    Game storage game = games[gameId];
 
    address player1 = game.player1;
    address player2 = game.player2;

    require(msg.sender == player1 || msg.sender == player2);

    // Player 2 must have already joined before either player can choose to reveal move
    require(game.status == GameStatus.Joined);
    
    // Can only be called within reveal period
    require(block.timestamp <= game.joinDate + REVEAL_PERIOD);

    // make sure move matches intended move
    bytes32 encryptedMove = keccak256(playerMove, secret, msg.sender);
    require(game.committedMoves[msg.sender] == encryptedMove);

    game.revealedMoves[msg.sender] = playerMove;

    // Set player's status to revealed
    game.hasRevealed[msg.sender] = true;

    LogReveal(gameId, playerMove, secret, msg.sender);

    // if both players revealed set game status get winner
    if(game.hasRevealed[player1] && game.hasRevealed[player2]) {
      game.status = GameStatus.Revealed;
      game.winner = getWinner(game.revealedMoves[player1], game.revealedMoves[player2]);
      
      LogWinner(gameId, game.winner, msg.sender);
      
      uint bet;
      if (game.winner == 1) {
        // transfer player 2's bet to player 1
        bet = game.bets[player2];
        game.bets[player2] = 0;
        game.bets[player1] = game.bets[player1].add(bet);
      } else if(game.winner == 2) {
        // transfer player 1's bet to player 2
        bet = game.bets[player1];
        game.bets[player1] = 0;
        game.bets[player2] = game.bets[player2].add(bet);
      }
    }
  }

  function withdraw(uint gameId) public {
    Game storage game = games[gameId];
    
    // players can only withdraw if in revealed state
    require(game.status == GameStatus.Revealed);
    require(game.bets[msg.sender] > 0);
    
    uint winnings = game.bets[msg.sender];
    game.bets[msg.sender] = 0;

    LogWithdraw(gameId, winnings, msg.sender);
    msg.sender.transfer(winnings);
  }

  function claim(uint gameId) public {
    Game storage game = games[gameId];
   
    address player1 = game.player1;
    address player2 = game.player2;

    require(block.timestamp >= game.joinDate + REVEAL_PERIOD);
    require(game.bets[player1] > 0 && game.bets[player2] > 0);
    
    // If only one player revealed within the reveal period, award that player the bets
    if(game.hasRevealed[msg.sender] && game.status != GameStatus.Revealed) {
      // transfer player 1's bet to player 2
      uint winnings = game.bets[player1].add(game.bets[player2]);
      
      game.bets[player1] = 0;
      game.bets[player2] = 0;
      game.status = GameStatus.Claimed;  

      LogClaim(gameId, winnings, msg.sender);
      msg.sender.transfer(winnings);
    }
  }

  function rescindGame(uint gameId) public {
    Game storage game = games[gameId];
    // player one can only rescind a game if still in 'Created' state
    require(game.status == GameStatus.Created);
    
    // only player one can rescind a game
    require(game.player1 == msg.sender);

    game.status = GameStatus.Rescinded;

    uint bet = game.bets[msg.sender];
    game.bets[msg.sender] = 0;
    
    LogRescind(gameId, bet, msg.sender);
    msg.sender.transfer(bet);
  }

  function encryptMove(uint8 move, bytes32 secret) public view returns (bytes32 encryptedMove) {
    return keccak256(move, secret, msg.sender);
  }

  function getBet(uint gameId, address player) public view returns(uint) {
    Game storage game = games[gameId];
    return game.bets[player];
  }

  function getWinner(uint8 player1Move, uint8 player2Move) public view returns(uint8 winner) {
    return winnerLookup[player1Move][player2Move];
  }

  // Fallback function
  function() public {
    revert();
  }
}
