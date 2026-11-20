'use client';

import React, { useState } from 'react';
import { ArrowRight, Download, Smartphone, CheckCircle2, Info } from 'lucide-react';
import { usePWAInstall } from '@/lib/usePWA';

export default function CuidadorPortalActions({
  apkAvailable = true,
  versionName = '2.0.0',
}) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showPwaGuide, setShowPwaGuide] = useState(false);

  const handleInstallPwa = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowPwaGuide((prev) => !prev);
    }
  };

  return (
    <div className="pt-6 mt-2 space-y-2.5">
      <a
        href="/cuidador"
        className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm py-3 px-5 rounded-xl transition-colors shadow-lg shadow-blue-600/20 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#131d31]"
      >
        <span>Acessar MediCare Cuidador</span>
        <ArrowRight size={16} className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </a>

      {apkAvailable ? (
        <a
          href="/api/apk/cuidador"
          download="MediCare-Cuidador.apk"
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#0b1120] hover:bg-slate-800/90 active:bg-slate-800 border border-blue-500/35 hover:border-blue-400/60 text-blue-300 hover:text-blue-200 font-semibold text-sm py-2.5 px-5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#131d31]"
        >
          <Smartphone size={16} className="w-4 h-4 shrink-0" />
          <span>Baixar versão mobile</span>
          <span className="text-[11px] font-medium text-slate-400 tabular-nums">
            (Android · v{versionName})
          </span>
        </a>
      ) : (
        <button
          type="button"
          onClick={handleInstallPwa}
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#0b1120] hover:bg-slate-800/90 border border-blue-500/35 hover:border-blue-400/60 text-blue-300 hover:text-blue-200 font-semibold text-sm py-2.5 px-5 rounded-xl transition-colors"
        >
          <Download size={16} className="w-4 h-4 shrink-0" />
          <span>Baixar versão mobile (PWA)</span>
        </button>
      )}

      {apkAvailable && !isInstalled && (isInstallable || isIOS) && (
        <button
          type="button"
          onClick={handleInstallPwa}
          className="w-full inline-flex items-center justify-center gap-1.5 pt-1 text-[11px] text-slate-400 hover:text-blue-300 transition-colors"
        >
          <Info size={12} className="w-3 h-3 shrink-0" />
          <span>
            {isIOS
              ? 'Usando iPhone? Veja como instalar na Tela de Início'
              : 'Ou instalar direto pelo navegador (PWA)'}
          </span>
        </button>
      )}

      {isInstalled && (
        <div className="flex items-center justify-center gap-1.5 pt-0.5 text-[11px] text-emerald-400">
          <CheckCircle2 size={12} className="w-3 h-3 shrink-0" />
          <span>Versão Web App instalada neste aparelho</span>
        </div>
      )}

      {showPwaGuide && !isInstallable && (
        <div className="p-3 rounded-xl bg-[#0b1120] border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-1">
          <p className="font-semibold text-white">Instalar no celular pelo navegador:</p>
          {isIOS ? (
            <p>
              No Safari, toque em <strong>Compartilhar</strong> e selecione{' '}
              <strong>Adicionar à Tela de Início</strong>.
            </p>
          ) : (
            <p>
              No Chrome ou Edge, abra o menu <strong>⋮</strong> no canto superior direito e toque em{' '}
              <strong>Instalar aplicativo</strong>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
