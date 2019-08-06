const etherlime = require('etherlime-lib');

const MogulDAI = require('./../../build/MogulDAI');
const MovieToken = require('./../../build/MovieToken');
const MogulToken = require('./../../build/MogulToken');

const SQRT = require('./../../build/SQRT');
const TokensSQRT = require('./../../build/TokensSQRT');
const BondingMathematics = require('./../../build/BondingMathematics');

const MogulOrganisation = require('./../../build/MogulOrganisation');

const deployerWallet = accounts[0].signer;
const WHITELISTER = accounts[0].signer.address;
const MOGUL_BANK = accounts[9].signer.address;

const deployer = new etherlime.EtherlimeGanacheDeployer();
deployer.setDefaultOverrides({ gasLimit: 6700000, gasPrice: 9000000000 });


let deployMogulOrganization = async (mglDai, movieTokenInstance) => {

    let bondingMathematicsInstance = await deployBondingMath();
    const mogulToken = await deployMogulToken();

    const mglOrganisationInstance = await deployer.deploy(MogulOrganisation, {},
        bondingMathematicsInstance.contractAddress,
        mglDai.contractAddress,
        mogulToken.contractAddress,
        movieTokenInstance.contractAddress,
        MOGUL_BANK,
        WHITELISTER);


    await mogulToken.addMinter(mglOrganisationInstance.contractAddress);
    await mogulToken.renounceMinter();
    await mogulToken.setMovementNotifier([mglOrganisationInstance.contractAddress]);

    return mglOrganisationInstance;

};

let deployMovieToken = async () => {
    return deployer.deploy(MovieToken);
};

let addMovieTokenMinter = async (movieTokenInstance, minterAddr) => {
    await movieTokenInstance.addMinter(minterAddr);
};

let deploySQRT = async () => {
    return deployer.deploy(SQRT);
};

let deployTokenSQRT = async () => {
    return deployer.deploy(TokensSQRT, {});
};

let getMogulToken = async (mogulOrganisationInstance, wallet) => {
    let mogulTokenAddress = await mogulOrganisationInstance.mogulToken();
    let mogulTokenContract = new ethers.Contract(mogulTokenAddress, MogulToken.abi, deployerWallet.provider);
    return mogulTokenContract.connect(wallet);

};

let deployMogulToken = async () => {
    return deployer.deploy(MogulToken, {});
};

let deployBondingMath = async () => {
    let sqrtContractAddress = await deploySQRT(deployerWallet);
    return deployer.deploy(BondingMathematics, {}, sqrtContractAddress.contractAddress);
};

let deployMglDai = async () => {
    return deployer.deploy(MogulDAI);
};

let mintDAI = async (mogulDAIInstance, to, amount) => {
    await mogulDAIInstance.mint(to, amount)
};

let approveDAI = async (mogulDAIInstance, approver, to, amount) => {
    await mogulDAIInstance.from(approver).approve(to, amount)
};

module.exports = {
    getMogulToken,
    mintDAI,
    approveDAI,
    deployMogulOrganization,
    deployMglDai,
    addMovieTokenMinter,
    deployMovieToken,
    deployTokenSQRT
};
