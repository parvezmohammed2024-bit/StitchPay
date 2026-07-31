import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Plus, Phone, CreditCard, Calendar, Wallet, 
  BarChart, X, Check, Award, ArrowUpRight 
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useTranslation } from '../lib/i18n';
import { dataService } from '../lib/dataService';
import { Worker, ProductionEntry, AttendanceRecord, Adjustment, FactorySettings, UserRole } from '../types';

interface WorkersScreenProps {
  role: UserRole;
}

export const WorkersScreen: React.FC<WorkersScreenProps> = ({ role }) => {
  const { t } = useTranslation();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [settings, setSettings] = useState<FactorySettings | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [workerForm, setWorkerForm] = useState<Partial<Worker>>({
    full_name: '',
    phone: '',
    section: 'Sewing',
    line_no: 'Line-01',
    payment_method: 'mobile_wallet',
    payment_details: { provider: 'bKash', account: '' },
    photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  });

  const isAccountsOrAdmin = role === 'admin' || role === 'accounts';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [wList, eList, aList, adjList, setRes] = await Promise.all([
      dataService.getWorkers(),
      dataService.getProductionEntries(),
      dataService.getAttendance(),
      dataService.getAdjustments(),
      dataService.getSettings(),
    ]);
    setWorkers(wList);
    setEntries(eList);
    setAttendance(aList);
    setAdjustments(adjList);
    setSettings(setRes);
  };

  const handleSaveWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    await dataService.saveWorker(workerForm);
    setShowModal(false);
    setWorkerForm({
      full_name: '',
      phone: '',
      section: 'Sewing',
      line_no: 'Line-01',
      payment_method: 'mobile_wallet',
      payment_details: { provider: 'bKash', account: '' },
      photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    });
    await loadData();
  };

  // Filter workers
  const filteredWorkers = workers.filter(w => {
    const matchesSearch = 
      w.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.worker_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.phone && w.phone.includes(searchTerm));
    const matchesSection = selectedSection === 'all' || w.section === selectedSection;
    return matchesSearch && matchesSection;
  });

  // Calculate worker detailed profile metrics when drawer is open
  const getWorkerMetrics = (wId: string) => {
    const wEntries = entries.filter(e => e.worker_id === wId);
    const wAtt = attendance.filter(a => a.worker_id === wId);
    const wAdj = adjustments.filter(a => a.worker_id === wId);

    const piecesDone = wEntries.reduce((sum, e) => sum + e.qty_ok, 0);
    const monthlyEarnings = wEntries.reduce((sum, e) => sum + e.amount, 0);

    // Attendance summary
    const presentCount = wAtt.filter(a => a.status === 'present').length;
    const absentCount = wAtt.filter(a => a.status === 'absent').length;

    // Advances calculation
    const advancesTaken = wAdj.filter(a => a.type === 'advance').reduce((sum, a) => sum + Number(a.amount), 0);
    const advancesRepaid = wAdj.filter(a => a.type === 'advance_repay').reduce((sum, a) => sum + Number(a.amount), 0);
    const outstandingAdvance = Math.max(0, advancesTaken - advancesRepaid);

    // Process breakdown chart
    const procMap = new Map<string, number>();
    wEntries.forEach(e => {
      const name = e.process_name || 'Process';
      const cur = procMap.get(name) || 0;
      procMap.set(name, cur + e.qty_ok);
    });

    const procChartData = Array.from(procMap.entries()).map(([name, qty]) => ({ name, value: qty }));
    const COLORS = ['#6366f1', '#fbbf24', '#10b981', '#ec4899', '#8b5cf6'];

    return {
      piecesDone,
      monthlyEarnings,
      presentCount,
      absentCount,
      outstandingAdvance,
      procChartData,
      COLORS,
    };
  };

  const currencySymbol = settings?.currency_symbol || '৳';

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" />
            <span>Factory Worker Roster</span>
          </h1>
          <p className="text-xs text-slate-400">{workers.length} active floor operators across sections</p>
        </div>

        {isAccountsOrAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg transition-all text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Worker</span>
          </button>
        )}
      </div>

      {/* Search & Section Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl shadow-lg">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search worker by name, code (W-101) or phone..."
            className="w-full bg-slate-800 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex space-x-2 w-full sm:w-auto">
          {['all', 'Sewing', 'Finishing', 'Cutting'].map(sec => (
            <button
              key={sec}
              onClick={() => setSelectedSection(sec)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                selectedSection === sec
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      {/* Workers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWorkers.map(worker => (
          <div
            key={worker.id}
            onClick={() => setSelectedWorker(worker)}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-indigo-500/50 hover:bg-slate-850 cursor-pointer transition-all shadow-lg flex flex-col justify-between"
          >
            <div className="flex items-start space-x-3.5">
              <img
                src={worker.photo_url || ''}
                alt={worker.full_name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-700 shrink-0 shadow-md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                    {worker.worker_code}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {worker.line_no}
                  </span>
                </div>
                <h3 className="font-bold text-white text-base truncate mt-1">{worker.full_name}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3 text-slate-500" /> {worker.phone || 'N/A'}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-800/60 p-2 rounded-xl">
                <span className="text-slate-400 text-[10px] block">PAYMENT</span>
                <span className="font-bold text-slate-200 capitalize">{worker.payment_method.replace('_', ' ')}</span>
              </div>
              <div className="bg-slate-800/60 p-2 rounded-xl text-right">
                <span className="text-slate-400 text-[10px] block">ADVANCE BAL</span>
                <span className="font-bold text-rose-400">{currencySymbol}{worker.outstanding_advance || 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* WORKER PROFILE DRAWER / MODAL */}
      {selectedWorker && (() => {
        const metrics = getWorkerMetrics(selectedWorker.id);
        return (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setSelectedWorker(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Profile Header */}
              <div className="flex items-center space-x-4 border-b border-slate-800 pb-4">
                <img
                  src={selectedWorker.photo_url || ''}
                  alt={selectedWorker.full_name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500 shadow-md"
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs text-amber-400 font-bold bg-slate-800 px-2 py-0.5 rounded">
                      {selectedWorker.worker_code}
                    </span>
                    <span className="text-xs text-slate-400">{selectedWorker.section} • {selectedWorker.line_no}</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1">{selectedWorker.full_name}</h2>
                  <p className="text-xs text-slate-400">{selectedWorker.phone || 'No phone registered'}</p>
                </div>
              </div>

              {/* Metrics Summary Grid */}
              <div className="grid grid-cols-2 gap-3 my-4">
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                  <span className="text-xs text-slate-400 block">{t('monthlyEarnings')}</span>
                  <span className="text-xl font-black text-amber-400 font-mono">
                    {currencySymbol}{metrics.monthlyEarnings.toFixed(0)}
                  </span>
                </div>

                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                  <span className="text-xs text-slate-400 block">{t('pieces')} Completed</span>
                  <span className="text-xl font-black text-emerald-400 font-mono">
                    {metrics.piecesDone.toLocaleString()} pcs
                  </span>
                </div>

                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                  <span className="text-xs text-slate-400 block">{t('outstandingAdvance')}</span>
                  <span className="text-xl font-black text-rose-400 font-mono">
                    {currencySymbol}{metrics.outstandingAdvance}
                  </span>
                </div>

                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                  <span className="text-xs text-slate-400 block">Attendance</span>
                  <span className="text-xl font-black text-white font-mono">
                    {metrics.presentCount} <span className="text-xs font-normal text-slate-400">days present</span>
                  </span>
                </div>
              </div>

              {/* Top Processes Chart */}
              {metrics.procChartData.length > 0 && (
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800 my-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Top Processes Executed
                  </h4>
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={metrics.procChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={55}
                          fill="#8884d8"
                          label={(entry) => `${entry.name.slice(0, 10)}... (${entry.value})`}
                        >
                          {metrics.procChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={metrics.COLORS[index % metrics.COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedWorker(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors mt-2"
              >
                Close Profile
              </button>
            </div>
          </div>
        );
      })()}

      {/* MODAL: ADD WORKER */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Add Garment Worker</h3>
            <form onSubmit={handleSaveWorker} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Full Name</label>
                <input
                  type="text"
                  required
                  value={workerForm.full_name || ''}
                  onChange={e => setWorkerForm({ ...workerForm, full_name: e.target.value })}
                  placeholder="e.g. Morshed Alam"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Phone Number</label>
                  <input
                    type="text"
                    value={workerForm.phone || ''}
                    onChange={e => setWorkerForm({ ...workerForm, phone: e.target.value })}
                    placeholder="+88017..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Line No</label>
                  <input
                    type="text"
                    value={workerForm.line_no || ''}
                    onChange={e => setWorkerForm({ ...workerForm, line_no: e.target.value })}
                    placeholder="Line-01"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Payment Method</label>
                <select
                  value={workerForm.payment_method || 'mobile_wallet'}
                  onChange={e => setWorkerForm({ ...workerForm, payment_method: e.target.value as any })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white mt-1"
                >
                  <option value="mobile_wallet">Mobile Wallet (bKash / Nagad)</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-slate-800 text-slate-300 font-semibold py-2 rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white font-semibold py-2 rounded-xl text-sm"
                >
                  Save Worker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
