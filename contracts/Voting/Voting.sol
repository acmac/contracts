pragma solidity ^0.5.3;

import "./../Math/Convert.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../Tokens/MogulToken/MogulToken.sol";
import "../Tokens/MogulDAI/MogulDAI.sol";


contract Voting is Ownable {
    
    using Convert for bytes;
    using SafeMath for uint256;

    MogulDAI public mogulDAITokenInstance;
    MogulToken public mogulTokenInstance;
    address public sqrtInstance;
    uint256 public lastVotingDate = 0;
    
    struct Round {
        uint256 startDate;
        uint256 endDate;
        uint8 proposalCount;
        mapping (uint8 => Proposal) proposals;
        mapping (address => uint8) votedFor;
        uint256 maxInvestment;
        bool isFinalized;
    }
    
    struct Proposal {
        bytes32 name;
        bytes32 metaData;
        mapping (address => uint256) votersToVotes;
        uint256 totalVotes;
        address sponsorshipReceiver;
        uint256 requestedAmount;
    }
    
    Round[] public rounds;
    
    constructor(address mogulTokenAddress, address _mogulDAITokenInstance, address sqrtContract) public {
        require(sqrtContract != address(0), "constructor :: SQRT contract could not be an empty address");
        require(mogulTokenAddress != address(0), "constructor :: Mogul token contract could not be an empty address");
        require(_mogulDAITokenInstance != address(0), "constructor :: Mogul DAI token contract could not be an empty address");
        
        mogulTokenInstance = MogulToken(mogulTokenAddress);
        mogulDAITokenInstance = MogulDAI(_mogulDAITokenInstance);
        sqrtInstance = sqrtContract;
    }
    
    // Rating is calculated as => sqrt(voter tokens balance) => 1 token = 1 rating; 9 tokens = 3 rating
    function __calculateRatingByTokens(uint256 tokens) private view returns(uint256){
        // Call a Vyper SQRT contract in order to work with decimals in sqrt
        (bool success, bytes memory data) = sqrtInstance.staticcall(abi.encodeWithSignature("tokens_sqrt(uint256)", tokens));
        require(success);

        uint rating = data.toUint256();
        return rating;
    }
    
    function createProposal(
        bytes32[] memory _movieNames,
        bytes32[] memory _movieMetaData,
        address[] memory _sponsorshipReceiver,
        uint256[] memory _requestedAmount,
        uint256 _startDate,
        uint256 _expirationDate
    ) public onlyOwner {
        require(_startDate >= now, "createProposal :: Start date cannot be in the past");
        require(_expirationDate > _startDate, "createProposal :: Start date cannot be after expiration date");
        require(_startDate > lastVotingDate, "createProposal :: Start date must be after last voting date");
        require(_movieNames.length == _movieMetaData.length
            && _movieMetaData.length == _sponsorshipReceiver.length
            && _sponsorshipReceiver.length == _requestedAmount.length);
    
        uint256 largestInvestment = getLargestInvestment(_requestedAmount);
        
        require(mogulDAITokenInstance.allowance(msg.sender, address(this)) >= largestInvestment, "createProposal :: Dai tokens are not approved");
        
        mogulDAITokenInstance.transferFrom(msg.sender, address(this), largestInvestment);
        
        if(lastVotingDate < _expirationDate) {
            lastVotingDate = _expirationDate;
        }
    
        Round memory currentRound = Round({
            proposalCount: uint8(_movieNames.length),
            startDate: _startDate,
            endDate: _expirationDate,
            maxInvestment: largestInvestment,
            isFinalized: false
            });
        
        rounds.push(currentRound);
        
        for(uint8 i = 0; i < _movieNames.length; i++){

            Proposal memory currentProposal = Proposal({

            name: _movieNames[i],
            metaData: _movieMetaData[i],
            totalVotes: 0,
            sponsorshipReceiver: _sponsorshipReceiver[i],
            requestedAmount: _requestedAmount[i]

        });
            rounds[rounds.length - 1].proposals[i] = currentProposal;
        }
    }
    
    // TODO: implement currentRound variable
    function vote(uint256 _round, uint8 _movieId) public {
        require(now >= rounds[_round].startDate && now <= rounds[_round].endDate, "vote :: now is not within a voting period for this round");
        require(rounds[_round].votedFor[msg.sender] == 0 || rounds[_round].votedFor[msg.sender] == _movieId + 1, "vote :: user is not allowed to vote more than once");
        require(rounds[_round].proposalCount > _movieId, "vote :: there is no such movie id in this round");
        
        if (rounds[_round].votedFor[msg.sender] == _movieId + 1) {
            rounds[_round].proposals[_movieId].totalVotes = rounds[_round].proposals[_movieId].totalVotes.sub(rounds[_round].proposals[_movieId].votersToVotes[msg.sender]);
        }
        
        uint256 voterMogulBalance = mogulTokenInstance.balanceOf(msg.sender);
        uint256 rating = __calculateRatingByTokens(voterMogulBalance.mul(10));
        
        rounds[_round].proposals[_movieId].votersToVotes[msg.sender] = rating;
        rounds[_round].proposals[_movieId].totalVotes = rounds[_round].proposals[_movieId].totalVotes.add(rating);
        
        // we are using the first element /0/ for empty votes
        rounds[_round].votedFor[msg.sender] = _movieId + 1;
        
    }
    
    function finalizeRound(uint256 _round) public onlyOwner {
        require(rounds[_round].endDate < now);
        require(rounds.length > _round);
        require(rounds[_round].isFinalized != true);

        uint256 mostVotes;
        uint8 WinnerMovieIndex;

        for(uint8 i = 0; i < rounds[_round].proposalCount; i++) {
            if(mostVotes < rounds[_round].proposals[i].totalVotes) {
                mostVotes = rounds[_round].proposals[i].totalVotes;
                WinnerMovieIndex = i;
            }
        }

        uint256 remainingDAI = (rounds[_round].maxInvestment).sub(rounds[_round].proposals[WinnerMovieIndex].requestedAmount);

        mogulDAITokenInstance.transfer(rounds[_round].proposals[WinnerMovieIndex].sponsorshipReceiver, rounds[_round].proposals[WinnerMovieIndex].requestedAmount);
        if(remainingDAI > 0) {
            mogulDAITokenInstance.transfer(owner(), remainingDAI);
        }

        rounds[_round].isFinalized = true;
    }
    
    function getRoundInfo(uint256 _round) public view returns (uint256, uint256, uint8, bool){
        return (rounds[_round].startDate, rounds[_round].endDate, rounds[_round].proposalCount, rounds[_round].isFinalized);
    }
    
    function getProposalInfo(uint256 _round, uint8 _proposal) public view returns (bytes32, bytes32, uint256, address, uint256){
        return (rounds[_round].proposals[_proposal].name,
        rounds[_round].proposals[_proposal].metaData,
        rounds[_round].proposals[_proposal].totalVotes,
        rounds[_round].proposals[_proposal].sponsorshipReceiver,
        rounds[_round].proposals[_proposal].requestedAmount);
    }
    
    function getVoteInfo(uint256 _round, address _voterAddress) public view returns (uint8){
        return (rounds[_round].votedFor[_voterAddress]);
    }
    
    function getLargestInvestment(uint256[] memory _requestedAmounts) private returns(uint256) {
        
        uint256 largestInvestment;
        
        for (uint8 i = 0; i < _requestedAmounts.length; i++) {
            if (largestInvestment < _requestedAmounts[i]) {
                largestInvestment = _requestedAmounts[i];
            }
        }
        return largestInvestment;
    }
}
