// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @dev TEST ONLY. Rejects all ETH; can also act as a funder to exercise refund failures.
contract RejectingReceiver {
    error Rejected();

    receive() external payable {
        revert Rejected();
    }

    function createCampaignOn(
        address escrow,
        address beneficiary,
        address attestor,
        uint32 observationStart,
        uint32 observationEnd,
        uint32 thresholdBps,
        uint64 settlementDeadline,
        string calldata spec
    ) external payable returns (uint256 id) {
        (bool ok, bytes memory ret) = escrow.call{value: msg.value}(
            abi.encodeWithSignature(
                "createCampaign(address,address,uint32,uint32,uint32,uint64,string)",
                beneficiary,
                attestor,
                observationStart,
                observationEnd,
                thresholdBps,
                settlementDeadline,
                spec
            )
        );
        require(ok, "create failed");
        id = abi.decode(ret, (uint256));
    }
}
