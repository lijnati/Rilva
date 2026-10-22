"use client";

import type { Address, Hex } from "viem";
import { CHAIN } from "@/lib/app/appConfig";
import { chainAddressUrl, chainTxUrl } from "@/lib/contracts";
import { HashField } from "./HashField";

export function AddressField({ label, address, head = 6, tail = 4 }: { label?: string; address: Address; head?: number; tail?: number }) {
  return <HashField label={label} value={address} head={head} tail={tail} href={chainAddressUrl(CHAIN, address)} hrefLabel="Explorer" />;
}

export function TxLink({ hash, label = "View transaction" }: { hash: Hex; label?: string }) {
  const href = chainTxUrl(CHAIN, hash);
  if (!href) {
    return (
      <span className="text-[12px] text-ink-3" title={hash}>
        {label}: <code className="font-mono">{hash.slice(0, 10)}…{hash.slice(-6)}</code> (local chain, no explorer)
      </span>
    );
  }
  return (
    <a className="link text-[12.5px]" href={href} target="_blank" rel="noreferrer">
      {label} ↗
    </a>
  );
}
