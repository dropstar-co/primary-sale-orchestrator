require('@nomiclabs/hardhat-waffle')
require('@nomiclabs/hardhat-ethers')
require('@nomiclabs/hardhat-truffle5')
require('@nomiclabs/hardhat-etherscan')
require('hardhat-abi-exporter')
require('solidity-coverage')
require('hardhat-etherscan-abi')
require('hardhat-gas-reporter')

const {
  ALCHEMY_API_KEY_MUMBAI,
  ALCHEMY_API_KEY_MAINNET,
  ALCHEMY_API_KEY_POLYGON,
  DEPLOYER_PRIVATE_KEY,
  DEPLOYER_PRIVATE_KEY_PRODUCTION,
  COINMARKETCAP_KEY,
  POLYGONSCAN_API_KEY,
} = require('./.env.js')

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: '0.8.4',
  settings: {
    optimizer: {
      enabled: true,
      runs: 1000,
    },
  },
  networks: {
    mumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_API_KEY_MUMBAI}`,
      accounts: [`${DEPLOYER_PRIVATE_KEY}`],
    },
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY_POLYGON}`,
      accounts: [`${DEPLOYER_PRIVATE_KEY_PRODUCTION}`],
    },
  },
  gasReporter: {
    currency: 'MATIC',
    gasPrice: 40,
    coinmarketcap: COINMARKETCAP_KEY,
    token: 'MATIC',
  },
  etherscan: {
    apiKey: {
      polygon: POLYGONSCAN_API_KEY,
      polygonMumbai: POLYGONSCAN_API_KEY,
    },
  },
}
