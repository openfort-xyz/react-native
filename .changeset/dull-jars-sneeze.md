---
'@openfort/react-native': major
---

Update `@openfort/openfort-js` to 2.0.0 and remove unimplemented auth types.

The core SDK split `AuthResponse` into `{ token, user, session }` and made `User`
the standalone profile type. The auth flow types and the internal
`refreshUserState` signature now use `User`, which is what they already returned
at runtime.

`SDKOverrides` is still exported from this package, but is now derived from
`OpenfortSDKConfiguration['overrides']` because openfort-js 2.0.0 declares the
type without exporting it.

**Breaking:** the following types have been removed. They described hook shapes
that no hook implemented — the real hooks return `{ signInEmail, signUpEmail,
... }` and `{ initOAuth, linkOauth, ... }` — and `UseLoginWithOAuth.login`
declared a return type that openfort-js 2.0.0 made incorrect. Use the return
types of `useEmailAuth`, `useWalletAuth` and `useOAuth` directly, and
`OpenfortHookOptions` for callback options.

- `EmailLoginHookOptions`, `EmailLoginHookResult`
- `SiweLoginHookOptions`, `SiweLoginHookResult`
- `UseLoginWithOAuth`, `LoginWithOAuthInput`, `LinkWithOAuthInput`
- `AuthSuccessCallback`, `ErrorCallback`
- `GenerateSiweMessage`, `GenerateSiweMessageResponse`
