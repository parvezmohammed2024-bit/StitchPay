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
      <header className="sticky top-0 z-30 bg-white border-b border-stone-200 text-stone-900 h-14 px-3 sm:px-4 flex items-center justify-between shadow-xs w-full max-w-full overflow-hidden">
        {/* Left: StitchPay Logo Only */}
        <div className="flex items-center space-x-2 shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-7 h-7 object-contain rounded-lg bg-stone-100 p-1 border border-stone-200" />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-indigo-700 flex items-center justify-center text-amber-400 font-bold shadow-xs shrink-0">
              <Shirt className="w-4 h-4" />
            </div>
          )}
          <div className="flex items-center space-x-1.5">
            <span className="font-extrabold text-base tracking-tight text-stone-900">Stitch<span className="text-amber-700">Pay</span></span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono hidden sm:inline-block">v1.1</span>
          </div>
        </div>

        {/* Center Desktop Badge */}
        {!hideAdminControls && (
          <div className="hidden md:flex items-center space-x-2 text-xs">
            <div className="flex items-center space-x-1.5 bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
              <Database className={`w-3.5 h-3.5 ${isSupabaseConfigured ? 'text-emerald-700' : 'text-amber-700'}`} />
              <span className="text-stone-700 text-[11px] font-medium">
                {isSupabaseConfigured ? 'Supabase Connected' : 'In-Memory / Preview'}
              </span>
            </div>

            <button
              onClick={onOpenRoleManager}
              className="flex items-center space-x-1 bg-amber-50 hover:bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full border border-amber-300 text-[11px] font-semibold transition-colors"
              title="Master Admin: Assign Roles to Users & Workers"
            >
              <Crown className="w-3.5 h-3.5 text-amber-700" />
              <span>Master Admin</span>
            </button>
          </div>
        )}

        {/* Right Desktop & Mobile Controls */}
        <div className="flex items-center space-x-2">
          {/* Desktop User Info */}
          {currentUser && (
            <div className="hidden md:flex items-center space-x-2 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200 text-xs">
              <div className="w-7 h-7 rounded-lg bg-indigo-700 text-white flex items-center justify-center font-black text-xs shrink-0">
                {userInitial}
              </div>
              <div className="text-left pr-1">
                <div className="text-[11px] font-bold text-stone-900 truncate max-w-[120px]">
                  {currentUser.full_name}
                </div>
                <div className="text-[9px] text-amber-800 font-mono uppercase tracking-wider font-bold">
                  {currentUser.role === 'admin' ? 'Master Admin' : currentUser.role}
                </div>
              </div>

              <button
                onClick={onLogout}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all ml-1 min-h-[36px]"
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
              className="hidden md:flex items-center space-x-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all min-h-[36px]"
              title="Worker Portal"
            >
              <UserCheck className="w-3.5 h-3.5 text-sky-700" />
              <span>Worker Portal</span>
            </a>
          )}

          {/* Desktop Language Switcher */}
          <button
            onClick={() => onLangChange(lang === 'en' ? 'bn' : 'en')}
            className="hidden md:flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-200 text-xs text-stone-800 transition-colors min-h-[36px]"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-700" />
            <span className="font-semibold uppercase text-[11px]">{lang}</span>
          </button>

          {/* Mobile User Avatar Trigger Button */}
          <button
            onClick={() => setIsProfileOpen(true)}
            className="md:hidden w-9 h-9 rounded-full bg-indigo-700 text-white flex items-center justify-center font-bold text-sm shadow-xs ring-2 ring-indigo-200 shrink-0"
            aria-label="User profile"
          >
            {userInitial}
          </button>
        </div>
      </header>

      {/* Mobile Profile Slide-up Sheet */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 backdrop-blur-xs p-0 md:hidden animate-fade-in">
          <div className="w-full bg-white border-t border-stone-200 rounded-t-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-indigo-700 text-amber-400 flex items-center justify-center font-black text-base border border-indigo-800">
                  {userInitial}
                </div>
                <div>
                  <div className="font-bold text-sm text-stone-900">{currentUser?.full_name || 'User Account'}</div>
                  <div className="text-xs text-amber-800 font-mono font-semibold uppercase">
                    {currentUser?.role === 'admin' ? 'Master Admin' : currentUser?.role || currentRole}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsProfileOpen(false)}
                className="w-9 h-9 rounded-full bg-stone-100 text-stone-600 hover:text-stone-900 flex items-center justify-center border border-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Email & Details */}
            {currentUser?.email && (
              <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 text-xs space-y-1">
                <div className="text-stone-600 font-medium">Logged in as</div>
                <div className="text-stone-900 font-mono font-semibold truncate">{currentUser.email}</div>
              </div>
            )}

            {/* DB & Quick Actions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200 text-xs">
                <div className="flex items-center space-x-2">
                  <Database className={`w-4 h-4 ${isSupabaseConfigured ? 'text-emerald-700' : 'text-amber-700'}`} />
                  <span className="text-stone-700 font-medium">Database Connection</span>
                </div>
                <span className={`font-mono text-[11px] font-bold ${isSupabaseConfigured ? 'text-emerald-700' : 'text-amber-800'}`}>
                  {isSupabaseConfigured ? 'Supabase Connected' : 'In-Memory / Preview'}
                </span>
              </div>

              {!hideAdminControls && onOpenRoleManager && (
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    onOpenRoleManager();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold min-h-[44px]"
                >
                  <div className="flex items-center space-x-2">
                    <Crown className="w-4 h-4 text-amber-700" />
                    <span>Master Admin Role Manager</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-700" />
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
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-bold min-h-[44px]"
                >
                  <div className="flex items-center space-x-2">
                    <UserCheck className="w-4 h-4 text-sky-700" />
                    <span>Open Worker Portal (/worker)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-sky-700" />
                </a>
              )}

              {/* Language Switch */}
              <button
                onClick={() => {
                  onLangChange(lang === 'en' ? 'bn' : 'en');
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-stone-100 border border-stone-200 text-xs text-stone-900 font-bold min-h-[44px]"
              >
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-indigo-700" />
                  <span>Language</span>
                </div>
                <span className="uppercase text-amber-800 font-mono">{lang === 'en' ? 'English' : 'বাংলা'}</span>
              </button>
            </div>

            {/* Sign Out Button */}
            {onLogout && (
              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center justify-center space-x-2 p-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all min-h-[44px]"
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

