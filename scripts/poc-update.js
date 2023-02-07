const { ethers, upgrades } = require('hardhat');

async function main() {
  const marketV2Addr = '0x7419a5dfd3F40aaAd7cF791BC5994E7DaA5c0532';
  const HinataMarketV2Factory = await ethers.getContractFactory('HinataMarketV2');
  await upgrades.upgradeProxy(marketV2Addr, HinataMarketV2Factory);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
