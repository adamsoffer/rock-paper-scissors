pragma solidity ^0.4.17;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "./Mortal.sol";

contract RockPaperScissors is Mortal {
  using SafeMath for uint;

  struct Game {
    address player1;
    address player2;
    bytes32 player1EncryptedMove;
    uint8 player2Move;
    uint deposit;
    uint8 winner;
    mapping(address => uint) balances;
  }

  // Number of games created. Also used for sequential identifiers
  uint public totalGames;

  // Mapping game id => game info
  mapping (uint256 => Game) public games;

  uint8[3][3] winnerLookup;

  modifier isValidMove(uint move) {
    require(move >= 0 && move < 3);
    _;
  }
  
  // uint rock = 0;
  // uint paper = 1;
  // uint scissors = 2;
  function RockPaperScissors () public {
    winnerLookup[0][0] = 0; // tie
    winnerLookup[1][1] = 0; // tie
    winnerLookup[2][2] = 0; // tie
    winnerLookup[1][0] = 1; // player 1 wins (paper beats rock)
    winnerLookup[0][1] = 2; // player 2 wins (paper beats rock)
    winnerLookup[2][1] = 1; // player 1 wins (scissors beats paper)
    winnerLookup[1][2] = 2; // player 2 wins (scissors beats paper)
    winnerLookup[0][2] = 1; // player 1 wins (rock beats scissors)
    winnerLookup[2][0] = 2; // player 2 wins (rock beats scissors)
  }

  function createGame(bytes32 encryptedMove) public payable {
    Game storage game = games[totalGames];
    games[totalGames] = game;
    game.player1 = msg.sender;
    game.deposit = msg.value;
    game.player1EncryptedMove = encryptedMove;

    // Increment number of created games
    totalGames = totalGames.add(1);
  }

  function encryptMove(uint move, bytes32 secret) public pure returns (bytes32 encryptedMove) {
    return keccak256(move, secret);
  }

  function joinGame(uint8 player2Move, uint gameId) public payable {
    Game storage game = games[gameId];

    // ensure no one else has joined yet
    require(game.player2 == address(0));

    // ensure player 2 matches the bet  
    require(msg.value == game.deposit);

    game.player2Move = player2Move;
    game.player2 = msg.sender;
    game.deposit.add(msg.value);
  }

  function reveal(uint gameId, uint8 player1Move, bytes32 secret) public isValidMove(player1Move) {
    Game storage game = games[gameId];
    // make sure it's a valid move
    bytes32 player1EncryptedMove = keccak256(player1Move, secret);
    require(game.player1EncryptedMove == player1EncryptedMove);
    uint deposit = game.deposit;
    game.deposit = 0;
    game.winner = getWinner(player1Move, game.player2Move);
    
    if (game.winner == 0) {
      game.balances[game.player1] = deposit.div(2);
      game.balances[game.player2] = deposit.sub(game.balances[game.player1]);
    } else if (game.winner == 1) {
      game.balances[game.player1] = deposit;
    } else {
      game.balances[game.player2] = deposit;
    }
  }

  function withdraw(uint gameId) public {
    Game storage game = games[gameId];
    require(game.balances[msg.sender] > 0);
    uint balance = game.balances[msg.sender];
    game.balances[msg.sender] = 0;
    msg.sender.transfer(balance);
  }

  function getWinner(uint8 player1Move, uint8 player2Move) public view returns(uint8 winner) {
    return winnerLookup[player1Move][player2Move];
  }

  // Fallback function
  function() public {
    revert();
  }
}
