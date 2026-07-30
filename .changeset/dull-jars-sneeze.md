---
'@openfort/react-native': minor
---

Update `@openfort/openfort-js` to 2.0.0.

The core SDK split `AuthResponse` into `{ token, user, session }` and made `User`
the standalone profile type. The auth flow types and the internal
`refreshUserState` signature now use `User`, which is what they already returned
at runtime — `AuthSuccessCallback` and the OAuth/email/SIWE hook callbacks
receive a `User` rather than an `AuthResponse`.

`SDKOverrides` is still exported from this package, but is now derived from
`OpenfortSDKConfiguration['overrides']` because openfort-js 2.0.0 declares the
type without exporting it.
