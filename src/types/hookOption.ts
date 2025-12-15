import type { OpenfortError } from './openfortError'

export type OpenfortHookOptions<T = { error?: OpenfortError }> = {
  onSuccess?: (data: T) => void
  onError?: (error: OpenfortError) => void
  throwOnError?: boolean
}
