import React from 'react';
import { Shirt, Globe, ShieldCheck, Database, UserCheck, Crown, LogIn, LogOut, User } from 'lucide-react';
import { useTranslation, Language } from '../lib/i18n';
import { UserRole, UserAccount } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  lang: Language;
  onLangChange: (lang: Language) => void;
  factoryName: string;
  logoUrl?: string | null;
  currentUser?: UserAccount | null;
  onOpenAuthModal?: () => void;
  onLogout?: () => void;
  onOpenRoleManager?: () => void;
  isWorkerPortal?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  lang,
  onLangChange,
  factoryName,
  logoUrl,
  currentUser,
  onOpenAuthModal,
  onLogout,
  onOpenRoleManager,
  isWorkerPortal,
}) => {
  const { t } = useTranslation();

  const hideAdminControls = isWorkerPortal || currentRole === 'worker';

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white px-3 py-2.5 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Logo & Factory Name */}
        <div className="flex items-center space-x-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain rounded-lg bg-white/10 p-1" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-amber-400 font-bold shadow-inner shrink-0">
              <Shirt className="w-4 h-4" />
            </div>
          )}
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-base tracking-tight text-white">Stitch<span className="text-amber-400">Pay</span></span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-mono">v1.1</span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block truncate max-w-[180px]">{factoryName}</p>
          </div>
        </div>

        {/* Center: DB Status Indicator & Master Admin Quick Access (Hidden on Worker Portal) */}
        {!hideAdminControls ? (
          <div className="hidden md:flex items-center space-x-2 text-xs">
            <div className="flex items-center space-x-1.5 bg-slate-800 px-3 py-1 rounded-full border border-slate-700/60">
              <Database className={`w-3.5 h-3.5 ${isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span className="text-slate-300 text-[11px]">
                {isSupabaseConfigured ? 'Supabase Connected' : 'In-Memory / Preview'}
              </span>
            </div>

            <button
              onClick={onOpenRoleManager}
              className="flex items-center space-x-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/30 text-[11px] font-medium transition-colors"
              title="Master Admin: Assign Roles to Users & Workers"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Master Admin</span>
            </button>
          </div>
        ) : (
          <div className="hidden sm:flex items-center space-x-2 bg-indigo-950/60 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-semibold text-indigo-300">
            <UserCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>Worker Portal Mode</span>
          </div>
        )}

        {/* Right Controls: Auth User, Database Role Badge & Language Toggle */}
        <div className="flex items-center space-x-2">
          {currentUser && (
            <div className="flex items-center space-x-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-black text-xs shrink-0">
                {currentUser.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left pr-1">
                <div className="text-[11px] font-bold text-white truncate max-w-[120px]">
                  {currentUser.full_name}
                </div>
                <div className="text-[9px] text-amber-400 font-mono uppercase tracking-wider font-bold">
                  {currentUser.role === 'admin' ? 'Master Admin' : currentUser.role}
                </div>
              </div>

              <button
                onClick={onLogout}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all ml-1"
                title="Sign Out of Supabase Account"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          )}

          {!hideAdminControls && (
            <a
              href="/worker"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/worker');
                window.dispatchEvent(new Event('popstate'));
              }}
              className="flex items-center space-x-1 bg-sky-950 hover:bg-sky-900 text-sky-400 border border-sky-500/30 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all"
              title="Go to Worker Portal (/worker)"
            >
              <UserCheck className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Worker Portal</span>
              <span className="text-[10px] opacity-75">(/worker)</span>
            </a>
          )}

          {/* Language Switcher */}
          <button
            onClick={() => onLangChange(lang === 'en' ? 'bn' : 'en')}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold uppercase text-[11px]">{lang}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
