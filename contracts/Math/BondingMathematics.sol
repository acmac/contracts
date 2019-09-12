pragma solidity ^0.5.4;

import "./Convert.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";


contract BondingMathematics {

    using Convert for bytes;
    using SafeMath for uint256;

    address public vyperMath;

    constructor(address _vyperMath) public {
        vyperMath = _vyperMath;
    }

    function calcPurchase(uint256 continuousTokenSupply,
        uint256 premintedMGL,
        uint256 daiAmount) public view returns (uint256){

        (bool success, bytes memory data) = vyperMath.staticcall(abi.encodeWithSignature("calc_purchase(uint256,uint256,uint256)", continuousTokenSupply, premintedMGL, daiAmount));
        require(success);

        uint tokensAmount = data.toUint256();
        return tokensAmount;
    }

    function calcTokenSell(uint256 continuousTokenSupply,
        uint256 reserveTokenSupply,
        uint256 _tokensAmount) public view returns (uint256){

        (bool success, bytes memory data) = vyperMath.staticcall(abi.encodeWithSignature("calc_sell(uint256,uint256,uint256)", continuousTokenSupply, reserveTokenSupply, _tokensAmount));
        require(success);

        uint ethersAmount = data.toUint256();
        return ethersAmount;
    }
    
    function calcExitFee(uint256 continuousTokenSupply,
        uint256 premintedMGL,
        uint256 reserveTokenSupply) public view returns (uint256){
        
        (bool success, bytes memory data) = vyperMath.staticcall(abi.encodeWithSignature("calc_exit_fee(uint256,uint256,uint256)", continuousTokenSupply, premintedMGL, reserveTokenSupply));
        require(success);
        
        uint exitFee = data.toUint256();
        return exitFee;
    }
}
