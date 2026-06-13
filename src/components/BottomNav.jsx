'use client';
import { C } from '@/lib/theme';

const TABS = [
  { id: 'home',    emoji: '🏠', label: 'Início'  },
  { id: 'meds',    emoji: '💊', label: 'Meds'    },
  { id: 'stats',   emoji: '📊', label: 'Saúde'   },
  { id: 'ai',      emoji: '✨', label: 'IA'      },
  { id: 'profile', emoji: '👤', label: 'Perfil'  },
];

export function BottomNav({ tab, setTab, T, pendingCount, criticalCount }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: T.nav, borderTop: `1px solid ${T.bdr}`,
      zIndex: 50, backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}>
      <div style={{
        maxWidth: 480, margin: '0 auto',
        display: 'flex', padding: '0 6px',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          const badge =
            t.id === 'home' && pendingCount > 0 ? pendingCount :
            t.id === 'meds' && criticalCount > 0 ? criticalCount : 0;

          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-label={t.label}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 2, padding: '9px 4px 8px',
                background: 'none', border: 'none',
                position: 'relative', minHeight: 58,
              }}
            >
              {badge > 0 && (
                <div style={{
                  position: 'absolute', top: 5, right: '16%',
                  width: 17, height: 17, borderRadius: '50%',
                  background: C.red, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 900, color: '#fff', zIndex: 1,
                }}>
                  {badge}
                </div>
              )}
              <div style={{
                width: 36, height: 26, borderRadius: 8,
                background: active ? 'rgba(59,130,246,.15)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .2s',
                transform: active ? 'scale(1.12)' : 'scale(1)',
              }}>
                <span style={{ fontSize: 17 }}>{t.emoji}</span>
              </div>
              <span style={{
                fontSize: 9, fontWeight: active ? 800 : 500,
                color: active ? C.blue : T.muted,
                transition: 'color .2s',
              }}>
                {t.label}
              </span>
              {active && (
                <div style={{
                  position: 'absolute', bottom: 0,
                  left: '28%', right: '28%', height: 2,
                  borderRadius: 99, background: C.blue,
                }} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
