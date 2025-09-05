import { EmbeddedState } from "@openfort/openfort-js";
import { useOpenfortContext } from "../../core";

export function useUser() {
  const { user, embeddedState, getAccessToken } = useOpenfortContext();

  return {
    user,
    isAuthenticated: !!user && (embeddedState !== EmbeddedState.NONE && embeddedState !== EmbeddedState.UNAUTHENTICATED),
    getAccessToken,
  };
}