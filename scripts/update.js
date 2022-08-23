const { ethers, upgrades } = require('hardhat');

async function main() {
  const storageAddr = '0x199297eb990bc25dd9a1c1c0d828a7e9df1d132e';

  const HinataStorageFactory = await ethers.getContractFactory('HinataStorage');
  await upgrades.upgradeProxy(storageAddr, HinataStorageFactory);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
