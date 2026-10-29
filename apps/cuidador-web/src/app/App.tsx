import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { LoginPage } from '@/features/auth/LoginPage';
import { Navigation, NavTab } from '@/components/Navigation';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { PatientsPage } from '@/features/patients/PatientsPage';
import { AgendaPage } from '@/features/agenda/AgendaPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { Bell, ShieldCheck } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1120] flex items-center justify-center text-slate-400 text-sm">
        Carregando MediCare Cuidador...
      </div>
    );
  }

  // Se não autenticado, exibe a tela de login
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col md:flex-row font-sans antialiased">
      {/* Sidebar (Desktop) and BottomNav (Mobile) */}
      <Navigation currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-[#1f2937] px-6 flex items-center justify-between bg-[#0b1120]/80 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-slate-200 capitalize">
              {currentTab === 'dashboard' && 'Visão Geral'}
              {currentTab === 'patients' && 'Gestão de Pacientes'}
              {currentTab === 'agenda' && 'Agenda e Consultas'}
              {currentTab === 'reports' && 'Relatórios Clínicos'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-700/60">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sincronizado com Oracle Cloud</span>
            </div>

            <button
              aria-label="Notificações"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              <span className="w-2 h-2 rounded-full bg-blue-500 absolute top-2 right-2 ring-2 ring-[#0b1120]" />
            </button>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardPage
              onNavigateToPatients={() => setCurrentTab('patients')}
              onNavigateToAgenda={() => setCurrentTab('agenda')}
            />
          )}
          {currentTab === 'patients' && <PatientsPage />}
          {currentTab === 'agenda' && <AgendaPage />}
          {currentTab === 'reports' && <ReportsPage />}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
};

export default App;
