import { useOpenfortContext } from "../../core";

export function useSignOut() {
  const { logout } = useOpenfortContext();

  return {
    signOut: logout,
  };
}