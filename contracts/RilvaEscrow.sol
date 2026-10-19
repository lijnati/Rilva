// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RilvaEscrow
 * @notice Testnet-only, ownerless, non-upgradeable escrow for climate-triggered relief campaigns.
 *
 * A funder locks native ETH under immutable terms: a fixed beneficiary, a designated attestor, a
 * climate specification (hashed on-chain from the canonical `rilva.spec.v1` JSON), an observation
 * period and a rainfall threshold in basis points. The attestor signs an EIP-712 `Attestation`
 * carrying the SRPN-v1 rainfall index; the contract — not the caller — decides:
 *   indexBps <= thresholdBps  → the full amount goes to the beneficiary (Released)
 *   indexBps >  thresholdBps  → the full amount returns to the funder   (Refunded, NotTriggered)
 * If no attestation is accepted before the settlement deadline, anyone may return the funds to the
 * funder (Refunded, Timeout).
 *
 * Trust: the contract enforces conditions over an authorised attestation. It cannot know whether
 * the rainfall data is accurate, and it cannot stop a malicious attestor from signing conflicting
 * attestations for the same campaign — the first valid one accepted is final. See CONTRACTS.md.
 */
contract RilvaEscrow is EIP712, ReentrancyGuard {
    // ───────────────────────────────────────────────────────────────── types

    enum Status {
        None,
        Active,
        Released,
        Refunded
    }

    enum RefundReason {
        NotTriggered,
        Timeout
    }

    struct Campaign {
        address funder;
        address beneficiary;
        address attestor;
        uint96 amount;
        uint64 settlementDeadline;
        uint32 observationStart; // YYYYMMDD, inclusive
        uint32 observationEnd; // YYYYMMDD, inclusive
        uint32 thresholdBps; // 1..10000; 6000 = 60 % of normal
        Status status;
        uint32 indexBps; // set at settlement
        bytes32 specHash; // keccak256(bytes(spec))
        bytes32 evidenceHash; // set at settlement
    }

    struct Attestation {
        uint256 campaignId;
        bytes32 specHash;
        bytes32 evidenceHash;
        uint32 indexBps;
        uint32 observationStart;
        uint32 observationEnd;
        uint64 expiresAt;
    }

    // ───────────────────────────────────────────────────────────────── constants

    /// @dev Must equal ATTESTATION_TYPE_STRING in lib/contracts/typedData.ts (checked by tests).
    bytes32 public constant ATTESTATION_TYPEHASH = keccak256(
        "Attestation(uint256 campaignId,bytes32 specHash,bytes32 evidenceHash,uint32 indexBps,uint32 observationStart,uint32 observationEnd,uint64 expiresAt)"
    );

    uint32 public constant MAX_BPS = 10_000;
    uint64 public constant MIN_SETTLEMENT_WINDOW = 10 minutes;
    uint64 public constant MAX_SETTLEMENT_WINDOW = 366 days;
    uint256 public constant MAX_SPEC_LENGTH = 4096;

    // ───────────────────────────────────────────────────────────────── storage

    uint256 public campaignCount;
    mapping(uint256 campaignId => Campaign) private _campaigns;

    // ───────────────────────────────────────────────────────────────── events

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed funder,
        address indexed beneficiary,
        address attestor,
        uint256 amount,
        bytes32 specHash,
        uint32 observationStart,
        uint32 observationEnd,
        uint32 thresholdBps,
        uint64 settlementDeadline,
        string spec
    );

    event CampaignSettled(
        uint256 indexed campaignId,
        bytes32 indexed evidenceHash,
        uint32 indexBps,
        uint32 thresholdBps,
        bool triggered,
        address recipient,
        uint256 amount,
        bytes32 digest
    );

    event CampaignRefunded(uint256 indexed campaignId, address indexed funder, uint256 amount, RefundReason reason);

    // ───────────────────────────────────────────────────────────────── errors

    error ZeroValue();
    error AmountTooLarge();
    error ZeroAddress();
    error RoleConflict();
    error InvalidThreshold();
    error InvalidObservationPeriod();
    error InvalidSettlementDeadline();
    error InvalidSpec();
    error CampaignNotFound(uint256 campaignId);
    error CampaignNotActive(uint256 campaignId);
    error SettlementWindowClosed(uint256 campaignId);
    error SettlementWindowOpen(uint256 campaignId);
    error AttestationExpired();
    error SpecMismatch();
    error ObservationPeriodMismatch();
    error InvalidSigner(address recovered);
    error TransferFailed(address recipient, uint256 amount);

    constructor() EIP712("RilvaEscrow", "1") {}

    // ───────────────────────────────────────────────────────────────── external

    /**
     * @notice Creates and funds a campaign in one transaction. All terms are immutable afterwards.
     * @param spec Canonical `rilva.spec.v1` JSON (RFC 8785). Its keccak256 becomes `specHash` and the
     *             full string is emitted so anyone can verify it without a database.
     * @dev Observation dates may be in the past (retrospective replay); they are never compared with
     *      block time. Only `settlementDeadline` is a timestamp.
     */
    function createCampaign(
        address beneficiary,
        address attestor,
        uint32 observationStart,
        uint32 observationEnd,
        uint32 thresholdBps,
        uint64 settlementDeadline,
        string calldata spec
    ) external payable returns (uint256 campaignId) {
        if (msg.value == 0) revert ZeroValue();
        if (msg.value > type(uint96).max) revert AmountTooLarge();
        if (beneficiary == address(0) || attestor == address(0)) revert ZeroAddress();
        if (attestor == msg.sender || attestor == beneficiary || beneficiary == msg.sender) revert RoleConflict();
        if (thresholdBps == 0 || thresholdBps > MAX_BPS) revert InvalidThreshold();
        if (!_isValidDate(observationStart) || !_isValidDate(observationEnd) || observationStart > observationEnd) {
            revert InvalidObservationPeriod();
        }
        if (
            settlementDeadline < block.timestamp + MIN_SETTLEMENT_WINDOW
                || settlementDeadline > block.timestamp + MAX_SETTLEMENT_WINDOW
        ) revert InvalidSettlementDeadline();
        uint256 specLength = bytes(spec).length;
        if (specLength == 0 || specLength > MAX_SPEC_LENGTH) revert InvalidSpec();

        campaignId = ++campaignCount;
        bytes32 specHash = keccak256(bytes(spec));
        _campaigns[campaignId] = Campaign({
            funder: msg.sender,
            beneficiary: beneficiary,
            attestor: attestor,
            amount: uint96(msg.value),
            settlementDeadline: settlementDeadline,
            observationStart: observationStart,
            observationEnd: observationEnd,
            thresholdBps: thresholdBps,
            status: Status.Active,
            indexBps: 0,
            specHash: specHash,
            evidenceHash: bytes32(0)
        });

        emit CampaignCreated(
            campaignId,
            msg.sender,
            beneficiary,
            attestor,
            msg.value,
            specHash,
            observationStart,
            observationEnd,
            thresholdBps,
            settlementDeadline,
            spec
        );
    }

    /**
     * @notice Settles a campaign with an attestation signed by its designated attestor. Callable by
     *         anyone; funds only ever go to the campaign's fixed beneficiary or funder.
     */
    function settle(Attestation calldata attestation, bytes calldata signature) external nonReentrant {
        uint256 campaignId = attestation.campaignId;
        Campaign storage c = _campaigns[campaignId];

        // Checks
        if (c.status == Status.None) revert CampaignNotFound(campaignId);
        if (c.status != Status.Active) revert CampaignNotActive(campaignId);
        if (block.timestamp >= c.settlementDeadline) revert SettlementWindowClosed(campaignId);
        if (block.timestamp > attestation.expiresAt) revert AttestationExpired();
        if (attestation.specHash != c.specHash) revert SpecMismatch();
        if (attestation.observationStart != c.observationStart || attestation.observationEnd != c.observationEnd) {
            revert ObservationPeriodMismatch();
        }
        bytes32 digest = _hashTypedDataV4(_structHash(attestation));
        address signer = ECDSA.recover(digest, signature); // reverts on malformed or high-s signatures
        if (signer != c.attestor) revert InvalidSigner(signer);

        // Effects — the decision is computed here, never supplied by the caller.
        bool triggered = attestation.indexBps <= c.thresholdBps;
        address recipient = triggered ? c.beneficiary : c.funder;
        uint256 amount = c.amount;
        c.status = triggered ? Status.Released : Status.Refunded;
        c.indexBps = attestation.indexBps;
        c.evidenceHash = attestation.evidenceHash;

        emit CampaignSettled(
            campaignId, attestation.evidenceHash, attestation.indexBps, c.thresholdBps, triggered, recipient, amount, digest
        );
        if (!triggered) emit CampaignRefunded(campaignId, recipient, amount, RefundReason.NotTriggered);

        // Interaction
        _send(recipient, amount);
    }

    /**
     * @notice Returns a campaign's funds to its funder once the settlement deadline has passed
     *         without an accepted attestation. Callable by anyone; pays only the recorded funder.
     */
    function refundAfterDeadline(uint256 campaignId) external nonReentrant {
        Campaign storage c = _campaigns[campaignId];
        if (c.status == Status.None) revert CampaignNotFound(campaignId);
        if (c.status != Status.Active) revert CampaignNotActive(campaignId);
        if (block.timestamp < c.settlementDeadline) revert SettlementWindowOpen(campaignId);

        address funder = c.funder;
        uint256 amount = c.amount;
        c.status = Status.Refunded;

        emit CampaignRefunded(campaignId, funder, amount, RefundReason.Timeout);
        _send(funder, amount);
    }

    // ───────────────────────────────────────────────────────────────── views

    function getCampaign(uint256 campaignId) external view returns (Campaign memory) {
        return _campaigns[campaignId];
    }

    /// @notice The EIP-712 digest the attestor signs (for off-chain parity checks).
    function hashAttestation(Attestation calldata attestation) external view returns (bytes32) {
        return _hashTypedDataV4(_structHash(attestation));
    }

    // ───────────────────────────────────────────────────────────────── internal

    function _structHash(Attestation calldata a) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ATTESTATION_TYPEHASH,
                a.campaignId,
                a.specHash,
                a.evidenceHash,
                a.indexBps,
                a.observationStart,
                a.observationEnd,
                a.expiresAt
            )
        );
    }

    /// @dev State is already final when this runs; a failed transfer reverts the whole transaction.
    function _send(address to, uint256 amount) private {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed(to, amount);
    }

    /// @dev Validates a YYYYMMDD calendar date in years 1940..2100 (Gregorian leap rules).
    function _isValidDate(uint32 yyyymmdd) private pure returns (bool) {
        uint32 year = yyyymmdd / 10_000;
        uint32 month = (yyyymmdd / 100) % 100;
        uint32 day = yyyymmdd % 100;
        if (year < 1940 || year > 2100 || month == 0 || month > 12 || day == 0) return false;
        uint32 maxDay;
        if (month == 2) {
            bool leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
            maxDay = leap ? 29 : 28;
        } else if (month == 4 || month == 6 || month == 9 || month == 11) {
            maxDay = 30;
        } else {
            maxDay = 31;
        }
        return day <= maxDay;
    }
}
