const { ethers } = require('hardhat');
const list = require('./batch.json');

async function main() {
  const CollectionFactory = await ethers.getContractFactory('CollectionFactory');
  const factory = await CollectionFactory.attach('0x41a508E15F391b2AA3129c9fE054f9A48226AC4F');
  await factory.batchRegister(
    list.map((x) => x.address),
    list.map((x) => x.beneficiary),
    list.map((x) => x.percentage),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
