import { useEffect, useRef } from "react";
import { useGoogleOAuth } from "@react-oauth/google";

let gsiInitialized = false;

export default function GoogleSignInButton({ onSuccess, onError }) {
  const btnRef = useRef(null);
  const { clientId, scriptLoadedSuccessfully } = useGoogleOAuth();
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!scriptLoadedSuccessfully || !btnRef.current || !clientId) return;

    const googleId = window.google?.accounts?.id;
    if (!googleId) return;

    if (!gsiInitialized) {
      googleId.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response?.credential) {
            onSuccessRef.current?.({ credential: response.credential });
            return;
          }
          onErrorRef.current?.();
        },
        // FedCM can open a blank popup in some Chrome setups — disable for local dev.
        use_fedcm_for_button: false,
        use_fedcm_for_prompt: false,
      });
      gsiInitialized = true;
    }

    btnRef.current.innerHTML = "";
    googleId.renderButton(btnRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      width: 320,
    });
  }, [scriptLoadedSuccessfully, clientId]);

  return <div ref={btnRef} className="flex justify-center min-h-[44px]" />;
}
