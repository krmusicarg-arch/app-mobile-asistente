import { useState, useEffect, useCallback } from "react";

/**
 * Función reutilizable para detectar si la aplicación ya está instalada o ejecutándose en modo standalone.
 * Considera:
 * - display-mode: standalone (estándar W3C para PWAs en Android/Chrome/Edge/Desktop)
 * - navigator.standalone en iOS Safari
 * - document.referrer android-app:// (Trusted Web Activity)
 */
export function isAppInstalled() {
  if (typeof window === "undefined") return false;

  const isStandaloneMatch =
    window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  const isIosStandalone = Boolean(window.navigator && window.navigator.standalone);
  const isAndroidApp = Boolean(
    document.referrer && document.referrer.startsWith("android-app://")
  );

  return Boolean(isStandaloneMatch || isIosStandalone || isAndroidApp);
}

/**
 * Detecta si el dispositivo es iPhone / iPad / iPod (iOS)
 */
export function isIosDevice() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  const isIosUA = /iPhone|iPad|iPod/i.test(ua);
  const isIpadOS =
    window.navigator.platform === "MacIntel" &&
    window.navigator.maxTouchPoints > 1;
  return isIosUA || isIpadOS;
}

export function usePwaInstall() {
  const [installed, setInstalled] = useState(isAppInstalled);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIos, setIsIos] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setIsIos(isIosDevice());
    setInstalled(isAppInstalled());

    // Escuchar cambios de display-mode
    const mediaQuery = window.matchMedia ? window.matchMedia("(display-mode: standalone)") : null;
    const handleMediaChange = (event) => {
      if (event.matches) {
        setInstalled(true);
        setShowModal(false);
      }
    };

    if (mediaQuery) {
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleMediaChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleMediaChange);
      }
    }

    // Escuchar evento beforeinstallprompt en Android / Chrome
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Escuchar evento appinstalled
    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowModal(false);
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      if (mediaQuery) {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener("change", handleMediaChange);
        } else if (mediaQuery.removeListener) {
          mediaQuery.removeListener(handleMediaChange);
        }
      }
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    // Si ya está instalada, no hacer nada
    if (installed) return;

    // En Android / Chrome con soporte nativo
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === "accepted") {
          setInstalled(true);
          setDeferredPrompt(null);
          setShowModal(false);
        } else {
          // El usuario canceló o pospuso
          setDeferredPrompt(null);
        }
      } catch (error) {
        console.warn("[PWA] Error en prompt de instalación:", error);
        setShowModal(true);
      }
    } else {
      // En iOS o navegadores sin beforeinstallprompt directo, mostrar panel de instrucciones
      setShowModal(true);
    }
  }, [installed, deferredPrompt]);

  return {
    installed,
    isIos,
    canInstallNative: Boolean(deferredPrompt),
    showModal,
    setShowModal,
    triggerInstall,
  };
}
