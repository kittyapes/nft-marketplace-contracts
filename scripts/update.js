const { ethers, upgrades } = require('hardhat');

async function main() {
  const owner = '0xd30b2014D01345EAbf7545AB83BD5A4F6A5127cA';
  const hinataAddr = '0x91a09acc7a76624f593990c4456fc318d705c761';
  const weth = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  const factoryAddr = '0x41a508E15F391b2AA3129c9fE054f9A48226AC4F';

  const HinataFactory = await ethers.getContractFactory('Hinata');
  const HinataStorageFactory = await ethers.getContractFactory('HinataStorage');
  const CollectionFactory = await ethers.getContractFactory('CollectionFactory');
  const hinata = await HinataFactory.attach(hinataAddr);
  const storage = await upgrades.deployProxy(HinataStorageFactory, [[owner], hinataAddr, weth], {
    initializer: 'initialize(address[],address,address)',
    kind: 'uups',
  });
  await upgrades.upgradeProxy(factoryAddr, CollectionFactory);
  const factory = await CollectionFactory.attach(factoryAddr);
  await hinata.setStorage(storage.address);
  await factory.setHinataStorage(storage.address);

  console.log(storage.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
