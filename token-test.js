

let DAI = 1000000000000000000 // 1 DAI
let MGL = 1000000000000000000 // 1 MGL

// ===== Variables to  play with

let initialCOTokenSupply = 7999 * MGL
let initialDAIInvestment = 8000 * DAI
let investDAI = 10000; // Investment amount in DAI
let investmentsCount = 15; // Number of times to invest 'investDAI' number of DAI

let dividendAmountInDAI = 10000; // Dividends repaid in DAI

let sellMGL = 1000; // Number of MGL sold
let sellCount = 15; // Number of times to sell 'sellMGL' number of tokens

// =====

let buyCalc = function buyCalc(continuousTokenSupply, totalInvestedDAI, amount) {
	return continuousTokenSupply * ((1 + amount / totalInvestedDAI) ** (0.5) - 1)
};

let sellCalc = function sellCalc(continuousTokenSupply, reserveSupply, tokenAmount) {
	return (reserveSupply * (1 - (1 - tokenAmount / continuousTokenSupply) ** 2));
};

const calculator = {
	buyCalc,
	sellCalc
}

let runInvest = () => {
	let investment = investDAI * DAI

	for (let i = 0; i < investmentsCount; i++) {
		let res = calculator.buyCalc(initialCOTokenSupply, initialDAIInvestment, investment);
		let tokensPerInvestment = res / 1000000000000000000;
		let tokensPerDaIInvestment = tokensPerInvestment / investDAI;

		console.log(`Tokens Per Investment: ${tokensPerInvestment.toFixed(15)} , Effective MGL received per 1 DAI investment: ${tokensPerDaIInvestment.toFixed(15)} MGL`)

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
	console.log(initialDAIInvestment / 5 / 1000000000000000000)

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

	for (let i = 0; i < sellCount; i++) {
		let res = calculator.sellCalc(COSupply, DAIInReserve, sell);
		let DAIForSale = res / 1000000000000000000;
		let effectiveMGLPrice = DAIForSale / sellMGL;

		console.log(`Dai Received for Sale: ${DAIForSale.toFixed(15)} , Effective Sell Price of 1 MGL: ${effectiveMGLPrice.toFixed(15)} DAI`)

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
	console.log("\n\n===== Buying =====")
	const buyRes = runInvest();
	console.log("===== End Buying Phase =====")
	console.log("\n\n===== Paying Dividends =====")
	const totalDAI = runPayDividents(buyRes.totalDAI)
	console.log("===== End Dividends Phase =====")
	console.log("\n\n===== Selling =====")
	runSell(buyRes.totalMGL, totalDAI / 5)
	console.log("===== End Selling Phase =====")
}

run()

