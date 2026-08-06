import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle, Database, ShieldAlert, DollarSign, Bell, Send, User, Layers } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { dataService } from '../lib/dataService';
import { FactorySettings, UserRole, Worker } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import { AuditLogViewer } from '../components/AuditLogViewer';

interface SettingsScreenProps {
  role: UserRole;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ role }) => {
  const { t } = useTranslation();

  const [settings, setSettings] = useState<FactorySettings | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Admin Notification Form State
  const [workersList, setWorkersList] = useState<Worker[]>([]);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifTarget, setNotifTarget] = useState<'everyone' | 'section' | 'worker'>('everyone');
  const [notifSection, setNotifSection] = useState<'Sewing' | 'Cutting' | 'Finishing'>('Sewing');
  const [notifWorkerId, setNotifWorkerId] = useState<string>('');
  const [isSendingNotif, setIsSendingNotif] = useState(false);
  const [notifSuccessMsg, setNotifSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadWorkers();
  }, []);

  const loadSettings = async () => {
    const res = await dataService.getSettings();
    setSettings(res);
  };

  const loadWorkers = async () => {
    const res = await dataService.getWorkers();
    setWorkersList(res);
    if (res.length > 0) {
      setNotifWorkerId(res[0].id);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    await dataService.updateSettings(settings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) return;

    setIsSendingNotif(true);
    setNotifSuccessMsg(null);

    try {
      const selectedWorker = workersList.find(w => w.id === notifWorkerId);
      await dataService.sendNotification({
        title: notifTitle.trim(),
        body: notifMessage.trim(),
        target: notifTarget,
        section: notifTarget === 'section' ? notifSection : null,
        worker_id: notifTarget === 'worker' ? notifWorkerId : null,
      });

      let targetDesc = 'all workers';
      if (notifTarget === 'section') targetDesc = `${notifSection} section`;
      if (notifTarget === 'worker' && selectedWorker) targetDesc = selectedWorker.full_name;

      setNotifSuccessMsg(`Notification sent successfully to ${targetDesc}!`);
      setNotifTitle('');
      setNotifMessage('');

      setTimeout(() => setNotifSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to send notification:', err);
    } finally {
      setIsSendingNotif(false);
    }
  };

  if (!settings) return null;

  return (
    <div className="space-y-6 pb-24 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-stone-200 p-5 rounded-3xl shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-amber-800" />
            <span>Factory Configuration & Payroll Parameters</span>
          </h1>
          <p className="text-xs text-stone-600">Configure factory currency, defect rates, and minimum wage protections</p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center space-x-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all text-sm shrink-0"
        >
          {savedSuccess ? <CheckCircle className="w-4 h-4 text-emerald-200" /> : <Save className="w-4 h-4" />}
          <span>{savedSuccess ? 'Settings Saved!' : 'Save Settings'}</span>
        </button>
      </div>

      {/* Supabase Connection Status Banner */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Database className={`w-6 h-6 ${isSupabaseConfigured ? 'text-emerald-700' : 'text-amber-700'}`} />
          <div>
            <h3 className="text-sm font-bold text-stone-900">
              {isSupabaseConfigured ? 'Supabase Database Connected' : 'In-Memory Preview Mode'}
            </h3>
            <p className="text-xs text-stone-600">
              {isSupabaseConfigured 
                ? 'Reading & writing to live Supabase Postgres tables with Row Level Security.' 
                : 'Configure SUPABASE_URL and SUPABASE_ANON_KEY in environment secrets to persist data to real Postgres.'}
            </p>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-6">
        {/* Section 1: Basic Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider border-b border-stone-200 pb-2">
            Factory Identity & Currency
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-stone-600">Factory Name</label>
              <input
                type="text"
                value={settings.factory_name || ''}
                onChange={e => setSettings({ ...settings, factory_name: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600">Currency Symbol</label>
              <input
                type="text"
                value={settings.currency_symbol || ''}
                onChange={e => setSettings({ ...settings, currency_symbol: e.target.value })}
                placeholder="e.g. MYR, RM, $, €"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 mt-1 font-mono font-bold"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Defect Rates */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider border-b border-stone-200 pb-2">
            Defect Piece Pay Policy (%)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-stone-600">Rework Pay Percent (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={settings.rework_pay_percent ?? ''}
                onChange={e => setSettings({ ...settings, rework_pay_percent: parseFloat(e.target.value) || 0 })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-amber-800 font-mono font-bold mt-1"
              />
              <p className="text-[10px] text-stone-500 mt-1">Percentage of piece rate paid to worker for garments needing rework (default 10%)</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600">Reject Pay Percent (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={settings.reject_pay_percent ?? ''}
                onChange={e => setSettings({ ...settings, reject_pay_percent: parseFloat(e.target.value) || 0 })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-rose-700 font-mono font-bold mt-1"
              />
              <p className="text-[10px] text-stone-500 mt-1">Percentage of piece rate paid for scrapped/rejected garments (default 0%)</p>
            </div>
          </div>
        </div>

        {/* Section 3: Minimum Wage Protection */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider border-b border-stone-200 pb-2">
            Minimum Wage Protection Rules
          </h3>

          <div className="flex items-center justify-between bg-stone-50 p-4 rounded-xl border border-stone-200">
            <div>
              <div className="font-bold text-stone-900 text-sm">Enable Minimum Wage Daily Top-up</div>
              <p className="text-xs text-stone-600">Automatically top-up worker earnings if piece rate total falls below daily minimum threshold</p>
            </div>
            <input
              type="checkbox"
              checked={settings.enable_minimum_wage_topup}
              onChange={e => setSettings({ ...settings, enable_minimum_wage_topup: e.target.checked })}
              className="w-5 h-5 accent-indigo-700 rounded cursor-pointer"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-600">Minimum Wage per Day ({settings.currency_symbol})</label>
            <input
              type="number"
              value={settings.minimum_wage_per_day ?? ''}
              onChange={e => setSettings({ ...settings, minimum_wage_per_day: parseFloat(e.target.value) || 0 })}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-emerald-800 font-mono font-bold mt-1"
            />
          </div>
        </div>
      </form>

      {/* ADMIN ONLY: Send In-App Notification Section */}
      {role === 'admin' && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-stone-900">Send In-App Notification</h3>
                <p className="text-xs text-stone-600">Broadcast messages to workers on the factory floor (admin only)</p>
              </div>
            </div>
            <span className="text-[10px] bg-indigo-100 text-indigo-900 border border-indigo-300 px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider">
              Admin Action
            </span>
          </div>

          {notifSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold rounded-xl p-3 flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{notifSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleSendNotification} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-stone-700">Notification Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Urgent Rush Order: LIZ-KAP01"
                  value={notifTitle}
                  onChange={e => setNotifTitle(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 mt-1 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700">Recipient Target</label>
                <select
                  value={notifTarget}
                  onChange={e => setNotifTarget(e.target.value as any)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 mt-1 outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
                >
                  <option value="everyone">Everyone (All Workers)</option>
                  <option value="section">Specific Section</option>
                  <option value="worker">Specific Worker</option>
                </select>
              </div>
            </div>

            {/* Target Details */}
            {notifTarget === 'section' && (
              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 animate-fade-in">
                <label className="text-xs font-bold text-stone-700 flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Select Target Section:</span>
                </label>
                <select
                  value={notifSection}
                  onChange={e => setNotifSection(e.target.value as any)}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-sm text-stone-900 mt-1.5 outline-none font-medium cursor-pointer"
                >
                  <option value="Sewing">Sewing Section</option>
                  <option value="Cutting">Cutting Section</option>
                  <option value="Finishing">Finishing Section</option>
                </select>
              </div>
            )}

            {notifTarget === 'worker' && (
              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 animate-fade-in">
                <label className="text-xs font-bold text-stone-700 flex items-center space-x-1.5">
                  <User className="w-4 h-4 text-indigo-600" />
                  <span>Select Target Worker:</span>
                </label>
                <select
                  value={notifWorkerId}
                  onChange={e => setNotifWorkerId(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-sm text-stone-900 mt-1.5 outline-none font-medium cursor-pointer"
                >
                  {workersList.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.full_name} ({w.worker_code}) - {w.section || 'Sewing'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-stone-700">Message Body *</label>
              <textarea
                required
                rows={3}
                placeholder="Write message content for workers..."
                value={notifMessage}
                onChange={e => setNotifMessage(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3.5 text-sm text-stone-900 mt-1 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-stone-500 italic">
                Inserts directly into the worker notifications feed. Appears when workers open their portal.
              </p>
              <button
                type="submit"
                disabled={isSendingNotif || !notifTitle.trim() || !notifMessage.trim()}
                className="bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition flex items-center space-x-2 shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isSendingNotif ? 'Sending...' : 'Send Notification'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADMIN ONLY: Audit Log Viewer Screen Section */}
      {role === 'admin' && (
        <AuditLogViewer role={role} />
      )}
    </div>
  );
};

