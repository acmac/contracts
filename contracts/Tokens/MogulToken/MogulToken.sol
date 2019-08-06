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

    MovementNotifier[] public movementNotifiers;
    
    constructor() ERC20Detailed(_name, _symbol, _decimal) public {
    }
    
    function addMovementNotifier(address _movementNotifier) public onlyOwner {
        require(_movementNotifier != address(0x0));
        movementNotifiers.push(MovementNotifier(_movementNotifier));
    }
    
    function removeMovementNotifier(uint16 _movementNotifierIndex) public onlyOwner {
        require(movementNotifiers.length > _movementNotifierIndex);
        movementNotifiers[_movementNotifierIndex] = movementNotifiers[movementNotifiers.length - 1];
        movementNotifiers.length--;
    }
    
    function getMovementNotifiersCount() public view returns (uint256){
        return movementNotifiers.length;
    }
    
    function transfer(address to, uint256 value) public returns (bool) {
        for (uint i = 0; i < movementNotifiers.length; i++) {
            movementNotifiers[i].onTransfer(msg.sender, to, value);
        }
        return super.transfer(to, value);
    }
    
    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        for (uint i = 0; i < movementNotifiers.length; i++) {
            movementNotifiers[i].onTransfer(msg.sender, to, value);
        }
        return super.transferFrom(from, to, value);
    }
    
    function burnFrom(address from, uint256 value) public {
        for (uint i = 0; i < movementNotifiers.length; i++) {
            movementNotifiers[i].onBurn(from, value);
        }
        super.burnFrom(from, value);
    }
}
