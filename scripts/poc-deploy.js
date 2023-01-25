const { ethers, upgrades } = require('hardhat');

async function main() {
  const owner = '0xD7D4587b5524b32e24F1eE7581D543C775df27B5';
  const beneficiary = '0xD7D4587b5524b32e24F1eE7581D543C775df27B5';
  const wethAddr = '0xbA5029aAF14672ef662aD8eB38CDB4E4C16AdF6D';
  const factoryAddr = '0x7E6b4e3daE0C60Fa3FD9bfa8dB2215b8B237b4FC';
  const HinataMarketV2Factory = await ethers.getContractFactory('HinataMarketV2');

  const marketV2 = await upgrades.deployProxy(
    HinataMarketV2Factory,
    [[owner], factoryAddr, beneficiary, 0],
    { initializer: 'initialize', kind: 'uups' },
  );

  await marketV2.deployed();
  await marketV2.setAcceptPayToken(wethAddr, true);
  await marketV2.setLimitCount(10);

  console.log('MarketV2 at:', marketV2.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
