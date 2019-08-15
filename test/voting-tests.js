const etherlime = require('etherlime-lib');
const calculationHelper = require('./utils/token-price-calculation');

const ContractInitializator = require('./utils/contract-initializator');

describe('Voting Contract', function () {

    this.timeout(20000);

    const provider = new ethers.providers.JsonRpcProvider();

    const sevenDays = 604800;
    const oneDay = 86400;

    const OWNER = accounts[0].signer;
    const INVESTOR = accounts[9].signer;


    const ONE_DAI = ethers.utils.bigNumberify("1000000000000000000");
    const MILLION_DAI = ONE_DAI.mul("1000000");

    const SPONSORSHIP_RECEIVER_1 = accounts[2].signer;
    const SPONSORSHIP_RECEIVER_2 = accounts[3].signer;
    const SPONSORSHIP_RECEIVER_3 = accounts[4].signer;
    const SPONSORSHIP_RECEIVER_4 = accounts[5].signer;
    const SPONSORSHIP_RECEIVER_5 = accounts[6].signer;

    const today = new Date();

    const MOVIE_NAMES = [
        '0x4d6f766965310000000000000000000000000000000000000000000000000000',
        '0x4d6f766965320000000000000000000000000000000000000000000000000000',
        '0x4d6f766965330000000000000000000000000000000000000000000000000000',
        '0x4d6f766965340000000000000000000000000000000000000000000000000000',
        '0x4d6f766965350000000000000000000000000000000000000000000000000000'
    ];

    const MOVIE_DESCRIPTION = [
        '0x4d6f766965310000000000000000000000000000000000000000000000000000',
        '0x4d6f766965320000000000000000000000000000000000000000000000000000',
        '0x4d6f766965330000000000000000000000000000000000000000000000000000',
        '0x4d6f766965340000000000000000000000000000000000000000000000000000',
        '0x4d6f766965350000000000000000000000000000000000000000000000000000'
    ];

    const MOVIE_SPONSORSHIP_RECEIVER = [
        SPONSORSHIP_RECEIVER_1.address,
        SPONSORSHIP_RECEIVER_2.address,
        SPONSORSHIP_RECEIVER_3.address,
        SPONSORSHIP_RECEIVER_4.address,
        SPONSORSHIP_RECEIVER_5.address
    ];

    const MOVIE_REQUESTED_AMOUNT = [
        MILLION_DAI,
        MILLION_DAI.mul('2'),
        MILLION_DAI.mul('3'),
        MILLION_DAI.mul('4'),
        MILLION_DAI.mul('5')
    ];

    const ONE_ETH = ethers.utils.bigNumberify("1000000000000000000");
    const INVESTMENT_AMOUNT = ONE_ETH.mul(100000);
    const UNLOCK_AMOUNT = ONE_ETH.mul(2500000);
    const INITIAL_MOGUL_SUPPLY = ONE_ETH.mul(5000000);

    let votingContract;
    let mogulTokenContract;

    let mogulDAIInstance;
    let mogulOrganisationInstance;
    let mogulTokenInstance;

    let startDate;
    let endDate;

    function hashData(wallet, data) {
        const hashMsg = ethers.utils.solidityKeccak256(['address'], [data]);
        const hashData = ethers.utils.arrayify(hashMsg);
        return wallet.signMessage(hashData);
    }

    const signedData = hashData(OWNER, INVESTOR.address);

    describe('Initialization', function () {

        beforeEach(async () => {
            mogulTokenContract = await ContractInitializator.deployMogulToken();
            mogulDAIInstance = await ContractInitializator.deployMglDai();

            votingContract = await ContractInitializator.getVotingContract(mogulTokenContract.contractAddress, mogulDAIInstance.contractAddress);
        });

        it('Should initialize the contract correctly', async () => {
            let owner = await votingContract.owner();
            let _mogulTokenInstance = await votingContract.mogulTokenInstance();

            assert.strictEqual(owner, OWNER.address);
            assert.strictEqual(_mogulTokenInstance, mogulTokenContract.contractAddress);

        });

    });

    describe('Proposing', function () {

        beforeEach(async () => {
            mogulTokenContract = await ContractInitializator.deployMogulToken();
            mogulDAIInstance = await ContractInitializator.deployMglDai();

            votingContract = await ContractInitializator.getVotingContract(mogulTokenContract.contractAddress, mogulDAIInstance.contractAddress);
            await mogulDAIInstance.mint(OWNER.address, MILLION_DAI.mul('5'));
            await mogulDAIInstance.approve(votingContract.contractAddress, MILLION_DAI.mul('5'));

            const blockInfo = await provider.getBlock();
            startDate = blockInfo.timestamp + oneDay;
            endDate = startDate + sevenDays;

        });

        it('Should make a proposal correctly', async () => {
            await votingContract.createProposal(MOVIE_NAMES, MOVIE_DESCRIPTION, MOVIE_SPONSORSHIP_RECEIVER, MOVIE_REQUESTED_AMOUNT, startDate, endDate,{
                gasLimit: 2700000
            });

            let lastVotingDate = await votingContract.lastVotingDate();
            assert(lastVotingDate.eq(endDate));

            let roundInfo = await votingContract.getRoundInfo(0);

            assert(roundInfo[0].eq(startDate));
            assert(roundInfo[1].eq(endDate));
            assert.strictEqual(roundInfo[2], MOVIE_NAMES.length);

            for (let i = 0; i < roundInfo[2]; i++) {
                let proposalInfo = await votingContract.getProposalInfo(0, i);
                assert.strictEqual(proposalInfo[0], MOVIE_NAMES[i]);
                assert.strictEqual(proposalInfo[1], MOVIE_DESCRIPTION[i]);
                assert.strictEqual(proposalInfo[3], MOVIE_SPONSORSHIP_RECEIVER[i]);
                assert(proposalInfo[4].eq(MOVIE_REQUESTED_AMOUNT[i]));
            }
        });

        it('Should revert if start date is after end date', async () => {
            await assert.revert(votingContract.createProposal(MOVIE_NAMES, MOVIE_DESCRIPTION, MOVIE_SPONSORSHIP_RECEIVER, MOVIE_REQUESTED_AMOUNT, endDate, startDate, {
                gasLimit: 2700000
            }));
        });

        it('Should revert if start date is in the past', async () => {
            let dateInPast = endDate = Math.floor(today.setDate(today.getDate() - 30) / 1000);
            await assert.revert(votingContract.createProposal(MOVIE_NAMES, MOVIE_DESCRIPTION, MOVIE_SPONSORSHIP_RECEIVER, MOVIE_REQUESTED_AMOUNT, dateInPast, endDate, {
                gasLimit: 2700000
            }));
        });

        it('Should revert if start date is before last voting date', async () => {
            await votingContract.createProposal(MOVIE_NAMES, MOVIE_DESCRIPTION, MOVIE_SPONSORSHIP_RECEIVER, MOVIE_REQUESTED_AMOUNT, startDate, endDate, {
                gasLimit: 2700000
            });
            let dateDuringVotingPeriod = endDate = Math.floor(today.setDate(today.getDate() + 15) / 1000);
            await assert.revert(votingContract.createProposal(MOVIE_NAMES, MOVIE_DESCRIPTION, MOVIE_SPONSORSHIP_RECEIVER, MOVIE_REQUESTED_AMOUNT, dateDuringVotingPeriod, endDate, {
                gasLimit: 2700000
            }));
        });

        it('Should revert if movie names are less than other properties', async () => {

            const LESS_MOVIE_NAMES = [
                '0x4d6f766965320000000000000000000000000000000000000000000000000000',
                '0x4d6f766965330000000000000000000000000000000000000000000000000000',
                '0x4d6f766965340000000000000000000000000000000000000000000000000000',
                '0x4d6f766965350000000000000000000000000000000000000000000000000000'
            ];
            await assert.revert(votingContract.createProposal(LESS_MOVIE_NAMES, MOVIE_DESCRIPTION, MOVIE_SPONSORSHIP_RECEIVER, MOVIE_REQUESTED_AMOUNT, startDate, endDate, {
                gasLimit: 2700000
            }));
        });

        it('Should revert if movie descriptions are less or more than other properties', async () => {

            const LESS_MOVIE_DESCRIPTION = [
                '0x4d6f766965320000000000000000000000000000000000000000000000000000',
                '0x4d6f766965330000000000000000000000000000000000000000000000000000',
                '0x4d6f766965340000000000000000000000000000000000000000000000000000',
                '0x4d6f766965350000000000000000000000000000000000000000000000000000'
            ];
            await assert.revert(votingContract.createProposal(MOVIE_NAMES, LESS_MOVIE_DESCRIPTION, MOVIE_SPONSORSHIP_RECEIVER, MOVIE_REQUESTED_AMOUNT, startDate, endDate, {
                gasLimit: 2700000
            }));
        });

        it('Should revert if sponsorship receivers are less or more than other properties', async () => {

            const MORE_MOVIE_SPONSORSHIP_RECEIVER = [
                SPONSORSHIP_RECEIVER_1.address,
                SPONSORSHIP_RECEIVER_2.address,
                SPONSORSHIP_RECEIVER_3.address,
                SPONSORSHIP_RECEIVER_4.address,
                SPONSORSHIP_RECEIVER_5.address,
                accounts[6].signer.address,
            ];

            await assert.revert(votingContract.createProposal(MOVIE_NAMES, MOVIE_DESCRIPTION, MORE_MOVIE_SPONSORSHIP_RECEIVER, MOVIE_REQUESTED_AMOUNT, startDate, endDate, {
                gasLimit: 2700000
            }));
        });

        it('Should revert if movie descriptions are less or more than other properties', async () => {

            const MORE_MOVIE_REQUESTED_AMOUNT = [
                MILLION_DAI,
                MILLION_DAI.mul('2'),
                MILLION_DAI.mul('3'),
                MILLION_DAI.mul('4'),
                MILLION_DAI.mul('5'),
                MILLION_DAI.mul('6')
            ];
            await assert.revert(votingContract.createProposal(MOVIE_NAMES, MOVIE_DESCRIPTION, MOVIE_SPONSORSHIP_RECEIVER, MORE_MOVIE_REQUESTED_AMOUNT, startDate, endDate, {
                gasLimit: 2700000
            }));
        });

    });

    describe('Voting', function () {

        beforeEach(async () => {

            mogulDAIInstance = await ContractInitializator.deployMglDai();
            mogulOrganisationInstance = await ContractInitializator.deployMogulOrganization(mogulDAIInstance);
            mogulTokenInstance = await ContractInitializator.getMogulToken(mogulOrganisationInstance, OWNER);

            await ContractInitializator.mintDAI(mogulDAIInstance, OWNER.address, UNLOCK_AMOUNT);
            await ContractInitializator.approveDAI(mogulDAIInstance, OWNER, mogulOrganisationInstance.contractAddress, UNLOCK_AMOUNT);


            await ContractInitializator.mintDAI(mogulDAIInstance, INVESTOR.address, INVESTMENT_AMOUNT);
            await ContractInitializator.approveDAI(mogulDAIInstance, INVESTOR, mogulOrganisationInstance.contractAddress, INVESTMENT_AMOUNT);

            await mogulOrganisationInstance.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY, {
                gasLimit: 2000000
            });

            await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);

            votingContract = await ContractInitializator.getVotingContract(mogulTokenInstance.address, mogulDAIInstance.contractAddress);

            const blockInfo = await provider.getBlock();
            startDate = blockInfo.timestamp + oneDay;
            endDate = startDate + sevenDays;

            await mogulDAIInstance.mint(OWNER.address, MILLION_DAI.mul('5'));
            await mogulDAIInstance.approve(votingContract.contractAddress, MILLION_DAI.mul('5'));

            await votingContract.createProposal(MOVIE_NAMES, MOVIE_DESCRIPTION, MOVIE_SPONSORSHIP_RECEIVER, MOVIE_REQUESTED_AMOUNT, startDate, endDate, {
                gasLimit: 2700000
            });

            await utils.setTimeTo(provider, startDate);
        });

        it('Should vote correctly', async () => {

            await votingContract.from(INVESTOR).vote(0);

            let voteInfo = await votingContract.getVoteInfo(0, INVESTOR.address);

            //we are expecting movie index of 1 because we are giving the 0 index to empty votes
            let expectedMovie = 1;
            assert.strictEqual(voteInfo, expectedMovie, "the vote is not given to the first movie");

            let proposalInfo = await votingContract.getProposalInfo(0, 0);

            let investorMogulTokens = await mogulTokenInstance.balanceOf(INVESTOR.address);
            let expectedRating = calculationHelper.sqrtTokens(investorMogulTokens.mul(10));

            assert.strictEqual(proposalInfo[2].toString().substring(0, 10), expectedRating.toString());
        });

        it('Should allow voter to vote again for the same movie and recalculate his vote weight correctly', async () => {

            await votingContract.from(INVESTOR).vote(0);

            await ContractInitializator.mintDAI(mogulDAIInstance, INVESTOR.address, INVESTMENT_AMOUNT);
            await ContractInitializator.approveDAI(mogulDAIInstance, INVESTOR, mogulOrganisationInstance.contractAddress, INVESTMENT_AMOUNT);

            await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData, {
                gasLimit: 2700000
            });

            await votingContract.from(INVESTOR).vote(0);

            let voteInfo = await votingContract.getVoteInfo(0, INVESTOR.address);

            //we are expecting movie index of 1 because we are giving the 0 index to empty votes
            let expectedMovie = 1;
            assert.strictEqual(voteInfo, expectedMovie, "the vote is not given to the first movie");

            let proposalInfo = await votingContract.getProposalInfo(0, 0);

            let investorMogulTokens = await mogulTokenInstance.balanceOf(INVESTOR.address);
            let expectedRating = calculationHelper.sqrtTokens(investorMogulTokens.mul(10));

            assert.strictEqual(proposalInfo[2].toString().substring(0, 10), expectedRating.toString());
        });

        it('Should revert if one tries to change his vote', async () => {
            await votingContract.from(INVESTOR).vote(0);
            await assert.revert(votingContract.from(INVESTOR).vote(2));
        });

        it('Should revert if one tries to vote outside voting period', async () => {
            await utils.setTimeTo(provider, endDate + 1);
            await assert.revert(votingContract.from(INVESTOR).vote(1));
        });

        it('Should revert if one tries to vote to non-existing movie id', async () => {
            await assert.revert(votingContract.from(INVESTOR).vote(5));
        });

    });

    describe('Finalizing', function () {

        beforeEach(async () => {

            mogulDAIInstance = await ContractInitializator.deployMglDai();
            mogulOrganisationInstance = await ContractInitializator.deployMogulOrganization(mogulDAIInstance);
            mogulTokenInstance = await ContractInitializator.getMogulToken(mogulOrganisationInstance, OWNER);

            await ContractInitializator.mintDAI(mogulDAIInstance, OWNER.address, UNLOCK_AMOUNT);
            await ContractInitializator.approveDAI(mogulDAIInstance, OWNER, mogulOrganisationInstance.contractAddress, UNLOCK_AMOUNT);

            await ContractInitializator.mintDAI(mogulDAIInstance, INVESTOR.address, INVESTMENT_AMOUNT);
            await ContractInitializator.approveDAI(mogulDAIInstance, INVESTOR, mogulOrganisationInstance.contractAddress, INVESTMENT_AMOUNT);

            await mogulOrganisationInstance.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY, {
                gasLimit: 2000000
            });

            await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);

            votingContract = await ContractInitializator.getVotingContract(mogulTokenInstance.address, mogulDAIInstance.contractAddress);

            const blockInfo = await provider.getBlock();
            startDate = blockInfo.timestamp + oneDay;
            endDate = startDate + sevenDays;

            await mogulDAIInstance.mint(OWNER.address, MILLION_DAI.mul('5'));
            await mogulDAIInstance.approve(votingContract.contractAddress, MILLION_DAI.mul('5'));

            await votingContract.createProposal(MOVIE_NAMES, MOVIE_DESCRIPTION, MOVIE_SPONSORSHIP_RECEIVER, MOVIE_REQUESTED_AMOUNT, startDate, endDate, {
                gasLimit: 2700000
            });

            await utils.setTimeTo(provider, startDate);

            await votingContract.from(INVESTOR).vote(0);
        });

        it('Should finalize correctly', async () => {
            let winnerMovieSponsorship = MILLION_DAI;
            let largestMovieSponsorship = MILLION_DAI.mul(5);
            let sponsorshipReceiverBefore = await mogulDAIInstance.balanceOf(SPONSORSHIP_RECEIVER_1.address);

            await utils.setTimeTo(provider, endDate + 1);
            await votingContract.finalizeRound();
            let roundInfo = await votingContract.getRoundInfo(0);

            assert.ok(roundInfo[3]);

            let sponsorshipReceiverAfter = await mogulDAIInstance.balanceOf(SPONSORSHIP_RECEIVER_1.address);
            let ownerBalanceAfter = await mogulDAIInstance.balanceOf(OWNER.address);

            assert(sponsorshipReceiverAfter.eq(sponsorshipReceiverBefore.add(winnerMovieSponsorship)));
            assert(ownerBalanceAfter.eq(largestMovieSponsorship.sub(winnerMovieSponsorship)));

            let currentRound = await votingContract.currentRoundIndex();
            assert(currentRound.eq(1));

        });

        it('Should not allow to finalize finalized round', async () => {
            await utils.setTimeTo(provider, endDate + 1);
            await votingContract.finalizeRound();
            await assert.revert(votingContract.finalizeRound());

        });

        it('Should not allow to finalize round within voting period', async () => {
            await assert.revert(votingContract.finalizeRound());
        });

    });

});
