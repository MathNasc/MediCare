'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Download, WifiOff, X, Share } from 'lucide-react';

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
  if (document.readyState === 'complete') {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const checkStandalone = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    setIsInstalled(checkStandalone());

    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua) && !window.MSStream;
    setIsIOS(iosDevice);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
    } catch {}
    return false;
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function PWAInstallButton({ variant = 'header', onAfterAction }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (!isInstallable && !isIOS) return null;

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      if (onAfterAction) onAfterAction();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const buttonNode =
    variant === 'menu' ? (
      <button
        type="button"
        onClick={handleClick}
        className="w-full min-h-[50px] flex items-center justify-between px-4 py-3 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-300 text-sm font-semibold hover:bg-blue-600/20 transition-colors"
      >
        <span className="flex items-center gap-3">
          <Download size={18} className="w-4 h-4 text-blue-400" />
          Instalar aplicativo (PWA)
        </span>
      </button>
    ) : variant === 'auth' ? (
      <button
        type="button"
        onClick={handleClick}
        className="w-full mt-4 min-h-[42px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0b1120] border border-slate-700/80 hover:border-blue-500/50 text-xs font-semibold text-blue-300 transition-colors"
      >
        <Download size={15} className="w-4 h-4 text-blue-400 shrink-0" />
        <span>Instalar MediCare Cuidador no celular</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={handleClick}
        title="Instalar aplicativo"
        aria-label="Instalar aplicativo"
        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-300 hover:bg-blue-600/25 text-xs font-semibold transition-colors whitespace-nowrap"
      >
        <Download size={14} className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Instalar app</span>
      </button>
    );

  return (
    <>
      {buttonNode}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="bg-[#131d31] rounded-t-3xl sm:rounded-2xl border border-slate-800 p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-white">Instalar no iPhone / iPad</h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white"
                aria-label="Fechar"
              >
                <X size={18} className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-2.5 text-xs text-slate-300 leading-relaxed mb-5">
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-400">1.</span>
                <span>
                  Toque no botão <strong className="text-white inline-flex items-center gap-1"><Share size={12} className="w-3 h-3 inline" /> Compartilhar</strong> na barra do Safari.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-400">2.</span>
                <span>
                  Role para baixo e toque em <strong className="text-white">Adicionar à Tela de Início</strong>.
                </span>
              </li>
            </ol>
            <button
              type="button"
              onClick={() => {
                setShowIOSGuide(false);
                if (onAfterAction) onAfterAction();
              }}
              className="w-full min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-4 left-4 right-4 sm:right-auto z-50 flex items-center gap-2 rounded-xl bg-amber-600/95 border border-amber-400/40 px-3.5 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md"
    >
      <WifiOff size={15} className="w-4 h-4 shrink-0" />
      <span>Modo offline — verifique sua conexão para atualizar os dados.</span>
    </div>
  );
}
