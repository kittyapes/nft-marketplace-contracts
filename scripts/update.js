const { ethers, upgrades } = require('hardhat');

async function main() {
  const factoryAddr = '0x41a508E15F391b2AA3129c9fE054f9A48226AC4F';

  const CollectionHelperFactory = await ethers.getContractFactory('CollectionHelper');
  const CollectionFactory = await ethers.getContractFactory('CollectionFactory');

  const helper = await CollectionHelperFactory.deploy('https://api.hinata.io/');
  const factory = await upgrades.upgradeProxy(factoryAddr, CollectionFactory);
  await factory.setHelper(helper.address);

  console.log(helper.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
