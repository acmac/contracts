const etherlime = require('etherlime-lib');
const { buyCalc, sellCalc } = require('./utils/token-price-calculation');
const contractInitializator = require('./utils/contract-initializator');
const ethers = require('ethers');


describe('Mogul Organisation Contract', function () {

    this.timeout(20000);
    const OWNER = accounts[0].signer;
    const INVESTOR = accounts[1].signer;
    const REPAYER = accounts[2].signer;
    const MOGUL_BANK = accounts[9].signer.address;

    const DIVIDEND_RATIO = 20;

    const ONE_ETH = ethers.utils.bigNumberify("1000000000000000000");
    const normalization = ethers.utils.bigNumberify("1000000000000000000");

    const INVESTMENT_AMOUNT = ONE_ETH.mul(100000);
    const UNLOCK_AMOUNT = ONE_ETH.mul(2500000);
    const DOUBLE_AMOUNT = UNLOCK_AMOUNT.mul(2);

    const INITIAL_MOGUL_SUPPLY = ONE_ETH.mul(5000000);

    let mogulDAIInstance;
    let mogulTokenInstance;

    let mogulOrganisationInstance;

    function hashData(wallet, data) {
        const hashMsg = ethers.utils.solidityKeccak256(['address'], [data]);
        const hashData = ethers.utils.arrayify(hashMsg);
        return wallet.signMessage(hashData);
    }

    function toHumanReadableValue(wei) {

        return wei.toString().match(/^-?\d+(?:\.\d{0,4})?/)[0]
    }


    describe('Continuous Organisation Contract', function () {

        beforeEach(async () => {
            mogulDAIInstance = await contractInitializator.deployMglDai();

            mogulOrganisationInstance = await contractInitializator.deployMogulOrganization(mogulDAIInstance);

            mogulTokenInstance = await contractInitializator.getMogulToken(mogulOrganisationInstance, OWNER);

            // Mint and Approve 1 ETH in order to unlock the organization
            await contractInitializator.mintDAI(mogulDAIInstance, OWNER.address, UNLOCK_AMOUNT);
            await contractInitializator.approveDAI(mogulDAIInstance, OWNER, mogulOrganisationInstance.contractAddress, UNLOCK_AMOUNT);


            // await approveDAI(INVESTOR, mogulOrganisationInstance.contractAddress, INVESTMENT_AMOUNT);
            await contractInitializator.mintDAI(mogulDAIInstance, INVESTOR.address, INVESTMENT_AMOUNT);
            await contractInitializator.approveDAI(mogulDAIInstance, INVESTOR, mogulOrganisationInstance.contractAddress, INVESTMENT_AMOUNT);

        });

        describe('Movement Notifier', function () {

            it('should return MovementNotifier implementation count', async () => {
                let movementNotifiersCount = await mogulTokenInstance.getMovementNotifiersCount();
                assert.strictEqual(movementNotifiersCount.toString(), "2")
            });

            it('should add MovementNotifier implementation address', async () => {
                let newNotifierImpl = accounts[8].signer;

                await mogulTokenInstance.addMovementNotifier(newNotifierImpl.address);

                let movementNotifiersCount = await mogulTokenInstance.getMovementNotifiersCount();
                let lastAddedAddress = await mogulTokenInstance.movementNotifiers(movementNotifiersCount - 1);
                assert.strictEqual(lastAddedAddress, newNotifierImpl.address)
            });

            it('should NOT add MovementNotifier implementation address if not from owner', async () => {
                mogulTokenInstance = await contractInitializator.getMogulToken(mogulOrganisationInstance, INVESTOR);
                let newNotifierImpl = accounts[8].signer;

                await assert.revert(mogulTokenInstance.addMovementNotifier(newNotifierImpl.address));
            });

            it('should remove from MovementNotifier implementation array', async () => {
                let movementNotifiersCount = await mogulTokenInstance.getMovementNotifiersCount();
                await mogulTokenInstance.removeMovementNotifier(movementNotifiersCount -1);

                let movementNotifiersCountAfter = await mogulTokenInstance.getMovementNotifiersCount();
                assert.strictEqual(movementNotifiersCountAfter.toString(), (movementNotifiersCount - 1).toString())
            });

            it('should NOT remove from MovementNotifier implementation array if not from owner', async () => {
                mogulTokenInstance = await contractInitializator.getMogulToken(mogulOrganisationInstance, INVESTOR);

                let movementNotifiersCount = await mogulTokenInstance.getMovementNotifiersCount();
                await assert.revert(mogulTokenInstance.removeMovementNotifier(movementNotifiersCount -1));
            });

        });

        describe('Unlocking', function () {

            it('Should unlock the organisation', async () => {
                let expectedBalance = UNLOCK_AMOUNT.div(5); // 20%
                await mogulOrganisationInstance.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY, {
                    gasLimit: 2000000
                });
                let organisationBalance = await mogulDAIInstance.balanceOf(mogulOrganisationInstance.contractAddress);
                let ownerMglBalance = await mogulTokenInstance.balanceOf(OWNER.address);
                assert(ownerMglBalance.eq(INITIAL_MOGUL_SUPPLY), 'Owner balance is incorrect after unlocking');
                assert(organisationBalance.eq(expectedBalance), 'Organisation balance is incorrect after unlocking');
            });

            it('Should throw on re-unlocking', async () => {
                await mogulOrganisationInstance.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY, {
                    gasLimit: 2000000
                });
                await assert.revert(mogulOrganisationInstance.unlockOrganisation(ONE_ETH, INITIAL_MOGUL_SUPPLY), 'Re-unlocking of an organisation did not throw');
            });

            it('Should throw if an unlocker tries to unlock with unapproved DAI amount', async () => {
                await mogulOrganisationInstance.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY, {
                    gasLimit: 2000000
                });
                await assert.revert(mogulOrganisationInstance.unlockOrganisation(DOUBLE_AMOUNT, INITIAL_MOGUL_SUPPLY), 'Organisation has been unlocked with unapproved DAI amount');
            });

            it('Should throw if one tries to invest in non-unlocked organisation', async () => {
                const signedData = hashData(OWNER, INVESTOR.address);

                await assert.revert(mogulOrganisationInstance.from(INVESTOR).invest(ONE_ETH, signedData), 'An investment has been processed for a non-unlocked organisation');
            });
        });

        describe('Investment', function () {
            let signedData;
            beforeEach(async () => {
                signedData = hashData(OWNER, INVESTOR.address);

                await mogulOrganisationInstance.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY, {
                    gasLimit: 2000000
                });

            });

            it('should calculate investment correctly', async () => {
                const amount = await mogulOrganisationInstance.from(INVESTOR).calcRelevantMGLForDAI(INVESTMENT_AMOUNT)
                const EXPECTED_INVESTOR_MOGUL_BALANCE = buyCalc(INITIAL_MOGUL_SUPPLY, INITIAL_MOGUL_SUPPLY, INVESTMENT_AMOUNT);
                assert.strictEqual(toHumanReadableValue(ethers.utils.formatEther(amount)), toHumanReadableValue(Number(EXPECTED_INVESTOR_MOGUL_BALANCE / normalization).toFixed(10)))
            });

            it('should send correct dai amount to the mogul bank', async () => {
                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);
                const EXPECTED_BANK_BALANCE = UNLOCK_AMOUNT.add(INVESTMENT_AMOUNT).div(5).mul(4); // 80%
                let bankBalance = await mogulDAIInstance.balanceOf(MOGUL_BANK);
                assert(bankBalance.eq(EXPECTED_BANK_BALANCE), 'Incorrect bank balance after investment');
            });

            it('should send correct dai amount to the reserve', async () => {
                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);
                const EXPECTED_RESERVE_BALANCE = UNLOCK_AMOUNT.add(INVESTMENT_AMOUNT).div(5); // 0.4 ETH (Unlocking + investment)
                let reserveBalance = await mogulDAIInstance.balanceOf(mogulOrganisationInstance.contractAddress);
                assert(reserveBalance.eq(EXPECTED_RESERVE_BALANCE), 'Incorrect reserve balance after investment');
            });

            it('should send correct amount mogul tokens to the investor', async () => {
                // normalization is because of 18 decimals of mogul token
                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);
                const EXPECTED_INVESTOR_MOGUL_BALANCE = (buyCalc(INITIAL_MOGUL_SUPPLY, INITIAL_MOGUL_SUPPLY, INVESTMENT_AMOUNT) / normalization).toFixed(9);
                let investorMogulBalance = await mogulTokenInstance.balanceOf(INVESTOR.address);
                investorMogulBalance = (Number(investorMogulBalance.toString()) / normalization).toFixed(9);

                assert.strictEqual(investorMogulBalance, EXPECTED_INVESTOR_MOGUL_BALANCE, 'Incorrect investor mogul balance after investment');
            });

            it('Should receive correct invest amount', async () => {
                // EXPECTED_INVESTMENTS_AMOUNT = unlocking amount + investment amount
                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);
                const EXPECTED_INVESTMENTS_AMOUNT = UNLOCK_AMOUNT.add(INVESTMENT_AMOUNT); // 2 ETH
                let totalDAIInvestments = await mogulOrganisationInstance.totalDAIInvestments();
                assert(totalDAIInvestments.eq(EXPECTED_INVESTMENTS_AMOUNT), 'Incorrect investments amount after investment');
            });

            it('Should throw if an investor tries to invest with unapproved DAI amount', async () => {
                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);
                let investorWithoutDAI = accounts[3].signer;

                const signedData2 = hashData(OWNER, investorWithoutDAI.address);

                await assert.revert(mogulOrganisationInstance.from(investorWithoutDAI).invest(ONE_ETH, signedData2), 'An investment has been processed with unapproved DAI amount');
            });

        });

        describe('Whitelist validations', function () {

            beforeEach(async () => {
                await mogulOrganisationInstance.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY, {
                    gasLimit: 2000000
                });
            });

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

                await contractInitializator.mintDAI(mogulDAIInstance, INVESTOR.address, INVESTMENT_AMOUNT);
                await contractInitializator.approveDAI(mogulDAIInstance, INVESTOR, mogulOrganisationInstance.contractAddress, INVESTMENT_AMOUNT);

                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, ethers.constants.AddressZero);
            });

            it('Should let whitelister to manual whitelist user', async () => {
                const newWhiteListed = accounts[5].signer;
                await mogulOrganisationInstance.from(OWNER).setWhitelisted(newWhiteListed.address, true);

                const isWhitelisted = await mogulOrganisationInstance.whiteList(newWhiteListed.address);
                assert.ok(isWhitelisted);
            });

            it('Should let whitelister to remove whitelist user', async () => {
                const signedData = hashData(OWNER, INVESTOR.address);

                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);
                await mogulOrganisationInstance.from(OWNER).setWhitelisted(INVESTOR.address, false);

                const isWhitelisted = await mogulOrganisationInstance.whiteList(INVESTOR.address);
                assert.ok(!isWhitelisted);
            });

            it.only('Should let one to transfer MGL tokens to whitelisted user', async () => {
                const signedData = hashData(OWNER, INVESTOR.address);
                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);

                await mogulTokenInstance.approve(INVESTOR.address, ONE_ETH);
                await mogulTokenInstance.transfer(INVESTOR.address, ONE_ETH);
            });

            it('Should revert if one tries to transfer MGL tokens to non whitelisted useer', async () => {
                const signedData = hashData(OWNER, INVESTOR.address);
                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);

                await mogulTokenInstance.approve(INVESTOR.address, ONE_ETH);
                await mogulOrganisationInstance.from(OWNER).setWhitelisted(INVESTOR.address, false);
                await assert.revert(mogulTokenInstance.transfer(INVESTOR.address, ONE_ETH));
            });

            it('Should revert if not whitelister tries to manage manually whitelisted', async () => {
                await assert.revert(mogulOrganisationInstance.from(INVESTOR).setWhitelisted(INVESTOR.address, true));
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
                mogulTokenInstance = await contractInitializator.getMogulToken(mogulOrganisationInstance, INVESTOR);
                const signedData = hashData(OWNER, INVESTOR.address);

                await mogulOrganisationInstance.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY, {
                    gasLimit: 2000000
                });
                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);
            });

            it('Should sell MGL Tokens for ~ 80% less of their buying price', async () => {
                let mglTokens = await mogulTokenInstance.balanceOf(INVESTOR.address);

                let organisationMogulBalance = await mogulTokenInstance.totalSupply();
                let reserveBalance = await mogulDAIInstance.balanceOf(mogulOrganisationInstance.contractAddress);

                let expectedDai = sellCalc(organisationMogulBalance, reserveBalance, mglTokens);

                await mogulTokenInstance.approve(mogulOrganisationInstance.contractAddress, mglTokens);
                await mogulOrganisationInstance.from(INVESTOR).revokeInvestment(mglTokens, {
                    gasLimit: 250000
                });


                let daiBalance = await mogulDAIInstance.balanceOf(INVESTOR.address);

                let normalizedDAIBalance = (daiBalance / normalization).toFixed(6);
                let expectedBalance = (expectedDai / normalization).toFixed(6);

                assert.strictEqual(toHumanReadableValue(normalizedDAIBalance), toHumanReadableValue(expectedBalance));
            });

            it('Should sell MGL Tokens on profit after some investments', async () => {
                let mglTokens = await mogulTokenInstance.balanceOf(INVESTOR.address);

                let randomInvestment = "40000000000000000000";
                await contractInitializator.mintDAI(mogulDAIInstance, OWNER.address, randomInvestment);
                await mogulDAIInstance.from(OWNER).approve(mogulOrganisationInstance.contractAddress, randomInvestment);

                const signedData = hashData(OWNER, OWNER.address);

                await mogulOrganisationInstance.from(OWNER).invest(randomInvestment, signedData);

                await mogulTokenInstance.approve(mogulOrganisationInstance.contractAddress, mglTokens);
                await mogulOrganisationInstance.from(INVESTOR).revokeInvestment(mglTokens, {
                    gasLimit: 250000
                });

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

                await mogulOrganisationInstance.unlockOrganisation(UNLOCK_AMOUNT, INITIAL_MOGUL_SUPPLY, {
                    gasLimit: 2000000
                });
                await mogulOrganisationInstance.from(INVESTOR).invest(INVESTMENT_AMOUNT, signedData);

                await contractInitializator.mintDAI(mogulDAIInstance, REPAYER.address, ONE_ETH);
                await contractInitializator.approveDAI(mogulDAIInstance, REPAYER.address, mogulOrganisationInstance.contractAddress, ONE_ETH);
            });

            it('Should lower COToken returned on investment after paying dividends', async () => {

                let mglTokens = await mogulTokenInstance.balanceOf(INVESTOR.address);

                const coTokensPerInvestmentBefore = await mogulOrganisationInstance.calcRelevantDAIForMGL(mglTokens);

                await mogulOrganisationInstance.from(REPAYER).payDividends(ONE_ETH, DIVIDEND_RATIO);

                const coTokensPerInvestmentAfter = await mogulOrganisationInstance.calcRelevantDAIForMGL(mglTokens);

                assert(coTokensPerInvestmentAfter.gt(coTokensPerInvestmentBefore), "The token sell price after dividents repayment were not increased")
            });

            it('Should receive more DAI on COToken exit after paying dividends', async () => {

                let coTokens = await mogulTokenInstance.balanceOf(INVESTOR.address);

                const DAIReturnedForInvestmentBefore = await mogulOrganisationInstance.calcRelevantDAIForMGL(coTokens);

                await mogulOrganisationInstance.from(REPAYER).payDividends(ONE_ETH, DIVIDEND_RATIO);

                await mogulTokenInstance.approve(mogulOrganisationInstance.contractAddress, coTokens);
                await mogulOrganisationInstance.from(INVESTOR).calcRelevantDAIForMGL(coTokens);

                const DAIReturnedForInvestmentAfter = await mogulOrganisationInstance.calcRelevantDAIForMGL(coTokens);

                assert(DAIReturnedForInvestmentAfter.gt(DAIReturnedForInvestmentBefore), "The DAI received after exit was not more than before dividents payout")
            });

            it('Should allocate dividends correctly between mogul bank and CO', async () => {

                let coBalance = await mogulDAIInstance.balanceOf(mogulOrganisationInstance.contractAddress);
                let mogulBankBalance = await mogulDAIInstance.balanceOf(MOGUL_BANK);

                let coPart = ONE_ETH.mul(DIVIDEND_RATIO).div(100);

                let expectedCOBalance = coBalance.add(coPart); // coBalance + 20%
                let expectedMogulBankBalance = mogulBankBalance.add(ONE_ETH.sub(coPart)); // mogulBankBalance + 20%

                await mogulOrganisationInstance.from(REPAYER).payDividends(ONE_ETH, DIVIDEND_RATIO);

                let newCoBalance = await mogulDAIInstance.balanceOf(mogulOrganisationInstance.contractAddress);
                let newMogulBankBalance = await mogulDAIInstance.balanceOf(MOGUL_BANK);

                assert.strictEqual(expectedCOBalance.toString(), newCoBalance.toString());
                assert.strictEqual(expectedMogulBankBalance.toString(), newMogulBankBalance.toString());
            });

            it('Should allocate dividends correctly between mogul bank and CO whit 100% dividend ratio', async () => {
                const newDividendRatio = 100;
                let coBalance = await mogulDAIInstance.balanceOf(mogulOrganisationInstance.contractAddress);
                let mogulBankBalance = await mogulDAIInstance.balanceOf(MOGUL_BANK);

                let coPart = ONE_ETH.mul(newDividendRatio).div(100);

                let expectedCOBalance = coBalance.add(coPart); // coBalance + 20%
                let expectedMogulBankBalance = mogulBankBalance.add(ONE_ETH.sub(coPart)); // mogulBankBalance + 20%

                await mogulOrganisationInstance.from(REPAYER).payDividends(ONE_ETH, newDividendRatio);

                let newCoBalance = await mogulDAIInstance.balanceOf(mogulOrganisationInstance.contractAddress);
                let newMogulBankBalance = await mogulDAIInstance.balanceOf(MOGUL_BANK);

                assert.strictEqual(expectedCOBalance.toString(), newCoBalance.toString());
                assert.strictEqual(expectedMogulBankBalance.toString(), newMogulBankBalance.toString());
            });

            it('Should revert if one tries to pay dividends whit higher than 100% ratio', async () => {
                const higherRatio = 101;
                await assert.revert(mogulOrganisationInstance.from(REPAYER).payDividends(ONE_ETH, higherRatio));
            });

            it('Should revert if one tries to repay with unapproved DAI', async () => {
                await contractInitializator.mintDAI(mogulDAIInstance, REPAYER.address, ONE_ETH);
                await assert.revert(mogulOrganisationInstance.from(REPAYER).payDividends(DOUBLE_AMOUNT, DIVIDEND_RATIO));
            });

            it("Should revert if one tries to repay DAI that he doesn't have", async () => {
                await assert.revert(mogulOrganisationInstance.from(REPAYER).payDividends(DOUBLE_AMOUNT, DIVIDEND_RATIO));
            });
        })
    });
});
