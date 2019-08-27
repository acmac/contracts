pragma solidity ^0.5.3;

import "./../Math/Convert.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";


contract Voting is Ownable {
    
    using Convert for bytes;
    using SafeMath for uint256;

    IERC20 public daiTokenContract;
    IERC20 public mogulTokenContract;
    address public sqrtContract;
    uint256 public lastVotingDate = 0;
    uint256 public currentRound = 0;
    
    struct Round {
        uint256 startDate;
        uint256 endDate;
        uint8 proposalCount;
        mapping (uint8 => Proposal) proposals;
        mapping (address => uint8) votedFor;
        uint256 maxInvestment;
    }
    
    struct Proposal {
        bytes32 name;
        mapping (address => uint256) voterToVotes;
        uint256 totalVotes;
        address sponsorshipReceiver;
        uint256 requestedAmount;
    }
    
    Round[] public rounds;
    
    event ProposalCreated(uint256 indexed roundID, uint8 proposalsCount, uint256 startDate, uint256 endDate);
    event Voted(uint256 indexed roundID, address voter, uint8 propolsalID);
    event RoundFinalized(uint256 indexed roundID, uint8 winnerID);
    event CancelRound(uint256 indexed roundID);
    
    modifier onlyTokenAddress() {
        require(msg.sender == address(mogulTokenContract), "movementNotifier :: permission denied");
        _;
    }
    
    constructor(address _mogulTokenAddress, address _daiTokenInstance, address _sqrtContract) public {
        require(_sqrtContract != address(0), "constructor :: SQRT contract could not be an empty address");
        require(_mogulTokenAddress != address(0), "constructor :: Mogul token contract could not be an empty address");
        require(_daiTokenInstance != address(0), "constructor :: Mogul DAI token contract could not be an empty address");
        
        mogulTokenContract = IERC20(_mogulTokenAddress);
        daiTokenContract = IERC20(_daiTokenInstance);
        sqrtContract = _sqrtContract;
    }
    
    function createProposal(
        bytes32[] memory _movieNames,
        address[] memory _sponsorshipReceiver,
        uint256[] memory _requestedAmount,
        uint256 _startDate,
        uint256 _expirationDate
    ) public onlyOwner {
        require(_startDate >= now, "createProposal :: Start date cannot be in the past");
        require(_expirationDate > _startDate, "createProposal :: Start date cannot be after expiration date");
        require(_startDate > lastVotingDate, "createProposal :: Start date must be after last voting date");
        require(_movieNames.length == _sponsorshipReceiver.length
            && _sponsorshipReceiver.length == _requestedAmount.length, "createProposal :: proposals data count is different");
            uint256 largestInvestment = getLargestInvestment(_requestedAmount);
        
        daiTokenContract.transferFrom(msg.sender, address(this), largestInvestment);
        
        lastVotingDate = _expirationDate;
    
        Round memory currentRoundData = Round({
            proposalCount: uint8(_movieNames.length),
            startDate: _startDate,
            endDate: _expirationDate,
            maxInvestment: largestInvestment
            });
        
        rounds.push(currentRoundData);
        
        for(uint8 i = 0; i < _movieNames.length; i++){

            Proposal memory currentProposal = Proposal({

            name: _movieNames[i],
            totalVotes: 0,
            sponsorshipReceiver: _sponsorshipReceiver[i],
            requestedAmount: _requestedAmount[i]

        });
            rounds[rounds.length - 1].proposals[i] = currentProposal;
        }
        
        emit ProposalCreated(rounds.length - 1, rounds[rounds.length - 1].proposalCount, _startDate, _expirationDate);
    }
    
    function vote(uint8 _movieId) public {
        require(now >= rounds[currentRound].startDate && now <= rounds[currentRound].endDate, "vote :: now is not within a voting period for this round");
        require(rounds[currentRound].votedFor[msg.sender] == 0 || rounds[currentRound].votedFor[msg.sender] == _movieId + 1, "vote :: user is not allowed to vote more than once");
        require(rounds[currentRound].proposalCount > _movieId, "vote :: there is no such movie id in this round");
        
        if (rounds[currentRound].votedFor[msg.sender] == _movieId + 1) {
            rounds[currentRound].proposals[_movieId].totalVotes = rounds[currentRound].proposals[_movieId].totalVotes.sub(rounds[currentRound].proposals[_movieId].voterToVotes[msg.sender]);
        }
        
        uint256 voterMogulBalance = mogulTokenContract.balanceOf(msg.sender);
        uint256 rating = __calculateRatingByTokens(voterMogulBalance.mul(10));
        
        rounds[currentRound].proposals[_movieId].voterToVotes[msg.sender] = rating;
        rounds[currentRound].proposals[_movieId].totalVotes = rounds[currentRound].proposals[_movieId].totalVotes.add(rating);
        
        // we are using the first element /0/ for empty votes
        rounds[currentRound].votedFor[msg.sender] = _movieId + 1;
        
        emit Voted(currentRound, msg.sender, _movieId);
    }
    
    function finalizeRound() public onlyOwner {
        require(rounds[currentRound].endDate < now, "finalizeRound :: the round is not finished");

        uint256 mostVotes;
        uint8 winnerMovieIndex;

        for(uint8 i = 0; i < rounds[currentRound].proposalCount; i++) {
            if(mostVotes < rounds[currentRound].proposals[i].totalVotes) {
                mostVotes = rounds[currentRound].proposals[i].totalVotes;
                winnerMovieIndex = i;
            }
        }

        uint256 remainingDAI = (rounds[currentRound].maxInvestment).sub(rounds[currentRound].proposals[winnerMovieIndex].requestedAmount);

        daiTokenContract.transfer(rounds[currentRound].proposals[winnerMovieIndex].sponsorshipReceiver, rounds[currentRound].proposals[winnerMovieIndex].requestedAmount);
        if(remainingDAI > 0) {
            daiTokenContract.transfer(owner(), remainingDAI);
        }

        currentRound++;
    }
    
    function cancelRound() public onlyOwner {
        
        daiTokenContract.transfer(owner(), rounds[currentRound].maxInvestment);
        
        emit CancelRound(currentRound);
    
        currentRound++;
    }
    
    function onTransfer(address from, address to, uint256 value) public onlyTokenAddress {
        if (rounds.length > 0) {
            if (rounds[currentRound].votedFor[from] != 0
            && rounds[currentRound].startDate <= now
            && rounds[currentRound].endDate >= now) {
                __revokeVote(from);
            }
        }
    }
    
    function onBurn(address from, uint256 value) public onlyTokenAddress {
        if (rounds.length > 0) {
            if (rounds[currentRound].votedFor[from] != 0
            && rounds[currentRound].startDate <= now
            && rounds[currentRound].endDate >= now) {
                __revokeVote(from);
            }
        }
    }
    
    function getRoundInfo(uint256 _round) public view returns (uint256, uint256, uint8){
        return (rounds[_round].startDate, rounds[_round].endDate, rounds[_round].proposalCount);
    }
    
    function getRounds() public view returns (uint256){
        return rounds.length;
    }
    
    function getProposalInfo(uint256 _round, uint8 _proposal) public view returns (bytes32, uint256, address, uint256){
        return (rounds[_round].proposals[_proposal].name,
        rounds[_round].proposals[_proposal].totalVotes,
        rounds[_round].proposals[_proposal].sponsorshipReceiver,
        rounds[_round].proposals[_proposal].requestedAmount);
    }
    
    function getVotersVotesInfo(uint256 _round, uint8 _proposal, address _voter) public view returns (uint256){
        return rounds[_round].proposals[_proposal].voterToVotes[_voter];
    }
    
    function getVoteInfo(uint256 _round, address _voterAddress) public view returns (uint8){
        return (rounds[_round].votedFor[_voterAddress]);
    }
    
    function getLargestInvestment(uint256[] memory _requestedAmounts) private pure returns(uint256) {
        
        uint256 largestInvestment;
        
        for (uint8 i = 0; i < _requestedAmounts.length; i++) {
            if (largestInvestment < _requestedAmounts[i]) {
                largestInvestment = _requestedAmounts[i];
            }
        }
        return largestInvestment;
    }
    
    // Rating is calculated as => sqrt(voter tokens balance) => 1 token = 1 rating; 9 tokens = 3 rating
    function __calculateRatingByTokens(uint256 tokens) private view returns(uint256){
        // Call a Vyper SQRT contract in order to work with decimals in sqrt
        (bool success, bytes memory data) = sqrtContract.staticcall(abi.encodeWithSignature("tokens_sqrt(uint256)", tokens));
        require(success);
        
        uint rating = data.toUint256();
        return rating;
    }
    
    function __revokeVote(address from) private {
        
        uint8 proposalIndex = rounds[currentRound].votedFor[from] - 1;
        uint256 votes = rounds[currentRound].proposals[proposalIndex].voterToVotes[from];
    
        rounds[currentRound].proposals[proposalIndex].totalVotes = rounds[currentRound].proposals[proposalIndex].totalVotes.sub(votes);
        rounds[currentRound].proposals[proposalIndex].voterToVotes[from] = 0;
        rounds[currentRound].votedFor[from] = 0;
    }
}
