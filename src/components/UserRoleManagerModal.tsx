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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-2 sm:p-4 overflow-hidden">
      <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-3xl max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl my-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-200 bg-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-300">
              <Crown className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900 flex items-center space-x-2">
                <span>Master Admin Role Manager</span>
                <span className="text-[11px] bg-amber-50 text-amber-800 font-mono px-2 py-0.5 rounded-full border border-amber-300">
                  parvezmohammed2024@gmail.com
                </span>
              </h2>
              <p className="text-xs text-stone-600">
                Create user accounts with mobile number or email and assign roles (Worker, Supervisor, Accounts, Admin)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-900 p-2 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto">
          {message && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-xs flex items-center justify-between">
              <span>{message}</span>
              <button onClick={() => setMessage(null)} className="text-stone-500 hover:text-stone-900">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Account Creation Form */}
          <form onSubmit={handleCreateAccount} className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-4">
            <h3 className="text-sm font-semibold text-amber-800 flex items-center space-x-2">
              <UserPlus className="w-4 h-4 text-amber-700" />
              <span>Register / Assign User Account</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-stone-700 font-medium mb-1">
                  Mobile Number or Email <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    placeholder="+88017... or worker@gmail.com"
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-stone-700 font-medium mb-1">
                  Full Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahim Uddin"
                  className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs text-stone-700 font-medium mb-1">Assigned Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="worker">Worker (Line Worker)</option>
                  <option value="supervisor">Supervisor (Floor Manager)</option>
                  <option value="accounts">Accounts (Payroll & Advances)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
              </div>

              {role === 'worker' && (
                <div>
                  <label className="block text-xs text-stone-700 font-medium mb-1">
                    Link Worker Profile
                  </label>
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
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
                className="bg-indigo-700 hover:bg-indigo-800 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center space-x-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Account & Assign Role'}</span>
              </button>
            </div>
          </form>

          {/* Accounts List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-stone-900 flex items-center space-x-2">
              <Crown className="w-4 h-4 text-amber-700" />
              <span>Registered Accounts & Active Roles ({accounts.length})</span>
            </h3>

            {loading ? (
              <div className="p-8 text-center text-stone-500 text-xs">Loading user accounts...</div>
            ) : (
              <div className="divide-y divide-stone-200 border border-stone-200 rounded-xl overflow-hidden bg-white">
                {accounts.map(acc => {
                  const linkedWorker = workers.find(w => w.id === acc.worker_id);
                  const isMasterAdmin = acc.email_or_phone === 'parvezmohammed2024@gmail.com';

                  return (
                    <div key={acc.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm text-stone-900">{acc.full_name}</span>
                          {isMasterAdmin && (
                            <span className="text-[10px] bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300 flex items-center space-x-1">
                              <Crown className="w-3 h-3 text-amber-700" />
                              <span>Master Admin</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-3 text-xs text-stone-600">
                          <span className="flex items-center space-x-1">
                            {acc.email_or_phone.includes('@') ? (
                              <Mail className="w-3 h-3 text-indigo-700" />
                            ) : (
                              <Smartphone className="w-3 h-3 text-emerald-700" />
                            )}
                            <span className="font-mono text-stone-800">{acc.email_or_phone}</span>
                          </span>

                          {linkedWorker && (
                            <span className="flex items-center space-x-1 text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                              <LinkIcon className="w-3 h-3 text-sky-700" />
                              <span>{linkedWorker.worker_code} - {linkedWorker.full_name}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Role Selector for Account */}
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-stone-600">Role:</span>
                        <select
                          value={acc.role}
                          onChange={(e) => handleRoleChange(acc.id, e.target.value as UserRole)}
                          disabled={isMasterAdmin}
                          className="bg-white border border-stone-300 rounded-lg px-2.5 py-1 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-indigo-600 disabled:opacity-50"
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
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
