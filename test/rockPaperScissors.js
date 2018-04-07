const evmFunctions = require('../lib/evmFunctions')
const web3 = require('../lib/web3')
const expectThrow = require('./helpers/expectThrow')

const RockPaperScissors = artifacts.require('./RockPaperScissors.sol')
const rock = 0
const paper = 1
const scissors = 2
const secret = 'b9labs'
const bet = web3.utils.toWei('.5', 'ether')

contract('RockPaperScissors', function(accounts) {
  describe('createGame()', async function() {
    beforeEach('should deploy RockPaperScissors', async function() {
      rockPaperScissors = await RockPaperScissors.new({ from: accounts[0] })
    })
    it('Number of games should increase by one', async function() {
      let encryptedMove = await rockPaperScissors.encryptMove(rock, secret, {
        from: accounts[0]
      })
      let totalGamesBefore = await rockPaperScissors.totalGames.call()

      await rockPaperScissors.createGame(encryptedMove, {
        from: accounts[0],
        value: bet
      })

      let totalGamesAfter = await rockPaperScissors.totalGames.call()

      assert.strictEqual(
        totalGamesBefore.toString(),
        totalGamesAfter.sub(1).toString()
      )
    })
  })

  describe('joinGame()', async function() {
    beforeEach(async function() {
      rockPaperScissors = await RockPaperScissors.new({ from: accounts[0] })
      let encryptedMove = await rockPaperScissors.encryptMove(rock, secret, {
        from: accounts[0]
      })

      await rockPaperScissors.createGame(encryptedMove, {
        from: accounts[0],
        value: bet
      })
    })
    it("Should fail if player two's bet does not equal player one's bet", async function() {
      let encryptedMove = await rockPaperScissors.encryptMove(rock, secret, {
        from: accounts[1]
      })
      await expectThrow(
        rockPaperScissors.joinGame(encryptedMove, 0, {
          from: accounts[1],
          value: web3.utils.toWei('.6', 'ether')
        })
      )
    })

    it('Should allow a player to join a game', async function() {
      let encryptedMove = await rockPaperScissors.encryptMove(rock, secret, {
        from: accounts[1]
      })
      await rockPaperScissors.joinGame(encryptedMove, 0, {
        from: accounts[1],
        value: bet
      })

      let game = await rockPaperScissors.games.call(0)
      let player2Address = game[1].toString()
      assert.strictEqual(player2Address, accounts[1])
    })

    it('Should fail if a player already joined', async function() {
      let encryptedMove = await rockPaperScissors.encryptMove(rock, secret, {
        from: accounts[1]
      })
      await rockPaperScissors.joinGame(encryptedMove, 0, {
        from: accounts[1],
        value: bet
      })
      await expectThrow(
        rockPaperScissors.joinGame(encryptedMove, 0, {
          from: accounts[2],
          value: bet
        })
      )
    })
  })

  describe('reveal()', async function() {
    beforeEach(async function() {
      rockPaperScissors = await RockPaperScissors.new({ from: accounts[0] })
      let encryptedMove = await rockPaperScissors.encryptMove(rock, secret, {
        from: accounts[0]
      })

      await rockPaperScissors.createGame(encryptedMove, {
        from: accounts[0],
        value: bet
      })
    })

    it('Should fail if move is invalid', async function() {
      await rockPaperScissors.joinGame(rock, 0, {
        from: accounts[1],
        value: bet
      })
      await expectThrow(
        rockPaperScissors.reveal(0, 5, secret, {
          from: accounts[0]
        })
      )
    })

    it('Should fail if secret is invalid', async function() {
      await rockPaperScissors.joinGame(rock, 0, {
        from: accounts[1],
        value: bet
      })
      await expectThrow(
        rockPaperScissors.reveal(0, rock, 'thisisnotthesecret', {
          from: accounts[0]
        })
      )
    })

    it('Should keep bets as is in case of a tie', async function() {
      let player1BalanceBefore = await rockPaperScissors.balances(accounts[0])
      let player2BalanceBefore = await rockPaperScissors.balances(accounts[1])
      let encryptedMove = await rockPaperScissors.encryptMove(rock, secret, {
        from: accounts[1]
      })
      await rockPaperScissors.joinGame(encryptedMove, 0, {
        from: accounts[1],
        value: bet
      })
      await rockPaperScissors.reveal(0, rock, secret, {
        from: accounts[0]
      })
      await rockPaperScissors.reveal(0, rock, secret, {
        from: accounts[1]
      })

      let player1BalanceAfter = await rockPaperScissors.balances(accounts[0])
      let player2BalanceAfter = await rockPaperScissors.balances(accounts[1])

      assert.strictEqual(
        (player1BalanceAfter - player1BalanceBefore).toString(),
        bet.toString()
      )
    })

    it('Should award bets to player 1 if player 1 wins', async function() {
      let player1BalanceBefore = await rockPaperScissors.balances(accounts[0])
      let encryptedMove = await rockPaperScissors.encryptMove(
        scissors,
        secret,
        {
          from: accounts[1]
        }
      )
      await rockPaperScissors.joinGame(encryptedMove, 0, {
        from: accounts[1],
        value: bet
      })
      await rockPaperScissors.reveal(0, rock, secret, {
        from: accounts[0]
      })
      await rockPaperScissors.reveal(0, scissors, secret, {
        from: accounts[1]
      })

      let player1BalanceAfter = await rockPaperScissors.balances(accounts[0])

      assert.strictEqual(
        (player1BalanceAfter - player1BalanceBefore).toString(),
        (bet * 2).toString()
      )
    })

    it('Should award bets to player 2 if player 2 wins', async function() {
      let player2BalanceBefore = await rockPaperScissors.balances(accounts[1])
      let encryptedMove = await rockPaperScissors.encryptMove(paper, secret, {
        from: accounts[1]
      })
      await rockPaperScissors.joinGame(encryptedMove, 0, {
        from: accounts[1],
        value: bet
      })
      await rockPaperScissors.reveal(0, rock, secret, {
        from: accounts[0]
      })
      await rockPaperScissors.reveal(0, paper, secret, {
        from: accounts[1]
      })
      let player2BalanceAfter = await rockPaperScissors.balances(accounts[1])

      assert.strictEqual(
        (player2BalanceAfter - player2BalanceBefore).toString(),
        (bet * 2).toString()
      )
    })
  })

  describe('withdraw()', async function() {
    beforeEach(async function() {
      rockPaperScissors = await RockPaperScissors.new({ from: accounts[0] })
      let player1EncryptedMove = await rockPaperScissors.encryptMove(
        rock,
        secret,
        {
          from: accounts[0]
        }
      )

      let player2EncryptedMove = await rockPaperScissors.encryptMove(
        scissors,
        secret,
        {
          from: accounts[1]
        }
      )

      await rockPaperScissors.createGame(player1EncryptedMove, {
        from: accounts[0],
        value: bet
      })

      await rockPaperScissors.joinGame(player2EncryptedMove, 0, {
        from: accounts[1],
        value: bet
      })

      await rockPaperScissors.reveal(0, rock, secret, {
        from: accounts[0]
      })

      await rockPaperScissors.reveal(0, scissors, secret, {
        from: accounts[1]
      })
    })

    it('Should transfer winnings', async function() {
      let player1BalanceBeforeWithdrawal = await web3.eth.getBalance(
        accounts[0]
      )
      let gasPrice = await web3.eth.getGasPrice()
      let tx = await rockPaperScissors.withdraw({
        from: accounts[0],
        gas: '1500000',
        gasPrice
      })

      let gasCost = web3.utils
        .toBN(gasPrice)
        .mul(web3.utils.toBN(tx.receipt.gasUsed))
      let player1BalanceAfterWithdrawal = await web3.eth.getBalance(accounts[0])

      assert.strictEqual(
        web3.utils
          .toBN(player1BalanceBeforeWithdrawal)
          .add(web3.utils.toBN(bet * 2))
          .toString(),
        web3.utils
          .toBN(player1BalanceAfterWithdrawal)
          .add(gasCost)
          .toString()
      )
    })
  })

  describe('claim()', async function() {
    beforeEach(async function() {
      rockPaperScissors = await RockPaperScissors.new({ from: accounts[0] })
      let player1EncryptedMove = await rockPaperScissors.encryptMove(
        rock,
        secret,
        {
          from: accounts[0]
        }
      )

      await rockPaperScissors.createGame(player1EncryptedMove, {
        from: accounts[0],
        value: bet
      })

      let player2EncryptedMove = await rockPaperScissors.encryptMove(
        paper,
        secret,
        {
          from: accounts[1]
        }
      )

      await rockPaperScissors.joinGame(player2EncryptedMove, 0, {
        from: accounts[1],
        value: bet
      })
    })

    it("Should transfer entire deposit to player who revealed from a player who didn't reveal within reveal period", async function() {
      await rockPaperScissors.reveal(0, paper, secret, {
        from: accounts[1]
      })

      let player2BalanceBeforeClaim = await rockPaperScissors.balances(
        accounts[1]
      )

      // increase time 24 hours
      await evmFunctions.evmIncreaseTime(86401)

      await rockPaperScissors.claim(0, accounts[1])

      let player2BalanceAfterClaim = await rockPaperScissors.balances(
        accounts[1]
      )

      assert.strictEqual(
        (player2BalanceAfterClaim - player2BalanceBeforeClaim).toString(),
        (bet * 2).toString()
      )
    })
  })

  describe('rescindGame()', async function() {
    beforeEach(async function() {
      rockPaperScissors = await RockPaperScissors.new({ from: accounts[0] })
      let encryptedMove = await rockPaperScissors.encryptMove(rock, secret, {
        from: accounts[0]
      })

      await rockPaperScissors.createGame(encryptedMove, {
        from: accounts[0],
        value: bet
      })
    })

    it('Should transfer bet back to player 1', async function() {
      let player1BalanceBeforeWithdrawal = await web3.eth.getBalance(
        accounts[0]
      )
      let gasPrice = await web3.eth.getGasPrice()
      let tx = await rockPaperScissors.rescindGame(0, {
        from: accounts[0],
        gas: '1500000',
        gasPrice
      })

      let gasCost = web3.utils
        .toBN(gasPrice)
        .mul(web3.utils.toBN(tx.receipt.gasUsed))
      let player1BalanceAfterWithdrawal = await web3.eth.getBalance(accounts[0])

      assert.strictEqual(
        web3.utils
          .toBN(player1BalanceBeforeWithdrawal)
          .add(web3.utils.toBN(bet))
          .toString(),
        web3.utils
          .toBN(player1BalanceAfterWithdrawal)
          .add(gasCost)
          .toString()
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
