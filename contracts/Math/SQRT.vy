@public
@constant
def sqrt_high_precision(num: decimal) -> uint256:
    if num == 0.0:
        return 0

    assert num >= 1.0

    normalization: decimal = 1000000000000000000.0

    root: decimal = sqrt(num)
    
    root *= normalization

    return convert(root, uint256)

@public
@constant
def calc_purchase(tokenSupply: uint256, preMintedAmount: uint256, amount: uint256) -> uint256:
    # 
    normalization: uint256 = 1000000000000000000

    x1: uint256 = tokenSupply * tokenSupply
    x2: uint256 = 2 * amount * preMintedAmount
    x3: uint256 = x1 + x2
    x3Decimal: decimal = convert(x3, decimal)
    x4: uint256 = self.sqrt_high_precision(x3Decimal) / normalization
    
    return x4 - tokenSupply

@public
@constant
def calc_sell(tokenSupply: uint256, totalSupply: uint256, tokenAmount: uint256) -> uint256:
    # totalSupply * (1 - (1 - tokenAmount / tokenSupply) ^2)

    normalization: decimal = 1000000000000000000.0

    tokenSupplyAsDecimal: decimal = convert(tokenSupply, decimal)
    totalSupplyAsDecimal: decimal = convert(totalSupply, decimal)
    tokenAmountAsDecimal: decimal = convert(tokenAmount, decimal)

    a: decimal = 1.0 - tokenAmountAsDecimal / tokenSupplyAsDecimal
    b: decimal = 1.0 - (a * a)
    return convert(totalSupplyAsDecimal * b, uint256)
