pragma solidity  ^0.7.0;
// SPDX-License-Identifier: MIT

library SafeMath {

  function mul(uint256 a, uint256 b) internal pure returns (uint256) {

    if (a == 0) {
      return 0;
    }

    uint256 c = a * b;
    require(c / a == b);

    return c;
  }


  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    require(b > 0); // Solidity only automatically asserts when dividing by 0
    uint256 c = a / b;

    return c;
  }

  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    require(b <= a);
    uint256 c = a - b;

    return c;
  }

  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a + b;
    require(c >= a);

    return c;
  }

  function mod(uint256 a, uint256 b) internal pure returns (uint256) {
    require(b != 0);
    return a % b;
  }
}

contract Ownable {
    address public owner;

    /**
      * @dev The Ownable constructor sets the original `owner` of the contract to the sender
      * account.
      */
    constructor(){
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

interface IERC20 {
    function totalSupply() external view returns (uint);
    function balanceOf(address tokenOwner) external view returns (uint);
    function allowance(address tokenOwner, address spender) external view returns (uint);
    function transfer(address to, uint value) external;
    function approve(address spender, uint value) external;
    function transferFrom(address from, address to, uint value) external;
    event Transfer(address indexed from, address indexed to, uint tokens);
    event Approval(address indexed tokenOwner, address indexed spender, uint tokens);
}

contract HopSell is Ownable{
    using SafeMath for uint256;
    
    uint256 public EXCHANGE_END_TIME = 1609416000; // (UTC) 2020/12/31 12:00pm 
    uint256 public ONLINE_TIME = 1619697600; //  (UTC) 2021/04/31 00:00am
    address public USDT;
    address public HOP;
    address public HOP_FUND;
    address public beneficiary;
    uint256 public FIRST_RELEASE = 20; // 20%
    
    mapping(address=>detail) public balanceDetail;
    
    //convert USDT uint to HOP unit, init 1 USDT = 2 HOP
    uint256 public mutiplier = 1e18 / 1e6 * 2; 
    
    constructor(address HOPAddr,
                address USDTAddr,
                address fundAddr,
                address beneAddr){
        HOP = HOPAddr;
        USDT = USDTAddr;
        HOP_FUND = fundAddr;
        beneficiary = beneAddr;
    }
    
    //set how many HOP will be exchanged base on 1e6 USDT
    function setRate(uint256 r) external onlyOwner {
        require(r > 0, "can't set rate to 0");
        mutiplier = uint256(1e12).mul(r).div(1e6); // 1e12 = 1e18 / 1e6
    }

    function changeAddress(address fundAddr, address beneAddr) external onlyOwner {
        HOP_FUND = fundAddr;
        beneficiary = beneAddr;
    }
    
    function setOnlineTime(uint256 time) external onlyOwner {
        require(time < ONLINE_TIME, "already online!");
        ONLINE_TIME = time;
    }
    
    function setFirstRelease(uint256 r) external onlyOwner {
        require(r <= 100, "not a valid ratio");
        FIRST_RELEASE = r;
    }
    
    function editBalance(address[] memory addrs, uint256[] memory values) external onlyOwner {
        require(addrs.length == values.length, "array length not match");
        for(uint256 i=0; i< addrs.length; i++){
            balanceDetail[addrs[i]].totalBalance = values[i];
        }
    }
    
    struct detail{
        uint256 totalBalance;
        uint256 claimed;
    }
    
    event Exchange(address indexed user, uint256 HOPAmount); 
    event Claim(address user, uint256 HOPAmount);
    
    function estimateCost(uint256 inputUSDT) public view returns (uint256){
        return inputUSDT.mul(mutiplier);
    }
    
    function exchangeForHOP(uint256 inputUSDT) public {
        require(block.timestamp < EXCHANGE_END_TIME);
        uint256 HOPAmount = inputUSDT.mul(mutiplier);
        require(HOPAmount > 0);
        IERC20(USDT).transferFrom(msg.sender, beneficiary, inputUSDT);
        balanceDetail[msg.sender].totalBalance += balanceDetail[msg.sender].totalBalance.add(HOPAmount);
        emit Exchange(msg.sender, HOPAmount);
    }
    
    function accountInfo(address payer, uint256 time) public view 
                                returns (uint256 totalBalance, 
                                        uint256 claimed,
                                        uint256 claimable){
        detail memory dtl = balanceDetail[payer];
        totalBalance = dtl.totalBalance;
        claimed = dtl.claimed;
        if(time < EXCHANGE_END_TIME + 1 days / 2){  // first release happends 12h after exchange ends
            return (totalBalance, claimed, 0);
        }
        if(time < ONLINE_TIME){
            return (totalBalance, claimed, totalBalance.mul(FIRST_RELEASE).div(100).sub(claimed));
        }
        uint256 period = (time.sub(ONLINE_TIME)).div(30 days) + 1;
        if(period >= 12){
            return (totalBalance, claimed, totalBalance.sub(claimed));
        }
        claimable = ((totalBalance * FIRST_RELEASE / 100)
                            + (totalBalance * (100 - FIRST_RELEASE) /100 * period / 12)).sub(claimed);
    }
    
    // this implement can't ensure fund is surfficient for claiming
    function claimHOP(uint256 amount) public {
        require(amount > 0, "claim zero hop");
        (uint256 totalBalance, uint256 claimed, uint256 claimable) = accountInfo(msg.sender, block.timestamp);
        require(claimable + claimed <= totalBalance, "error in calculation");
        require(amount <= claimable, "claim to much");
        balanceDetail[msg.sender].claimed += amount; 
        IERC20(HOP).transferFrom(HOP_FUND, msg.sender, amount);
        emit Claim(msg.sender, amount);
    }
    
    // for test purpose, delete it before online
    // function FAKE_Claim(uint256 amount, uint256 time) public {
    //     require(amount > 0, "claim zero hop");
    //     (uint256 totalBalance, uint256 claimed, uint256 claimable) = accountInfo(msg.sender, time);
    //     require(claimable + claimed <= totalBalance, "error in calculation");
    //     require(amount <= claimable, "claim to much");
    //     balanceDetail[msg.sender].claimed += amount; 
    //     IERC20(HOP).transferFrom(HOP_FUND, msg.sender, amount);
    //     emit Claim(msg.sender, amount);
    // }
}