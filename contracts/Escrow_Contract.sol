// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract Escrow {
    address public arbiter;

    struct Deposit {
        address depositor;
        address beneficiary;
        uint256 amount;
        bool isApproved;
        bool isWithdrawn;
        mapping(bytes32 => bool) conditions;
        uint256 requiredConditions;
        uint256 metConditions;
    }

    mapping(uint256 => Deposit) public deposits;
    uint256 public depositCount;

    event DepositCreated(uint256 depositId, address depositor, address beneficiary, uint256 amount);
    event ConditionSet(uint256 depositId, bytes32 condition);
    event ConditionMet(uint256 depositId, bytes32 condition);
    event Approved(uint256 depositId);
    event Withdrawn(uint256 depositId, uint256 amount);

    constructor(address _arbiter) {
        arbiter = _arbiter;
    }

    function createDeposit(address _beneficiary) external payable returns (uint256) {
        require(msg.value > 0, "Deposit amount must be greater than 0");
        uint256 depositId = depositCount;
        Deposit storage newDeposit = deposits[depositId];
        
        newDeposit.depositor = msg.sender;
        newDeposit.beneficiary = _beneficiary;
        newDeposit.amount = msg.value;
        newDeposit.isApproved = false;
        newDeposit.isWithdrawn = false;

        depositCount++;
        emit DepositCreated(depositId, msg.sender, _beneficiary, msg.value);
        return depositId;
    }

    function setCondition(uint256 _depositId, bytes32 _condition) external {
        require(msg.sender == arbiter, "Only arbiter can set conditions");
        Deposit storage deposit = deposits[_depositId];
        require(!deposit.conditions[_condition], "Condition already exists");
        
        deposit.conditions[_condition] = false;
        deposit.requiredConditions++;
        emit ConditionSet(_depositId, _condition);
    }

    function meetCondition(uint256 _depositId, bytes32 _condition) external {
        require(msg.sender == arbiter, "Only arbiter can meet conditions");
        Deposit storage deposit = deposits[_depositId];
        require(!deposit.conditions[_condition], "Condition already met");
        
        deposit.conditions[_condition] = true;
        deposit.metConditions++;
        emit ConditionMet(_depositId, _condition);
        
        if (deposit.metConditions == deposit.requiredConditions) {
            approve(_depositId);
        }
    }

    function approve(uint256 _depositId) internal {
        Deposit storage deposit = deposits[_depositId];
        require(!deposit.isApproved, "Already approved");
        deposit.isApproved = true;
        emit Approved(_depositId);
    }

    function withdraw(uint256 _depositId) external {
        Deposit storage deposit = deposits[_depositId];
        require(msg.sender == deposit.beneficiary, "Only beneficiary can withdraw");
        require(deposit.isApproved, "Not yet approved");
        require(!deposit.isWithdrawn, "Already withdrawn");

        uint256 amount = deposit.amount;
        deposit.isWithdrawn = true;
        (bool sent, ) = deposit.beneficiary.call{value: amount}("");
        require(sent, "Failed to send Ether");
        emit Withdrawn(_depositId, amount);
    }

    function getDeposit(uint256 _depositId) external view returns (
        address depositor,
        address beneficiary,
        uint256 amount,
        bool isApproved,
        bool isWithdrawn,
        uint256 requiredConditions,
        uint256 metConditions
    ) {
        Deposit storage deposit = deposits[_depositId];
        return (
            deposit.depositor,
            deposit.beneficiary,
            deposit.amount,
            deposit.isApproved,
            deposit.isWithdrawn,
            deposit.requiredConditions,
            deposit.metConditions
        );
    }

    function checkCondition(uint256 _depositId, bytes32 _condition) external view returns (bool) {
        return deposits[_depositId].conditions[_condition];
    }
}