import { useCallback, useState } from "react";
import { useOpenfortContext } from "../../core";
import { onError, onSuccess } from "../../lib/hookConsistency";
import { BaseFlowState, mapStatus } from "../../types/baseFlowState";
import { OpenfortHookOptions } from "../../types/hookOption";
import { OpenfortError, OpenfortErrorType } from "../../types/openfortError";
import { useOpenfortClient } from "../core";

export function useSignOut(hookOptions: OpenfortHookOptions = {}) {
  const client = useOpenfortClient();
  const { _internal, user } = useOpenfortContext();
  const [status, setStatus] = useState<BaseFlowState>({
    status: "idle",
  });

  const signOut = useCallback(async (options: OpenfortHookOptions = {}) => {
    if (!user)
      return;

    setStatus({
      status: 'loading',
    });
    try {
      await client.auth.logout();
      _internal.refreshUserState();
      setStatus({
        status: 'success',
      });

      return onSuccess({
        hookOptions,
        options,
        data: {},
      });
    } catch (e) {
      const error = new OpenfortError('Failed to sign out', OpenfortErrorType.AUTHENTICATION_ERROR, { error: e })
      setStatus({
        status: 'error',
        error,
      });
      return onError({
        hookOptions,
        options,
        error,
      });
    }
  }, [client, user, _internal.refreshUserState, setStatus, hookOptions]);

  return {
    ...mapStatus(status),
    signOut,
  };
}