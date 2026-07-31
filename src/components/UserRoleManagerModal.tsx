import React, { useState, useEffect } from 'react';
import { X, Crown, UserPlus, ShieldAlert, CheckCircle, Smartphone, Mail, Link as LinkIcon, User } from 'lucide-react';
import { dataService } from '../lib/dataService';
import { UserAccount, UserRole, Worker } from '../types';

interface UserRoleManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoleChanged?: () => void;
}

export const UserRoleManagerModal: React.FC<UserRoleManagerModalProps> = ({ isOpen, onClose, onRoleChanged }) => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // New account form
  const [emailOrPhone, setEmailOrPhone] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [role, setRole] = useState<UserRole>('worker');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    const [accs, wrks] = await Promise.all([
      dataService.getUserAccounts(),
      dataService.getWorkers(),
    ]);
    setAccounts(accs);
    setWorkers(wrks);
    setLoading(false);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrPhone.trim() || !fullName.trim()) return;

    setSaving(true);
    try {
      await dataService.saveUserAccount({
        email_or_phone: emailOrPhone.trim(),
        full_name: fullName.trim(),
        role,
        worker_id: role === 'worker' ? (selectedWorkerId || null) : null,
      });

      setMessage(`Account created/updated for ${fullName}`);
      setEmailOrPhone('');
      setFullName('');
      setSelectedWorkerId('');
      await loadData();
      if (onRoleChanged) onRoleChanged();
    } catch (err: any) {
      setMessage(`Error: ${err.message || 'Failed to save account'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (accountId: string, newRole: UserRole, workerId?: string | null) => {
    await dataService.updateUserRole(accountId, newRole, workerId);
    await loadData();
    if (onRoleChanged) onRoleChanged();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Master Admin Role Manager</span>
                <span className="text-[11px] bg-amber-400/20 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-400/30">
                  parvezmohammed2024@gmail.com
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Create user accounts with mobile number or email and assign roles (Worker, Supervisor, Accounts, Admin)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {message && (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-300 text-xs flex items-center justify-between">
              <span>{message}</span>
              <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Account Creation Form */}
          <form onSubmit={handleCreateAccount} className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 space-y-4">
            <h3 className="text-sm font-semibold text-amber-400 flex items-center space-x-2">
              <UserPlus className="w-4 h-4" />
              <span>Register / Assign User Account</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 font-medium mb-1">
                  Mobile Number or Email <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    placeholder="+88017... or worker@gmail.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-medium mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahim Uddin"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-medium mb-1">Assigned Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="worker">Worker (Line Worker)</option>
                  <option value="supervisor">Supervisor (Floor Manager)</option>
                  <option value="accounts">Accounts (Payroll & Advances)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
              </div>

              {role === 'worker' && (
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1">
                    Link Worker Profile
                  </label>
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Select Worker Profile --</option>
                    {workers.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.worker_code} - {w.full_name} ({w.section || 'Sewing'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-lg transition-all flex items-center space-x-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Account & Assign Role'}</span>
              </button>
            </div>
          </form>

          {/* Accounts List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Registered Accounts & Active Roles ({accounts.length})</span>
            </h3>

            {loading ? (
              <div className="p-8 text-center text-slate-500 text-xs">Loading user accounts...</div>
            ) : (
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
                {accounts.map(acc => {
                  const linkedWorker = workers.find(w => w.id === acc.worker_id);
                  const isMasterAdmin = acc.email_or_phone === 'parvezmohammed2024@gmail.com';

                  return (
                    <div key={acc.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm text-white">{acc.full_name}</span>
                          {isMasterAdmin && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center space-x-1">
                              <Crown className="w-3 h-3 text-amber-400" />
                              <span>Master Admin</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-3 text-xs text-slate-400">
                          <span className="flex items-center space-x-1">
                            {acc.email_or_phone.includes('@') ? (
                              <Mail className="w-3 h-3 text-indigo-400" />
                            ) : (
                              <Smartphone className="w-3 h-3 text-emerald-400" />
                            )}
                            <span className="font-mono text-slate-300">{acc.email_or_phone}</span>
                          </span>

                          {linkedWorker && (
                            <span className="flex items-center space-x-1 text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                              <LinkIcon className="w-3 h-3" />
                              <span>{linkedWorker.worker_code} - {linkedWorker.full_name}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Role Selector for Account */}
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-400">Role:</span>
                        <select
                          value={acc.role}
                          onChange={(e) => handleRoleChange(acc.id, e.target.value as UserRole)}
                          disabled={isMasterAdmin}
                          className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                        >
                          <option value="worker">Worker</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="accounts">Accounts</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
