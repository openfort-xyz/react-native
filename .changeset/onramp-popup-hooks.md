---
"@openfort/react-native": minor
---

Added `useOnramp`, the headless fiat onramp for React Native. Every call declares the popup-only capability (`angles: ['popup']`) so server routing never resolves the embedded or native flows this platform cannot execute; the hosted checkout opens in the system browser sheet via expo-web-browser and the session polls to a terminal status — closing the sheet is not an outcome. Requires an api deployment with the angles filter and `@openfort/openfort-js` ≥ 2.2 at runtime (the surface is probed; `isAvailable` is false on older SDKs).
