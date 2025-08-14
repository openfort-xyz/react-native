
export enum OpenfortErrorType {
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  WALLET_ERROR = "WALLET_ERROR",
}

interface Data {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
export class OpenfortError extends Error {
  type: OpenfortErrorType;
  data: Data;
  constructor(message: string, type: OpenfortErrorType, data?: Data) {
    if (data?.error instanceof OpenfortError) {
      super(data.error.message);
      this.data = data.error.data;
      this.type = data.error.type;
      this.name = data.error.name;
      return;
    } else if (data?.error instanceof Error) {
      super(data.error.message);
    } else {
      super(message);
    }
    this.type = type;
    this.data = data || {};
    this.name = 'OpenfortError';
  }
}