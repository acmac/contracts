pragma solidity ^0.5.4;

import "./Tokens/MogulDAI/MogulDAI.sol";
import "./Tokens/MogulToken/MogulToken.sol";
import "./Math/BondingMathematics.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Helpers/Whitelisting.sol";


contract MogulOrganisation is Whitelisting, MovementNotifier {

    using SafeMath for uint256;
    
    BondingMathematics public bondingMath;

    MogulDAI public mogulDAI;
    MogulToken public mogulToken;

    address public mogulBank;
    address public mogulOrgAdmin;
    
    uint256 public totalDAIInvestments = 0;

    uint256 public premintedMGL = 0;
    
    uint256 constant public DAI_RESERVE_REMAINDER = 5; // 20%
    
    uint16 public maxGasPrice = 30;
    
    enum State {
        LOCKED,
        LIVE,
        CLOSED
    }
    
    State public mogulOrgState;
    
    modifier onlyWhenLive() {
        require(mogulOrgState == State.LIVE, "onlyWhenLive :: The Organisation iis not live");
        _;
    }
    
    modifier onlyAdmin() {
        require(msg.sender == mogulOrgAdmin, "onlyAdmin :: msg sender is not the admin");
        _;
    }
    
    event Invest(address investor, uint256 amount);
    event Withdraw(address investor, uint256 amount);
    event UnlockOrganisation(address unlocker, uint256 initialAmount, uint256 initialMglSupply);
    event DividendPayed(address payer, uint256 amount);
    event CloseOrganisation(uint256 taxPenalty);
    
    constructor(address _bondingMath, address _mogulDAI, address _mogulToken, address _mogulBank, address _whiteLister) Whitelisting(_whiteLister) public {
        
        require(_mogulDAI != address(0), "constructor:: Mogul DAI address is required");
        require(_mogulBank != address(0), "constructor:: Mogul Bank address is required");
        require(_bondingMath != address(0), "constructor:: Bonding Math address is required");

        mogulToken = MogulToken(_mogulToken);
        mogulDAI = MogulDAI(_mogulDAI);

        mogulBank = _mogulBank;
        mogulOrgAdmin = msg.sender;
        bondingMath = BondingMathematics(_bondingMath);
    }
    
    function setMaxGasPrice(uint16 _maxGasPrice) public onlyAdmin {
        require(_maxGasPrice > 0, "setMaxGasPrice :: gas price can not be zero");
        maxGasPrice = _maxGasPrice;
    }
    
    function setMogulOrgAdminAddress(address _newMogulOrgAdmin) public onlyAdmin {
        require(_newMogulOrgAdmin != address(0), "mogulOrgAdminAddress :: invalid address");
        mogulOrgAdmin = _newMogulOrgAdmin;
    }
    
    function invest(uint256 _daiAmount, bytes memory signedData) public onlyWhenLive {
        require(tx.gasprice == maxGasPrice);
        require(mogulOrgState == State.LIVE);
        require(mogulDAI.balanceOf(address(this)) > 0, "invest:: Organisation is not unlocked for investments yet");
        require(mogulDAI.allowance(msg.sender, address(this)) >= _daiAmount, "invest:: Investor tries to invest with unapproved DAI amount");
        
        if (!whiteList[msg.sender]) {
            require(confirmedByWhiteLister(signedData));
            _setWhitelisted(msg.sender, true);
        }

        uint256 mglTokensToMint = calcRelevantMGLForDAI(_daiAmount);

        uint256 reserveDAIAmount = _daiAmount.div(DAI_RESERVE_REMAINDER);
        mogulDAI.transferFrom(msg.sender, address(this), reserveDAIAmount);
        mogulDAI.transferFrom(msg.sender, mogulBank, _daiAmount.sub(reserveDAIAmount));

        mogulToken.mint(msg.sender, mglTokensToMint);
    
        totalDAIInvestments = totalDAIInvestments.add(_daiAmount);
        
        emit Invest(msg.sender, _daiAmount);
    }
    
    function revokeInvestment(uint256 _amountMGL) public {
        require(tx.gasprice == maxGasPrice);
        if (mogulOrgState == State.LIVE) {
            require(mogulToken.allowance(msg.sender, address(this)) >= _amountMGL, "revokeInvestment:: Investor wants to withdraw MGL without allowance");
    
            uint256 daiToReturn = bondingMath.calcTokenSell(mogulToken.totalSupply(), mogulDAI.balanceOf(address(this)), _amountMGL);
    
            mogulDAI.transfer(msg.sender, daiToReturn);
    
            mogulToken.burnFrom(msg.sender, _amountMGL);
    
            totalDAIInvestments = totalDAIInvestments.sub(daiToReturn);
    
            emit Withdraw(msg.sender, daiToReturn);
        } else if (mogulOrgState == State.CLOSED) {
            require(mogulToken.allowance(msg.sender, address(this)) >= _amountMGL, "revokeInvestment:: Investor wants to withdraw MGL without allowance");
            
            uint256 daiToReturn = mogulDAI.balanceOf(address(this)).mul(_amountMGL).div(mogulToken.totalSupply());
    
            mogulDAI.transfer(msg.sender, daiToReturn);
            mogulToken.burnFrom(msg.sender, _amountMGL);
    
            emit Withdraw(msg.sender, daiToReturn);
        }
    }
    
    function calcRelevantMGLForDAI(uint256 _daiAmount) public view returns(uint256) {
        uint256 tokensAfterPurchase = bondingMath.calcPurchase(mogulToken.totalSupply(), premintedMGL, _daiAmount);
        return tokensAfterPurchase;
    }
    
    function calcRelevantDAIForMGL(uint256 coTokenAmount) public view returns(uint256) {
        return bondingMath.calcTokenSell(mogulToken.totalSupply(), mogulDAI.balanceOf(address(this)), coTokenAmount);
    }
    
    function payDividends(uint256 dividendAmount, uint8 dividendRatio)  public onlyWhenLive {
        require(dividendRatio <= 100, "dividendRatio is higher than maximum allowed");
        require(mogulDAI.balanceOf(address(this)) > 0, "payDividends:: Organisation is not unlocked for dividends payment yet");
        require(mogulDAI.allowance(msg.sender, address(this)) >= dividendAmount, "payDividends:: payer tries to pay with unapproved amount");
        
        uint256 reserveAmount = (dividendAmount.mul(dividendRatio)).div(100);
        
        mogulDAI.transferFrom(msg.sender, address(this), reserveAmount);
        mogulDAI.transferFrom(msg.sender, mogulBank, dividendAmount.sub(reserveAmount));
        
        emit DividendPayed(msg.sender, dividendAmount);
    }
    
    function unlockOrganisation(uint256 _unlockAmount, uint256 _initialMglSupply) public {
        require(mogulOrgState == State.LOCKED);
        require(mogulDAI.balanceOf(address(this)) == 0, "unlockOrganisation:: Organization is already unlocked");
        require(mogulDAI.allowance(msg.sender, address(this)) >= _unlockAmount, "unlockOrganisation:: Unlocker tries to unlock with unapproved amount");

        mogulDAI.transferFrom(msg.sender, address(this), _unlockAmount.div(DAI_RESERVE_REMAINDER));
        mogulDAI.transferFrom(msg.sender, mogulBank, _unlockAmount.sub(_unlockAmount.div(DAI_RESERVE_REMAINDER)));

        premintedMGL = _initialMglSupply;
        
        mogulToken.mint(msg.sender, _initialMglSupply);
    
        totalDAIInvestments = _unlockAmount;
        _setWhitelisted(msg.sender, true);
    
        mogulOrgState = State.LIVE;
        
        emit UnlockOrganisation(msg.sender, _unlockAmount, _initialMglSupply);
    }
    
    function closeOrganisation() public onlyOwner onlyWhenLive {
        uint256 taxPenalty = bondingMath.calcExitFee(mogulToken.totalSupply(), premintedMGL, mogulDAI.balanceOf(address(this)));
        
        require(mogulDAI.allowance(msg.sender, address(this)) >= taxPenalty, "closeOrganisation :: Owner tries to close organisation with unapproved DAI amount");
    
        mogulDAI.transferFrom(msg.sender, address(this), taxPenalty);
    
        mogulOrgState = State.CLOSED;
    
        emit CloseOrganisation(taxPenalty);
    }
    
    function calcCloseTaxPenalty() public view returns(uint256) {
        return bondingMath.calcExitFee(mogulToken.totalSupply(), premintedMGL, mogulDAI.balanceOf(address(this)));
    }
    
    function onTransfer(address from, address to, uint256 value) public {
        require(whiteList[to]);
    }
    
    function onBurn(address from, uint256 value) public {
        require(whiteList[from]);
    }
    
}
