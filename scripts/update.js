const { ethers, upgrades } = require('hardhat');

async function main() {
  const marketplaceAddr = '0x9A986d8B2cB50e827393Ec329cb0003535b5Ff75';

  const HinataMarketplaceFactory = await ethers.getContractFactory('HinataMarketplace');
  await upgrades.upgradeProxy(marketplaceAddr, HinataMarketplaceFactory);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
