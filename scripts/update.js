const { ethers, upgrades } = require('hardhat');

async function main() {
  const ContractFactory = await ethers.getContractFactory('CollectionFactory');
  await upgrades.upgradeProxy('0x41a508E15F391b2AA3129c9fE054f9A48226AC4F', ContractFactory);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
