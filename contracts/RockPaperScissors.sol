pragma solidity ^0.4.17;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "./Mortal.sol";

contract RockPaperScissors is Mortal {
  using SafeMath for uint;

  byte constant ROCK = "R";
  byte constant PAPER = "P";
  byte constant SCISSORS = "S";

  uint constant public REVEAL_PERIOD = 1 days;
  uint constant public JOIN_PERIOD = 1 days;

  mapping(address => uint) public balances;
  mapping(bytes32 => address) public disclosedEncryptedMoves;

  struct Game {
    address player1;
    address player2;
    mapping(address => byte) disclosedMoves;
    uint8 winner;
    uint deposit;
    GameStatus status;
    uint256 deadline;
  }

  // Status of a game
  enum GameStatus { Created, Joined, Revealed, Claimed, Rescinded }

  // Number of games created. Also used for sequential identifiers
  uint public totalGames;

  // Mapping game id => game info
  mapping (uint256 => Game) public games;

  // winner lookup mapping
  mapping (byte => mapping(byte => uint8)) public winnerLookup;

  // Modifiers
  modifier isValidMove(byte move) {
    require(move == ROCK || move == PAPER || move == SCISSORS);
    _;
  }

  // Events
  event LogCreate(uint indexed gameId, uint amount, bytes32 indexed encryptedMove, address indexed sender);
  event LogJoin(uint indexed gameId, uint amount, bytes32 indexed encryptedMove, address indexed sender);
  event LogReveal(uint indexed gameId, byte indexed move, bytes32 secret, address indexed sender);
  event LogWinner(uint indexed gameId, uint8 indexed winner, address indexed sender);
  event LogWithdraw(uint amount, address indexed sender);
  event LogClaim(uint indexed gameId, uint amount, address indexed player, address indexed sender);
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
    // Protect user from using a previously disclosed encrypted move
    require(disclosedEncryptedMoves[encryptedMove] != msg.sender);

    Game storage game = games[totalGames];
    games[totalGames] = game;
    game.player1 = msg.sender;
    game.deposit = msg.value;
    game.deadline = block.timestamp.add(JOIN_PERIOD);
    
    disclosedEncryptedMoves[encryptedMove] = msg.sender;
    
    // Increment number of created games
    totalGames = totalGames.add(1);
    game.status = GameStatus.Created;
    
    LogCreate(totalGames, msg.value, encryptedMove, msg.sender);
  }

  function joinGame(bytes32 encryptedMove, uint gameId) public payable {
    Game storage game = games[gameId];

    // Can only join within 24 hours of game being created to reduce chance of cracking player1's hash
    require(block.timestamp <= game.deadline);

    // Can only join if game is in a 'Created' state
    require(game.status == GameStatus.Created);

    // ensure player 2 matches the deposit  
    require(msg.value == game.deposit);

    // Protect player from using a previously disclosed encrypted move
    require(disclosedEncryptedMoves[encryptedMove] != msg.sender);

    disclosedEncryptedMoves[encryptedMove] = msg.sender;

    game.player2 = msg.sender;
    game.deadline = block.timestamp.add(REVEAL_PERIOD);
    game.status = GameStatus.Joined;
    
    LogJoin(gameId, msg.value, encryptedMove, msg.sender);
  }

  function reveal(uint gameId, byte playerMove, bytes32 secret) public isValidMove(playerMove) {
    Game storage game = games[gameId];

    // Player 2 must have already joined before either player can choose to reveal move
    require(game.status == GameStatus.Joined);
    
    // Can only be called within reveal period
    require(block.timestamp <= game.deadline);

    // make sure move matches intended move
    bytes32 encryptedMove = encryptMove(playerMove, secret);
    require(disclosedEncryptedMoves[encryptedMove] == msg.sender);

    address player1 = game.player1;
    address player2 = game.player2;
    
    game.disclosedMoves[msg.sender] = playerMove;

    LogReveal(gameId, playerMove, secret, msg.sender);

    // if both players revealed then get winner, update game status, and award deposit
    if(game.disclosedMoves[player1] != 0 && game.disclosedMoves[player2] != 0) {
      game.status = GameStatus.Revealed;
      game.winner = winnerLookup[game.disclosedMoves[player1]][game.disclosedMoves[player2]];
      
      LogWinner(gameId, game.winner, msg.sender);
      
      uint deposit = game.deposit;
      game.deposit = 0;
      if (game.winner == 1) {
        // transfer deposit to player 1
        balances[player1] = balances[player1].add(deposit.mul(2));
      } else if(game.winner == 2) {
        // transfer deposit to player 2
        balances[player2] = balances[player2].add(deposit.mul(2));
      } else {
        // split deposit between both players in case of tie
        balances[player1] = balances[player1].add(deposit);
        balances[player2] = balances[player2].add(deposit);
      }
      // clear the game so that it takes 0 space in the current state trie.
      delete games[gameId];
    }
  }

  function withdraw() public {
    require(balances[msg.sender] > 0);
    
    uint winnings = balances[msg.sender];
    balances[msg.sender] = 0;

    LogWithdraw(winnings, msg.sender);
    msg.sender.transfer(winnings);
  }

  function claim(uint gameId, address player) public {
    Game storage game = games[gameId];
    
    require(block.timestamp > game.deadline);
    require(game.deposit > 0);

    if(game.disclosedMoves[player] != 0 && game.status != GameStatus.Revealed) {
      // transfer deposit to player that revealed within period
      uint deposit = game.deposit.mul(2);
      game.deposit = 0;
      game.status = GameStatus.Claimed;  
      
      // clear the game so that it takes 0 space in the current state trie.
      delete games[gameId];

      LogClaim(gameId, deposit, player, msg.sender);
      balances[player] = deposit;
    }
  }

  function rescindGame(uint gameId) public {
    Game storage game = games[gameId];
    // player one can only rescind a game if still in 'Created' state
    require(game.status == GameStatus.Created);
    
    // only player one can rescind a game
    require(game.player1 == msg.sender);

    game.status = GameStatus.Rescinded;

    uint deposit = game.deposit;
    game.deposit = 0;
    
    // clear the game so that it takes 0 space in the current state trie.
    delete games[gameId];
    
    LogRescind(gameId, deposit, msg.sender);
    msg.sender.transfer(deposit);
  }

  function encryptMove(byte move, bytes32 secret) public view returns (bytes32 encryptedMove) {
    return keccak256(move, secret, msg.sender, this);
  }

  // Fallback function
  function() public {
    revert();
  }
}
