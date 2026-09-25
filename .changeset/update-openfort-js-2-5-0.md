---
"@openfort/react-native": patch
---

Update `@openfort/openfort-js` to 2.5.0. `OpenfortEvents.ON_SIGNED_MESSAGE` now fires only for `personal_sign`/`signMessage` and EIP-712 typed data, and `SignedMessagePayload` carries a `type: 'message' | 'typedData'` discriminator.
