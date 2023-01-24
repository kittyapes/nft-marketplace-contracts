const { ethers, upgrades } = require('hardhat');

async function main() {
  const marketV2Addr = '0xB4A03F5823A011Be345B567B87EA69540B53aAC1';
  const HinataMarketV2Factory = await ethers.getContractFactory('HinataMarketV2');
  await upgrades.upgradeProxy(marketV2Addr, HinataMarketV2Factory);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
