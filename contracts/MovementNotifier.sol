pragma solidity ^0.5.3;

contract MovementNotifier {
    function onTransfer(address from, address to, uint256 value) public;
    function onBurn(address from, uint256 value) public;
}
