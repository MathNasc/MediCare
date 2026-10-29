import React from 'react';
import { Calendar, Plus, Clock, MapPin, User } from 'lucide-react';
import { AppointmentItem } from '@/types';

export const AgendaPage: React.FC = () => {
  const appointments: AppointmentItem[] = [
    {
      id: 'apt-1',
      patient_id: 'p1',
      patient_name: 'João Ferreira',
      type: 'consulta',
      title: 'Cardiologia - Avaliação de Rotina',
      date: '15/11/2026',
      time: '14:30',
      doctor: 'Dr. Feres Chaddad Neto',
      location: 'Hospital São Paulo - Sala 304',
    },
    {
      id: 'apt-2',
      patient_id: 'p2',
      patient_name: 'Maria Clara Santos',
      type: 'exame',
      title: 'Exame de Sangue em Jejum',
      date: '20/11/2026',
      time: '07:30',
      doctor: 'Laboratório Fleury',
      location: 'Unidade Paulista',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Agenda Médica</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Consultas, exames e compromissos clínicos de todos os pacientes.
          </p>
        </div>

        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-colors">
          <Plus className="w-4 h-4" />
          <span>Novo Compromisso</span>
        </button>
      </div>

      <div className="space-y-3">
        {appointments.map((apt) => (
          <div
            key={apt.id}
            className="bg-[#131d31] p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400">
                <Calendar className="w-6 h-6" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-base">{apt.title}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-semibold capitalize">
                    {apt.type}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-2">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>{apt.patient_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{apt.date} às {apt.time}</span>
                  </div>
                  {apt.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      <span>{apt.location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center">
              <button className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
