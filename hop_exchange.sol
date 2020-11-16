pragma solidity ^0.4.17;

/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }
        uint256 c = a * b;
        assert(c / a == b);
        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        assert(b <= a);
        return a - b;
    }

    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        assert(c >= a);
        return c;
    }
}

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
    address public owner;

    /**
      * @dev The Ownable constructor sets the original `owner` of the contract to the sender
      * account.
      */
    function Ownable() public {
        owner = msg.sender;
    }

    /**
      * @dev Throws if called by any account other than the owner.
      */
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    /**
    * @dev Allows the current owner to transfer control of the contract to a newOwner.
    * @param newOwner The address to transfer ownership to.
    */
    function transferOwnership(address newOwner) public onlyOwner {
        if (newOwner != address(0)) {
            owner = newOwner;
        }
    }

}

/**
 * @title ERC20Basic
 * @dev Simpler version of ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/20
 */
contract ERC20Basic {
    uint public _totalSupply;
    function totalSupply() public constant returns (uint);
    function balanceOf(address who) public constant returns (uint);
    function transfer(address to, uint value) public;
    event Transfer(address indexed from, address indexed to, uint value);
}

/**
 * @title ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/20
 */
contract ERC20 is ERC20Basic {
    function allowance(address owner, address spender) public constant returns (uint);
    function transferFrom(address from, address to, uint value) public;
    function approve(address spender, uint value) public;
    event Approval(address indexed owner, address indexed spender, uint value);
}

contract USDTforHOP is Ownable{
    
    using SafeMath for uint256;
    
    address public HOP;
    address public USDT;
    address public fund;
    address public beneficiary;
    
    mapping(address=>uint256) public HOPCredit;
    
    uint256 public exchangeStopTime;
    uint256 public releaseHopTime;
    
    //convert USDT uint to HOP unit, init 1 USDT = 2 HOP
    uint256 public mutiplier = 1e18 / 1e6 * 2; 
    
    
    event Exchange(address indexed user, uint256 HOPAmount); 
    event Claim(address user, uint256 HOPAmount);
    
    //set how many HOP will be exchanged base on 1e6 USDT
    function setRate(uint256 r) external onlyOwner {
        require(r > 0);
        mutiplier = uint256(1e12).mul(r).div(1e6); // 1e12 = 1e18 / 1e6
    }
    
    function changeAddress(address fundAddr, address beniAddr) external onlyOwner {
        fund = fundAddr;
        beneficiary = beniAddr;
    }
    
    function USDTforHOP(address HOPAddr,
                        address USDTAddr,
                        address fundAddr,
                        address beneAddr,
                        uint256 exchangeDays,
                        uint256 lockDays) public{
        HOP = HOPAddr;
        USDT = USDTAddr;
        fund = fundAddr;
        beneficiary = beneAddr;
        exchangeStopTime = now + exchangeDays * 1 days;
        releaseHopTime = exchangeStopTime + lockDays * 1 days;
    }
    
    function estimateCost(uint256 inputUSDT) public view returns (uint256){
        return inputUSDT.mul(mutiplier);
    }
    
    function exchangeForHOP(uint256 inputUSDT) public {
        require(now < exchangeStopTime);
        uint256 HOPAmount = inputUSDT.mul(mutiplier);
        require(HOPAmount > 0);
        ERC20(USDT).transferFrom(msg.sender, beneficiary, inputUSDT);
        ERC20(HOP).transferFrom(fund, address(this), HOPAmount);
        HOPCredit[msg.sender] = HOPCredit[msg.sender].add(HOPAmount);
        Exchange(msg.sender, HOPAmount);
    }
    
    function claimHOP() public {
        require(now > releaseHopTime);
        uint256 credit = HOPCredit[msg.sender];
        delete HOPCredit[msg.sender];
        require(credit > 0);
        ERC20(HOP).transfer(msg.sender, credit);
        Claim(msg.sender, credit);
    }
}