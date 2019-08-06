pragma solidity ^0.5.3;

contract MovementNotifier {
    function onTransfer(address to) public view returns(bool);
}
