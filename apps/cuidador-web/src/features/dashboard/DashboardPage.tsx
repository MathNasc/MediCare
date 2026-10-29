import React from 'react';
import { Bell, CheckCircle2, Clock, AlertTriangle, ArrowRight, PlusCircle, ShieldCheck } from 'lucide-react';

interface DashboardPageProps {
  onNavigateToPatients: () => void;
  onNavigateToAgenda: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToPatients, onNavigateToAgenda }) => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-blue-900/40 via-indigo-950/30 to-slate-900/50 p-6 rounded-2xl border border-blue-800/30">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Central de Acompanhamento
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Atividades do Dia</h1>
          <p className="text-sm text-slate-400 mt-1">
            Supervisão em tempo real de administrações e compromissos dos pacientes vinculados.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToPatients}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Vincular Paciente</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#131d31] p-5 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Doses Hoje</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">8</div>
          <div className="text-xs text-slate-500 mt-1">4 de 8 administradas</div>
        </div>

        <div className="bg-[#131d31] p-5 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Pendências</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">2</div>
          <div className="text-xs text-slate-500 mt-1">Requerem atenção</div>
        </div>

        <div className="bg-[#131d31] p-5 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Confirmadas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">4</div>
          <div className="text-xs text-slate-500 mt-1">Adesão positiva</div>
        </div>

        <div className="bg-[#131d31] p-5 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Pacientes Ativos</span>
            <Bell className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400">2</div>
          <div className="text-xs text-slate-500 mt-1">Tratamentos regulares</div>
        </div>
      </div>

      {/* Central Timeline / Pendências Operacionais */}
      <div className="bg-[#131d31] rounded-2xl border border-slate-800/80 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Linha do Tempo de Administrações</h2>
            <p className="text-xs text-slate-400">Horários programados e estado de confirmação</p>
          </div>
          <button
            onClick={onNavigateToAgenda}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
          >
            <span>Ver agenda completa</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Administrations List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-sm">
                08:00
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">Losartana Potássica 50mg</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold">
                    Tomada
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Paciente: <span className="text-slate-300 font-medium">João Ferreira</span> • Confirmada pelo paciente via app
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-500">08:04</div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-sm">
                14:00
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">Amoxicilina 500mg</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-semibold">
                    Pendente
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Paciente: <span className="text-slate-300 font-medium">Maria Clara Santos</span> • 1 comprimido
                </div>
              </div>
            </div>
            <button className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors">
              Registrar Dose
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-sm">
                20:00
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">Atorvastatina 20mg</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300 font-semibold">
                    Prevista
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Paciente: <span className="text-slate-300 font-medium">João Ferreira</span> • 1 comprimido à noite
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-500">Hoje</div>
          </div>
        </div>
      </div>
    </div>
  );
};
