import React from 'react';
import { 
  LayoutDashboard, Zap, Scissors, Users, Table, 
  CalendarCheck, Banknote, BarChart3, Settings,
  Workflow, BadgePercent, UserCheck, Truck
} from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { UserRole } from '../types';

export type ScreenId = 
  | 'dashboard' 
  | 'workerPortal'
  | 'dailySetup'
  | 'quickEntry' 
  | 'deliveries'
  | 'rateBids'
  | 'bulkGrid' 
  | 'styles' 
  | 'workers' 
  | 'attendance' 
  | 'payroll' 
  | 'reports' 
  | 'settings';

interface NavigationProps {
  activeScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  role: UserRole;
}

export const Navigation: React.FC<NavigationProps> = ({ activeScreen, onNavigate, role }) => {
  const { t } = useTranslation();

  const navItems = [
    { id: 'dashboard' as ScreenId, label: t('navDashboard'), icon: LayoutDashboard, roles: ['admin', 'supervisor', 'accounts'] },
    { id: 'dailySetup' as ScreenId, label: 'Daily Line Setup', icon: Workflow, roles: ['admin', 'supervisor'] },
    { id: 'quickEntry' as ScreenId, label: t('navQuickEntry'), icon: Zap, roles: ['admin', 'supervisor'] },
    { id: 'deliveries' as ScreenId, label: 'Delivery Reports', icon: Truck, roles: ['admin', 'supervisor', 'accounts'] },
    { id: 'rateBids' as ScreenId, label: 'Rate Approvals', icon: BadgePercent, roles: ['admin', 'supervisor'] },
    { id: 'styles' as ScreenId, label: t('navStyles'), icon: Scissors, roles: ['admin', 'supervisor', 'accounts'] },
    { id: 'workers' as ScreenId, label: t('navWorkers'), icon: Users, roles: ['admin', 'supervisor', 'accounts'] },
    { id: 'bulkGrid' as ScreenId, label: t('navBulkGrid'), icon: Table, roles: ['admin', 'supervisor'] },
    { id: 'attendance' as ScreenId, label: t('navAttendance'), icon: CalendarCheck, roles: ['admin', 'supervisor', 'accounts'] },
    { id: 'payroll' as ScreenId, label: t('navPayroll'), icon: Banknote, roles: ['admin', 'accounts'] },
    { id: 'reports' as ScreenId, label: t('navReports'), icon: BarChart3, roles: ['admin', 'accounts'] },
    { id: 'settings' as ScreenId, label: t('navSettings'), icon: Settings, roles: ['admin'] },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(role));

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 p-4 space-y-1 shrink-0">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
          Navigation Menu
        </div>
        {visibleItems.map(item => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-2xl px-2 py-1 flex justify-around items-center overflow-x-auto">
        {visibleItems.slice(0, 6).map(item => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-lg transition-all text-[10px] font-medium min-w-[50px] ${
                isActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-full ${isActive ? 'bg-indigo-600/30' : ''}`}>
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400 scale-110' : 'text-slate-400'}`} />
              </div>
              <span className="truncate max-w-[58px]">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
