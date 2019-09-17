pragma solidity ^0.5.4;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";


contract Whitelisting is Ownable {
    
    address public whiteLister;
    
    mapping (address => bool) public whiteList;
    
    /*
    * @dev Contract Constructor
    *
    * @param _whiteLister address of contract admin with whitelist rights
    */
    constructor(address _whiteLister) public {
        whiteLister = _whiteLister;
    }
    
    /*
    * modifiers
    */
    modifier onlyWhiteLister {
        require(msg.sender == whiteLister);
        _;
    }
    
    
    function setWhiteLister(address _newWhiteLister) public onlyOwner {
        require(_newWhiteLister != address(0));
        whiteLister = _newWhiteLister;
    }
    
    /*
    * @dev function setWhitelisted sets the whitelist status of an address
    *
    * @param _whiteListedUser address the address of the user
    * @param isWhitelisted bool Status of the user
    */
    function setWhitelisted(address _whiteListedUser, bool isWhitelisted) public onlyWhiteLister {
        _setWhitelisted(_whiteListedUser, isWhitelisted);
    }
    
    /*
    * @dev function confirmedByWhiteLister performs a check if the user is whitelisted
    *
    * @param signature bytes is signed keccak256 of the user we are whitelisting
    */
    function confirmedByWhiteLister(bytes memory signature) internal view returns (bool) {
        bytes32 bytes32Message = keccak256(abi.encodePacked(msg.sender));
        bytes32 EthSignedMessageHash = ECDSA.toEthSignedMessageHash(bytes32Message);
        
        address signer = ECDSA.recover(EthSignedMessageHash, signature);
        
        return signer == whiteLister;
    }
    
    /*
    * @dev function setWhitelisted sets the whitelist status of an address
    *
    * @param _whiteListedUser address the address of the user
    * @param isWhitelisted bool Status of the user
    */
    function _setWhitelisted(address _whiteListedUser, bool isWhitelisted) internal {
        require(_whiteListedUser != address(0));
        whiteList[_whiteListedUser] = isWhitelisted;
    }
}
