let DAI = 1000000000000000000 // 1 DAI
let MGL = 1000000000000000000 // 1 MGL

// ===== Variables to  play with

let initialCOTokenSupplyND = 5000000
let initialDAIInvestmentND = 2500000


let initialCOTokenSupply = initialCOTokenSupplyND * MGL
let initialDAIInvestment = initialDAIInvestmentND * DAI
let investDAI = 500000; // Investment amount in DAI
let investmentsCount = 10; // Number of times to invest 'investDAI' number of DAI

let dividendAmountInDAI = 1000000; // Dividends repaid in DAI

let sellMGL = 100000; // Number of MGL sold
let sellCount = 5; // Number of times to sell 'sellMGL' number of tokens

let reserveRatio = 20; //50 %

// =====

const buyCalc = (
	continuousTokenSupply,
	preMintedAmount,
	amount
) => {
	const x1 = continuousTokenSupply ** 2;
	const x2 = 2 * amount * preMintedAmount;
	const x3 = (x1 + x2) ** 0.5;
	return x3 - continuousTokenSupply;
};

const sellCalc = (
	continuousTokenSupply,
	reserveSupply,
	tokenAmount
) => {
	const a = 1 - tokenAmount / continuousTokenSupply;
	const b = 1 - a * a;

	return reserveSupply * b;
};

const calculator = {
	buyCalc,
	sellCalc
}

let runInvest = () => {
	let investment = investDAI * DAI

	console.log(`Scenario: ${investmentsCount} investors invest ${investDAI} DAI each`);

	for (let i = 0; i < investmentsCount; i++) {
		let res = calculator.buyCalc(initialCOTokenSupply, initialDAIInvestment, investment);
		let tokensPerInvestment = res / 1000000000000000000;
		let tokensPerDaIInvestment = tokensPerInvestment / investDAI;

		console.log(`Investor ${i + 1} Tokens Per Investment: ${tokensPerInvestment.toFixed(15)} , Effective MGL received per 1 DAI investment: ${tokensPerDaIInvestment.toFixed(15)} MGL`)

		initialCOTokenSupply += res;
		initialDAIInvestment += investment;
	}
	console.log('=================')

	console.log('Tokens per 10x investment will give you this much tokens:')

	let res = calculator.buyCalc(initialCOTokenSupply, initialDAIInvestment, 10 * investment);
	console.log(res / 1000000000000000000)

	console.log('=================')

	console.log("Total Tokens Supply:")
	console.log(initialCOTokenSupply / 1000000000000000000)

	console.log("Total DAI Invested:")
	console.log(initialDAIInvestment / 1000000000000000000)

	console.log("Total DAI in reserve:")
	console.log(initialDAIInvestment / (100 / reserveRatio) / 1000000000000000000)

	return {
		totalDAI: initialDAIInvestment,
		totalMGL: initialCOTokenSupply
	}
}

let runPayDividents = (totalDAIInvested) => {
	console.log(`Repaying ${dividendAmountInDAI} DAI as dividends`);
	return totalDAIInvested + (dividendAmountInDAI * DAI);
}

let runSell = (COSupply, DAIInReserve) => {
	let sell = sellMGL * MGL

	console.log(`Scenario: ${sellCount} investors sell ${sellMGL} MGL each`);

	for (let i = 0; i < sellCount; i++) {
		let res = calculator.sellCalc(COSupply, DAIInReserve, sell);
		let DAIForSale = res / 1000000000000000000;
		let effectiveMGLPrice = DAIForSale / sellMGL;

		console.log(`Seller ${i + 1} Dai Received for Sale: ${DAIForSale.toFixed(15)} , Effective Sell Price of 1 MGL: ${effectiveMGLPrice.toFixed(15)} DAI`)

		COSupply -= sell;
		DAIInReserve -= res;
	}

	console.log('=================')

	console.log("Total Tokens Supply:")
	console.log(COSupply / 1000000000000000000)

	console.log("Total DAI in reserve:")
	console.log(DAIInReserve / 1000000000000000000)

	return {

	}
}

let run = () => {
	console.log(`Initial Investment: ${initialDAIInvestmentND} DAI`)
	console.log(`Initial pre-minted: ${initialCOTokenSupplyND} MGL`)
	console.log(`Reserve ratio: ${reserveRatio}%`)
	console.log("\n\n===== Buying =====")
	const buyRes = runInvest();
	console.log("===== End Buying Phase =====")
	console.log("\n\n===== Paying Dividends =====")
	const totalDAI = runPayDividents(buyRes.totalDAI)
	console.log("===== End Dividends Phase =====")
	console.log("\n\n===== Selling =====")
	runSell(buyRes.totalMGL, totalDAI / (100 / reserveRatio))
	console.log("===== End Selling Phase =====")
}

run()

