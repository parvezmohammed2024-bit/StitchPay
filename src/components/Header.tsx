import React, { useState } from 'react';
import { Shirt, Globe, Database, UserCheck, Crown, LogOut, X, ChevronRight, User } from 'lucide-react';
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const hideAdminControls = isWorkerPortal || currentRole === 'worker';

  const userInitial = currentUser?.full_name?.charAt(0).toUpperCase() || 'U';

  return (
    <>
      <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white h-14 px-3 sm:px-4 flex items-center justify-between shadow-md w-full max-w-full overflow-hidden">
        {/* Left: StitchPay Logo Only */}
        <div className="flex items-center space-x-2 shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-7 h-7 object-contain rounded-lg bg-white/10 p-1" />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-amber-400 font-bold shadow-inner shrink-0">
              <Shirt className="w-4 h-4" />
            </div>
          )}
          <div className="flex items-center space-x-1.5">
            <span className="font-extrabold text-base tracking-tight text-white">Stitch<span className="text-amber-400">Pay</span></span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-mono hidden sm:inline-block">v1.1</span>
          </div>
        </div>

        {/* Center Desktop Badge */}
        {!hideAdminControls && (
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
        )}

        {/* Right Desktop & Mobile Controls */}
        <div className="flex items-center space-x-2">
          {/* Desktop User Info */}
          {currentUser && (
            <div className="hidden md:flex items-center space-x-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-black text-xs shrink-0">
                {userInitial}
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
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all ml-1 min-h-[36px]"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
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
              className="hidden md:flex items-center space-x-1 bg-sky-950 hover:bg-sky-900 text-sky-400 border border-sky-500/30 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all min-h-[36px]"
              title="Worker Portal"
            >
              <UserCheck className="w-3.5 h-3.5 text-sky-400" />
              <span>Worker Portal</span>
            </a>
          )}

          {/* Desktop Language Switcher */}
          <button
            onClick={() => onLangChange(lang === 'en' ? 'bn' : 'en')}
            className="hidden md:flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition-colors min-h-[36px]"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold uppercase text-[11px]">{lang}</span>
          </button>

          {/* Mobile User Avatar Trigger Button */}
          <button
            onClick={() => setIsProfileOpen(true)}
            className="md:hidden w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-md ring-2 ring-indigo-500/30 shrink-0"
            aria-label="User profile"
          >
            {userInitial}
          </button>
        </div>
      </header>

      {/* Mobile Profile Slide-up Sheet */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-sm p-0 md:hidden animate-fade-in">
          <div className="w-full bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto animate-slide-up shadow-2xl">
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600 text-amber-300 flex items-center justify-center font-black text-base border border-indigo-400/40">
                  {userInitial}
                </div>
                <div>
                  <div className="font-bold text-sm text-white">{currentUser?.full_name || 'User Account'}</div>
                  <div className="text-xs text-amber-400 font-mono font-semibold uppercase">
                    {currentUser?.role === 'admin' ? 'Master Admin' : currentUser?.role || currentRole}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsProfileOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Email & Details */}
            {currentUser?.email && (
              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 text-xs space-y-1">
                <div className="text-slate-400 font-medium">Logged in as</div>
                <div className="text-white font-mono font-semibold truncate">{currentUser.email}</div>
              </div>
            )}

            {/* DB & Quick Actions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-slate-800 text-xs">
                <div className="flex items-center space-x-2">
                  <Database className={`w-4 h-4 ${isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <span className="text-slate-300 font-medium">Database Connection</span>
                </div>
                <span className={`font-mono text-[11px] font-bold ${isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isSupabaseConfigured ? 'Supabase Connected' : 'In-Memory / Preview'}
                </span>
              </div>

              {!hideAdminControls && onOpenRoleManager && (
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    onOpenRoleManager();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold min-h-[44px]"
                >
                  <div className="flex items-center space-x-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>Master Admin Role Manager</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {!hideAdminControls && (
                <a
                  href="/worker"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsProfileOpen(false);
                    window.history.pushState({}, '', '/worker');
                    window.dispatchEvent(new Event('popstate'));
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-sky-950/80 border border-sky-500/30 text-sky-400 text-xs font-bold min-h-[44px]"
                >
                  <div className="flex items-center space-x-2">
                    <UserCheck className="w-4 h-4 text-sky-400" />
                    <span>Open Worker Portal (/worker)</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </a>
              )}

              {/* Language Switch */}
              <button
                onClick={() => {
                  onLangChange(lang === 'en' ? 'bn' : 'en');
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-800 border border-slate-700 text-xs text-white font-bold min-h-[44px]"
              >
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  <span>Language</span>
                </div>
                <span className="uppercase text-amber-400 font-mono">{lang === 'en' ? 'English' : 'বাংলা'}</span>
              </button>
            </div>

            {/* Sign Out Button */}
            {onLogout && (
              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center justify-center space-x-2 p-3.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all min-h-[44px]"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

