const { ethers } = require('hardhat');

async function main() {
  const wethAddr = '0xf2155859d31c5ea79f45a55c6ad9a44e7f257700';
  const hinataAddr = '0x04013fA3b72E82489d434FD64E3f4142647413cA';
  const storageAddr = '0xbfF4E404ACacd49c55Cc9A04e871D8a738af7095';
  const marketplaceAddr = '0xfE5c453A595Cec7D2B20Aa9b7D57B5A0AD09d61F';
  const adminForStorage = '0x35CaaBA865BD019dc738eCB96Ec7D0a7Ab349015';
  const server = '0xe26C1b781dC472D5Ff17FA1A542eF609bd0F2b87';
  const artists = [
    '0x35CaaBA865BD019dc738eCB96Ec7D0a7Ab349015',
    '0x40D6f8Ac990d98F9c812A3910e3255345fB32f8e', // jakub
    '0x5546Ea6D6C056e5D4267789532D4743cE4438e6B',
    '0x7e163970F2A09d6092721D4d2C19E1Fe33177DDD',
    '0x302a44F7d6E5Fa00590ca7A01E35b6674f2fa645',
    '0x4E0f1cC2e75166e17D3683287dD7a7Facd1312Bd', // ivan
    '0x5Fba4608a7E9310735d0bE5993fEA08fEaF9bD48', // stefan
  ];
  const ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const mintTos = [
    '0x302a44F7d6E5Fa00590ca7A01E35b6674f2fa645', // petar
    '0x5546Ea6D6C056e5D4267789532D4743cE4438e6B', // pavel
    '0x7e163970F2A09d6092721D4d2C19E1Fe33177DDD', // stefan
    '0x7FB10CF27B4A7613d1B6F168e3DCf9728a115EFb', // john
    '0x1a63D0736b4205fBe4E635D0d43657b43f30AB09', // jakub
    '0x35CaaBA865BD019dc738eCB96Ec7D0a7Ab349015', // anhnt
  ];
  const amount = '10000000000000000000000';

  const HinataFactory = await ethers.getContractFactory('Hinata');
  const MockERC20Factory = await ethers.getContractFactory('MockERC20');
  const HinataStorageFactory = await ethers.getContractFactory('HinataStorage');
  const HinataMarketplaceFactory = await ethers.getContractFactory('HinataMarketplace');

  const hinata = await HinataFactory.attach(hinataAddr);
  await hinata.addVerifier(server);

  const weth = await MockERC20Factory.attach(wethAddr);
  await weth.setBalance(mintTos[0], amount);
  await weth.setBalance(mintTos[1], amount);
  await weth.setBalance(mintTos[2], amount);
  await weth.setBalance(mintTos[3], amount);
  await weth.setBalance(mintTos[4], amount);
  await weth.setBalance(mintTos[5], amount);

  const storage = await HinataStorageFactory.attach(storageAddr);
  await storage.grantRole(ADMIN_ROLE, adminForStorage);
  await storage.addArtists(artists);

  const marketplace = await HinataMarketplaceFactory.attach(marketplaceAddr);
  await marketplace.setAcceptPayToken(wethAddr, true);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
