const web3 = require('../lib/web3')
const RockPaperScissors = artifacts.require('./RockPaperScissors.sol')
const addEvmFunctions = require('../lib/evmFunctions.js')

const rock = 0
const paper = 1
const scissors = 2
const secret = 'b9labs'
let deposit = web3.utils.toWei('1', 'ether')

contract('RockPaperScissors', function(accounts) {
  beforeEach('should deploy RockPaperScissors', async function() {
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
