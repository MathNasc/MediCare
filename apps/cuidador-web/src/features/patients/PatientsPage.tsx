import React, { useState } from 'react';
import { Search, UserPlus, Shield, ChevronRight, Activity, Calendar } from 'lucide-react';
import { PatientSummary } from '@/types';

export const PatientsPage: React.FC = () => {
  const [search, setSearch] = useState('');

  // Dados de referência estrutural para desenvolvimento de componentes
  const mockPatients: PatientSummary[] = [
    {
      id: 'p1',
      nome: 'João Ferreira',
      social_name: 'Seu João',
      email: 'joao@medicare.local',
      blood_type: 'O+',
      meds_count: 4,
      adherence_rate: 92,
      relationship_label: 'Pai',
      pending_doses_count: 0,
      next_appointment: '15/11/2026 - Cardiologista',
    },
    {
      id: 'p2',
      nome: 'Maria Clara Santos',
      email: 'maria@medicare.local',
      blood_type: 'A+',
      meds_count: 2,
      adherence_rate: 85,
      relationship_label: 'Mãe',
      pending_doses_count: 1,
      next_appointment: '20/11/2026 - Exame de Sangue',
    },
  ];

  const filtered = mockPatients.filter(
    (p) =>
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.relationship_label?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Pacientes Acompanhados</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Gerencie os tratamentos, histórico clínico e vínculos de autorização.
          </p>
        </div>

        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-colors">
          <UserPlus className="w-4 h-4" />
          <span>Aceitar Novo Convite</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar paciente por nome ou parentesco..."
          className="w-full bg-[#131d31] border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Patient Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((patient) => (
          <div
            key={patient.id}
            className="bg-[#131d31] p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-lg">
                  {patient.nome.slice(0, 1)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base group-hover:text-blue-400 transition-colors">
                      {patient.nome}
                    </h3>
                    {patient.relationship_label && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                        {patient.relationship_label}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Tipo sanguíneo: <span className="text-slate-300 font-semibold">{patient.blood_type}</span>
                  </div>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-slate-300 transition-colors" />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-800/80">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>
                  <strong className="text-white">{patient.meds_count}</strong> medicamentos
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Shield className="w-4 h-4 text-blue-400" />
                <span>
                  Adesão: <strong className="text-white">{patient.adherence_rate}%</strong>
                </span>
              </div>
            </div>

            {patient.next_appointment && (
              <div className="mt-3 p-2.5 rounded-lg bg-slate-900/50 border border-slate-800/60 flex items-center gap-2 text-xs text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span className="truncate">{patient.next_appointment}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
