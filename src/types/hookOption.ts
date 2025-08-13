import { OpenfortError } from "./openfortError";


export type OpenfortHookOptions<T = { error?: OpenfortError }> = {
  onSuccess?: (data: T) => void;
  onError?: (error: OpenfortError) => void;
  onSettled?: (data: T | undefined | null, error: OpenfortError | null) => void;
  throwOnError?: boolean;
}
