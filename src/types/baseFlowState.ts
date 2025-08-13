import { OpenfortError } from "./openfortError";

export type BaseFlowState = {
  status: "idle" | 'awaiting-input' | 'loading' | 'success';
  error?: never;
} | {
  status: 'error';
  error: OpenfortError | null;
}

export const mapStatus = (status: BaseFlowState) => {
  return {
    isLoading: status.status === 'loading',
    isError: status.status === 'error',
    isSuccess: status.status === 'success',
    error: status.error
  }
}
