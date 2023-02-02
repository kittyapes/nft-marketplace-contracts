const { ethers, upgrades } = require('hardhat');

async function main() {
  const owner = '0xd30b2014d01345eabf7545ab83bd5a4f6a5127ca';
  const beneficiary = '0x2004C4E60B314604c5786dCa88e8D9B89cF3660a';
  const wethAddr = '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6';
  const factoryAddr = '0x41a508E15F391b2AA3129c9fE054f9A48226AC4F';
  const HinataMarketV2Factory = await ethers.getContractFactory('HinataMarketV2');

  const marketV2 = await upgrades.deployProxy(
    HinataMarketV2Factory,
    [[owner], factoryAddr, beneficiary, 0],
    { initializer: 'initialize', kind: 'uups' },
  );

  await marketV2.deployed();
  await marketV2.setAcceptPayToken(wethAddr, true);
  await marketV2.setLimitCount(10);

  console.log('MarketV2 at:', marketV2.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
