const ethers = require('ethers');
const DAIToken = require('./build/MogulDAI');
const DAI_TOKEN_ADDRESS = "0x1eaCe4925162117ec72586CD5Bee1C9cE0053e36";
const MGL_ORG_ADDRESS = "0x9C37D99F38c9d7A5893cd0b406C1AC99F81a1D85";
const VOTING_ADDRESS = "0xBe7B4A6Fdc2aeCeDbeC7f173dBe485B54bcaAa10";
const MGL_ORG = require('./build/MogulOrganisation');
const VOTING = require('./build/Voting');

const provider = new ethers.providers.InfuraProvider('ropsten');
const ownerWallet = new ethers.Wallet("0x2956B7AFA2B93C048F2281BE59A5D0ECAF247C5F82430A2209143C1E973C5B82").connect(provider);

async function mint(mintAmount) {

    let mglDai = new ethers.Contract(DAI_TOKEN_ADDRESS, DAIToken.abi, provider).connect(ownerWallet);
    let tr = await mglDai.mint("0x4555A429Df5Cc32efa46BCb1412a3CD7Bf14b381", mintAmount);
    let minedTr = await provider.waitForTransaction(tr.hash);
    console.log(minedTr);
}

async function isApproved(addr) {

    let mglOrg = new ethers.Contract(MGL_ORG_ADDRESS, MGL_ORG.abi, provider).connect(ownerWallet);
    let res = await mglOrg.whiteList(addr);
    console.log(res);
}

async function invest(amount, signed) {

    let mglOrg = new ethers.Contract(MGL_ORG_ADDRESS, MGL_ORG.abi, provider).connect(ownerWallet);
    let res = await mglOrg.invest(amount, signed, {
        gasLimit: 2700000
    });
    console.log(res);
}

async function voteingOwner() {

    let voting = new ethers.Contract(VOTING_ADDRESS, VOTING.abi, provider).connect(ownerWallet);
    let res = await voting.owner();
    console.log(res);
}

async function getDate() {

    const blockInfo = await provider.getBlock();
    let startDate = blockInfo.timestamp;
    let startDateJs = Math.floor(Date.now() / 1000 + 100);
    let endDate = Math.floor(Date.now() / 1000 + 2628000);

    console.log(startDate);
    console.log(startDateJs);
    console.log(endDate);
}

mint("100000000000000000000000000");
// isApproved('0x4555A429Df5Cc32efa46BCb1412a3CD7Bf14b381');
// isApproved('0xab23de8ae71682adb4b06c2f50048690fb47fae0');
// isApproved('0x929cac8ecf42b4814cc1f4b9e63a61e0a39d77b6');
// invest("50000000000000000000", "0x8f6b3719691459599b35e8a02f208ceb82077f8b9325a792f905dda067130ddf19d5652512e2a5b61e80e4e4d663562b8c00a4959cb9aad5e673b82af1bba4671c");


// getDate();
