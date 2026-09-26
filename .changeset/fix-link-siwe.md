---
"@openfort/react-native": minor
---

`useWalletAuth().linkSiwe` now links the wallet to the signed-in user via `linkWithSiwe` instead of signing in with it. Generate its message with `generateSiweMessage({ ..., link: true })` so the nonce comes from `initLinkSiwe`. `messageOverride` is now required on `signInWithSiwe` and `linkSiwe` (both already threw without it), and the unused `disableSignup` option is removed.
