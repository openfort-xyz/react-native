---
"@openfort/react-native": minor
---

`useUser().user.metadata` now returns the custom data your backend sets on the user with your secret key. Update `@openfort/openfort-js` to 2.7.0, which adds `metadata` to `User`. Email and password, email OTP, phone OTP, Sign in with Apple, and SIWE sign-in now load the user from `client.user.get()` after login, because sign-in responses do not include metadata.
