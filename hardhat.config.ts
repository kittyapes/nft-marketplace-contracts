import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-web3';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import 'dotenv/config';
import '@openzeppelin/hardhat-upgrades';

export default {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      timeout: 1000000,
      initialBaseFeePerGas: 0,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 89,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      chainId: 1,
      accounts: [process.env.PRIVATE_KEY],
    },
    testnet: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`,
      chainId: 5,
      accounts: [process.env.PRIVATE_KEY],
      gas: 2100000,
      gasPrice: 8000000000,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  typechain: {
    outDir: 'src/types',
    target: 'ethers-v5',
  },
  gasReporter: {
    currency: 'ETH',
  },
  etherscan: {
    apiKey: process.env.API_KEY,
  },
  solidity: {
    version: '0.8.15',
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  mocha: {
    timeout: 2000000,
  },
};
