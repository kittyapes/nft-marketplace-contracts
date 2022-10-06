const { ethers, upgrades } = require('hardhat');

async function main() {
  const factoryAddr = '0x41a508E15F391b2AA3129c9fE054f9A48226AC4F';
  const marketplaceAddr = '0x9A986d8B2cB50e827393Ec329cb0003535b5Ff75';

  const HinataFactory = await ethers.getContractFactory('CollectionFactory');
  await upgrades.upgradeProxy(factoryAddr, HinataFactory);

  const HinataMarketplaceFactory = await ethers.getContractFactory('HinataMarketplace');
  await upgrades.upgradeProxy(marketplaceAddr, HinataMarketplaceFactory);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
