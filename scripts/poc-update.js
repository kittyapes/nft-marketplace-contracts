const { ethers, upgrades } = require('hardhat');

async function main() {
  const marketV2Addr = '0x464CF8880524f70b8f956f5042A7F712d759c516';
  const HinataMarketV2Factory = await ethers.getContractFactory('HinataMarketV2');
  await upgrades.upgradeProxy(marketV2Addr, HinataMarketV2Factory);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
