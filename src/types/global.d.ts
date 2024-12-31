/* eslint-disable no-var */

declare global {
  var openfortListener: ((fn: ((event: MessageEvent<unknown>) => void)) => void) | undefined;
  var openfortPostMessage: ((message: MessageEvent<unknown>) => void) | undefined;
}

export default function Iframe();
