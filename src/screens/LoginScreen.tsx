import React, { useState } from 'react';
import { Mail, Lock, KeyRound, ArrowRight, Shirt, AlertCircle, ShieldCheck } from 'lucide-react';
import { dataService } from '../lib/dataService';
import { UserAccount } from '../types';

interface LoginScreenProps {
  onAuthSuccess: (user: UserAccount) => void;
  factoryName?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onAuthSuccess,
  factoryName = 'StitchPay Garments Ltd.',
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both Email Address and Password');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const user = await dataService.loginUser(email.trim(), password.trim());
      onAuthSuccess(user);
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(
        err.message || 'Invalid email or password. Please verify your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background Decorative Gradient Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 text-amber-400 shadow-xl mb-1">
            <Shirt className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Stitch<span className="text-amber-400">Pay</span>
            </h1>
            <p className="text-sm font-semibold text-slate-400 mt-0.5">{factoryName}</p>
          </div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Staff & Admin Auth Portal</span>
          </div>
        </div>

        {/* Main Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-800/80">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Sign In to Account</h2>
              <p className="text-xs text-slate-400">Enter your authorized email and password</p>
            </div>
          </div>

          {/* Feedback Error Message */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-medium flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="parvezmohammed2024@gmail.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2 mt-2"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center">
          <a
            href="/worker"
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, '', '/worker');
              window.dispatchEvent(new Event('popstate'));
            }}
            className="inline-flex items-center space-x-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors cursor-pointer"
          >
            <span>Are you a factory worker? Sign in here</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
