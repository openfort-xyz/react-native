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

## Usage notes

### Account type and gas

The embedded wallet can be a smart account (default) or an EOA
(`accountType: AccountTypeEnum.EOA`). Gas sponsorship (`walletConfig.feeSponsorshipId`)
applies to **smart accounts** — an EOA pays its own gas in the chain's native token.
Choose an EOA when it must own or sign for an external contract (e.g. a Safe), since
smart-account owners require ERC-1271 contract signatures.

### Wallet recovery without a backend

`recoveryMethod: 'password'` (or `'passkey'`) encrypts the key share on the client, so
no Shield encryption-session backend is required. `recoveryMethod: 'automatic'` needs a
`getEncryptionSession` callback (and a backend) instead.

### Authentication hooks

Sign-in lives in dedicated hooks: `useGuestAuth` (`signUpGuest`), `useEmailAuthOtp`
(`requestEmailOtp` → `signInEmailOtp`, passwordless), `useEmailAuth` (email + password),
`useOAuth`, `usePhoneAuthOtp`, `useWalletAuth`, and `useSignOut`. A successful sign-in
refreshes the session — read the user with `useUser`.

These methods **resolve with `{ user?, error? }`; they do not throw.** Check `error` on
the result instead of wrapping the call in `try/catch`:

```ts
const { requestEmailOtp, signInEmailOtp } = useEmailAuthOtp()

await requestEmailOtp({ email })
const { error } = await signInEmailOtp({ email, otp })
if (error) {
  // surface error.message — a thrown-exception handler will not catch this
}
```

### Creating and connecting a wallet

`useEmbeddedEthereumWallet().create()` returns the new account but does **not** activate
it — call `setActive({ address })` afterwards to reach the `connected` state (with a
`provider`). `create()` accepts the same recovery options as `setActive()`.

### Supported EIP-1193 methods

The embedded Ethereum provider (`await wallet.getProvider()`) supports, among others:
`eth_accounts`, `eth_chainId`, `eth_call`, `eth_getTransactionReceipt`,
`eth_sendTransaction`, `wallet_sendCalls`, `personal_sign`, and `eth_signTypedData_v4`.

### Expo: reading env into `app.config.js`

When reading secrets from `.env` in `app.config.js`, use the function form so it
**merges** `app.json` instead of replacing it (a static object drops `scheme`,
`plugins`, `ios`, etc. and breaks `expo run:ios`):

```js
// app.config.js
export default ({ config }) => ({
  ...config,
  extra: { ...config.extra, /* values from process.env */ },
})
```
