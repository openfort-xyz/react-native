/* eslint-disable no-var */

declare global {
  var openfort: {
    iframeListener: ((fn: ((event: MessageEvent<unknown>) => void)) => void);
    iframePostMessage: ((message: MessageEvent<unknown>) => void);
    jwk: {
      getKey: (key: unknown) => unknown;
      parse: (sJWS: string) => unknown;
      verifyJWT: (sJWT: string, key: string | unknown, acceptField?: {
        alg?: string[] | undefined;
        aud?: string[] | undefined;
        iss?: string[] | undefined;
        jti?: string | undefined;
        sub?: string[] | undefined;
        verifyAt?: string | number | undefined;
        gracePeriod?: number | undefined;
      }) => boolean,
      getNow: () => number;
    };
  } | undefined;
}

export default function Iframe();
