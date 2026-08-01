import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Plus, Phone, CreditCard, Calendar, Wallet, 
  BarChart, X, Check, Award, ArrowUpRight, ShieldCheck, AlertCircle, 
  KeyRound, Copy, Edit3, Lock, RefreshCw 
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useTranslation } from '../lib/i18n';
import { dataService } from '../lib/dataService';
import { showErrorToast, showSuccessToast } from '../lib/toast';
import { Worker, ProductionEntry, AttendanceRecord, Adjustment, FactorySettings, UserRole } from '../types';
import { WorkerAvatar } from '../components/WorkerAvatar';
import { WorkerPhotoUploader } from '../components/WorkerPhotoUploader';

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

  // Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [workerForm, setWorkerForm] = useState<{
    worker_code: string;
    full_name: string;
    phone: string;
    section: string;
    line_no: string;
    pay_type: 'piece_rate' | 'monthly_salary';
    monthly_salary: number;
    payment_method: 'cash' | 'bank' | 'mobile_wallet';
    payment_details: Record<string, any>;
    photo_url: string | null;
    pin?: string;
  }>({
    worker_code: '',
    full_name: '',
    phone: '',
    section: 'Sewing',
    line_no: 'Line-01',
    pay_type: 'piece_rate',
    monthly_salary: 15000,
    payment_method: 'mobile_wallet',
    payment_details: { provider: 'bKash', account: '' },
    photo_url: null,
    pin: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [savingWorker, setSavingWorker] = useState(false);

  // Reset PIN Modal State
  const [resetPinWorker, setResetPinWorker] = useState<Worker | null>(null);
  const [resetPinInput, setResetPinInput] = useState('');
  const [resetPinError, setResetPinError] = useState<string | null>(null);
  const [savingPin, setSavingPin] = useState(false);

  // Credentials Confirmation Modal State
  const [credentialsModal, setCredentialsModal] = useState<{
    show: boolean;
    workerCode: string;
    phone: string;
    pin: string;
    workerName: string;
  } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  const isAdmin = role === 'admin';
  const isAccountsOrAdmin = role === 'admin' || role === 'accounts';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
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
    } catch (err: any) {
      showErrorToast(`Failed to load workers data: ${err.message || String(err)}`);
    }
  };

  // Helper to auto-suggest next worker code in sequence (e.g. W-001, W-002 -> W-003)
  const generateNextWorkerCode = (wList: Worker[]): string => {
    let maxNum = 0;
    let padLen = 3;
    for (const w of wList) {
      if (!w.worker_code) continue;
      const match = w.worker_code.match(/^W-(\d+)$/i) || w.worker_code.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
          padLen = Math.max(padLen, match[1].length);
        }
      }
    }
    const nextNum = maxNum + 1;
    return `W-${String(nextNum).padStart(padLen, '0')}`;
  };

  const handleOpenAddModal = () => {
    const nextCode = generateNextWorkerCode(workers);
    setEditingWorker(null);
    setWorkerForm({
      worker_code: nextCode,
      full_name: '',
      phone: '',
      section: 'Sewing',
      line_no: 'Line-01',
      pay_type: 'piece_rate',
      monthly_salary: 15000,
      payment_method: 'mobile_wallet',
      payment_details: { provider: 'bKash', account: '' },
      photo_url: null,
      pin: '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (worker: Worker) => {
    setEditingWorker(worker);
    setWorkerForm({
      worker_code: worker.worker_code || '',
      full_name: worker.full_name || '',
      phone: worker.phone || '',
      section: worker.section || 'Sewing',
      line_no: worker.line_no || 'Line-01',
      pay_type: worker.pay_type || 'piece_rate',
      monthly_salary: worker.monthly_salary || 15000,
      payment_method: worker.payment_method || 'mobile_wallet',
      payment_details: worker.payment_details || { provider: 'bKash', account: '' },
      photo_url: worker.photo_url || null,
      pin: '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSaveWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanCode = workerForm.worker_code.trim().toUpperCase();
    if (!cleanCode) {
      setFormError('Worker Code is required (e.g. W-001).');
      return;
    }

    // Validate uniqueness of worker code
    const duplicate = workers.find(
      w => w.id !== editingWorker?.id && w.worker_code.trim().toUpperCase() === cleanCode
    );
    if (duplicate) {
      setFormError(`Worker Code "${cleanCode}" is already taken by ${duplicate.full_name}. Please enter a unique code.`);
      return;
    }

    if (!workerForm.full_name.trim()) {
      setFormError('Full Name is required.');
      return;
    }

    const cleanPhone = workerForm.phone.trim();
    if (!cleanPhone) {
      setFormError('Mobile / Phone Number is required. A worker with no phone number cannot log in.');
      return;
    }

    // Validate phone uniqueness locally
    const dupPhone = workers.find(
      w => w.id !== editingWorker?.id && w.phone && w.phone.replace(/\D/g, '') === cleanPhone.replace(/\D/g, '')
    );
    if (dupPhone) {
      setFormError('This phone number is already registered to another worker.');
      return;
    }

    if (!workerForm.section) {
      setFormError('Section is required (Sewing, Finishing, Cutting).');
      return;
    }

    if (workerForm.pay_type === 'monthly_salary' && (!workerForm.monthly_salary || workerForm.monthly_salary <= 0)) {
      setFormError('Monthly Salary amount is required for monthly-salary workers.');
      return;
    }

    const pin = (workerForm.pin || '').trim();
    const isNewWorker = !editingWorker;

    if (isNewWorker && isAdmin && pin) {
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        setFormError('PIN must be exactly 4 numeric digits (e.g. 1234).');
        return;
      }
    }

    setSavingWorker(true);
    try {
      const saved = await dataService.saveWorker({
        id: editingWorker?.id,
        worker_code: cleanCode,
        full_name: workerForm.full_name.trim(),
        phone: cleanPhone,
        section: workerForm.section,
        line_no: workerForm.line_no.trim() || 'Line-01',
        pay_type: workerForm.pay_type,
        monthly_salary: workerForm.pay_type === 'monthly_salary' ? Number(workerForm.monthly_salary || 0) : 0,
        payment_method: workerForm.payment_method,
        payment_details: workerForm.payment_details,
        photo_url: workerForm.photo_url || null,
        status: 'active',
      });

      // If creating a new worker and Admin specified a PIN
      if (isNewWorker && isAdmin && pin) {
        await dataService.setWorkerPinByPhone(cleanPhone, pin);
        setShowModal(false);
        await loadData();

        // Show confirmation dialog with phone & PIN once
        setCredentialsModal({
          show: true,
          workerCode: cleanCode,
          phone: cleanPhone,
          pin: pin,
          workerName: saved.full_name,
        });
        setCopiedCredentials(false);
        setSavingWorker(false);
        return;
      }

      setShowModal(false);
      showSuccessToast(editingWorker ? 'Worker updated successfully' : 'Worker created successfully');
      await loadData();
    } catch (err: any) {
      console.error('Error saving worker:', err);
      if (err.message && (err.message.includes('phone') || err.message.includes('duplicate') || err.message.includes('unique'))) {
        setFormError('This phone number is already registered to another worker.');
      } else {
        setFormError(err.message || 'Failed to save worker.');
      }
    } finally {
      setSavingWorker(false);
    }
  };

  const handleOpenResetPin = (worker: Worker) => {
    setResetPinWorker(worker);
    setResetPinInput('');
    setResetPinError(null);
  };

  const handleSaveResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPinWorker) return;

    if (!resetPinWorker.phone) {
      setResetPinError('This worker does not have a registered mobile number.');
      return;
    }

    const pin = resetPinInput.trim();
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setResetPinError('PIN must be a 4-digit number (e.g. 1234).');
      return;
    }

    setSavingPin(true);
    try {
      await dataService.setWorkerPinByPhone(resetPinWorker.phone, pin);
      const wCode = resetPinWorker.worker_code;
      const wPhone = resetPinWorker.phone;
      const wName = resetPinWorker.full_name;

      setResetPinWorker(null);
      await loadData();

      setCredentialsModal({
        show: true,
        workerCode: wCode,
        phone: wPhone,
        pin: pin,
        workerName: wName,
      });
      setCopiedCredentials(false);
    } catch (err: any) {
      console.error('Error resetting PIN:', err);
      setResetPinError(err.message || 'Failed to set worker PIN.');
    } finally {
      setSavingPin(false);
    }
  };

  // Filter workers by search and section
  const filteredWorkers = workers.filter(w => {
    const matchesSearch = 
      w.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.worker_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.phone && w.phone.includes(searchTerm));
    const matchesSection = selectedSection === 'all' || w.section === selectedSection;
    return matchesSearch && matchesSection;
  });

  // Calculate worker detailed profile metrics
  const getWorkerMetrics = (wId: string) => {
    const wEntries = entries.filter(e => e.worker_id === wId);
    const wAtt = attendance.filter(a => a.worker_id === wId);
    const wAdj = adjustments.filter(a => a.worker_id === wId);

    const piecesDone = wEntries.reduce((sum, e) => sum + e.qty_ok, 0);
    const monthlyEarnings = wEntries.reduce((sum, e) => sum + e.amount, 0);

    const presentCount = wAtt.filter(a => a.status === 'present').length;
    const absentCount = wAtt.filter(a => a.status === 'absent').length;

    const advancesTaken = wAdj.filter(a => a.type === 'advance').reduce((sum, a) => sum + Number(a.amount), 0);
    const advancesRepaid = wAdj.filter(a => a.type === 'advance_repay').reduce((sum, a) => sum + Number(a.amount), 0);
    const outstandingAdvance = Math.max(0, advancesTaken - advancesRepaid);

    const procMap = new Map<string, number>();
    wEntries.forEach(e => {
      const name = e.process_name || 'Process';
      const cur = procMap.get(name) || 0;
      procMap.set(name, cur + e.qty_ok);
    });

    const procChartData = Array.from(procMap.entries()).map(([name, qty]) => ({ name, value: qty }));
    const COLORS = ['#4338ca', '#b45309', '#15803d', '#be185d', '#6d28d9'];

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
          <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-700" />
            <span>Factory Worker Roster</span>
          </h1>
          <p className="text-xs text-stone-600">{workers.length} active floor operators across sections</p>
        </div>

        {isAccountsOrAdmin && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center space-x-2 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-all text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Worker</span>
          </button>
        )}
      </div>

      {/* Search & Section Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white border border-stone-200 p-3 rounded-2xl shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search worker by name, code (W-001) or phone..."
            className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-sm text-stone-900 focus:outline-none focus:border-indigo-600"
          />
        </div>

        <div className="flex space-x-2 w-full sm:w-auto">
          {['all', 'Sewing', 'Finishing', 'Cutting'].map(sec => (
            <button
              key={sec}
              onClick={() => setSelectedSection(sec)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                selectedSection === sec
                  ? 'bg-indigo-700 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900 border border-stone-200'
              }`}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      {/* Workers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWorkers.map(worker => {
          const hasPin = Boolean(worker.pin_hash);
          return (
            <div
              key={worker.id}
              onClick={() => setSelectedWorker(worker)}
              className="bg-white border border-stone-200 hover:border-stone-300 rounded-2xl p-4 cursor-pointer transition-all shadow-xs flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start space-x-3.5">
                  <WorkerAvatar
                    photoUrl={worker.photo_url}
                    name={worker.full_name}
                    size="xl"
                    className="rounded-2xl"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        {worker.worker_code}
                      </span>

                      {/* PIN Status Badge */}
                      {hasPin ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <ShieldCheck className="w-3 h-3 text-emerald-700 shrink-0" />
                          <span>Can log in</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          <AlertCircle className="w-3 h-3 text-rose-700 shrink-0" />
                          <span>No PIN</span>
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-stone-900 text-base truncate mt-1.5">{worker.full_name}</h3>
                    
                    <div className="flex items-center space-x-2 text-xs text-stone-600 mt-0.5 flex-wrap gap-y-1">
                      <span className="font-semibold text-stone-800">{worker.section || 'Sewing'}</span>
                      <span>•</span>
                      <span className="font-mono">{worker.line_no || 'Line-01'}</span>
                      <span>•</span>
                      {worker.pay_type === 'monthly_salary' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                          Monthly ({currencySymbol}{(worker.monthly_salary || 0).toLocaleString()})
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
                          Piece Rate
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-stone-600 flex items-center gap-1.5 mt-3">
                  <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span>{worker.phone || 'No phone registered'}</span>
                </p>
              </div>

              {/* Bottom Card Footer with Actions */}
              <div className="mt-4 pt-3 border-t border-stone-200 flex items-center justify-between gap-2">
                <div className="text-xs font-mono">
                  <span className="text-stone-500 text-[10px] block font-sans">ADVANCE BAL</span>
                  <span className="font-bold text-rose-700">{currencySymbol}{worker.outstanding_advance || 0}</span>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center space-x-1.5">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenResetPin(worker);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-amber-800 border border-amber-300 text-xs font-semibold transition-all flex items-center space-x-1"
                      title="Reset 4-digit PIN for Worker Portal"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Reset PIN</span>
                    </button>
                  )}

                  {isAccountsOrAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditModal(worker);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-indigo-800 border border-indigo-200 text-xs font-semibold transition-all flex items-center space-x-1"
                      title="Edit Worker Profile"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* WORKER PROFILE DRAWER / MODAL */}
      {selectedWorker && (() => {
        const metrics = getWorkerMetrics(selectedWorker.id);
        const hasPin = Boolean(selectedWorker.pin_hash);

        return (
          <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-stone-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-5">
              <button
                onClick={() => setSelectedWorker(null)}
                className="absolute top-4 right-4 text-stone-400 hover:text-stone-900 p-1.5 rounded-xl hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Profile Header */}
              <div className="flex items-start space-x-4 border-b border-stone-200 pb-5">
                <WorkerAvatar
                  photoUrl={selectedWorker.photo_url}
                  name={selectedWorker.full_name}
                  size="2xl"
                  className="rounded-2xl"
                />
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="font-mono text-xs text-amber-900 font-bold bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                      {selectedWorker.worker_code}
                    </span>
                    <span className="text-xs text-stone-600">
                      {selectedWorker.section || 'Sewing'} • {selectedWorker.line_no || 'Line-01'}
                    </span>
                    {hasPin ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-700" />
                        <span>PIN Set</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                        <AlertCircle className="w-3 h-3 text-rose-700" />
                        <span>No PIN</span>
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-black text-stone-900 mt-1.5">{selectedWorker.full_name}</h2>
                  <p className="text-xs text-stone-600 mt-0.5">{selectedWorker.phone || 'No phone registered'}</p>
                </div>
              </div>

              {/* Action Buttons in Drawer */}
              <div className="flex items-center space-x-2">
                {isAccountsOrAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      const w = selectedWorker;
                      setSelectedWorker(null);
                      handleOpenEditModal(w);
                    }}
                    className="flex-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold py-2 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Profile</span>
                  </button>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      const w = selectedWorker;
                      setSelectedWorker(null);
                      handleOpenResetPin(w);
                    }}
                    className="flex-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold py-2 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Reset Portal PIN</span>
                  </button>
                )}
              </div>

              {/* Metrics Summary Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                  <span className="text-xs text-stone-600 block">{t('monthlyEarnings')}</span>
                  <span className="text-xl font-black text-amber-800 font-mono mt-0.5 block">
                    {currencySymbol}{(metrics?.monthlyEarnings || 0).toFixed(0)}
                  </span>
                </div>

                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                  <span className="text-xs text-stone-600 block">{t('pieces')} Completed</span>
                  <span className="text-xl font-black text-emerald-700 font-mono mt-0.5 block">
                    {metrics.piecesDone.toLocaleString()} pcs
                  </span>
                </div>

                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                  <span className="text-xs text-stone-600 block">{t('outstandingAdvance')}</span>
                  <span className="text-xl font-black text-rose-700 font-mono mt-0.5 block">
                    {currencySymbol}{metrics.outstandingAdvance}
                  </span>
                </div>

                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                  <span className="text-xs text-stone-600 block">Attendance</span>
                  <span className="text-xl font-black text-stone-900 font-mono mt-0.5 block">
                    {metrics.presentCount} <span className="text-xs font-normal text-stone-500">days present</span>
                  </span>
                </div>
              </div>

              {/* Top Processes Chart */}
              {metrics.procChartData.length > 0 && (
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
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
                        <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e7e5e4', color: '#1c1917' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedWorker(null)}
                className="w-full bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold py-3 rounded-2xl text-sm transition-colors border border-stone-200"
              >
                Close Profile
              </button>
            </div>
          </div>
        );
      })()}

      {/* MODAL: ADD / EDIT WORKER */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="text-lg font-black text-stone-900">
                {editingWorker ? 'Edit Garment Worker' : 'Add Garment Worker'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-stone-400 hover:text-stone-900 p-1 rounded-lg hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveWorker} className="space-y-4">
              {/* Photo Uploader */}
              <div className="pb-2 border-b border-stone-200">
                <WorkerPhotoUploader
                  currentPhotoUrl={workerForm.photo_url}
                  workerCode={workerForm.worker_code}
                  workerName={workerForm.full_name}
                  onPhotoChanged={(url) => setWorkerForm(prev => ({ ...prev, photo_url: url }))}
                  onUploadingStateChange={setIsUploadingPhoto}
                />
              </div>

              {/* Worker Code (Required & Unique) */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Worker Code <span className="text-rose-700">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={workerForm.worker_code}
                  onChange={e => setWorkerForm({ ...workerForm, worker_code: e.target.value.toUpperCase() })}
                  placeholder="e.g. W-001"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 font-mono font-bold focus:outline-none focus:border-indigo-600"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Unique ID & Worker Portal login username (e.g. W-001)
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Full Name <span className="text-rose-700">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={workerForm.full_name}
                  onChange={e => setWorkerForm({ ...workerForm, full_name: e.target.value })}
                  placeholder="e.g. Morshed Alam"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              {/* Section & Line No */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Section <span className="text-rose-700">*</span>
                  </label>
                  <select
                    required
                    value={workerForm.section}
                    onChange={e => setWorkerForm({ ...workerForm, section: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="Sewing">Sewing</option>
                    <option value="Finishing">Finishing</option>
                    <option value="Cutting">Cutting</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Line No
                  </label>
                  <input
                    type="text"
                    value={workerForm.line_no}
                    onChange={e => setWorkerForm({ ...workerForm, line_no: e.target.value })}
                    placeholder="e.g. Line-01"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Mobile / Phone Number <span className="text-rose-700">*</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  required
                  value={workerForm.phone}
                  onChange={e => setWorkerForm({ ...workerForm, phone: e.target.value })}
                  placeholder="e.g. 0123456789 or +60123456789"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-indigo-600"
                />
                <p className="text-[11px] text-stone-500 mt-1">Required for worker portal login</p>
              </div>

              {/* Pay Type Selector */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Pay Type <span className="text-rose-700">*</span>
                </label>
                <select
                  value={workerForm.pay_type}
                  onChange={e => setWorkerForm({ ...workerForm, pay_type: e.target.value as any })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-900 font-bold focus:outline-none focus:border-indigo-600"
                >
                  <option value="piece_rate">Piece Rate (Paid per finished garment piece)</option>
                  <option value="monthly_salary">Monthly Salary (Fixed monthly wage)</option>
                </select>
              </div>

              {/* Monthly Salary Amount (When monthly_salary is chosen) */}
              {workerForm.pay_type === 'monthly_salary' && (
                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl space-y-1">
                  <label className="block text-xs font-bold text-amber-900">
                    Monthly Salary Amount ({currencySymbol}) <span className="text-rose-700">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={workerForm.monthly_salary}
                    onChange={e => setWorkerForm({ ...workerForm, monthly_salary: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g. 15000"
                    className="w-full bg-white border border-stone-300 rounded-xl px-3.5 py-2 text-base font-mono font-bold text-amber-900 focus:outline-none focus:border-amber-700"
                  />
                  <p className="text-[11px] text-stone-600">
                    Fixed monthly remuneration for helpers, cutters, ironers, supervisors, etc.
                  </p>
                </div>
              )}

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={workerForm.payment_method}
                  onChange={e => setWorkerForm({ ...workerForm, payment_method: e.target.value as any })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-indigo-600"
                >
                  <option value="mobile_wallet">Mobile Wallet (bKash / Nagad)</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>

              {/* Set Initial PIN (Admin Only when Adding New Worker) */}
              {!editingWorker && isAdmin && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-indigo-900 text-xs font-bold">
                    <KeyRound className="w-4 h-4 text-indigo-700" />
                    <span>Set Initial 4-Digit Login PIN</span>
                  </div>
                  <input
                    type="text"
                    maxLength={4}
                    value={workerForm.pin || ''}
                    onChange={e => setWorkerForm({ ...workerForm, pin: e.target.value.replace(/\D/g, '') })}
                    placeholder="e.g. 1234"
                    className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-base text-center font-mono font-bold text-emerald-800 tracking-widest focus:outline-none focus:border-indigo-600"
                  />
                  <p className="text-[11px] text-stone-600">
                    4-digit PIN for the Worker Portal. You will see a one-time confirmation dialog after saving.
                  </p>
                </div>
              )}

              {/* Edit Mode Notice regarding PIN */}
              {editingWorker && isAdmin && (
                <div className="p-3 bg-stone-100 border border-stone-200 rounded-xl text-xs text-stone-600 flex items-center justify-between">
                  <span>To change this worker's login PIN:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      handleOpenResetPin(editingWorker);
                    }}
                    className="text-amber-800 hover:underline font-bold"
                  >
                    Reset PIN
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold py-2.5 rounded-xl text-sm transition-colors border border-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingWorker || isUploadingPhoto}
                  className="flex-1 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center space-x-2 shadow-xs"
                >
                  {savingWorker ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : isUploadingPhoto ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Uploading Photo...</span>
                    </>
                  ) : (
                    <span>{editingWorker ? 'Update Worker' : 'Save Worker'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET WORKER PIN (Admin Only) */}
      {resetPinWorker && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center space-x-2 text-amber-800">
                <KeyRound className="w-5 h-5" />
                <h3 className="text-base font-black text-stone-900">Reset Worker PIN</h3>
              </div>
              <button
                onClick={() => setResetPinWorker(null)}
                className="text-stone-400 hover:text-stone-900 p-1 rounded-lg hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-xs text-stone-600">
                Worker: <strong className="text-stone-900">{resetPinWorker.full_name}</strong>
              </p>
              <p className="text-xs text-amber-800 font-mono mt-0.5">
                Code: {resetPinWorker.worker_code}
              </p>
            </div>

            {resetPinError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <span>{resetPinError}</span>
              </div>
            )}

            <form onSubmit={handleSaveResetPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  New 4-Digit Login PIN <span className="text-rose-700">*</span>
                </label>
                <input
                  type="text"
                  maxLength={4}
                  required
                  autoFocus
                  value={resetPinInput}
                  onChange={e => setResetPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-3 text-lg text-center font-mono font-bold text-emerald-800 tracking-widest focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setResetPinWorker(null)}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold py-2.5 rounded-xl text-xs transition-colors border border-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPin}
                  className="flex-1 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-xs"
                >
                  {savingPin ? (
                    <span>Saving...</span>
                  ) : (
                    <span>Set New PIN</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREDENTIALS CONFIRMATION DIALOG (SHOWS CODE & PIN ONCE) */}
      {credentialsModal && credentialsModal.show && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative space-y-6">
            <div className="flex items-center space-x-3 text-emerald-800">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-lg font-black text-stone-900">Worker Credentials Ready</h3>
                <p className="text-xs text-stone-600">Pass these login details to {credentialsModal.workerName}</p>
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3 font-mono text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                <span className="text-xs font-sans text-stone-600">Worker Name:</span>
                <span className="font-bold text-stone-900 font-sans">{credentialsModal.workerName}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                <span className="text-xs font-sans text-stone-600">Mobile Number (Login ID):</span>
                <span className="font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg text-base">
                  {credentialsModal.phone}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                <span className="text-xs font-sans text-stone-600">Worker Code:</span>
                <span className="font-bold text-stone-800 font-sans text-xs">
                  {credentialsModal.workerCode}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-sans text-stone-600">4-Digit Login PIN:</span>
                <span className="font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg text-base tracking-widest">
                  {credentialsModal.pin}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <span>
                <strong>One-Time Notice:</strong> This PIN will <strong>never be displayed again</strong> for security. Make sure to copy or pass it to the worker now.
              </span>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  const textToCopy = `StitchPay Worker Credentials:\nWorker Name: ${credentialsModal.workerName}\nMobile Number: ${credentialsModal.phone}\nPIN: ${credentialsModal.pin}`;
                  navigator.clipboard.writeText(textToCopy);
                  setCopiedCredentials(true);
                  showSuccessToast('Credentials copied to clipboard!');
                  setTimeout(() => setCopiedCredentials(false), 3000);
                }}
                className="w-full py-3 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-sm rounded-2xl shadow-xs transition-all flex items-center justify-center space-x-2"
              >
                {copiedCredentials ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Credentials Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Credentials to Clipboard</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setCredentialsModal(null)}
                className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs rounded-xl transition-all border border-stone-200"
              >
                I Have Saved / Passed These Credentials
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
