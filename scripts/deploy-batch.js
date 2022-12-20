const { ethers } = require('hardhat');

async function main() {
  const marketplaceAddr = '0x48441F157Eb382C8FEC1f9b40f34aa9a04209028';

  const BatchQuery = await ethers.getContractFactory('BatchQuery');
  let batchQuery = await BatchQuery.deploy(marketplaceAddr);
  console.log((await batchQuery.deployed()).address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
