pragma solidity ^0.4.4;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "./Mortal.sol";

contract RockPaperScissors is Mortal {
  using SafeMath for uint;

  struct Game {
    address player1;
    address player2;
    bytes32 player1EncryptedMove;
    bytes32 player2EncryptedMove;
  }

  // Number of games created. Also used for sequential identifiers
  uint256 public numGames;

  // Mapping broadcaster address => broadcaster info
  mapping (uint256 => Game) public games;

  function createGame(uint encryptedMove) public payable {
    Game storage game = games[numGames];
    game.gameId = numGames;
    game.player1 = msg.sender;
    game.player1EncryptedMove = encryptedMove;
    
    // Increment number of created games
    numGames = numGames.add(1);
  }

  // Fallback function
  function() public {
    revert();
  }
}
