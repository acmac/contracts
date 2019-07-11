pragma solidity ^0.5.4;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";


contract Whitelisting is Ownable {
    
    address public whiteLister;
    
    mapping (address => bool) public whiteList;
    
    constructor(address _whiteLister) public {
        whiteLister = _whiteLister;
    }
    
    function setWhiteLister(address _newWhiteLister) public onlyOwner {
        require(_newWhiteLister != address(0));
        whiteLister = _newWhiteLister;
    }
    
    function confirmedByWhiteLister(bytes memory signature) internal view returns (bool) {
        bytes32 bytes32Message = keccak256(abi.encodePacked(msg.sender));
        bytes32 EthSignedMessageHash = ECDSA.toEthSignedMessageHash(bytes32Message);
        
        address signer = ECDSA.recover(EthSignedMessageHash, signature);
        
        if (signer != whiteLister) {
            return false;
        }
        
        return true;
    }
    
    function setWhitelisted(address _whiteListedUser) internal {
        require(_whiteListedUser != address(0));
        whiteList[msg.sender] = true;
    }
}
