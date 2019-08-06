pragma solidity ^0.5.3;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol";
import "../../MovementNotifier.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract MogulToken is ERC20Detailed, ERC20Mintable, ERC20Burnable, Ownable {
    
    string private _name = "Mogul";
    string private _symbol = "MGL";
    uint8 private _decimal = 18;

    MovementNotifier public movementNotifier;
    
    constructor() ERC20Detailed(_name, _symbol, _decimal) public {
    }
    
    function setMovementNotifier(address[] memory _movementNotifier) public onlyOwner {
        require(address(_movementNotifier[0]) != address(0x0));
        movementNotifier = MovementNotifier(_movementNotifier[0]);
    }
    
    function transfer(address to, uint256 value) public returns (bool) {
        require(movementNotifier.onTransfer(to));
        return super.transfer(to, value);
    }
    
    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(movementNotifier.onTransfer(to));
        return super.transferFrom(from, to, value);
    }
    
    function burnFrom(address from, uint256 value) public {
        require(movementNotifier.onTransfer(from));
        super.burnFrom(from, value);
    }
}
