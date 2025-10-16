import type { OpenfortHookOptions } from '../types/hookOption'
import type { OpenfortError } from '../types/openfortError'

/**
 * Handles successful hook operation callbacks
 *
 * This utility function invokes success and settled callbacks from hook options,
 * ensuring consistent callback execution across all hooks in the SDK.
 *
 * @param params - Object containing hook options and success data
 * @returns The success data that was passed in
 *
 * @example
 * ```tsx
 * const result = await someAsyncOperation();
 * return onSuccess({
 *   hookOptions,
 *   options,
 *   data: { user: result.user },
 * });
 * ```
 */
export const onSuccess = <T>({
  hookOptions,
  options,
  data,
}: {
  hookOptions?: OpenfortHookOptions<T>
  options?: OpenfortHookOptions<T>
  data: T
}) => {
  hookOptions?.onSuccess?.(data)
  hookOptions?.onSettled?.(data, null)
  options?.onSuccess?.(data)
  options?.onSettled?.(data, null)

  return data
}

/**
 * Handles failed hook operation callbacks
 *
 * This utility function invokes error and settled callbacks from hook options,
 * and optionally throws the error if throwOnError is configured.
 *
 * @param params - Object containing hook options and error information
 * @returns Object containing the error, or throws if throwOnError is enabled
 *
 * @example
 * ```tsx
 * try {
 *   await someAsyncOperation();
 * } catch (e) {
 *   const error = new OpenfortError('Operation failed', OpenfortErrorType.GENERIC);
 *   return onError({
 *     hookOptions,
 *     options,
 *     error,
 *   });
 * }
 * ```
 */
export const onError = <T>({
  hookOptions,
  options,
  error,
}: {
  hookOptions?: OpenfortHookOptions<T>
  options?: OpenfortHookOptions<T>
  error: OpenfortError
}) => {
  hookOptions?.onError?.(error)
  hookOptions?.onSettled?.(null, error)
  options?.onError?.(error)
  options?.onSettled?.(null, error)

  if (hookOptions?.throwOnError || options?.throwOnError) throw error

  return { error }
}
