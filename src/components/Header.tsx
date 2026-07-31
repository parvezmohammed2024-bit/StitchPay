import React from 'react';
import { Shirt, Globe, ShieldCheck, Database, Info } from 'lucide-react';
import { useTranslation, Language } from '../lib/i18n';
import { UserRole } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  lang: Language;
  onLangChange: (lang: Language) => void;
  factoryName: string;
  logoUrl?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  lang,
  onLangChange,
  factoryName,
  logoUrl,
}) => {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white px-4 py-3 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Logo & Factory Name */}
        <div className="flex items-center space-x-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-9 h-9 object-contain rounded-lg bg-white/10 p-1" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-amber-400 font-bold shadow-inner">
              <Shirt className="w-5 h-5" />
            </div>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight text-white">Stitch<span className="text-amber-400">Pay</span></span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-mono">v1.0</span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block truncate max-w-[200px]">{factoryName}</p>
          </div>
        </div>

        {/* Center: DB Status Indicator */}
        <div className="hidden md:flex items-center space-x-2 text-xs bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700/60">
          <Database className={`w-3.5 h-3.5 ${isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-slate-300">
            {isSupabaseConfigured ? 'Supabase Connected' : 'In-Memory / Preview Mode'}
          </span>
          {!isSupabaseConfigured && (
            <span className="text-[10px] text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded">RLS Ready</span>
          )}
        </div>

        {/* Right Controls: Role Selector & Language Toggle */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Role Pill Switcher */}
          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 ml-1 hidden xs:block" />
            <button
              onClick={() => onRoleChange('admin')}
              className={`px-2 py-1 rounded-lg transition-all font-medium ${
                currentRole === 'admin'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Full access, set rates, run payroll"
            >
              Admin
            </button>
            <button
              onClick={() => onRoleChange('supervisor')}
              className={`px-2 py-1 rounded-lg transition-all font-medium ${
                currentRole === 'supervisor'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Record floor production & attendance only"
            >
              Supervisor
            </button>
            <button
              onClick={() => onRoleChange('accounts')}
              className={`px-2 py-1 rounded-lg transition-all font-medium ${
                currentRole === 'accounts'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Payroll, advances, reports"
            >
              Accounts
            </button>
          </div>

          {/* Language Switcher */}
          <button
            onClick={() => onLangChange(lang === 'en' ? 'bn' : 'en')}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold uppercase">{lang}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
