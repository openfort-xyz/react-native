<div align="center">
  <h4>
    <a href="https://www.openfort.io/">
      Website
    </a>
    <span> | </span>
    <a href="https://www.openfort.io/docs/products/embedded-wallet/react-native/">
      Documentation
    </a>
    <span> | </span>
    <a href="https://x.com/openfort_hq">
      X
    </a>
  </h4>
</div>

# Openfort React Native SDK

Quickstart sample:
https://github.com/openfort-xyz/react-native-auth-sample

## Signing EIP-712 typed data

Contract SDKs (ethers, viem, Safe/Zodiac, GnosisPay account-kit, ...) produce typed
data without an `EIP712Domain` entry in `types`, but `eth_signTypedData_v4` requires
one. `signTypedData` re-adds it (in canonical order) and serializes `bigint` values,
so the signature recovers correctly on-chain. Use an EOA wallet for plain ECDSA
signatures.

```ts
import { signTypedData, useEmbeddedEthereumWallet } from '@openfort/react-native'

const wallet = useEmbeddedEthereumWallet()
if (wallet.status === 'connected') {
  const signature = await signTypedData(wallet.provider, wallet.activeWallet.address, {
    domain: { name: 'MyApp', version: '1', chainId: 1, verifyingContract: '0xCcCC...' },
    primaryType: 'Mail',
    types: { Mail: [{ name: 'contents', type: 'string' }] },
    message: { contents: 'Hello, Openfort' },
  })
}
```
