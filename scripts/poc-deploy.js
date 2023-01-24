const { ethers, upgrades } = require('hardhat');

async function main() {
  const owner = '0xD7D4587b5524b32e24F1eE7581D543C775df27B5';
  const beneficiary = '0xD7D4587b5524b32e24F1eE7581D543C775df27B5';
  const factoryAddr = '0x7FeDd7Cc42E5486f2Ff73147DD9c06b80665B2A1';
  const HinataMarketV2Factory = await ethers.getContractFactory('HinataMarketV2');

  const marketV2 = await upgrades.deployProxy(
    HinataMarketV2Factory,
    [[owner], factoryAddr, beneficiary, 0],
    { initializer: 'initialize', kind: 'uups' },
  );

  await marketV2.deployed();

  console.log('MarketV2 at:', marketV2.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
