const { ethers } = require('hardhat');

async function main() {
  const wethAddr = '0xbA5029aAF14672ef662aD8eB38CDB4E4C16AdF6D';
  const hinataAddr = '0xf41f5a3f6497687738F1cBd0B262f577da9384Bf';
  const storageAddr = '0xE09dA477881DDC07D8DAD107dd71021EA43aCFf8';
  const marketplaceAddr = '0x1fBf287d7026f5d43549424886B439Fc1d405c58';
  const adminForStorage = '0x7FB10CF27B4A7613d1B6F168e3DCf9728a115EFb';
  const server = '0xe26C1b781dC472D5Ff17FA1A542eF609bd0F2b87';
  const artists = [
    '0x35CaaBA865BD019dc738eCB96Ec7D0a7Ab349015', // admin
    '0x40D6f8Ac990d98F9c812A3910e3255345fB32f8e', // jakub
    '0x5546Ea6D6C056e5D4267789532D4743cE4438e6B',
    '0x7e163970F2A09d6092721D4d2C19E1Fe33177DDD', // stefan
    '0x302a44F7d6E5Fa00590ca7A01E35b6674f2fa645',
    '0x4E0f1cC2e75166e17D3683287dD7a7Facd1312Bd', // ivan
    '0x5Fba4608a7E9310735d0bE5993fEA08fEaF9bD48', // stefan
  ];
  const newArtists = [
    '0xbDc2BD2A0011d918CAbb389ae739212C46e0eE91',
    '0xB272794188658B6Ca7aaEbE79468A718C620A721',
    '0x5B3f64d8b621a5F0E0ADF812172C9df62270bfFF',
    '0x749D2747271e7a41435eE2DAD6f808c8c0a83132',
    '0x7FB10CF27B4A7613d1B6F168e3DCf9728a115EFb',
    '0x7D2498A05f2C6d6d53db8dFb5826e279012996EB',
    '0xa6cf13Fa4df69F09A518e2F4419f7Ae1Cae71eC6',
    '0x0c73774C8b8836fB4E626c7338B639e6293cf569',
    '0x40D6f8Ac990d98F9c812A3910e3255345fB32f8e',
    '0x5546Ea6D6C056e5D4267789532D4743cE4438e6B',
    '0x7e163970F2A09d6092721D4d2C19E1Fe33177DDD',
    '0x302a44F7d6E5Fa00590ca7A01E35b6674f2fa645',
    '0x914853f5B413d0ca84522F4260743699C390fe17',
    '0x31d8FC8bD6dEFcCfCc03e838db35b19819F67e18',
    '0x86aBE289cfeb6Ec7Daa118DE76A10e3614768128',
    '0xCbc15cCa499feF2A575d203Bb6c0e1aa7A383d15',
    '0xaA4A5853080CbE0053756a4907bD488E67D7b280',
    '0xCC96A980DA2ED7778E878cb5524E4B82c25337ec',
    '0x2C4d288B9F86D25D4fd1875710d5929F4afdB456',
    '0x5CeDFAE9629fdD41AE7dD25ff64656165526262A',
    '0xf09000ABe7ceBA60947768793038d05b9678DDC8',
  ];
  const ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6';
  const mintTos = [
    '0x302a44F7d6E5Fa00590ca7A01E35b6674f2fa645', // petar
    '0x5546Ea6D6C056e5D4267789532D4743cE4438e6B', // pavel
    '0x7e163970F2A09d6092721D4d2C19E1Fe33177DDD', // stefan
    '0x7FB10CF27B4A7613d1B6F168e3DCf9728a115EFb', // john
    '0x1a63D0736b4205fBe4E635D0d43657b43f30AB09', // jakub
    '0x35CaaBA865BD019dc738eCB96Ec7D0a7Ab349015', // anhnt
  ];
  const sharedAccount = '0xB712dECe0f1E0a1a561D74Ef90cF08a560CE3214';
  const amount = '100000000000000000000000';

  const HinataFactory = await ethers.getContractFactory('Hinata');
  const MockERC20Factory = await ethers.getContractFactory('MockERC20');
  const HinataStorageFactory = await ethers.getContractFactory('HinataStorage');
  const HinataMarketplaceFactory = await ethers.getContractFactory('HinataMarketplace');

  const params = {
    nonce: 176,
    gasPrice: '60000000000',
    gasLimit: 60000,
  };

  // const hinata = await HinataFactory.attach(hinataAddr);
  // await hinata.setStorage(storageAddr);

  // const weth = await MockERC20Factory.attach(wethAddr);
  // await weth.setBalance(sharedAccount, amount);
  // await weth.setBalance(mintTos[0], amount);
  // await weth.setBalance(mintTos[1], amount);
  // await weth.setBalance(mintTos[2], amount);
  // await weth.setBalance(mintTos[3], amount);
  // await weth.setBalance(mintTos[4], amount);
  // await weth.setBalance(mintTos[5], amount);

  // const storage = await HinataStorageFactory.attach(storageAddr);
  // await hinata.addVerifier('0x555f663c62f973c7ab4d146d861d87f7d931bd29');

  const marketplace = await HinataMarketplaceFactory.attach(marketplaceAddr);
  await marketplace.setAcceptPayToken(wethAddr, true, params);
  await marketplace.setMarketFee(150);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
