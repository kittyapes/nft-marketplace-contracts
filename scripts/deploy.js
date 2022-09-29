const { ethers, upgrades } = require('hardhat');

async function main() {
  const owner = '0xD7D4587b5524b32e24F1eE7581D543C775df27B5';
  const beneficiary = '0xD7D4587b5524b32e24F1eE7581D543C775df27B5';
  const WETHFactory = await ethers.getContractFactory('MockERC20');
  const HinataFactory = await ethers.getContractFactory('Hinata');
  const HinataStorageFactory = await ethers.getContractFactory('HinataStorage');
  const CollectionHelperFactory = await ethers.getContractFactory('CollectionHelper');
  const CollectionFactory = await ethers.getContractFactory('CollectionFactory');
  const HinataMarketplaceFactory = await ethers.getContractFactory('HinataMarketplace');

  const weth = await WETHFactory.deploy('Test Wrapped Ether', 'TWETH', '1000000000000000000000000');
  const hinata = await HinataFactory.deploy(owner);
  const storage = await upgrades.deployProxy(
    HinataStorageFactory,
    [[owner], hinata.address, weth.address],
    { initializer: 'initialize', kind: 'uups' },
  );
  const helper = await CollectionHelperFactory.deploy('https://api.hinata.io/');
  const factory = await upgrades.deployProxy(
    CollectionFactory,
    [helper.address, storage.address, 9850],
    { initializer: 'initialize', kind: 'uups' },
  );
  const marketplace = await upgrades.deployProxy(
    HinataMarketplaceFactory,
    [[owner], factory.address, beneficiary, 0],
    { initializer: 'initialize', kind: 'uups' },
  );

  console.log('WETH at:', weth.address);
  console.log('Hinata at:', hinata.address);
  console.log('Storage at:', storage.address);
  console.log('Helper at:', helper.address);
  console.log('Factory at:', factory.address);
  console.log('Marketplace at:', marketplace.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
