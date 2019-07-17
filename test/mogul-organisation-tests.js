const etherlime = require('etherlime-lib');
const { buyCalc, sellCalc } = require('./utils/token-price-calculation');
const contractInitializator = require('./utils/contract-initializator');


describe('Mogul Organisation Contract', function() {

    this.timeout(20000);
    const OWNER = accounts[0].signer;
    const INVESTOR = accounts[1].signer;
    const REPAYER = accounts[2].signer;
    const MOGUL_BANK = accounts[9].signer.address;

    const INITIAL_MOGUL_SUPPLY = ethers.utils.bigNumberify("1000000000000000000");

    const ONE_ETH = ethers.utils.bigNumberify("1000000000000000000");
    const TWO_ETH = ethers.utils.bigNumberify("2000000000000000000");
    const normalization = ethers.utils.bigNumberify("1000000000000000000");

    const INVESTMENT_AMOUNT = ONE_ETH;
    const UNLOCK_AMOUNT = ONE_ETH;

    let mogulDAIInstance;
    let movieTokenInstance;
    let mogulTokenInstance;

    let mogulOrganisationInstance;

    function hashData(wallet, data) {
        const hashMsg = ethers.utils.solidityKeccak256(['address'], [data]);
        const hashData = ethers.utils.arrayify(hashMsg);
        return wallet.signMessage(hashData);
    }


    describe('Continuous Organisation Contract', function () {

        beforeEach(async () => {
            mogulDAIInstance = await contractInitializator.deployMglDai();
            movieTokenInstance = await contractInitializator.deployMovieToken();

            mogulOrganisationInstance = await contractInitializator.deployMogulOrganization(mogulDAIInstance, movieTokenInstance);

            mogulTokenInstance = await contractInitializator.getMogulToken(mogulOrganisationInstance, INVESTOR);

            // Mint and Approve 1 ETH in order to unlock the organization
            await contractInitializator.mintDAI(mogulDAIInstance, OWNER.address, ONE_ETH);
            await contractInitializator.approveDAI(mogulDAIInstance, OWNER, mogulOrganisationInstance.contractAddress, ONE_ETH);

            await contractInitializator.addMovieTokenMinter(movieTokenInstance, mogulOrganisationInstance.contractAddress);

            // await approveDAI(INVESTOR, mogulOrganisationInstance.contractAddress, INVESTMENT_AMOUNT);
            await contractInitializator.mintDAI(mogulDAIInstance, INVESTOR.address, ONE_ETH);
            await contractInitializator.approveDAI(mogulDAIInstance, INVESTOR, mogulOrganisationInstance.contractAddress, ONE_ETH);

        });

        describe('Unlocking', function () {

            it('Should unlock the organisation', async () => {
                let expectedBalance = "200000000000000000"; // 20% of one eth
                await mogulOrganisationInstance.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY);
                let organisationBalance = await mogulDAIInstance.balanceOf(mogulOrganisationInstance.contractAddress);
                let ownerMglBalance = await mogulTokenInstance.balanceOf(OWNER.address);
                assert(ownerMglBalance.eq(INITIAL_MOGUL_SUPPLY), 'Owner balance is incorrect after unlocking');
                assert(organisationBalance.eq(expectedBalance), 'Organisation balance is incorrect after unlocking');
            });

            it('Should throw on re-unlocking', async () => {
                await mogulOrganisationInstance.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY);
                await assert.revert(mogulOrganisationInstance.unlockOrganisation(ONE_ETH, INITIAL_MOGUL_SUPPLY), 'Re-unlocking of an organisation did not throw');
            });

            it('Should throw if an unlocker tries to unlock with unapproved DAI amount', async () => {
                await mogulOrganisationInstance.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY);
                await assert.revert(mogulOrganisationInstance.unlockOrganisation(TWO_ETH, INITIAL_MOGUL_SUPPLY), 'Organisation has been unlocked with unapproved DAI amount');
            });

            it('Should throw if one tries to invest in non-unlocked organisation', async () => {
                const signedData = hashData(OWNER, INVESTOR.address);

                await assert.revert(mogulOrganisationInstance.from(INVESTOR).invest(ONE_ETH, signedData), 'An investment has been processed for a non-unlocked organisation');
            });
        });

        describe('Investment', function () {
            beforeEach(async () => {
                const signedData = hashData(OWNER, INVESTOR.address);

                await mogulOrganisationInstance.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY);
                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);
            });

            it('should send correct dai amount to the mogul bank', async () => {
                const EXPECTED_BANK_BALANCE = '1600000000000000000'; // 1.6 ETH (0.8 from unlocking + 0.8 from investing)
                let bankBalance = await mogulDAIInstance.balanceOf(MOGUL_BANK);
                assert(bankBalance.eq(EXPECTED_BANK_BALANCE), 'Incorrect bank balance after investment');
            });

            it('should send correct dai amount to the reserve', async () => {

                const EXPECTED_RESERVE_BALANCE = '400000000000000000'; // 0.4 ETH (Unlocking + investment)
                let reserveBalance = await mogulDAIInstance.balanceOf(mogulOrganisationInstance.contractAddress);
                assert(reserveBalance.eq(EXPECTED_RESERVE_BALANCE), 'Incorrect reserve balance after investment');
            });

            it('should send correct amount mogul tokens to the investor', async () => {
                // normalization is because of 18 decimals of mogul token
                const EXPECTED_INVESTOR_MOGUL_BALANCE = (buyCalc(INITIAL_MOGUL_SUPPLY, UNLOCK_AMOUNT, INVESTMENT_AMOUNT) / normalization).toFixed(9);
                let investorMogulBalance = await mogulTokenInstance.balanceOf(INVESTOR.address);
                investorMogulBalance = (Number(investorMogulBalance.toString()) / normalization).toFixed(9);

                assert.strictEqual(investorMogulBalance, EXPECTED_INVESTOR_MOGUL_BALANCE, 'Incorrect investor mogul balance after investment');
            });

            it('should send correct amount movie tokens to the investor', async () => {
                // 1:10 = mogul:movie token
                let investorMogulBalance = await mogulTokenInstance.balanceOf(INVESTOR.address);
                let EXPECTED_INVESTOR_MOVIE_BALANCE = ((investorMogulBalance * 10) / normalization).toFixed(8);
                let investorMovieBalance = await movieTokenInstance.balanceOf(INVESTOR.address);
                investorMovieBalance = (Number(investorMovieBalance.toString()) / normalization).toFixed(8);

                assert.strictEqual(investorMovieBalance, EXPECTED_INVESTOR_MOVIE_BALANCE, 'Incorrect investor movie balance after investment');
            });

            it('Should receive correct invest amount', async () => {
                // EXPECTED_INVESTMENTS_AMOUNT = unlocking amount + investment amount
                const EXPECTED_INVESTMENTS_AMOUNT = '2000000000000000000'; // 2 ETH
                let totalDAIInvestments = await mogulOrganisationInstance.totalDAIInvestments();
                assert(totalDAIInvestments.eq(EXPECTED_INVESTMENTS_AMOUNT), 'Incorrect investments amount after investment');
            });

            it('Should throw if an investor tries to invest with unapproved DAI amount', async () => {
                let investorWithoutDAI = accounts[3].signer;

                const signedData = hashData(OWNER, investorWithoutDAI.address);

                await assert.revert(mogulOrganisationInstance.from(investorWithoutDAI).invest(ONE_ETH, signedData), 'An investment has been processed with unapproved DAI amount');
            });

        });

        describe('Whitelist validations', function () {

            it('Should change whiteLister', async () => {
                const newWhiteLister = accounts[5].signer.address;

                await mogulOrganisationInstance.setWhiteLister(newWhiteLister);
                const newWhiteListerFromContract = await mogulOrganisationInstance.whiteLister();

                assert.strictEqual(newWhiteListerFromContract, newWhiteLister, "WhiteLister is not changed correctly");
            });

            it('Should let new whitelister to whitelist user', async () => {
                const newWhiteLister = accounts[5].signer;
                await mogulOrganisationInstance.setWhiteLister(newWhiteLister.address);

                const signedData = hashData(newWhiteLister, INVESTOR.address);

                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);

                const isWhitelisted = await mogulOrganisationInstance.whiteList(INVESTOR.address);
                assert.ok(isWhitelisted);

            });

            it('Should not allow old admin to whitelist users', async () => {
                const newWhiteLister = accounts[5].signer;
                await mogulOrganisationInstance.setWhiteLister(newWhiteLister.address);

                const signedData = hashData(OWNER, INVESTOR.address);

                await assert.revert(mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData));

            });

            it('Should throw on trying to change whitelister not from owner', async () => {
                const newWhiteLister = accounts[5].signer.address;
                await assert.revert(mogulOrganisationInstance.from(INVESTOR).setWhiteLister(newWhiteLister), 'Changing whiteLister not from owner did not throw');
            });

            beforeEach(async () => {
                await mogulOrganisationInstance.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY);
            });

            it('Should let investor to invest and save him as whitelisted if approved from owner / whitelister', async () => {
                const signedData = hashData(OWNER, INVESTOR.address);

                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);

                const isWhitelisted = await mogulOrganisationInstance.whiteList(INVESTOR.address);
                assert.ok(isWhitelisted);
            });

            it('Should let whitelisted investor to invest', async () => {
                const signedData = hashData(OWNER, INVESTOR.address);

                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);

                const isWhitelisted = await mogulOrganisationInstance.whiteList(INVESTOR.address);
                assert.ok(isWhitelisted);

                await contractInitializator.mintDAI(mogulDAIInstance, INVESTOR.address, ONE_ETH);
                await contractInitializator.approveDAI(mogulDAIInstance, INVESTOR, mogulOrganisationInstance.contractAddress, ONE_ETH);

                const emptySignedData = "0x";
                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, emptySignedData);
            });

            it('Should revert if not whitelisted investor try to invest', async () => {
                const emptySignedData = "0x";

                await assert.revert(mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, emptySignedData));
            });

            it('Should revert if one try to invest with incorrect signature', async () => {
                const signedData = hashData(INVESTOR, INVESTOR.address);

                await assert.revert(mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData));
            });

        });

        describe('Revoke Investment', function () {

            beforeEach(async () => {
                const signedData = hashData(OWNER, INVESTOR.address);

                await mogulOrganisationInstance.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY);
                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);
            });

            it('Should sell MGL Tokens for ~ 80% less of their buying price', async () => {
                let mglTokens = await mogulTokenInstance.balanceOf(INVESTOR.address);

                let organisationMogulBalance = await mogulTokenInstance.totalSupply();
                let reserveBalance = await mogulDAIInstance.balanceOf(mogulOrganisationInstance.contractAddress);

                let expectedDai = sellCalc(organisationMogulBalance, reserveBalance, mglTokens);

                await mogulTokenInstance.approve(mogulOrganisationInstance.contractAddress, mglTokens);
                await mogulOrganisationInstance.from(INVESTOR).revokeInvestment(mglTokens);


                let daiBalance = await mogulDAIInstance.balanceOf(INVESTOR.address);

                let normalizedDAIBalance = (daiBalance / normalization).toFixed(6);
                let expectedBalance = (expectedDai / normalization).toFixed(6);

                assert.strictEqual(normalizedDAIBalance, expectedBalance);
            });

            it('Should sell MGL Tokens on profit after some investments', async () => {
                let mglTokens = await mogulTokenInstance.balanceOf(INVESTOR.address);

                let randomInvestment = "40000000000000000000";
                await contractInitializator.mintDAI(mogulDAIInstance, OWNER.address, randomInvestment);
                await mogulDAIInstance.from(OWNER).approve(mogulOrganisationInstance.contractAddress, randomInvestment);

                const signedData = hashData(OWNER, OWNER.address);

                await mogulOrganisationInstance.from(OWNER).invest(randomInvestment, signedData);

                await mogulTokenInstance.approve(mogulOrganisationInstance.contractAddress, mglTokens);
                await mogulOrganisationInstance.from(INVESTOR).revokeInvestment(mglTokens);

                let daiBalance = await mogulDAIInstance.balanceOf(INVESTOR.address);

                let normDaiBalance = (daiBalance / normalization).toFixed(6);

                assert(1 <= normDaiBalance, "tokens are not sold on profit");
            });

            it('Should revert if one tries to sell unapproved tokens', async () => {
                let tokens = "414213562299999999";
                await assert.revert(mogulOrganisationInstance.from(INVESTOR).revokeInvestment(tokens));

            });

            it("Should revert if one tries to sell tokens that he doesn't have", async () => {
                let tokens = "414213562299999999";
                await assert.revert(mogulOrganisationInstance.from(OWNER).revokeInvestment(tokens));
            });
        });

        describe('Paying dividends', function () {

            beforeEach(async () => {
                const signedData = hashData(OWNER, INVESTOR.address);

                await mogulOrganisationInstance.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY);
                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);

                await contractInitializator.mintDAI(mogulDAIInstance, REPAYER.address, ONE_ETH);
                await contractInitializator.approveDAI(mogulDAIInstance, REPAYER.address, mogulOrganisationInstance.contractAddress, ONE_ETH);
            });

            it('Should lower COToken returned on investment after paying dividents', async () => {

                const coTokensPerInvestmentBefore = await mogulOrganisationInstance.calcRelevantMGLForDAI(INVESTMENT_AMOUNT);

                await mogulOrganisationInstance.from(REPAYER).payDividends(ONE_ETH);

                const coTokensPerInvestmentAfter = await mogulOrganisationInstance.calcRelevantMGLForDAI(INVESTMENT_AMOUNT);

                assert(coTokensPerInvestmentAfter.lt(coTokensPerInvestmentBefore), "The tokens received after dividents repayment were not less than before")

            });

            it('Should receive more DAI on COToken exit after paying dividents', async () => {

                let coTokens = await mogulTokenInstance.balanceOf(INVESTOR.address);

                const DAIReturnedForInvestmentBefore = await mogulOrganisationInstance.calcRelevantDAIForMGL(coTokens);

                await mogulOrganisationInstance.from(REPAYER).payDividends(ONE_ETH);

                await mogulTokenInstance.approve(mogulOrganisationInstance.contractAddress, coTokens);
                await mogulOrganisationInstance.from(INVESTOR).calcRelevantDAIForMGL(coTokens);

                const DAIReturnedForInvestmentAfter = await mogulOrganisationInstance.calcRelevantDAIForMGL(coTokens);

                assert(DAIReturnedForInvestmentAfter.gt(DAIReturnedForInvestmentBefore), "The DAI received after exit was not more than before dividents payout")

            });

            it('Should revert if one tries to repay with unapproved DAI', async () => {
                await contractInitializator.mintDAI(mogulDAIInstance, REPAYER.address, ONE_ETH);
                await assert.revert(mogulOrganisationInstance.from(REPAYER).payDividends(TWO_ETH));

            });

            it("Should revert if one tries to repay DAI that he doesn't have", async () => {
                await assert.revert(mogulOrganisationInstance.from(REPAYER).payDividends(TWO_ETH));
            });
        })
    });
});
