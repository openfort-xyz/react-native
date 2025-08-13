import { mapStatus } from "../../types/oauth";
import { useLinkWithOAuth } from "./useLinkWithOAuth";
import { useLoginWithOAuth } from "./useLoginWithOAuth";

export const useOAuth = () => {
  const { login, state: loginState } = useLoginWithOAuth();
  const { link, state: linkState } = useLinkWithOAuth();

  const {
    isLoading: isLinkLoading,
    isError: isLinkError,
    isSuccess: isLinkSuccess,
    error: linkError
  } = mapStatus(linkState);
  const {
    isLoading: isLoginLoading,
    isError: isLoginError,
    isSuccess: isLoginSuccess,
    error: loginError
  } = mapStatus(loginState);

  return {
    login,
    link,
    isLoading: isLinkLoading || isLoginLoading,
    isError: isLinkError || isLoginError,
    isSuccess: isLinkSuccess || isLoginSuccess,
    error: linkError || loginError,
  };
}