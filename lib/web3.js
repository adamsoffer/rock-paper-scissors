import Web3 from 'web3'

export default new Web3(Web3.givenProvider || 'http://127.0.0.1:7545')
