---
'@openfort/react-native': minor
---

Add explicit config validation to catch two silent misconfigurations:

- **`supportedChains`**: `OpenfortProvider` now throws at mount if `supportedChains` is not an array of viem `Chain` objects (e.g. raw chain IDs like `[80002]`), instead of silently building a broken chain map.
- **EOA + fee sponsorship**: `createWallet` now throws a clear error when an EOA account is created while a `feeSponsorshipId` (gas policy) is configured, since fee sponsorship requires a smart account or a delegated account. Previously this surfaced later as a misleading "insufficient funds" error.
- **Consistent `accountType` default**: the account-list path now defaults to `EOA` when no `accountType` is configured, matching the `createWallet` default (previously it defaulted to `SMART_ACCOUNT`).
