// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract HyperPoints is ERC20, Ownable, ReentrancyGuard {
    uint256 public constant DECAY_RATE = 1;
    uint256 public constant DECAY_PERIOD = 30 days;
    uint256 public lastDecayTimestamp;
    uint256 public totalClaimed;
    
    mapping(address => uint256) public contributionPoints;
    mapping(address => uint256) public lastClaimTimestamp;
    mapping(bytes32 => bool) public contributionMinted;
    
    event PointsMinted(address indexed to, uint256 amount, string contributionType);
    event PointsClaimed(address indexed to, uint256 amount);
    event DecayApplied(uint256 totalDecayed);
    
    constructor() ERC20("HyperPoints", "HYPE") Ownable(msg.sender) {
        lastDecayTimestamp = block.timestamp;
    }
    
    function mintForContribution(
        address to,
        uint256 amount,
        string memory contributionType,
        bytes32 contributionId
    ) external onlyOwner {
        require(!contributionMinted[contributionId], "Contribution already minted");
        require(to != address(0), "Invalid address");
        require(amount > 0, "Amount must be greater than 0");
        
        contributionMinted[contributionId] = true;
        contributionPoints[to] += amount;
        _mint(to, amount);
        
        emit PointsMinted(to, amount, contributionType);
    }
    
    function claimPoints() external nonReentrant {
        uint256 claimable = contributionPoints[msg.sender];
        require(claimable > 0, "No points to claim");
        require(
            block.timestamp >= lastClaimTimestamp[msg.sender] + 7 days,
            "Claim cooldown active"
        );
        
        contributionPoints[msg.sender] = 0;
        lastClaimTimestamp[msg.sender] = block.timestamp;
        totalClaimed += claimable;
        
        emit PointsClaimed(msg.sender, claimable);
    }
    
    function applyDecay() external {
        require(
            block.timestamp >= lastDecayTimestamp + DECAY_PERIOD,
            "Decay period not reached"
        );
        
        uint256 totalSupply = totalSupply();
        uint256 decayAmount = (totalSupply * DECAY_RATE) / 100;
        
        if (decayAmount > 0) {
            _burn(address(this), decayAmount);
            lastDecayTimestamp = block.timestamp;
            emit DecayApplied(decayAmount);
        }
    }
    
    function getClaimablePoints(address user) external view returns (uint256) {
        return contributionPoints[user];
    }
    
    function getNextDecayTimestamp() external view returns (uint256) {
        return lastDecayTimestamp + DECAY_PERIOD;
    }
}

