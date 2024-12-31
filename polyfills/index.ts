import { polyfillGlobal } from "react-native/Libraries/Utilities/PolyfillFunctions"

// This is a workaround to fix the issue with process.version
if (process.version === undefined) {
  Object.defineProperty(process, 'version', {
    value: "",  // Set the desired version (you can use any string)
    writable: false,
  });
}

// Crypto module needs getRandomValues
import 'react-native-get-random-values';

const MMKVStorage = require("react-native-mmkv").MMKV;

// Initialize MMKVStorage
const MMKV = new MMKVStorage();

const localStorage: Storage = {
  getItem: (key: string): string | null => {
    try {
      const value = MMKV.getString(key);
      // console.log("getItem", key, value);
      return value !== undefined ? value : null;  // Ensure it returns string or null
    } catch (e) {
      console.error('Error reading value from localStorage polyfill', e);
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      // console.log("setItem", key, value);
      MMKV.set(key, value);  // Sets value synchronously
    } catch (e) {
      console.error('Error saving value to localStorage polyfill', e);
    }
  },
  removeItem: (key: string) => {
    try {
      // console.log("removeItem", key);
      MMKV.delete(key);  // Removes item synchronously
    } catch (e) {
      console.error('Error removing value from localStorage polyfill', e);
    }
  },
  clear: () => {
    try {
      // console.log("clear");
      MMKV.clearAll();  // Clears store synchronously
    } catch (e) {
      console.error('Error clearing localStorage polyfill', e);
    }
  },
  key: (index: number): string | null => {
    return MMKV.getAllKeys()[index] || null;
  },
  get length(): number {
    try {
      return MMKV.getAllKeys().length;
    } catch {
      console.error('Error: localStorage.length is not supported');
      return -1;
    }
  }
};

global.localStorage = localStorage;
global.sessionStorage = localStorage;

// for TextEncoder and TextDecoder
const applyGlobalPolyfills = () => {
  const { TextEncoder, TextDecoder } = require("text-encoding")

  polyfillGlobal("TextEncoder", () => TextEncoder)
  polyfillGlobal("TextDecoder", () => TextDecoder)
}

applyGlobalPolyfills()
