const { ethers, upgrades } = require('hardhat');

async function main() {
  const owner = '0xD7D4587b5524b32e24F1eE7581D543C775df27B5';
  const MockERC20Factory = await ethers.getContractFactory('MockERC20');
  const HinataFactory = await ethers.getContractFactory('Hinata');
  const HinataStorageFactory = await ethers.getContractFactory('HinataStorage');
  const HinataMarketV2Factory = await ethers.getContractFactory('HinataMarketV2');

  const weth = await MockERC20Factory.deploy('Mock WETH', 'WETH', '1000000000000000000000000');
  const hinata = await HinataFactory.deploy(owner);
  const storage = await upgrades.deployProxy(
    HinataStorageFactory,
    [[owner], hinata.address, weth.address],
    {
      initializer: 'initialize(address[],address,address)',
      kind: 'uups',
    },
  );
  const marketplace = await upgrades.deployProxy(
    HinataMarketV2Factory,
    [storage.address, 1000, owner],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await hinata.deployed();
  await hinata.setStorage(storage.address);
  await storage.deployed();
  await marketplace.deployed();

  console.log('Hinata at:', hinata.address);
  console.log('Storage at:', storage.address);
  console.log('Marketplace at:', marketplace.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
