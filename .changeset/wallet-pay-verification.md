---
'@openfort/react-native': minor
---

Add `useWalletPayVerification` (Coinbase-issued email + US-phone OTP via `client.funding.verifications`, with 60-day on-device reuse of completed verifications and `+1000…` sandbox numbers on test keys) and `OnrampPaymentSheet` (payment-link WebView with the `onramp_api.*` event bridge) for native wallet pay (Apple/Google Pay) funding. Requires `@openfort/openfort-js` with the `funding.verifications` namespace.
