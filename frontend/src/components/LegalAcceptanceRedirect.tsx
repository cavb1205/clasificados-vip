"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const EVENT_NAME = "legal-acceptance-required";

export function LegalAcceptanceRedirect() {
  const router = useRouter();

  useEffect(() => {
    function redirectToAccount() {
      if (window.location.pathname !== "/cuenta") {
        router.replace("/cuenta?legal=1");
      }
    }

    window.addEventListener(EVENT_NAME, redirectToAccount);
    return () => window.removeEventListener(EVENT_NAME, redirectToAccount);
  }, [router]);

  return null;
}
