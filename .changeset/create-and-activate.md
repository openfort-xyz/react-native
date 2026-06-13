---
'@openfort/react-native': minor
---

Add `createAndActivate` to `useEmbeddedEthereumWallet` — a create-or-recover convenience for onboarding. If the user already has an embedded wallet it is recovered and activated, otherwise a new one is created; either way the wallet ends up connected (provider ready), so callers no longer have to branch on `wallets.length` themselves.
