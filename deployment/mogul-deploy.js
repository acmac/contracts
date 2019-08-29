const ethers = require('ethers');
const etherlime = require('etherlime-lib');

const DAIToken = require('./../build/MogulDAI');
const MogulToken = require('./../build/MogulToken');

const Voting = require('./../build/Voting');
const DAIExchange = require('./../build/DAIExchange');
const BondingMath = require('./../build/BondingMathematics');
const MogulOrganization = require('./../build/MogulOrganisation');

const BondingSQRT = require('./../build/SQRT');
const TokensSQRT = require('./../build/TokensSQRT');

const ONE_ETH = ethers.utils.bigNumberify("1000000000000000000");
const UNLOCK_AMOUNT = ONE_ETH.mul(2500000);
const INITIAL_MOGUL_SUPPLY = ONE_ETH.mul(5000000);

// Mogul wallet address
let MOGUL_BANK = '0x3EDBA762A053B939e581a6A2330a1B6470C14412';
let MOGUL_BANK_LOCAL = '0xd4fa489eacc52ba59438993f37be9fcc20090e39';
let WHITELISTER_ADDRESS = '0x3EDBA762A053B939e581a6A2330a1B6470C14412';
let WHITELISTER_ADDRESS_LOCAL = '0x760bf27cd45036a6c486802d30b5d90cffbe31fe';
let DAI_TOKEN_ADDRESS = '0x1eaCe4925162117ec72586CD5Bee1C9cE0053e36';

// let localUser1PrKey = "0xf41486fdb04505e7966c8720a353ed92ce0d6830f8a5e915fbde735106a06d25";
// let localUser1Address = "0x28bf45680ca598708e5cdacc1414fcac04a3f1ed";
// let localUser2PrKey = "0x6ca40ba4cca775643398385022264c0c414da1abd21d08d9e7136796a520a543";
// let localUser2Address = "0xf0508f89e26bd6b00f66a9d467678c7ed16a3c5a";

const ENV = {
    LOCAL: 'LOCAL',
    TEST: 'TEST'
};

const DEPLOYERS = {
    LOCAL: (secret) => { return new etherlime.EtherlimeGanacheDeployer(secret, 8545, '') },
    TEST: (secret) => { return new etherlime.InfuraPrivateKeyDeployer(secret, 'ropsten', 'e7a6b9997e804bc6a91b8c8d6f1fd7d1') }
};

const deploy = async (network, secret) => {

    const env = ENV.TEST;

    // // Change ENV in order to deploy on test net (Ropsten)
    const deployer = getDeployer(env, secret);

    const daiContract = await getDAIContract(deployer);
    let mogulBankAddress = getMogulBankAddress(env);
    let whitelisterAddress = getWhitelisterAddress(env);

    // let daiExchangeContract = await deployDAIExchange(deployer, daiContract);
    // await daiContract.addMinter(daiExchangeContract.contractAddress);

    await daiContract.mint("0x4555A429Df5Cc32efa46BCb1412a3CD7Bf14b381", UNLOCK_AMOUNT);
    // await daiContract.mint(localUser1Address, "100000000000000000000");

    // Deploy Mogul Token
    const mogulTokenDeployed = await deployMogulToken(deployer);

    const mogulOrganization = await deployMogulOrganization(deployer, daiContract.address, mogulTokenDeployed.contractAddress, mogulBankAddress, whitelisterAddress);

    await mogulTokenDeployed.addMinter(mogulOrganization.contractAddress);
    await mogulTokenDeployed.renounceMinter();
    await mogulTokenDeployed.addMovementNotifier(mogulOrganization.contractAddress);

    await deployVoting(mogulTokenDeployed.contractAddress, daiContract.address, deployer);

    await daiContract.approve(mogulOrganization.contractAddress, UNLOCK_AMOUNT, {
        gasLimit: 4700000
    });
    await mogulOrganization.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY, {
        gasLimit: 4700000
    });
};

let getDeployer = function (env, secret) {
    let deployer = DEPLOYERS[env](secret);

    deployer.ENV = env;
    deployer.defaultOverrides = { gasLimit: 4700000, gasPrice: 9000000000 };

    return deployer;
};

let getMogulBankAddress = function (env) {
  if (env === ENV.TEST) {
      return (MOGUL_BANK);
  } else if (env === ENV.LOCAL) {
      return MOGUL_BANK_LOCAL;
  }
};

let getWhitelisterAddress = function (env) {
    if (env === ENV.TEST) {
        return (WHITELISTER_ADDRESS);
    } else if (env === ENV.LOCAL) {
        return WHITELISTER_ADDRESS_LOCAL;
    }
};

let getDAIContract = async function (deployer) {
    if (deployer.ENV === ENV.LOCAL) {
        let daiContractDeployed = await deployer.deploy(DAIToken, {});
        await daiContractDeployed.mint(deployer.signer.address, UNLOCK_AMOUNT);

        return daiContractDeployed.contract;
    }

    return new ethers.Contract(DAI_TOKEN_ADDRESS, DAIToken.abi, deployer.signer);
};

let deployDAIExchange = async function (deployer, daiToken) {
    const exchangeContractDeployed = await deployer.deploy(DAIExchange, {}, daiToken.address);
    return exchangeContractDeployed;
};

let deployMogulToken = async function (deployer) {
    const mogulTokenDeployed = await deployer.deploy(MogulToken, {});
    return mogulTokenDeployed;
};

let deployMogulOrganization = async function (deployer, daiToken, mogulToken, mogulBankAddress, whitelisterAddress) {

    // Deploy Organization Bonding SQRT Math
    const bondingSqrtDeployTx = await deployer.signer.sendTransaction({
        data: BondingSQRT.bytecode
    });

    await deployer.provider.waitForTransaction(bondingSqrtDeployTx.hash);
    bondingSqrtContractAddress = (await deployer.provider.getTransactionReceipt(bondingSqrtDeployTx.hash)).contractAddress;


    // Deploy Bonding Calculations
    const bondingMathContractDeployed = await deployer.deploy(BondingMath, {}, bondingSqrtContractAddress);

    // Deploy Organization
    return await deployer.deploy(MogulOrganization, {},
        bondingMathContractDeployed.contractAddress,
        daiToken,
        mogulToken,
        mogulBankAddress,
        whitelisterAddress
    );
};

let deployVoting = async function (mogulTokenAddress, daiTokenAddress, deployer) {
    // Deploy Token SQRT Math
    const tokenSqrtDeployTx = await deployer.signer.sendTransaction({
        data: TokensSQRT.bytecode
    });

    await deployer.provider.waitForTransaction(tokenSqrtDeployTx.hash);
    let tokenSqrtContractAddress = (await deployer.provider.getTransactionReceipt(tokenSqrtDeployTx.hash)).contractAddress;


    // Deploy Voting
    return await deployer.deploy(Voting, {}, mogulTokenAddress, daiTokenAddress, tokenSqrtContractAddress);
};

module.exports = { deploy };
