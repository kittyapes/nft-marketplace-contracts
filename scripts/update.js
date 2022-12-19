const { ethers, upgrades } = require('hardhat');

async function main() {
  // const factoryAddr = '0x41a508E15F391b2AA3129c9fE054f9A48226AC4F';
  const marketplaceAddr = '0x9A986d8B2cB50e827393Ec329cb0003535b5Ff75';
  const storageAddr = '0x199297eb990bc25dd9a1c1c0d828a7e9df1d132e';

  const HinataMarketplaceFactory = await ethers.getContractFactory('HinataMarketplace');
  await upgrades.upgradeProxy(marketplaceAddr, HinataMarketplaceFactory);

  const HinataStorageFactory = await ethers.getContractFactory('HinataStorage');
  await upgrades.upgradeProxy(storageAddr, HinataStorageFactory);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
