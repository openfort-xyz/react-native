---
'@openfort/react-native': minor
---

Add `signTypedData` helper for EIP-712 typed-data signing.

Signs ethers/viem-style typed data (`{ domain, types, primaryType, message }`) via
`eth_signTypedData_v4`, re-adding the required `EIP712Domain` type in canonical field
order and serializing `bigint` values so the signature recovers on-chain. This unblocks
signing typed data produced by contract SDKs (Safe/Zodiac, GnosisPay account-kit, ...)
from React Native without hand-rolling the payload.
