const evmFunctions = {
  evmIncreaseTime: seconds =>
    new Promise((resolve, reject) =>
      web3.currentProvider.sendAsync(
        {
          jsonrpc: '2.0',
          method: 'evm_increaseTime',
          params: [seconds],
          id: new Date().getTime()
        },
        (error, result) => (error ? reject(error) : resolve(result.result))
      )
    )
}

module.exports = evmFunctions
