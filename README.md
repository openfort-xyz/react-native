# Openfort React native SDK

## Install required packages:

Using the package manager of your preference, install the openfort-js react native library, e.g. with yarn: `yarn add @openfort/react-native`.

Since react native requires installing native dependencies directly, you also have to install these required dependencies
```
yarn add buffer react-native-crypto react-native-get-random-values react-native-randombytes stream-browserify react-native-mmkv
```

## Setup your metro config 

If you do not already have a `metro.config.js`, create one with those required extra node modules:
```
// sample metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  // Add shims for Node.js modules like crypto and stream
  config.resolver.extraNodeModules = {
    crypto: require.resolve('react-native-crypto'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer'),
  };

  return config;
})();

```
## Import `Openfort` at the top of your app
The first file loaded should be Openfort-js polyfills: 
```
import  "@openfort/react-native/polyfills";
```
This will ensure the correct modules are imported and will ensure `openfort-js` works properly.

## Render secure WebView

Openfort uses a `WebView` (from `react-native-webview`) to operate as a secure environment, managing the private key and executing wallet operations. [Learn more](https://www.openfort.xyz/docs/security#embedded-self-custodial-signer).

This WebView needs to always be displayed, it is recommended to put it on top of your app. It is wrapped inside a view with `flex: 0`

Simply import it from `@openfort/react-native`

```
// Sample app/_layout.tsx using expo router
import { OpenfortCommunicationWebView } from  '@openfort/react-native';

export default function RootLayout() {

  return (
    <>
      <OpenfortCommunicationWebView />
      <Slot />
    </>
  );
}
```
## Notes

Because we are using `mmkv` storage, expo-go will not work. To run your app use `expo run:ios` or `expo run:android`.
 
# Sample

You can check out the [React native auth sample](https://github.com/openfort-xyz/react-native-auth-sample) to get your app running.