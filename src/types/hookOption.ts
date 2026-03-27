import type { OpenfortError } from '@openfort/openfort-js'

export type OpenfortHookOptions<T = { error?: OpenfortError }> = {
  onSuccess?: (data: T) => void
  onError?: (error: OpenfortError) => void
  throwOnError?: boolean
}
