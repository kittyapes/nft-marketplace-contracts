const { ethers, upgrades } = require('hardhat');

async function main() {
  const marketV2Addr = '0xAd1cCB7135aEA4F41f588631fD6E2F1e578C9D17';
  const HinataMarketV2Factory = await ethers.getContractFactory('HinataMarketV2');
  await upgrades.upgradeProxy(marketV2Addr, HinataMarketV2Factory);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
