import { useEffect, useState } from "react";

/**
 * Hook that listens for the PWA beforeinstallprompt event and exposes
 * a deferred prompt that can be triggered by an install button.
 * The install button should only be shown when canInstall is true.
 */
export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      setCanInstall(false);
      return;
    }

    const handleBeforeInstall = (e: Event) => {
      // Prevent the default mini-infobar from appearing
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  /**
   * Trigger the native OS install prompt.
   * Call this from an install button's onClick.
   * Returns true if the prompt was shown, false if it couldn't be shown.
   */
  const installPWA = async () => {
    if (!deferredPrompt) return false;
    // Show the native install prompt
    deferredPrompt.prompt();
    // Wait for the user's choice
    const { outcome } = await deferredPrompt.userChoice;
    // The deferredPrompt can only be used once — clear it either way
    setDeferredPrompt(null);
    setCanInstall(false);
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    return outcome === "accepted";
  };

  return { canInstall, isInstalled, installPWA };
}
