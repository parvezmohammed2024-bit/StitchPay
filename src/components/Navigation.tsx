import React, { useState } from 'react';
import { 
  LayoutDashboard, Zap, Scissors, Users, Table, 
  CalendarCheck, Banknote, BarChart3, Settings,
  Workflow, BadgePercent, Layers, MoreHorizontal, X, LogOut, ChevronRight, Building2
} from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { UserRole } from '../types';

export type ScreenId = 
  | 'dashboard' 
  | 'workerPortal'
  | 'mgmtPortal'
  | 'dailySetup'
  | 'quickEntry' 
  | 'cutting'
  | 'finishing'
  | 'rateBids'
  | 'teams'
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
  onLogout?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeScreen, onNavigate, role, onLogout }) => {
  const { t } = useTranslation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const desktopNavItems = [
    { id: 'dashboard' as ScreenId, label: t('navDashboard'), icon: LayoutDashboard, roles: ['admin', 'supervisor', 'accounts'] },
    { id: 'dailySetup' as ScreenId, label: 'Daily Line Setup', icon: Workflow, roles: ['admin', 'supervisor'] },
    { id: 'quickEntry' as ScreenId, label: t('navQuickEntry'), icon: Zap, roles: ['admin', 'supervisor'] },
    { id: 'cutting' as ScreenId, label: 'Cutting Board', icon: Scissors, roles: ['admin', 'supervisor', 'accounts'] },
    { id: 'finishing' as ScreenId, label: 'Finishing', icon: Layers, roles: ['admin', 'supervisor', 'accounts'] },
    { id: 'rateBids' as ScreenId, label: 'Rate Approvals', icon: BadgePercent, roles: ['admin', 'supervisor'] },
    { id: 'teams' as ScreenId, label: 'Teams', icon: Users, roles: ['admin', 'supervisor'] },
    { id: 'styles' as ScreenId, label: t('navStyles'), icon: Scissors, roles: ['admin', 'supervisor', 'accounts'] },
    { id: 'workers' as ScreenId, label: t('navWorkers'), icon: Users, roles: ['admin', 'supervisor', 'accounts'] },
    { id: 'bulkGrid' as ScreenId, label: t('navBulkGrid'), icon: Table, roles: ['admin', 'supervisor'] },
    { id: 'attendance' as ScreenId, label: t('navAttendance'), icon: CalendarCheck, roles: ['admin', 'supervisor', 'accounts'] },
    { id: 'payroll' as ScreenId, label: t('navPayroll'), icon: Banknote, roles: ['admin', 'accounts'] },
    { id: 'reports' as ScreenId, label: t('navReports'), icon: BarChart3, roles: ['admin', 'accounts'] },
    { id: 'settings' as ScreenId, label: t('navSettings'), icon: Settings, roles: ['admin'] },
  ];

  const visibleDesktopItems = desktopNavItems.filter(item => item.roles.includes(role));

  // Fixed 5 items for mobile bottom bar
  const mainMobileTabs = [
    { id: 'dashboard' as ScreenId, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'dailySetup' as ScreenId, label: 'Daily', icon: Workflow },
    { id: 'quickEntry' as ScreenId, label: 'Quick Entry', icon: Zap },
    { id: 'workers' as ScreenId, label: 'Workers', icon: Users },
  ];

  // Items for "More" sheet
  const moreSheetItems = [
    { id: 'cutting' as ScreenId, label: 'Cutting Board', icon: Scissors, roles: ['admin', 'supervisor', 'accounts'] },
    { id: 'styles' as ScreenId, label: 'Styles & Processes', icon: Scissors, roles: ['admin', 'supervisor', 'accounts'] },
    { id: 'bulkGrid' as ScreenId, label: 'Bulk Grid', icon: Table, roles: ['admin', 'supervisor'] },
    { id: 'attendance' as ScreenId, label: 'Attendance', icon: CalendarCheck, roles: ['admin', 'supervisor', 'accounts'] },
    { id: 'payroll' as ScreenId, label: 'Payroll Run', icon: Banknote, roles: ['admin', 'accounts'] },
    { id: 'rateBids' as ScreenId, label: 'Rate Approvals', icon: BadgePercent, roles: ['admin', 'supervisor'] },
    { id: 'reports' as ScreenId, label: 'Reports', icon: BarChart3, roles: ['admin', 'accounts'] },
    { id: 'finishing' as ScreenId, label: 'Finishing', icon: Layers, roles: ['admin', 'supervisor', 'accounts'] },
    { id: 'settings' as ScreenId, label: 'Settings', icon: Settings, roles: ['admin'] },
  ].filter(item => item.roles.includes(role));

  const isMoreActive = moreSheetItems.some(item => item.id === activeScreen);

  return (
    <>
      {/* Desktop Sidebar - Hides below 768px (md) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-stone-200 p-4 space-y-1 shrink-0">
        <div className="text-xs font-semibold text-stone-600 uppercase tracking-wider px-3 mb-2">
          Navigation Menu
        </div>
        {visibleDesktopItems.map(item => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all ${
                isActive
                  ? 'bg-indigo-700 text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-amber-400' : 'text-stone-500'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </aside>

      {/* Mobile Fixed 5-Item Bottom Navigation Bar (56px tall, identical on every screen) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white border-t border-stone-200 shadow-md flex justify-around items-center px-1 overflow-hidden select-none pb-safe">
        {mainMobileTabs.map(item => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setIsMoreOpen(false);
                onNavigate(item.id);
              }}
              className={`flex flex-col items-center justify-center h-full w-1/5 py-1 transition-all ${
                isActive ? 'text-indigo-700 font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <div className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700' : ''}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-700' : 'text-stone-500'}`} />
              </div>
              <span className="text-[10px] tracking-tight leading-none mt-0.5 truncate max-w-[64px]">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* 5th Tab: More */}
        <button
          onClick={() => setIsMoreOpen(true)}
          className={`flex flex-col items-center justify-center h-full w-1/5 py-1 transition-all ${
            isMoreActive ? 'text-indigo-700 font-bold' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <div className={`p-1 rounded-xl transition-colors ${isMoreActive ? 'bg-indigo-50 text-indigo-700' : ''}`}>
            <MoreHorizontal className={`w-5 h-5 ${isMoreActive ? 'text-indigo-700' : 'text-stone-500'}`} />
          </div>
          <span className="text-[10px] tracking-tight leading-none mt-0.5 truncate max-w-[64px]">
            More
          </span>
        </button>
      </nav>

      {/* "More" Slide-Up Sheet */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 backdrop-blur-xs p-0 md:hidden">
          <div className="w-full bg-white border-t border-stone-200 rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center space-x-2">
                <MoreHorizontal className="w-5 h-5 text-indigo-700" />
                <span className="font-extrabold text-base text-stone-900">More Operations</span>
              </div>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="w-9 h-9 rounded-full bg-stone-100 text-stone-600 hover:text-stone-900 flex items-center justify-center border border-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {moreSheetItems.map(item => {
                const Icon = item.icon;
                const isActive = activeScreen === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setIsMoreOpen(false);
                      onNavigate(item.id);
                    }}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border text-sm font-bold transition-all min-h-[48px] ${
                      isActive
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                        : 'bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-xl ${isActive ? 'bg-indigo-700 text-white' : 'bg-stone-200 text-stone-700'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </button>
                );
              })}

              {onLogout && (
                <button
                  onClick={() => {
                    setIsMoreOpen(false);
                    onLogout();
                  }}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-bold min-h-[48px] mt-2"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                      <LogOut className="w-5 h-5" />
                    </div>
                    <span>Sign Out</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-rose-500" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

