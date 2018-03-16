const web3 = require('../lib/web3')
const addEvmFunctions = require('../lib/evmFunctions.js')
const expectThrow = require('./helpers/expectThrow')

const RockPaperScissors = artifacts.require('./RockPaperScissors.sol')
const rock = 0
const paper = 1
const scissors = 2
const secret = 'b9labs'
let deposit = web3.utils.toWei('1', 'ether')

contract('RockPaperScissors', function(accounts) {
  before('should deploy RockPaperScissors', async function() {
    rockPaperScissors = await RockPaperScissors.new({ from: accounts[0] })
  })

  describe('createGame()', async function() {
    it('Number of games should increase by one', async function() {
      let encryptedMove = await rockPaperScissors.encryptMove(rock, secret)
      let totalGamesBefore = await rockPaperScissors.totalGames.call()

      await rockPaperScissors.createGame(encryptedMove, {
        from: accounts[0],
        value: deposit
      })

      let totalGamesAfter = await rockPaperScissors.totalGames.call()

      assert.strictEqual(
        totalGamesBefore.toString(),
        totalGamesAfter.sub(1).toString()
      )
    })
  })

  describe('joinGame()', async function() {
    it("Should fail if player two's deposit does not equal player one's deposit", async function() {
      await expectThrow(
        rockPaperScissors.joinGame(rock, 0, {
          from: accounts[1],
          value: web3.utils.toWei('.5', 'ether')
        })
      )
    })

    it('Should fail if move is not valid', async function() {
      await expectThrow(
        rockPaperScissors.joinGame(5, 0, {
          from: accounts[1],
          value: deposit
        })
      )
    })

    it('Should allow a player to join a game', async function() {
      rockPaperScissors.joinGame(paper, 0, {
        from: accounts[1],
        value: deposit
      })

      let game = await rockPaperScissors.games.call(0)
      let player2Address = game[1].toString()
      assert.strictEqual(player2Address, accounts[1])
    })

    it('Should increase the deposit by 2x', async function() {
      let lastCreatedGame = await rockPaperScissors.totalGames.call()
      let game = await rockPaperScissors.games.call(
        lastCreatedGame.sub(1).toString()
      )
      let updatedDeposit = game[4].toString()
      assert.strictEqual((deposit * 2).toString(), updatedDeposit.toString())
    })

    it('Should fail if a player already joined', async function() {
      await expectThrow(
        rockPaperScissors.joinGame(paper, 0, {
          from: accounts[2],
          value: deposit
        })
      )
    })
  })

  describe('reveal()', async function() {
    it('Should fail if move is invalid', async function() {
      await expectThrow(
        rockPaperScissors.reveal(0, 5, secret, {
          from: accounts[0]
        })
      )
    })

    it('Should fail if secret is invalid', async function() {
      await expectThrow(
        rockPaperScissors.reveal(0, rock, 'thisisnotthesecret', {
          from: accounts[0]
        })
      )
    })

    it('Should divide winnings evenly in case of a tie', async function() {})
  })

  describe('getWinner()', async function() {
    it('Should declare a tie (rock vs rock)', async function() {
      const player1Move = rock
      const player2Move = rock
      let winner = await rockPaperScissors.getWinner(player1Move, player2Move)
      assert.strictEqual(winner.toString(), '0')
    })
    it('Should declare a tie (paper vs paper)', async function() {
      const player1Move = paper
      const player2Move = paper
      let winner = await rockPaperScissors.getWinner(player1Move, player2Move)
      assert.strictEqual(winner.toString(), '0')
    })
    it('Should declare a tie (scissors vs scissors)', async function() {
      const player1Move = scissors
      const player2Move = scissors
      let winner = await rockPaperScissors.getWinner(player1Move, player2Move)
      assert.strictEqual(winner.toString(), '0')
    })
    it('Should declare player 1 the winner (rock vs scissors)', async function() {
      const player1Move = rock
      const player2Move = scissors
      let winner = await rockPaperScissors.getWinner(player1Move, player2Move)
      assert.strictEqual(winner.toString(), '1')
    })
    it('Should declare player 1 the winner (paper vs rock)', async function() {
      const player1Move = paper
      const player2Move = rock
      let winner = await rockPaperScissors.getWinner(player1Move, player2Move)
      assert.strictEqual(winner.toString(), '1')
    })
    it('Should declare player 1 the winner (scissors vs paper)', async function() {
      const player1Move = scissors
      const player2Move = paper
      let winner = await rockPaperScissors.getWinner(player1Move, player2Move)
      assert.strictEqual(winner.toString(), '1')
    })
    it('Should declare player 2 the winner (rock vs paper)', async function() {
      const player1Move = rock
      const player2Move = paper
      let winner = await rockPaperScissors.getWinner(player1Move, player2Move)
      assert.strictEqual(winner.toString(), '2')
    })
    it('Should declare player 2 the winner (paper vs scissors)', async function() {
      const player1Move = paper
      const player2Move = scissors
      let winner = await rockPaperScissors.getWinner(player1Move, player2Move)
      assert.strictEqual(winner.toString(), '2')
    })
    it('Should declare player 2 the winner (scissors vs rock)', async function() {
      const player1Move = scissors
      const player2Move = rock
      let winner = await rockPaperScissors.getWinner(player1Move, player2Move)
      assert.strictEqual(winner.toString(), '2')
    })
  })
})
