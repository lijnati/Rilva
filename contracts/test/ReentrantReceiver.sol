// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

interface IRilvaEscrowRefund {
    function refundAfterDeadline(uint256 campaignId) external;
}

/// @dev TEST ONLY. On receiving a payout it tries to re-enter the escrow and trigger another
///      campaign's refund; records whether that succeeded, then accepts the ETH.
contract ReentrantReceiver {
    IRilvaEscrowRefund public immutable escrow;
    uint256 public target;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor(address escrow_) {
        escrow = IRilvaEscrowRefund(escrow_);
    }

    function setTarget(uint256 campaignId) external {
        target = campaignId;
    }

    receive() external payable {
        reentryAttempted = true;
        try escrow.refundAfterDeadline(target) {
            reentrySucceeded = true;
        } catch {
            reentrySucceeded = false;
        }
    }
}
