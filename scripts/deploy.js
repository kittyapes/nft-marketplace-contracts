const { ethers, upgrades } = require('hardhat');

async function main() {
  const owner = '0xD7D4587b5524b32e24F1eE7581D543C775df27B5';
  const beneficiary = '0xD7D4587b5524b32e24F1eE7581D543C775df27B5';
  const CollectionFactory = await ethers.getContractFactory('CollectionFactory');
  const HinataMarketplaceFactory = await ethers.getContractFactory('HinataMarketplace');

  const storage = '0xbfF4E404ACacd49c55Cc9A04e871D8a738af7095';
  const helper = '0x88b3bEB5f691091E3efCD6a19731558dDefB3799';
  const factory = await upgrades.deployProxy(CollectionFactory, [helper, storage, 9850], {
    initializer: 'initialize',
    kind: 'uups',
  });
  const marketplace = await upgrades.deployProxy(
    HinataMarketplaceFactory,
    [[owner], factory.address, beneficiary, 0],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  console.log('Factory at:', factory.address);
  console.log('Marketplace at:', marketplace.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
