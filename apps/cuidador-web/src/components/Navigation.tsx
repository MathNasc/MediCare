import React from 'react';
import { Home, Users, Calendar, BarChart3, LogOut } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';

export type NavTab = 'dashboard' | 'patients' | 'agenda' | 'reports';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onSelectTab }) => {
  const { logout, user } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Início', icon: Home },
    { id: 'patients', label: 'Pacientes', icon: Users },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
  ] as const;

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex flex-col w-64 bg-[#111827] border-r border-[#1f2937] p-5 justify-between select-none">
        <div>
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-lg">
              M
            </div>
            <div>
              <div className="font-bold text-slate-100 text-base leading-tight">MediCare</div>
              <div className="text-xs text-blue-400 font-semibold tracking-wide">CUIDADOR WEB</div>
            </div>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[#1f2937] pt-4 px-2">
          <div className="flex items-center justify-between mb-3">
            <div className="truncate">
              <div className="text-xs text-slate-400 font-medium">Conectado como</div>
              <div className="text-sm font-bold text-slate-200 truncate">{user?.nome || 'Cuidador'}</div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (hidden on desktop) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur-md border-t border-[#1e293b] px-3 py-2 z-50 flex items-center justify-around select-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors ${
                isActive ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[11px] leading-none">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
