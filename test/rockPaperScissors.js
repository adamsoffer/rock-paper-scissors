const evmFunctions = require('../lib/evmFunctions')
const web3 = require('../lib/web3')
const expectThrow = require('./helpers/expectThrow')

const RockPaperScissors = artifacts.require('./RockPaperScissors.sol')
const rock = 0
const paper = 1
const scissors = 2
const secret = 'b9labs'
const deposit = web3.utils.toWei('.5', 'ether')

contract('RockPaperScissors', function(accounts) {
  describe('createGame()', async function() {
    beforeEach('should deploy RockPaperScissors', async function() {
      rockPaperScissors = await RockPaperScissors.new({ from: accounts[0] })
    })
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
    beforeEach(async function() {
      rockPaperScissors = await RockPaperScissors.new({ from: accounts[0] })
      let encryptedMove = await rockPaperScissors.encryptMove(rock, secret)

      await rockPaperScissors.createGame(encryptedMove, {
        from: accounts[0],
        value: deposit
      })
    })
    it("Should fail if player two's deposit does not equal player one's deposit", async function() {
      await expectThrow(
        rockPaperScissors.joinGame(rock, 0, {
          from: accounts[1],
          value: web3.utils.toWei('.6', 'ether')
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
      await rockPaperScissors.joinGame(paper, 0, {
        from: accounts[1],
        value: deposit
      })

      let game = await rockPaperScissors.games.call(0)
      let player2Address = game[1].toString()
      assert.strictEqual(player2Address, accounts[1])
    })

    it('Should increase the deposit by 2x', async function() {
      await rockPaperScissors.joinGame(paper, 0, {
        from: accounts[1],
        value: deposit
      })
      let game = await rockPaperScissors.games.call(0)
      let updatedDeposit = game[4].toString()
      assert.strictEqual((deposit * 2).toString(), updatedDeposit.toString())
    })

    it('Should fail if a player already joined', async function() {
      await rockPaperScissors.joinGame(paper, 0, {
        from: accounts[1],
        value: deposit
      })
      await expectThrow(
        rockPaperScissors.joinGame(paper, 0, {
          from: accounts[2],
          value: deposit
        })
      )
    })
  })

  describe('reveal()', async function() {
    beforeEach(async function() {
      rockPaperScissors = await RockPaperScissors.new({ from: accounts[0] })
      let encryptedMove = await rockPaperScissors.encryptMove(rock, secret)

      await rockPaperScissors.createGame(encryptedMove, {
        from: accounts[0],
        value: deposit
      })
    })

    it('Should fail if move is invalid', async function() {
      await rockPaperScissors.joinGame(rock, 0, {
        from: accounts[1],
        value: deposit
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
        value: deposit
      })
      await expectThrow(
        rockPaperScissors.reveal(0, rock, 'thisisnotthesecret', {
          from: accounts[0]
        })
      )
    })

    it('Should divide winnings evenly in case of a tie', async function() {
      await rockPaperScissors.joinGame(rock, 0, {
        from: accounts[1],
        value: deposit
      })
      await rockPaperScissors.reveal(0, rock, secret, {
        from: accounts[0]
      })
      let player1Balance = await rockPaperScissors.getBalance.call(
        0,
        accounts[0]
      )
      let player2Balance = await rockPaperScissors.getBalance.call(
        0,
        accounts[1]
      )
      assert.strictEqual(player1Balance.toString(), player2Balance.toString())
    })

    it('Should award deposit to player 1 if player 1 wins', async function() {
      await rockPaperScissors.joinGame(scissors, 0, {
        from: accounts[1],
        value: deposit
      })
      await rockPaperScissors.reveal(0, rock, secret, {
        from: accounts[0]
      })
      let player1Balance = await rockPaperScissors.getBalance.call(
        0,
        accounts[0]
      )
      assert.strictEqual(player1Balance.toString(), (deposit * 2).toString())
    })

    it('Should award deposit to player 2 if player 2 wins', async function() {
      await rockPaperScissors.joinGame(paper, 0, {
        from: accounts[1],
        value: deposit
      })
      await rockPaperScissors.reveal(0, rock, secret, {
        from: accounts[0]
      })
      let player2Balance = await rockPaperScissors.getBalance.call(
        0,
        accounts[1]
      )
      assert.strictEqual(player2Balance.toString(), (deposit * 2).toString())
    })
  })

  describe('withdraw()', async function() {
    beforeEach(async function() {
      rockPaperScissors = await RockPaperScissors.new({ from: accounts[0] })
      let encryptedMove = await rockPaperScissors.encryptMove(rock, secret)

      await rockPaperScissors.createGame(encryptedMove, {
        from: accounts[0],
        value: deposit
      })
    })

    it("Should transfer player 1's original deposit back in case of a tie", async function() {
      await rockPaperScissors.joinGame(rock, 0, {
        from: accounts[1],
        value: deposit
      })
      await rockPaperScissors.reveal(0, rock, secret, {
        from: accounts[0]
      })

      let player1BalanceBeforeWithdrawal = await web3.eth.getBalance(
        accounts[0]
      )

      let gasPrice = await web3.eth.getGasPrice()

      let tx = await rockPaperScissors.withdraw(0, {
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
          .add(web3.utils.toBN(deposit))
          .toString(),
        web3.utils
          .toBN(player1BalanceAfterWithdrawal)
          .add(gasCost)
          .toString()
      )
    })

    it("Should transfer player 2's original deposit back in case of a tie", async function() {
      await rockPaperScissors.joinGame(rock, 0, {
        from: accounts[1],
        value: deposit
      })
      await rockPaperScissors.reveal(0, rock, secret, {
        from: accounts[0]
      })

      let player2BalanceBeforeWithdrawal = await web3.eth.getBalance(
        accounts[1]
      )

      let gasPrice = await web3.eth.getGasPrice()

      let tx = await rockPaperScissors.withdraw(0, {
        from: accounts[1],
        gas: '1500000',
        gasPrice
      })

      let gasCost = web3.utils
        .toBN(gasPrice)
        .mul(web3.utils.toBN(tx.receipt.gasUsed))

      let player2BalanceAfterWithdrawal = await web3.eth.getBalance(accounts[1])

      assert.strictEqual(
        web3.utils
          .toBN(player2BalanceBeforeWithdrawal)
          .add(web3.utils.toBN(deposit))
          .toString(),
        web3.utils
          .toBN(player2BalanceAfterWithdrawal)
          .add(gasCost)
          .toString()
      )
    })

    it('Should transfer entire deposit to player 1 if player 1 wins', async function() {
      await rockPaperScissors.joinGame(scissors, 0, {
        from: accounts[1],
        value: deposit
      })
      await rockPaperScissors.reveal(0, rock, secret, {
        from: accounts[0]
      })
      let player1BalanceBeforeWithdrawal = await web3.eth.getBalance(
        accounts[0]
      )
      let gasPrice = await web3.eth.getGasPrice()
      let tx = await rockPaperScissors.withdraw(0, {
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
          .add(web3.utils.toBN(deposit * 2))
          .toString(),
        web3.utils
          .toBN(player1BalanceAfterWithdrawal)
          .add(gasCost)
          .toString()
      )
    })

    it('Should transfer entire deposit to player 2 if player 2 wins', async function() {
      await rockPaperScissors.joinGame(paper, 0, {
        from: accounts[1],
        value: deposit
      })
      await rockPaperScissors.reveal(0, rock, secret, {
        from: accounts[0]
      })
      let player2BalanceBeforeWithdrawal = await web3.eth.getBalance(
        accounts[1]
      )
      let gasPrice = await web3.eth.getGasPrice()
      let tx = await rockPaperScissors.withdraw(0, {
        from: accounts[1],
        gas: '1500000',
        gasPrice
      })

      let gasCost = web3.utils
        .toBN(gasPrice)
        .mul(web3.utils.toBN(tx.receipt.gasUsed))
      let player2BalanceAfterWithdrawal = await web3.eth.getBalance(accounts[1])

      assert.strictEqual(
        web3.utils
          .toBN(player2BalanceBeforeWithdrawal)
          .add(web3.utils.toBN(deposit * 2))
          .toString(),
        web3.utils
          .toBN(player2BalanceAfterWithdrawal)
          .add(gasCost)
          .toString()
      )
    })
  })

  describe('claim()', async function() {
    beforeEach(async function() {
      rockPaperScissors = await RockPaperScissors.new({ from: accounts[0] })
      let encryptedMove = await rockPaperScissors.encryptMove(rock, secret)

      await rockPaperScissors.createGame(encryptedMove, {
        from: accounts[0],
        value: deposit
      })

      await rockPaperScissors.joinGame(paper, 0, {
        from: accounts[1],
        value: deposit
      })
    })

    it("Should transfer entire deposit to player 2 if player 1 doesn't reveal within 24 hours", async function() {
      let player2BalanceBeforeClaim = await web3.eth.getBalance(accounts[1])

      // increase time 24 hours
      await evmFunctions.evmIncreaseTime(1440)

      let gasPrice = await web3.eth.getGasPrice()
      let tx = await rockPaperScissors.claim(0, {
        from: accounts[1],
        gas: '1500000',
        gasPrice
      })

      let gasCost = web3.utils
        .toBN(gasPrice)
        .mul(web3.utils.toBN(tx.receipt.gasUsed))

      let player2BalanceAfterClaim = await web3.eth.getBalance(accounts[1])

      assert.strictEqual(
        web3.utils
          .toBN(player2BalanceBeforeClaim)
          .add(web3.utils.toBN(deposit * 2))
          .toString(),
        web3.utils
          .toBN(player2BalanceAfterClaim)
          .add(gasCost)
          .toString()
      )
    })
  })

  describe('rescindGame()', async function() {
    beforeEach(async function() {
      rockPaperScissors = await RockPaperScissors.new({ from: accounts[0] })
      let encryptedMove = await rockPaperScissors.encryptMove(rock, secret)

      await rockPaperScissors.createGame(encryptedMove, {
        from: accounts[0],
        value: deposit
      })
    })

    it('Should transfer deposit back to player 1', async function() {
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
          .add(web3.utils.toBN(deposit))
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
