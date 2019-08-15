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

const UNLOCK_AMOUNT = '1000000000000000000'; // 1 ETH
const INITIAL_MOGUL_SUPPLY = '1000000000000000000'; // 1 ETH

// Mogul wallet address
let MOGUL_BANK = '0x3EDBA762A053B939e581a6A2330a1B6470C14412';
let DAI_TOKEN_ADDRESS = '0x1eaCe4925162117ec72586CD5Bee1C9cE0053e36';
let WHITELISTER_ADDRESS = '0x3EDBA762A053B939e581a6A2330a1B6470C14412';

const ENV = {
    LOCAL: 'LOCAL',
    TEST: 'TEST'
};

const DEPLOYERS = {
    LOCAL: (secret) => { return new etherlime.EtherlimeGanacheDeployer(secret, 8545, '') },
    TEST: (secret) => { return new etherlime.InfuraPrivateKeyDeployer(secret, 'ropsten', 'e7a6b9997e804bc6a91b8c8d6f1fd7d1') }
};

const deploy = async (network, secret) => {

    // // Change ENV in order to deploy on test net (Ropsten)
    const deployer = getDeployer(ENV.TEST, secret);
    const daiContract = await getDAIContract(deployer);

    let daiExchangeContract = await deployDAIExchange(deployer, daiContract);
    await daiContract.addMinter(daiExchangeContract.contractAddress);
    await daiContract.mint("0x4555A429Df5Cc32efa46BCb1412a3CD7Bf14b381", "100000000000000000000");

    // Deploy Movie Token

    await deployVoting(deployer);

    // Deploy Mogul Token
    const mogulTokenDeployed = await deployMogulToken(deployer);

    const mogulOrganization = await deployMogulOrganization(deployer, daiContract.address, mogulTokenDeployed.contractAddress);

    await mogulTokenDeployed.addMinter(mogulOrganization.contractAddress);
    await mogulTokenDeployed.renounceMinter();
    await mogulTokenDeployed.addMovementNotifier(mogulOrganization.contractAddress);
    console.log("addMovementNotifier");

    await daiContract.approve(mogulOrganization.contractAddress, UNLOCK_AMOUNT, {
        gasLimit: 4700000
    });
    await mogulOrganization.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY, {
        gasLimit: 4700000
    });
    console.log("Done Done");
};

let getDeployer = function (env, secret) {
    let deployer = DEPLOYERS[env](secret);

    deployer.ENV = env;
    deployer.defaultOverrides = { gasLimit: 4700000, gasPrice: 9000000000 };

    return deployer;
};

let getDAIContract = async function (deployer) {
    if (deployer.ENV == ENV.LOCAL) {
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

let deployMogulOrganization = async function (deployer, daiToken, mogulToken) {

    // Deploy Organization Bonding SQRT Math
    const bondingSqrtDeployTx = await deployer.signer.sendTransaction({
        data: BondingSQRT.bytecode
    });

    await deployer.provider.waitForTransaction(bondingSqrtDeployTx.hash);
    bondingSqrtContractAddress = (await deployer.provider.getTransactionReceipt(bondingSqrtDeployTx.hash)).contractAddress;


    // Deploy Bonding Calculations
    const bondingMathContractDeployed = await deployer.deploy(BondingMath, {}, bondingSqrtContractAddress);

    // Deploy Organization
    const mogulOrganizationContractDeployed = await deployer.deploy(MogulOrganization, {},
        bondingMathContractDeployed.contractAddress,
        daiToken,
        mogulToken,
        MOGUL_BANK,
        WHITELISTER_ADDRESS
    );

    return mogulOrganizationContractDeployed;
};

let deployVoting = async function (deployer) {

    const MOVIES = [
        '0x4d6f766965310000000000000000000000000000000000000000000000000000', // Movie1
        '0x4d6f766965320000000000000000000000000000000000000000000000000000', // Movie2
        '0x4d6f766965330000000000000000000000000000000000000000000000000000', // Movie3
        '0x4d6f766965340000000000000000000000000000000000000000000000000000', // Movie4
        '0x4d6f766965350000000000000000000000000000000000000000000000000000'  // Movie5
    ];


    // Deploy Token SQRT Math
    const tokenSqrtDeployTx = await deployer.signer.sendTransaction({
        data: TokensSQRT.bytecode
    });

    await deployer.provider.waitForTransaction(tokenSqrtDeployTx.hash);
    tokenSqrtContractAddress = (await deployer.provider.getTransactionReceipt(tokenSqrtDeployTx.hash)).contractAddress;


    // Deploy Voting
    const votingContractDeployed = await deployer.deploy(Voting, {}, MOVIES, tokenSqrtContractAddress);
    return votingContractDeployed;
};

module.exports = { deploy };
