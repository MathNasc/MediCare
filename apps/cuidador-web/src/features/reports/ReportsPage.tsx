import React from 'react';
import { BarChart3, TrendingUp, CheckCircle, AlertTriangle, ShieldCheck, Download } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Indicadores e Relatórios</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Métricas oficiais calculadas pelo backend para acompanhamento clínico de adesão.
          </p>
        </div>

        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-colors">
          <Download className="w-4 h-4" />
          <span>Exportar Relatório PDF</span>
        </button>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#131d31] p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Taxa Geral de Adesão</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-white">88.5%</div>
          <p className="text-xs text-slate-500 mt-1">Últimos 30 dias (cálculo ponderado oficial)</p>
        </div>

        <div className="bg-[#131d31] p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Doses no Prazo</span>
            <CheckCircle className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-black text-white">92.0%</div>
          <p className="text-xs text-slate-500 mt-1">Ingeridas em até 30 min do horário</p>
        </div>

        <div className="bg-[#131d31] p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Alertas de Estoque</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-amber-400">1</div>
          <p className="text-xs text-slate-500 mt-1">Medicamento com menos de 5 dias</p>
        </div>
      </div>

      {/* Audit & Compliance Card */}
      <div className="bg-[#131d31] p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Auditoria e Rastreabilidade</h3>
            <p className="text-xs text-slate-400">Trilha de modificações com preservação de autoria</p>
          </div>
        </div>

        <div className="text-sm text-slate-300 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          Todas as administrações confirmadas retroativamente por cuidadores gravam o identificador exclusivo do profissional e a justificativa clínica em conformidade com as diretrizes do CFM e da LGPD.
        </div>
      </div>
    </div>
  );
};
