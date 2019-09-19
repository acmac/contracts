pragma solidity ^0.5.3;

interface MovementNotifier {
    function onTransfer(address from, address to, uint256 value) external;
    function onBurn(address from, uint256 value) external;
}
