import React, { useState, useEffect, useRef } from 'react';
import { 
  UserCheck, Clock, Pause, Square, Scissors, TrendingUp, CheckCircle2, 
  Zap, Trophy, Calendar, Crown, DollarSign, LogOut, Key, ShieldAlert,
  ArrowRight, AlertCircle, RefreshCw, Briefcase, Award, Info, Layers, Plus, X, FileText, Check, Lock, PackageCheck
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { dataService } from '../lib/dataService';
import { Worker, DailyAssignment, AttendanceRecord, ProductionEntry, GarmentStyle, GarmentProcess, CuttingEntry, FinishingEntry, FinishingStage, FactorySettings } from '../types';
import { RateBiddingModal } from '../components/RateBiddingModal';
import { WorkerAvatar } from '../components/WorkerAvatar';
import { FooterCredit } from '../components/FooterCredit';
import { ReceiveFromSewingView } from '../components/ReceiveFromSewingView';

export const WorkerPortalScreen: React.FC = () => {
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallDismissed, setIsInstallDismissed] = useState<boolean>(() => {
    return localStorage.getItem('stitchpay_pwa_dismissed') === 'true';
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult?.outcome === 'accepted') {
      console.log('PWA installation accepted');
    }
    setDeferredPrompt(null);
  };

  const handleDismissInstall = () => {
    localStorage.setItem('stitchpay_pwa_dismissed', 'true');
    setIsInstallDismissed(true);
  };

  // Session Worker State
  const [currentWorker, setCurrentWorker] = useState<Worker | null>(null);

  // Login Form State
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState<boolean>(false);

  // Portal Menu Tab Navigation
  const [activityTab, setActivityTab] = useState<'sewing' | 'finishing' | 'cutting'>('sewing');

  // Draggable Navigation Bar State & Handlers
  const navRef = useRef<HTMLDivElement>(null);
  const [isNavDragging, setIsNavDragging] = useState(false);
  const [navStartX, setNavStartX] = useState(0);
  const [navScrollLeft, setNavScrollLeft] = useState(0);

  const handleNavMouseDown = (e: React.MouseEvent) => {
    if (!navRef.current) return;
    setIsNavDragging(true);
    setNavStartX(e.pageX - navRef.current.offsetLeft);
    setNavScrollLeft(navRef.current.scrollLeft);
  };

  const handleNavMouseLeave = () => {
    setIsNavDragging(false);
  };

  const handleNavMouseUp = () => {
    setIsNavDragging(false);
  };

  const handleNavMouseMove = (e: React.MouseEvent) => {
    if (!isNavDragging || !navRef.current) return;
    e.preventDefault();
    const x = e.pageX - navRef.current.offsetLeft;
    const walk = (x - navStartX) * 1.5;
    navRef.current.scrollLeft = navScrollLeft - walk;
  };

  // Portal Data State
  const [settings, setSettings] = useState<FactorySettings | null>(null);
  const currencySymbol = settings?.currency_symbol || 'MYR';
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [monthlyAttendanceCount, setMonthlyAttendanceCount] = useState<number>(0);
  const [assignedWorks, setAssignedWorks] = useState<DailyAssignment[]>([]);
  const [todayEntries, setTodayEntries] = useState<ProductionEntry[]>([]);
  const [allPeriodEntries, setAllPeriodEntries] = useState<ProductionEntry[]>([]);
  const [allEntries, setAllEntries] = useState<ProductionEntry[]>([]);
  const [workersList, setWorkersList] = useState<Worker[]>([]);
  const [garmentStyles, setGarmentStyles] = useState<GarmentStyle[]>([]);
  const [myFinishingEntries, setMyFinishingEntries] = useState<FinishingEntry[]>([]);
  const [allFinishingEntries, setAllFinishingEntries] = useState<FinishingEntry[]>([]);
  const [myCuttingEntries, setMyCuttingEntries] = useState<CuttingEntry[]>([]);
  const [allCuttingEntries, setAllCuttingEntries] = useState<CuttingEntry[]>([]);
  const [allFinishingStages, setAllFinishingStages] = useState<FinishingStage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals & Forms
  const [biddingAssignment, setBiddingAssignment] = useState<DailyAssignment | null>(null);
  const [entryQty, setEntryQty] = useState<string>('');
  const [selectedWork, setSelectedWork] = useState<DailyAssignment | null>(null);
  const [submittingEntry, setSubmittingEntry] = useState<boolean>(false);
  const [clockMessage, setClockMessage] = useState<string | null>(null);

  // Finishing Modal & Form
  const [isFinishingModalOpen, setIsFinishingModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [submittingFinishing, setSubmittingFinishing] = useState(false);
  const [finishingForm, setFinishingForm] = useState({
    style_id: '',
    stage_id: '',
    entry_date: new Date().toISOString().split('T')[0],
    shift: 'day' as 'day' | 'night',
    qty_ok: '',
    qty_rework: '0',
    qty_reject: '0',
    note: '',
  });

  // Cutting Modal & Form
  const [isCuttingModalOpen, setIsCuttingModalOpen] = useState(false);
  const [submittingCutting, setSubmittingCutting] = useState(false);
  const [cuttingForm, setCuttingForm] = useState({
    style_id: '',
    cut_type: 'bulk' as 'bulk' | 'sample',
    entry_date: new Date().toISOString().split('T')[0],
    pieces_cut: '',
    tables_layers: '',
    notes: '',
  });

  // Check existing session on mount
  useEffect(() => {
    initSession();
  }, []);

  const initSession = async () => {
    setLoading(true);
    const savedWorkerId = sessionStorage.getItem('stitchpay_worker_id');
    const [allWrks, factorySet] = await Promise.all([
      dataService.getWorkers(),
      dataService.getSettings(),
    ]);
    setWorkersList(allWrks);
    setSettings(factorySet);

    if (savedWorkerId) {
      const match = allWrks.find(w => w.id === savedWorkerId);
      if (match) {
        setCurrentWorker(match);
        // Default tab based on worker section
        const sec = (match.section || '').toLowerCase();
        if (sec.includes('finishing')) {
          setActivityTab('finishing');
        } else if (sec.includes('cutting')) {
          setActivityTab('cutting');
        } else {
          setActivityTab('sewing');
        }
        await loadWorkerData(match.id);
      } else {
        sessionStorage.removeItem('stitchpay_worker_id');
      }
    }
    setLoading(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim() || !pinInput.trim()) {
      setLoginError('Please enter both Mobile Number and 4-digit PIN');
      return;
    }

    setLoggingIn(true);
    setLoginError(null);

    try {
      const verified = await dataService.verifyWorkerPinByPhone(phoneInput, pinInput);
      if (verified) {
        sessionStorage.setItem('stitchpay_worker_id', verified.id);
        setCurrentWorker(verified);
        const sec = (verified.section || '').toLowerCase();
        if (sec.includes('finishing')) {
          setActivityTab('finishing');
        } else if (sec.includes('cutting')) {
          setActivityTab('cutting');
        } else {
          setActivityTab('sewing');
        }
        await loadWorkerData(verified.id);
      } else {
        setLoginError('Invalid Mobile Number or PIN. Please try again.');
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('stitchpay_worker_id');
    setCurrentWorker(null);
    setTodayAttendance(null);
    setAssignedWorks([]);
    setTodayEntries([]);
    setAllPeriodEntries([]);
    setMyFinishingEntries([]);
    setMyCuttingEntries([]);
  };

  const loadWorkerData = async (workerId: string) => {
    setLoading(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthPrefix = todayStr.slice(0, 7); // 'YYYY-MM'

    const [
      wrkList, attTodayList, allAttList, assignList, entryList,
      stylesList, finishingList, cuttingList, stagesList, factorySet
    ] = await Promise.all([
      dataService.getWorkers(),
      dataService.getAttendance(todayStr),
      dataService.getAttendance(),
      dataService.getDailyAssignments(todayStr),
      dataService.getProductionEntries(),
      dataService.getStyles(),
      dataService.getFinishingEntries(),
      dataService.getCuttingEntries(),
      dataService.getFinishingStages(),
      dataService.getSettings(),
    ]);

    setWorkersList(wrkList);
    setSettings(factorySet);
    setAllEntries(entryList);
    setGarmentStyles(stylesList);
    setAllFinishingStages(stagesList);

    // Filter today attendance
    const att = attTodayList.find(a => a.worker_id === workerId) || null;
    setTodayAttendance(att);

    // Monthly attendance days count
    const workerMonthAtt = allAttList.filter(
      a => a.worker_id === workerId && a.date.startsWith(currentMonthPrefix) && (a.status === 'present' || a.status === 'half_day')
    );
    setMonthlyAttendanceCount(workerMonthAtt.length);

    // Filter assigned works
    const myWorks = assignList.filter(a => a.worker_id === workerId);
    setAssignedWorks(myWorks);

    // Filter production entries
    const myTodayEntries = entryList.filter(e => e.worker_id === workerId && e.entry_date === todayStr);
    setTodayEntries(myTodayEntries);
    setAllPeriodEntries(entryList.filter(e => e.worker_id === workerId));

    // Filter finishing entries for worker
    setAllFinishingEntries(finishingList);
    const workerFinishing = finishingList.filter(f => f.worker_id === workerId);
    setMyFinishingEntries(workerFinishing);

    // Filter cutting entries for worker
    setAllCuttingEntries(cuttingList);
    const workerCutting = cuttingList.filter(c => c.worker_id === workerId);
    setMyCuttingEntries(workerCutting);

    setLoading(false);
  };

  // Clock Actions
  const handleClockIn = async () => {
    if (!currentWorker) return;
    try {
      const att = await dataService.clockInWorker(currentWorker.id);
      setTodayAttendance(att);
      setClockMessage(`✅ Clocked In successfully at ${att.in_time || new Date().toLocaleTimeString()}!`);
      setTimeout(() => setClockMessage(null), 5000);
      await loadWorkerData(currentWorker.id);
    } catch (err: any) {
      alert(err.message || 'Failed to clock in');
    }
  };

  const handleToggleBreak = async () => {
    if (!currentWorker) return;
    try {
      const att = await dataService.toggleWorkerBreak(currentWorker.id);
      setTodayAttendance(att);
      setClockMessage(
        att.is_on_break
          ? `☕ Break started at ${att.break_start_time || new Date().toLocaleTimeString()}`
          : `▶️ Break ended at ${att.break_end_time || new Date().toLocaleTimeString()}. Welcome back to work!`
      );
      setTimeout(() => setClockMessage(null), 5000);
      await loadWorkerData(currentWorker.id);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle break');
    }
  };

  const handleClockOut = async () => {
    if (!currentWorker) return;
    try {
      const att = await dataService.clockOutWorker(currentWorker.id);
      setTodayAttendance(att);
      setClockMessage(`🛑 Clocked Out successfully at ${att.out_time || new Date().toLocaleTimeString()}. Shift ended.`);
      setTimeout(() => setClockMessage(null), 5000);
      await loadWorkerData(currentWorker.id);
    } catch (err: any) {
      alert(err.message || 'Failed to clock out');
    }
  };

  // Submit Rate Bid
  const handleSubmitBid = async (assignmentId: string, proposedRate: number, reason: string) => {
    const assignment = assignedWorks.find(a => a.id === assignmentId);
    if (assignment) {
      assignment.agreed_rate = proposedRate;
      setClockMessage(`Submitted rate bid of ${currencySymbol}${proposedRate}/pc for ${assignment.process_name}`);
      setTimeout(() => setClockMessage(null), 5000);
    }
  };

  // Submit piece production output (Sewing)
  const handleQuickEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWork || !currentWorker || !entryQty || Number(entryQty) <= 0) return;

    setSubmittingEntry(true);
    try {
      await dataService.saveProductionEntry({
        worker_id: currentWorker.id,
        style_id: selectedWork.style_id,
        process_id: selectedWork.process_id,
        assignment_id: selectedWork.id,
        entry_date: new Date().toISOString().split('T')[0],
        qty_ok: Number(entryQty),
        qty_rework: 0,
        qty_reject: 0,
        rate_snapshot: selectedWork.agreed_rate,
        shift: 'day',
        note: 'Submitted via Worker Mobile Portal',
      });

      setSelectedWork(null);
      setEntryQty('');
      await loadWorkerData(currentWorker.id);
    } catch (err: any) {
      alert(err.message || 'Failed to submit production');
    } finally {
      setSubmittingEntry(false);
    }
  };

  // Section Permissions
  const currentSection = (currentWorker?.section || '').trim().toLowerCase();
  const isFinishingWorker = currentSection.includes('finish');
  const isCuttingWorker = currentSection.includes('cut');

  // Submit Finishing Output
  const handleSaveFinishingEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFinishingWorker) {
      alert('Permission Denied: Only workers assigned to the Finishing section can log finishing output.');
      return;
    }
    if (!currentWorker || !finishingForm.style_id || !finishingForm.stage_id || !finishingForm.qty_ok) return;

    setSubmittingFinishing(true);
    try {
      await dataService.saveFinishingEntries([{
        worker_id: currentWorker.id,
        style_id: finishingForm.style_id,
        stage_id: finishingForm.stage_id,
        entry_date: finishingForm.entry_date,
        shift: finishingForm.shift,
        qty_ok: Number(finishingForm.qty_ok || 0),
        qty_rework: Number(finishingForm.qty_rework || 0),
        qty_reject: Number(finishingForm.qty_reject || 0),
        note: finishingForm.note || 'Logged via Worker Mobile Portal',
        entered_by: null,
      }]);

      setIsFinishingModalOpen(false);
      const stageMatch = allFinishingStages.find(s => s.id === finishingForm.stage_id);
      setClockMessage(`✅ Finishing output of ${finishingForm.qty_ok} pcs for ${stageMatch?.name || 'stage'} logged successfully!`);
      setTimeout(() => setClockMessage(null), 5000);

      setFinishingForm({
        style_id: '',
        stage_id: '',
        entry_date: new Date().toISOString().split('T')[0],
        shift: 'day',
        qty_ok: '',
        qty_rework: '0',
        qty_reject: '0',
        note: '',
      });
      await loadWorkerData(currentWorker.id);
    } catch (err: any) {
      alert(err.message || 'Failed to save finishing output');
    } finally {
      setSubmittingFinishing(false);
    }
  };

  // Submit Cutting Output
  const handleSaveCuttingEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCuttingWorker) {
      alert('Permission Denied: Only workers assigned to the Cutting section can log cutting output.');
      return;
    }
    if (!currentWorker || !cuttingForm.style_id || !cuttingForm.pieces_cut) return;

    setSubmittingCutting(true);
    try {
      await dataService.saveCuttingEntry({
        worker_id: currentWorker.id,
        style_id: cuttingForm.style_id,
        cut_type: cuttingForm.cut_type,
        entry_date: cuttingForm.entry_date,
        pieces_cut: Number(cuttingForm.pieces_cut || 0),
        tables_layers: cuttingForm.tables_layers || undefined,
        notes: cuttingForm.notes || 'Logged via Worker Mobile Portal',
      });

      setIsCuttingModalOpen(false);
      setClockMessage(`✅ Cutting output of ${cuttingForm.pieces_cut} pcs logged successfully!`);
      setTimeout(() => setClockMessage(null), 5000);

      setCuttingForm({
        style_id: '',
        cut_type: 'bulk',
        entry_date: new Date().toISOString().split('T')[0],
        pieces_cut: '',
        tables_layers: '',
        notes: '',
      });
      await loadWorkerData(currentWorker.id);
    } catch (err: any) {
      alert(err.message || 'Failed to save cutting output');
    } finally {
      setSubmittingCutting(false);
    }
  };

  // --- WORKER PIN LOGIN SCREEN ---
  if (!currentWorker) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          {/* PWA INSTALL APP BANNER */}
          {deferredPrompt && !isInstallDismissed && (
            <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white rounded-3xl p-4 shadow-lg flex items-center justify-between gap-3 border border-indigo-700 animate-fade-in">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
                  <img src="/icon-192.png" alt="StitchPay" className="w-7 h-7 rounded-xl" />
                </div>
                <div>
                  <div className="text-xs font-black tracking-wide">Install StitchPay App</div>
                  <div className="text-[11px] text-indigo-200">Fast instant offline access on your phone</div>
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={handleInstallPWA}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95"
                >
                  Install
                </button>
                <button
                  onClick={handleDismissInstall}
                  className="p-1.5 text-indigo-200 hover:text-white rounded-lg transition-colors"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center mx-auto shadow-xs">
                <UserCheck className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-black text-stone-900 tracking-tight">Worker Portal</h1>
              <p className="text-xs text-stone-600">Enter your Mobile Number and 4-digit PIN to access your account</p>
            </div>

            {loginError && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-xs text-rose-800 font-medium flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-rose-700 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">
                  Mobile Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="e.g. 0123456789 or +60123456789"
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-stone-900 placeholder-stone-400 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">
                  4-Digit PIN
                </label>
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    required
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="e.g. 1111"
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-lg font-mono tracking-widest font-bold text-stone-900 placeholder-stone-400 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-3.5 px-6 rounded-2xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-sm shadow-xs transition-all active:scale-98 flex items-center justify-center space-x-2"
              >
                {loggingIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying PIN...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Worker Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Test Credentials Box */}
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-1.5 text-xs text-stone-600">
              <div className="font-bold text-stone-800 flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-amber-800" />
                <span>Test Credentials:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div className="bg-white p-2 rounded-xl border border-stone-200">
                  <span className="text-stone-500 block">Worker 1:</span>
                  <span className="font-mono text-amber-800 font-bold">W-001</span> / <span className="font-mono text-amber-800 font-bold">1111</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-stone-200">
                  <span className="text-stone-500 block">Worker 2:</span>
                  <span className="font-mono text-amber-800 font-bold">W-002</span> / <span className="font-mono text-amber-800 font-bold">2222</span>
                </div>
              </div>
            </div>
          </div>

          <FooterCredit />
        </div>
      </div>
    );
  }

  // --- LOGGED-IN WORKER DASHBOARD VIEW ---
  const isPieceRateWorker = currentWorker.pay_type !== 'monthly_salary';
  const isClockedIn = todayAttendance?.status === 'present' && !!todayAttendance.in_time && !todayAttendance.out_time;
  const isOnBreak = todayAttendance?.is_on_break || false;

  const todayOutputPcs = todayEntries.reduce((sum, e) => sum + e.qty_ok, 0);
  const todayEarningsBDT = todayEntries.reduce((sum, e) => sum + e.amount, 0);

  const totalPeriodEarningsBDT = allPeriodEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalPeriodOutputPcs = allPeriodEntries.reduce((sum, e) => sum + e.qty_ok, 0);
  const outstandingAdvanceBDT = currentWorker.outstanding_advance || 0;
  const netReceivableBDT = Math.max(0, totalPeriodEarningsBDT - outstandingAdvanceBDT);

  // Compute Last 7 Days Production Breakdown & Weekly Output
  const last7DaysData: { date: string; dateFormatted: string; pcs: number; earnings: number; entries: ProductionEntry[] }[] = [];
  let weeklyOutputPcs = 0;

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
    const dayEntries = allPeriodEntries.filter(e => e.entry_date === dStr);
    const pcs = dayEntries.reduce((s, e) => s + e.qty_ok, 0);
    const earnings = dayEntries.reduce((s, e) => s + e.amount, 0);
    weeklyOutputPcs += pcs;
    
    last7DaysData.push({
      date: dStr,
      dateFormatted: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      pcs,
      earnings,
      entries: dayEntries,
    });
  }

  // Compute Worker Ranking
  const workerTotalsMap = new Map<string, { totalPcs: number; totalAmt: number }>();
  allEntries.forEach(e => {
    const cur = workerTotalsMap.get(e.worker_id) || { totalPcs: 0, totalAmt: 0 };
    cur.totalPcs += e.qty_ok;
    cur.totalAmt += e.amount;
    workerTotalsMap.set(e.worker_id, cur);
  });

  const sortedWorkerRankings = Array.from(workerTotalsMap.entries())
    .map(([wId, totals]) => ({ workerId: wId, ...totals }))
    .sort((a, b) => b.totalAmt - a.totalAmt);

  const workerRankIndex = sortedWorkerRankings.findIndex(item => item.workerId === currentWorker.id);
  const currentRank = workerRankIndex >= 0 ? workerRankIndex + 1 : 1;
  const totalRankedWorkers = Math.max(workersList.length, sortedWorkerRankings.length);

  // Top 5 Performers Leaderboard
  const topPerformers = sortedWorkerRankings.slice(0, 5).map((rankItem, idx) => {
    const w = workersList.find(work => work.id === rankItem.workerId) || {
      id: rankItem.workerId,
      full_name: `Worker #${idx + 1}`,
      worker_code: `W-10${idx + 1}`,
      photo_url: null,
      section: 'Sewing',
    };
    return {
      rank: idx + 1,
      worker: w,
      totalPcs: rankItem.totalPcs,
      totalAmt: rankItem.totalAmt,
    };
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* PWA INSTALL APP BANNER */}
      {deferredPrompt && !isInstallDismissed && (
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white rounded-3xl p-4 shadow-lg flex items-center justify-between gap-3 border border-indigo-700 animate-fade-in">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
              <img src="/icon-192.png" alt="StitchPay" className="w-7 h-7 rounded-xl" />
            </div>
            <div>
              <div className="text-xs font-black tracking-wide">Install StitchPay App</div>
              <div className="text-[11px] text-indigo-200">Add to home screen for fast instant offline access</div>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleInstallPWA}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95"
            >
              Install
            </button>
            <button
              onClick={handleDismissInstall}
              className="p-1.5 text-indigo-200 hover:text-white rounded-lg transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1. WORKER ACCOUNT HEADER & LOGOUT */}
      <div className="bg-white border border-stone-200 rounded-3xl p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <WorkerAvatar
            photoUrl={currentWorker.photo_url}
            name={currentWorker.full_name}
            size="2xl"
            className="rounded-2xl border-2 border-indigo-200 shadow-xs"
          />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-black text-stone-900">{currentWorker.full_name}</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 font-mono border border-indigo-200 font-bold">
                {currentWorker.worker_code}
              </span>
              {!isPieceRateWorker && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                  Monthly Salaried
                </span>
              )}
            </div>
            <p className="text-xs text-stone-600 mt-1 flex flex-wrap items-center gap-2">
              <span>Section: <strong className="text-stone-800">{currentWorker.section || 'Sewing'}</strong></span>
              <span>•</span>
              <span>Line: <strong className="text-stone-800">{currentWorker.line_no || 'Line-01'}</strong></span>
              <span>•</span>
              <span className="text-amber-800 font-bold flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" /> Rank #{currentRank} of {totalRankedWorkers}
              </span>
            </p>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all self-start md:self-center"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* 2. SHIFT TIME & ATTENDANCE CLOCK */}
      <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
          <div className="flex items-center space-x-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-xs ${
              isClockedIn ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
            }`}>
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-stone-900 flex items-center space-x-2">
                <span>Shift Time & Attendance Clock</span>
                {isClockedIn ? (
                  <span className="text-xs bg-emerald-50 text-emerald-800 px-3 py-0.5 rounded-full border border-emerald-200 font-bold flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                    <span>Clocked In (Active)</span>
                  </span>
                ) : (
                  <span className="text-xs bg-stone-100 text-stone-600 px-3 py-0.5 rounded-full border border-stone-200">
                    Off Duty / Not Clocked In
                  </span>
                )}
              </h2>
              <p className="text-xs text-stone-600 mt-0.5">
                {isClockedIn 
                  ? `Clocked In at: ${todayAttendance?.in_time || '08:00 AM'}` 
                  : 'Click Clock In Now to record your shift start'}
              </p>
            </div>
          </div>
        </div>

        {/* Confirmation Banner */}
        {clockMessage && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs font-bold text-emerald-900 flex items-center justify-between animate-fade-in shadow-xs">
            <span>{clockMessage}</span>
            <button onClick={() => setClockMessage(null)} className="text-emerald-800 hover:text-emerald-950 text-xs ml-2">✕</button>
          </div>
        )}

        {/* Attendance Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Clock In */}
          <button
            onClick={handleClockIn}
            disabled={isClockedIn}
            className={`py-3.5 px-5 rounded-2xl font-black text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center space-x-2.5 ${
              isClockedIn
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{isClockedIn ? 'Clocked In ✓' : 'Clock In Now'}</span>
          </button>

          {/* Break Button */}
          <button
            onClick={handleToggleBreak}
            disabled={!isClockedIn}
            className={`py-3.5 px-5 rounded-2xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center space-x-2 ${
              !isClockedIn
                ? 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                : isOnBreak
                ? 'bg-amber-700 hover:bg-amber-800 text-white font-black animate-pulse'
                : 'bg-indigo-700 hover:bg-indigo-800 text-white'
            }`}
          >
            <Pause className="w-4 h-4" />
            <span>{isOnBreak ? 'Resume Work' : 'Take Break'}</span>
          </button>

          {/* Clock Out */}
          <button
            onClick={handleClockOut}
            disabled={!isClockedIn}
            className={`py-3.5 px-5 rounded-2xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center space-x-2 ${
              !isClockedIn
                ? 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                : 'bg-rose-700 hover:bg-rose-800 text-white'
            }`}
          >
            <Square className="w-4 h-4 fill-current" />
            <span>Clock Out</span>
          </button>
        </div>
      </div>

      {/* Active Tab Section Header Indicator */}
      <div className="flex items-center justify-between bg-white border border-stone-200 rounded-2xl p-3 px-4 shadow-2xs">
        <div className="flex items-center space-x-2">
          {activityTab === 'sewing' && <Scissors className="w-4 h-4 text-amber-800" />}
          {activityTab === 'finishing' && <Layers className="w-4 h-4 text-purple-700" />}
          {activityTab === 'cutting' && <Scissors className="w-4 h-4 text-indigo-700 rotate-90" />}
          <span className="text-xs font-black text-stone-900 uppercase tracking-wider">
            {activityTab} Activity View
          </span>
        </div>
        <div className="flex items-center space-x-1.5 text-[11px] font-bold text-stone-500">
          <span>Swipe/Tap bottom bar to switch</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
        </div>
      </div>

      {/* 4. SEWING ACTIVITY CONTENT */}
      {activityTab === 'sewing' && (
        <div className="space-y-6 animate-fade-in">
          {/* TODAY'S WORK SECTION (REAL-TIME UPDATED & PAY-TYPE ADAPTIVE) */}
          <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-xs space-y-0">
            <div className="p-5 border-b border-stone-200 bg-stone-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-stone-900 flex items-center space-x-2">
                  <Scissors className="w-5 h-5 text-amber-800" />
                  <span>Today's Work</span>
                </h2>
                <p className="text-xs text-stone-600 mt-0.5">
                  Live operation logs and earnings updated instantly as supervisor saves entries
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  <span>Live Real-Time Sync</span>
                </span>
              </div>
            </div>

            {/* OPERATIONS BREAKDOWN LIST */}
            {assignedWorks.length === 0 ? (
              <div className="p-8 text-center text-stone-500 text-xs space-y-1">
                <Info className="w-6 h-6 text-stone-400 mx-auto mb-2" />
                <p className="font-semibold text-stone-700">No line operations assigned to you today</p>
                <p className="text-stone-500 text-[11px]">Please check with your line supervisor for today's assignment.</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-200">
                {assignedWorks.map(work => {
                  const myOutputForWork = todayEntries
                    .filter(e => e.process_id === work.process_id)
                    .reduce((s, e) => s + e.qty_ok, 0);

                  const targetQty = work.target_qty || 250;
                  const progressPct = Math.min(100, Math.round((myOutputForWork / targetQty) * 100));
                  const agreedRate = work.agreed_rate || 0;
                  const opAmountEarned = myOutputForWork * agreedRate;

                  return (
                    <div key={work.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-stone-50 transition-colors">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-base text-stone-900">{work.process_name}</span>
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-800 font-mono font-bold border border-stone-200">
                            {work.style_code}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600">
                          <span>Style: <strong className="text-stone-800">{work.style_name}</strong></span>
                          <span>•</span>
                          <span>Target Qty: <strong className="text-stone-800">{targetQty} pcs</strong></span>
                          <span>•</span>
                          <span>Completed Qty: <strong className="text-emerald-800">{myOutputForWork} pcs</strong></span>
                          
                          {/* CONDITIONAL DISPLAY: Show Rate & Amount ONLY for Piece-Rate Workers */}
                          {isPieceRateWorker ? (
                            <>
                              <span>•</span>
                              <span className="text-emerald-800 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                                Rate: {currencySymbol}{agreedRate}/pc
                              </span>
                              <span>•</span>
                              <span className="text-amber-800 font-bold bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-300">
                                Earned: {currencySymbol}{opAmountEarned.toLocaleString()}
                              </span>
                            </>
                          ) : (
                            /* MONTHLY SALARY WORKER: Omit rate, amount, and earnings completely */
                            null
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full max-w-md bg-stone-100 h-2.5 rounded-full overflow-hidden mt-1 border border-stone-200">
                          <div
                            className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Actions: Bidding Option (piece-rate only) + Log Output */}
                      <div className="flex items-center space-x-2 self-start md:self-center shrink-0">
                        {isPieceRateWorker && (
                          <button
                            onClick={() => setBiddingAssignment(work)}
                            className="bg-stone-100 hover:bg-stone-200 text-amber-900 border border-stone-200 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-1"
                          >
                            <DollarSign className="w-3.5 h-3.5 text-amber-800" />
                            <span>Bidding Option</span>
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedWork(work)}
                          className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-4 py-2 rounded-2xl text-xs shadow-xs transition-all flex items-center space-x-1.5"
                        >
                          <Zap className="w-4 h-4 fill-current" />
                          <span>Log Output</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TODAY'S WORK SUMMARY METRICS BAR */}
            <div className="p-5 bg-stone-50 border-t border-stone-200">
              {isPieceRateWorker ? (
                /* PIECE RATE WORKER METRICS SUMMARY */
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Today's Earnings</span>
                    <span className="text-xl font-black text-amber-800 mt-0.5 font-mono block">{currencySymbol}{todayEarningsBDT.toLocaleString()}</span>
                    <span className="text-[10px] text-stone-500">{todayOutputPcs} pcs today</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Running Total (Pay Period)</span>
                    <span className="text-xl font-black text-indigo-700 mt-0.5 font-mono block">{currencySymbol}{totalPeriodEarningsBDT.toLocaleString()}</span>
                    <span className="text-[10px] text-stone-500">Current period total</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Pieces Completed This Week</span>
                    <span className="text-xl font-black text-stone-900 mt-0.5 font-mono block">{weeklyOutputPcs.toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span></span>
                    <span className="text-[10px] text-stone-500">Last 7 days total</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Net Payable Amount</span>
                    <span className="text-xl font-black text-emerald-800 mt-0.5 font-mono block">{currencySymbol}{netReceivableBDT.toLocaleString()}</span>
                    <span className="text-[10px] text-stone-500">After advance deductions</span>
                  </div>
                </div>
              ) : (
                /* MONTHLY SALARY WORKER METRICS SUMMARY (No rate, no piece amounts) */
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Fixed Monthly Salary</span>
                    <span className="text-xl font-black text-amber-800 mt-0.5 font-mono block">{currencySymbol}{(currentWorker.monthly_salary || 0).toLocaleString()}</span>
                    <span className="text-[10px] text-stone-500">Fixed Monthly Rate</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Days Worked This Month</span>
                    <span className="text-xl font-black text-indigo-700 mt-0.5 font-mono block">{monthlyAttendanceCount} <span className="text-xs font-normal text-stone-500">days</span></span>
                    <span className="text-[10px] text-stone-500">Present in attendance</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Today's Piece Output</span>
                    <span className="text-xl font-black text-stone-900 mt-0.5 font-mono block">{todayOutputPcs.toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span></span>
                    <span className="text-[10px] text-stone-500">Completed today</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Pieces Completed This Week</span>
                    <span className="text-xl font-black text-emerald-800 mt-0.5 font-mono block">{weeklyOutputPcs.toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span></span>
                    <span className="text-[10px] text-stone-500">Last 7 days total</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* EARNINGS & PRODUCTION GRAPH WITH RANKING */}
          <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
              <div>
                <h2 className="text-lg font-black text-stone-900 flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-indigo-700" />
                  <span>Production Trend & Factory Standing</span>
                </h2>
                <p className="text-xs text-stone-600">Cumulative output analysis and performance metrics</p>
              </div>

              {/* Ranking Badge */}
              <div className="bg-amber-50 border border-amber-300 px-4 py-2 rounded-2xl flex items-center space-x-3 self-start sm:self-center">
                <Trophy className="w-6 h-6 text-amber-800" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-amber-900 tracking-wider">Factory Worker Rank</div>
                  <div className="text-sm font-black text-stone-900">
                    Rank #{currentRank} <span className="text-xs text-stone-600 font-normal">of {totalRankedWorkers} Workers</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Graph: Output & Earnings over last 7 days */}
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-2">
              <div className="text-xs font-bold text-stone-700 flex items-center justify-between">
                <span>Last 7 Days Production Trend</span>
                <span className="text-[10px] text-stone-500 font-mono">Output Pieces {isPieceRateWorker ? `& Earnings (${currencySymbol})` : 'Daily'}</span>
              </div>

              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={last7DaysData}>
                    <defs>
                      <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#047857" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#047857" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorPcs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4338CA" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#4338CA" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="dateFormatted" stroke="#78716c" fontSize={11} />
                    <YAxis stroke="#78716c" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e7e5e4', borderRadius: '12px', color: '#1c1917' }}
                      labelStyle={{ color: '#1c1917', fontWeight: 'bold' }}
                    />
                    {isPieceRateWorker && (
                      <Area type="monotone" dataKey="earnings" name={`Earnings (${currencySymbol})`} stroke="#047857" fillOpacity={1} fill="url(#colorEarnings)" />
                    )}
                    <Area type="monotone" dataKey="pcs" name="Pieces (Pcs)" stroke="#4338CA" fillOpacity={1} fill="url(#colorPcs)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* LAST 7 DAYS PRODUCTION DETAILS BREAKDOWN */}
          <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h2 className="text-base font-black text-stone-900 flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-indigo-700" />
                <span>Last 7 Days Production Details</span>
              </h2>
              <span className="text-xs text-stone-600 font-mono">Daily Breakdown</span>
            </div>

            <div className="w-full max-w-full overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[480px]">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Completed Pieces</th>
                    {isPieceRateWorker && <th className="py-2.5 px-3">Day Earnings</th>}
                    <th className="py-2.5 px-3">Logged Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 text-stone-700">
                  {last7DaysData.map((day, idx) => (
                    <tr key={idx} className="hover:bg-stone-50 transition-colors">
                      <td className="py-3 px-3 font-bold text-stone-900">{day.dateFormatted}</td>
                      <td className="py-3 px-3 font-mono text-indigo-800 font-bold">{day.pcs} pcs</td>
                      {isPieceRateWorker && (
                        <td className="py-3 px-3 font-mono text-emerald-800 font-bold">{currencySymbol}{day.earnings.toLocaleString()}</td>
                      )}
                      <td className="py-3 px-3 text-stone-600">
                        {day.entries.length > 0 ? (
                          <span className="bg-stone-100 px-2 py-1 rounded text-[11px] text-stone-800">
                            {day.entries.length} log submissions
                          </span>
                        ) : (
                          <span className="text-stone-400">No logs / Off day</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TOP PERFORMANCE LEADERBOARD TILL NOW */}
          <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h2 className="text-base font-black text-stone-900 flex items-center space-x-2">
                <Crown className="w-5 h-5 text-amber-800" />
                <span>Top Performers Till Now (Factory Leaderboard)</span>
              </h2>
              <span className="text-xs text-amber-900 font-bold bg-amber-50 px-3 py-1 rounded-full border border-amber-300">
                Top 5 Workers
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {topPerformers.map(item => (
                <div
                  key={item.worker.id}
                  className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-all ${
                    item.rank === 1
                      ? 'bg-amber-50 border-amber-300 shadow-xs'
                      : 'bg-stone-50 border-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                      item.rank === 1 ? 'bg-amber-700 text-white' : 'bg-stone-200 text-stone-800'
                    }`}>
                      #{item.rank}
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono">{item.worker.worker_code}</span>
                  </div>

                  <div className="flex items-center space-x-2.5">
                    <WorkerAvatar
                      photoUrl={item.worker.photo_url}
                      name={item.worker.full_name}
                      size="md"
                      className="rounded-xl"
                    />
                    <div>
                      <div className="text-xs font-bold text-stone-900 truncate max-w-[100px]">{item.worker.full_name}</div>
                      <div className="text-[10px] text-stone-600">{item.worker.section || 'Sewing'}</div>
                    </div>
                  </div>

                  <div className="border-t border-stone-200 pt-2 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-stone-600">Total Output:</span>
                      <strong className="text-indigo-800 font-mono">{item.totalPcs} pcs</strong>
                    </div>
                    {item.worker.pay_type !== 'monthly_salary' && (
                      <div className="flex justify-between">
                        <span className="text-stone-600">Total Pay:</span>
                        <strong className="text-emerald-800 font-mono">{currencySymbol}{item.totalAmt.toLocaleString()}</strong>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. FINISHING ACTIVITY CONTENT */}
      {activityTab === 'finishing' && (() => {
        const displayedFinishingEntries = isFinishingWorker ? myFinishingEntries : allFinishingEntries;

        return (
          <div className="space-y-6 animate-fade-in">
            {/* PERMISSION NOTICE BANNER FOR NON-FINISHING WORKERS */}
            {!isFinishingWorker && (
              <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3.5 px-4 text-xs text-amber-900 flex items-center justify-between shadow-2xs">
                <span className="flex items-center space-x-2 font-medium">
                  <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Logged in as <strong>{currentWorker?.full_name} ({currentWorker?.section || 'Sewing'})</strong>. You are in <strong>Read-Only Mode</strong>. Only workers assigned to the Finishing section can log finishing output.</span>
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-200/70 px-2.5 py-1 rounded-lg border border-amber-300 shrink-0 ml-2">Read Only</span>
              </div>
            )}

            {/* FINISHING HEADER & METRIC SUMMARY */}
            <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
                <div>
                  <h2 className="text-lg font-black text-stone-900 flex items-center space-x-2">
                    <Layers className="w-5 h-5 text-purple-700" />
                    <span>Finishing Activity Portal</span>
                  </h2>
                  <p className="text-xs text-stone-600 mt-0.5">
                    {isFinishingWorker 
                      ? "Log finishing process outputs (Thread Trimming, Buttoning, Ironing, Packing, QC) & track stage submissions"
                      : "View finishing process metrics and stage completion output numbers across active garments"
                    }
                  </p>
                </div>

                {isFinishingWorker ? (
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => setIsReceiveModalOpen(true)}
                      className="bg-purple-900 hover:bg-purple-950 text-white font-bold px-4 py-2.5 rounded-2xl text-xs shadow-xs transition-all flex items-center space-x-2"
                    >
                      <PackageCheck className="w-4 h-4 text-purple-200" />
                      <span>Receive from Sewing</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFinishingForm({
                          style_id: garmentStyles[0]?.id || '',
                          stage_id: allFinishingStages[0]?.id || '',
                          entry_date: new Date().toISOString().split('T')[0],
                          shift: 'day',
                          qty_ok: '',
                          qty_rework: '0',
                          qty_reject: '0',
                          note: '',
                        });
                        setIsFinishingModalOpen(true);
                      }}
                      className="bg-stone-800 hover:bg-stone-900 text-white font-bold px-4 py-2.5 rounded-2xl text-xs shadow-xs transition-all flex items-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Record Stage Output</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-amber-50 text-amber-900 border border-amber-200 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center space-x-1.5 self-start sm:self-center">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Finishing Workers Only</span>
                  </div>
                )}
              </div>

              {/* METRIC CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="bg-purple-50/60 p-3.5 rounded-2xl border border-purple-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">Today's Finishing Output</span>
                  <span className="text-2xl font-black text-purple-900 mt-0.5 font-mono block">
                    {displayedFinishingEntries.filter(f => f.entry_date === new Date().toISOString().split('T')[0]).reduce((s, f) => s + (f.qty_ok || 0), 0).toLocaleString()} <span className="text-xs font-normal text-purple-700">pcs</span>
                  </span>
                  <span className="text-[10px] text-purple-700 font-medium">{isFinishingWorker ? 'My output today' : 'Total factory output today'}</span>
                </div>

                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Total Finishing Output</span>
                  <span className="text-2xl font-black text-stone-900 mt-0.5 font-mono block">
                    {displayedFinishingEntries.reduce((s, f) => s + (f.qty_ok || 0), 0).toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span>
                  </span>
                  <span className="text-[10px] text-stone-500">Cumulative total</span>
                </div>

                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Rework / Rejects</span>
                  <span className="text-2xl font-black text-amber-800 mt-0.5 font-mono block">
                    {displayedFinishingEntries.reduce((s, f) => s + (f.qty_rework || 0) + (f.qty_reject || 0), 0).toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span>
                  </span>
                  <span className="text-[10px] text-stone-500">Quality check items</span>
                </div>

                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Logged Submissions</span>
                  <span className="text-2xl font-black text-indigo-700 mt-0.5 font-mono block">
                    {displayedFinishingEntries.length} <span className="text-xs font-normal text-stone-500">logs</span>
                  </span>
                  <span className="text-[10px] text-stone-500">Finishing records</span>
                </div>
              </div>
            </div>

            {/* ACTIVE FINISHING STAGES PER STYLE */}
            <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <h3 className="text-base font-black text-stone-900 flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-purple-700" />
                  <span>Active Garment Finishing Stages</span>
                </h3>
                <span className="text-xs text-stone-500 font-medium">
                  {isFinishingWorker ? "Select stage to submit output" : "Garment stage completion status"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {garmentStyles.filter(s => s.status !== 'completed').map(st => {
                  const styleStages = allFinishingStages.filter(stage => stage.style_id === st.id);
                  
                  return (
                    <div key={st.id} className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-mono font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                            {st.style_code}
                          </span>
                          <h4 className="text-sm font-black text-stone-900 mt-1">{st.name}</h4>
                        </div>
                        <span className="text-[11px] font-bold text-stone-600 bg-white px-2.5 py-1 rounded-xl border border-stone-200">
                          {st.order_qty?.toLocaleString()} pcs
                        </span>
                      </div>

                      {/* Stages List */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Stages Pipeline:</div>
                        {styleStages.length === 0 ? (
                          <div className="text-xs text-stone-500 italic bg-white p-2.5 rounded-xl border border-stone-200 flex items-center justify-between">
                            <span>Standard Finishing Stages</span>
                            {isFinishingWorker ? (
                              <button
                                onClick={() => {
                                  setFinishingForm({
                                    style_id: st.id,
                                    stage_id: '',
                                    entry_date: new Date().toISOString().split('T')[0],
                                    shift: 'day',
                                    qty_ok: '',
                                    qty_rework: '0',
                                    qty_reject: '0',
                                    note: '',
                                  });
                                  setIsFinishingModalOpen(true);
                                }}
                                className="text-xs text-purple-800 hover:text-purple-950 font-bold"
                              >
                                + Log Output
                              </button>
                            ) : (
                              <span className="text-[11px] font-bold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-lg border border-stone-200">
                                View Only
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {styleStages.map(stg => (
                              <div key={stg.id} className="bg-white p-2.5 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                                <div className="font-bold text-stone-800 flex items-center space-x-1.5">
                                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 text-[10px] flex items-center justify-center font-mono font-bold">
                                    {stg.seq_no}
                                  </span>
                                  <span>{stg.name}</span>
                                </div>

                                {isFinishingWorker ? (
                                  <button
                                    onClick={() => {
                                      setFinishingForm({
                                        style_id: st.id,
                                        stage_id: stg.id,
                                        entry_date: new Date().toISOString().split('T')[0],
                                        shift: 'day',
                                        qty_ok: '',
                                        qty_rework: '0',
                                        qty_reject: '0',
                                        note: '',
                                      });
                                      setIsFinishingModalOpen(true);
                                    }}
                                    className="bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors"
                                  >
                                    + Log Output
                                  </button>
                                ) : (
                                  <span className="text-[11px] font-bold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-lg border border-stone-200">
                                    View Only
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FINISHING LOG SUBMISSIONS TABLE */}
            <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <h3 className="text-base font-black text-stone-900 flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-purple-700" />
                  <span>{isFinishingWorker ? 'My Finishing Activity Log Submissions' : 'Factory Finishing Activity Logs (Read-Only)'}</span>
                </h3>
                <span className="text-xs text-stone-500 font-mono">{displayedFinishingEntries.length} records</span>
              </div>

              {displayedFinishingEntries.length === 0 ? (
                <div className="p-8 text-center text-stone-500 text-xs space-y-1">
                  <Info className="w-6 h-6 text-stone-400 mx-auto mb-2" />
                  <p className="font-semibold text-stone-700">No finishing logs recorded yet</p>
                  <p className="text-stone-500 text-[11px]">
                    {isFinishingWorker ? 'Click "Record Finishing Output" above to log your finishing work.' : 'Finishing entries logged by workers will appear here.'}
                  </p>
                </div>
              ) : (
                <div className="w-full max-w-full overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[600px]">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Date & Shift</th>
                        <th className="py-2.5 px-3">Garment Style</th>
                        <th className="py-2.5 px-3">Finishing Stage</th>
                        <th className="py-2.5 px-3 text-right">OK Pieces</th>
                        <th className="py-2.5 px-3 text-right">Rework</th>
                        <th className="py-2.5 px-3 text-right">Reject</th>
                        <th className="py-2.5 px-3">Entered By</th>
                        <th className="py-2.5 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 text-stone-700">
                      {displayedFinishingEntries.map(fe => {
                        const st = garmentStyles.find(s => s.id === fe.style_id);
                        const stg = allFinishingStages.find(s => s.id === fe.stage_id);

                        return (
                          <tr key={fe.id} className="hover:bg-stone-50 transition-colors">
                            <td className="py-3 px-3">
                              <span className="font-bold text-stone-900 block">{fe.entry_date}</span>
                              <span className="text-[10px] text-stone-500 uppercase">{fe.shift || 'day'} shift</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-mono font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
                                {fe.style_code || st?.style_code || 'STY'}
                              </span>
                              <span className="block text-stone-800 font-medium mt-0.5">{fe.style_name || st?.name}</span>
                            </td>
                            <td className="py-3 px-3 font-bold text-purple-900">
                              {fe.stage_name || stg?.name || 'Finishing Stage'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-emerald-800 font-bold">
                              {fe.qty_ok} pcs
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-amber-800 font-bold">
                              {fe.qty_rework || 0} pcs
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-rose-700 font-bold">
                              {fe.qty_reject || 0} pcs
                            </td>
                            <td className="py-3 px-3 font-medium text-stone-700">
                              {fe.entered_by || 'Worker'}
                            </td>
                            <td className="py-3 px-3 text-stone-500 text-[11px]">
                              {fe.note || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 6. CUTTING ACTIVITY CONTENT */}
      {activityTab === 'cutting' && (() => {
        const displayedCuttingEntries = isCuttingWorker ? myCuttingEntries : allCuttingEntries;

        return (
          <div className="space-y-6 animate-fade-in">
            {/* PERMISSION NOTICE BANNER FOR NON-CUTTING WORKERS */}
            {!isCuttingWorker && (
              <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3.5 px-4 text-xs text-amber-900 flex items-center justify-between shadow-2xs">
                <span className="flex items-center space-x-2 font-medium">
                  <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Logged in as <strong>{currentWorker?.full_name} ({currentWorker?.section || 'Sewing'})</strong>. You are in <strong>Read-Only Mode</strong>. Only workers assigned to the Cutting section can log cutting output.</span>
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-200/70 px-2.5 py-1 rounded-lg border border-amber-300 shrink-0 ml-2">Read Only</span>
              </div>
            )}

            {/* CUTTING HEADER & METRIC SUMMARY */}
            <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
                <div>
                  <h2 className="text-lg font-black text-stone-900 flex items-center space-x-2">
                    <Scissors className="w-5 h-5 text-indigo-700 rotate-90" />
                    <span>Cutting Activity Portal</span>
                  </h2>
                  <p className="text-xs text-stone-600 mt-0.5">
                    {isCuttingWorker 
                      ? "Record table cutting output (Bulk Cutting & Sample Cutting) & track cutting log history"
                      : "View cutting output metrics, order cutting progress, and cutting submission logs across styles"
                    }
                  </p>
                </div>

                {isCuttingWorker ? (
                  <button
                    onClick={() => {
                      const cutStyles = garmentStyles.filter(s => s.requires_cutting !== false);
                      setCuttingForm({
                        style_id: cutStyles[0]?.id || garmentStyles[0]?.id || '',
                        cut_type: 'bulk',
                        entry_date: new Date().toISOString().split('T')[0],
                        pieces_cut: '',
                        tables_layers: '',
                        notes: '',
                      });
                      setIsCuttingModalOpen(true);
                    }}
                    className="bg-indigo-800 hover:bg-indigo-900 text-white font-bold px-4 py-2.5 rounded-2xl text-xs shadow-xs transition-all flex items-center space-x-2 self-start sm:self-center"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Record Cutting Output</span>
                  </button>
                ) : (
                  <div className="bg-amber-50 text-amber-900 border border-amber-200 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center space-x-1.5 self-start sm:self-center">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Cutting Workers Only</span>
                  </div>
                )}
              </div>

              {/* METRIC CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Today's Cut Output</span>
                  <span className="text-2xl font-black text-indigo-900 mt-0.5 font-mono block">
                    {displayedCuttingEntries.filter(c => c.entry_date === new Date().toISOString().split('T')[0]).reduce((s, c) => s + (c.pieces_cut || 0), 0).toLocaleString()} <span className="text-xs font-normal text-indigo-700">pcs</span>
                  </span>
                  <span className="text-[10px] text-indigo-700 font-medium">{isCuttingWorker ? 'My output today' : 'Total factory output today'}</span>
                </div>

                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Total Bulk Cut Pieces</span>
                  <span className="text-2xl font-black text-stone-900 mt-0.5 font-mono block">
                    {displayedCuttingEntries.filter(c => c.cut_type === 'bulk').reduce((s, c) => s + (c.pieces_cut || 0), 0).toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span>
                  </span>
                  <span className="text-[10px] text-stone-500">Production cutting</span>
                </div>

                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Total Sample Cut Pieces</span>
                  <span className="text-2xl font-black text-amber-800 mt-0.5 font-mono block">
                    {displayedCuttingEntries.filter(c => c.cut_type === 'sample').reduce((s, c) => s + (c.pieces_cut || 0), 0).toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span>
                  </span>
                  <span className="text-[10px] text-stone-500">Sample cutting</span>
                </div>

                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Cutting Submissions</span>
                  <span className="text-2xl font-black text-emerald-800 mt-0.5 font-mono block">
                    {displayedCuttingEntries.length} <span className="text-xs font-normal text-stone-500">logs</span>
                  </span>
                  <span className="text-[10px] text-stone-500">Cutting records</span>
                </div>
              </div>
            </div>

            {/* ACTIVE CUTTING ORDERS BOARD */}
            <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <h3 className="text-base font-black text-stone-900 flex items-center space-x-2">
                  <Scissors className="w-4 h-4 text-indigo-700 rotate-90" />
                  <span>Active In-House Cutting Orders</span>
                </h3>
                <span className="text-xs text-stone-500 font-medium">Styles requiring table cutting</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {garmentStyles.filter(s => s.requires_cutting !== false && s.status !== 'completed').map(st => {
                  const styleCutTotal = allCuttingEntries
                    .filter(c => c.style_id === st.id)
                    .reduce((s, c) => s + (c.pieces_cut || 0), 0);

                  const cutPct = Math.min(100, Math.round((styleCutTotal / (st.order_qty || 1)) * 100));

                  return (
                    <div key={st.id} className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-mono font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                            {st.style_code}
                          </span>
                          <h4 className="text-sm font-black text-stone-900 mt-1">{st.name}</h4>
                        </div>
                        <span className="text-[11px] font-bold text-stone-600 bg-white px-2.5 py-1 rounded-xl border border-stone-200">
                          Target: {st.order_qty?.toLocaleString()} pcs
                        </span>
                      </div>

                      {/* Progress */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-stone-600 font-bold">
                          <span>Total Cut Pieces:</span>
                          <span className="text-indigo-800 font-mono">{styleCutTotal.toLocaleString()} pcs ({cutPct}%)</span>
                        </div>
                        <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                          <div className="bg-indigo-700 h-full rounded-full transition-all" style={{ width: `${cutPct}%` }}></div>
                        </div>
                      </div>

                      <div className="pt-1 flex justify-end">
                        {isCuttingWorker ? (
                          <button
                            onClick={() => {
                              setCuttingForm({
                                style_id: st.id,
                                cut_type: 'bulk',
                                entry_date: new Date().toISOString().split('T')[0],
                                pieces_cut: '',
                                tables_layers: '',
                                notes: '',
                              });
                              setIsCuttingModalOpen(true);
                            }}
                            className="bg-indigo-800 hover:bg-indigo-900 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs transition-colors flex items-center space-x-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Record Cutting Output</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-bold text-stone-400 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
                            View Only
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CUTTING LOG SUBMISSIONS TABLE */}
            <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <h3 className="text-base font-black text-stone-900 flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-indigo-700" />
                  <span>{isCuttingWorker ? 'My Cutting Activity Log Submissions' : 'Factory Cutting Activity Logs (Read-Only)'}</span>
                </h3>
                <span className="text-xs text-stone-500 font-mono">{displayedCuttingEntries.length} records</span>
              </div>

              {displayedCuttingEntries.length === 0 ? (
                <div className="p-8 text-center text-stone-500 text-xs space-y-1">
                  <Info className="w-6 h-6 text-stone-400 mx-auto mb-2" />
                  <p className="font-semibold text-stone-700">No cutting logs recorded yet</p>
                  <p className="text-stone-500 text-[11px]">
                    {isCuttingWorker ? 'Click "Record Cutting Output" above to log your cutting table output.' : 'Cutting entries logged by workers will appear here.'}
                  </p>
                </div>
              ) : (
                <div className="w-full max-w-full overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[600px]">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Garment Style</th>
                        <th className="py-2.5 px-3">Cut Type</th>
                        <th className="py-2.5 px-3 text-right">Pieces Cut</th>
                        <th className="py-2.5 px-3">Table / Layers</th>
                        <th className="py-2.5 px-3">Entered By</th>
                        <th className="py-2.5 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 text-stone-700">
                      {displayedCuttingEntries.map(ce => {
                        const st = garmentStyles.find(s => s.id === ce.style_id);
                        const wrk = workersList.find(w => w.id === ce.worker_id);

                        return (
                          <tr key={ce.id} className="hover:bg-stone-50 transition-colors">
                            <td className="py-3 px-3 font-bold text-stone-900">{ce.entry_date}</td>
                            <td className="py-3 px-3">
                              <span className="font-mono font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
                                {ce.style_code || st?.style_code || 'STY'}
                              </span>
                              <span className="block text-stone-800 font-medium mt-0.5">{ce.style_name || st?.name}</span>
                            </td>
                            <td className="py-3 px-3">
                              {ce.cut_type === 'bulk' ? (
                                <span className="text-[11px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                  Bulk Cutting
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                  Sample Cutting
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-black text-indigo-900 text-sm">
                              {ce.pieces_cut?.toLocaleString()} pcs
                            </td>
                            <td className="py-3 px-3 font-mono text-stone-600">
                              {ce.tables_layers || '-'}
                            </td>
                            <td className="py-3 px-3 font-medium text-stone-700">
                              {wrk?.full_name || 'Cutting Worker'}
                            </td>
                            <td className="py-3 px-3 text-stone-500 text-[11px]">
                              {ce.notes || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* MODALS */}
      {/* Rate Bidding Modal */}
      <RateBiddingModal
        isOpen={Boolean(biddingAssignment)}
        onClose={() => setBiddingAssignment(null)}
        assignment={biddingAssignment}
        onSubmitBid={handleSubmitBid}
        currencySymbol={currencySymbol}
      />

      {/* Production Output Log Modal (Sewing) */}
      {selectedWork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-stone-900 flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-800" />
              <span>Log Sewing Production Output</span>
            </h3>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 text-xs space-y-1">
              <div className="text-amber-800 font-bold">{selectedWork.process_name}</div>
              <div className="text-stone-800">Style: {selectedWork.style_name}</div>
              {isPieceRateWorker && (
                <div className="text-stone-600">Approved Rate: {currencySymbol}{selectedWork.agreed_rate} per piece</div>
              )}
            </div>

            <form onSubmit={handleQuickEntrySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Quantity OK Pieces Completed <span className="text-rose-700">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 50"
                  value={entryQty}
                  onChange={(e) => setEntryQty(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-xl font-black text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedWork(null)}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded-2xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEntry}
                  className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-2xl text-xs shadow-xs"
                >
                  {submittingEntry ? 'Submitting...' : 'Confirm & Save Output'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Finishing Output Modal */}
      {isFinishingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-base font-bold text-stone-900 flex items-center space-x-2">
                <Layers className="w-5 h-5 text-purple-700" />
                <span>Record Finishing Stage Output</span>
              </h3>
              <button
                onClick={() => setIsFinishingModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFinishingEntry} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Garment Style <span className="text-rose-600">*</span></label>
                <select
                  required
                  value={finishingForm.style_id}
                  onChange={(e) => {
                    const selectedStId = e.target.value;
                    const styleStages = allFinishingStages.filter(st => st.style_id === selectedStId);
                    setFinishingForm(prev => ({
                      ...prev,
                      style_id: selectedStId,
                      stage_id: styleStages[0]?.id || prev.stage_id || '',
                    }));
                  }}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none focus:border-purple-700"
                >
                  <option value="">Select Style...</option>
                  {garmentStyles.map(st => (
                    <option key={st.id} value={st.id}>{st.style_code} - {st.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Finishing Stage <span className="text-rose-600">*</span></label>
                <select
                  required
                  value={finishingForm.stage_id}
                  onChange={(e) => setFinishingForm(prev => ({ ...prev, stage_id: e.target.value }))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none focus:border-purple-700"
                >
                  <option value="">Select Stage...</option>
                  {allFinishingStages
                    .filter(stg => !finishingForm.style_id || stg.style_id === finishingForm.style_id)
                    .map(stg => (
                      <option key={stg.id} value={stg.id}>
                        {stg.seq_no}. {stg.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Entry Date</label>
                  <input
                    type="date"
                    required
                    value={finishingForm.entry_date}
                    onChange={(e) => setFinishingForm(prev => ({ ...prev, entry_date: e.target.value }))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Shift</label>
                  <select
                    value={finishingForm.shift}
                    onChange={(e) => setFinishingForm(prev => ({ ...prev, shift: e.target.value }))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none"
                  >
                    <option value="day">Day Shift</option>
                    <option value="night">Night Shift</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  OK Completed Pieces <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 150"
                  value={finishingForm.qty_ok ?? ''}
                  onChange={(e) => setFinishingForm(prev => ({ ...prev, qty_ok: e.target.value }))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-2.5 text-lg font-black text-stone-900 focus:outline-none focus:border-purple-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Rework Pieces</label>
                  <input
                    type="number"
                    min="0"
                    value={finishingForm.qty_rework ?? ''}
                    onChange={(e) => setFinishingForm(prev => ({ ...prev, qty_rework: e.target.value }))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Reject Pieces</label>
                  <input
                    type="number"
                    min="0"
                    value={finishingForm.qty_reject ?? ''}
                    onChange={(e) => setFinishingForm(prev => ({ ...prev, qty_reject: e.target.value }))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Thread trimming completed for Table 2"
                  value={finishingForm.note || ''}
                  onChange={(e) => setFinishingForm(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFinishingModalOpen(false)}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded-2xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFinishing}
                  className="px-5 py-2.5 bg-purple-800 hover:bg-purple-900 text-white font-bold rounded-2xl text-xs shadow-xs"
                >
                  {submittingFinishing ? 'Saving...' : 'Save Finishing Output'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Cutting Output Modal */}
      {isCuttingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-base font-bold text-stone-900 flex items-center space-x-2">
                <Scissors className="w-5 h-5 text-indigo-700 rotate-90" />
                <span>Record Table Cutting Output</span>
              </h3>
              <button
                onClick={() => setIsCuttingModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCuttingEntry} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Garment Style <span className="text-rose-600">*</span></label>
                <select
                  required
                  value={cuttingForm.style_id}
                  onChange={(e) => setCuttingForm(prev => ({ ...prev, style_id: e.target.value }))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none focus:border-indigo-700"
                >
                  <option value="">Select Style...</option>
                  {garmentStyles
                    .filter(st => st.requires_cutting !== false)
                    .map(st => (
                      <option key={st.id} value={st.id}>{st.style_code} - {st.name}</option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Cut Type</label>
                  <select
                    value={cuttingForm.cut_type}
                    onChange={(e) => setCuttingForm(prev => ({ ...prev, cut_type: e.target.value as 'bulk' | 'sample' }))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none"
                  >
                    <option value="bulk">Bulk Cutting</option>
                    <option value="sample">Sample Cutting</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Entry Date</label>
                  <input
                    type="date"
                    required
                    value={cuttingForm.entry_date}
                    onChange={(e) => setCuttingForm(prev => ({ ...prev, entry_date: e.target.value }))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Cut Pieces Completed <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 500"
                  value={cuttingForm.pieces_cut ?? ''}
                  onChange={(e) => setCuttingForm(prev => ({ ...prev, pieces_cut: e.target.value }))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-2.5 text-lg font-black text-stone-900 focus:outline-none focus:border-indigo-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Table / Layers Info</label>
                <input
                  type="text"
                  placeholder="e.g. Table 1, 40 layers"
                  value={cuttingForm.tables_layers || ''}
                  onChange={(e) => setCuttingForm(prev => ({ ...prev, tables_layers: e.target.value }))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Front/Back panels cut"
                  value={cuttingForm.notes || ''}
                  onChange={(e) => setCuttingForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCuttingModalOpen(false)}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded-2xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCutting}
                  className="px-5 py-2.5 bg-indigo-800 hover:bg-indigo-900 text-white font-bold rounded-2xl text-xs shadow-xs"
                >
                  {submittingCutting ? 'Saving...' : 'Save Cutting Output'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FOOTER CREDIT */}
      <FooterCredit hasBottomNav={true} />

      {/* 3. MOBILE APP BOTTOM ACTIVITY NAVIGATION BAR (DRAGGABLE & FIXED AT BOTTOM) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200/90 shadow-2xl px-3 py-2.5 sm:py-3 sm:px-6">
        <div
          ref={navRef}
          onMouseDown={handleNavMouseDown}
          onMouseLeave={handleNavMouseLeave}
          onMouseUp={handleNavMouseUp}
          onMouseMove={handleNavMouseMove}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          className="max-w-xl mx-auto flex items-center gap-2 overflow-x-auto cursor-grab active:cursor-grabbing select-none py-0.5"
        >
          <button
            onClick={() => setActivityTab('sewing')}
            className={`flex-1 min-w-[135px] sm:min-w-[160px] py-2.5 px-3 sm:px-4 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 shrink-0 ${
              activityTab === 'sewing'
                ? 'bg-amber-800 text-white shadow-md ring-2 ring-amber-400/50 scale-[1.02]'
                : 'bg-stone-100/90 hover:bg-stone-200/80 text-stone-700 border border-stone-200/60'
            }`}
          >
            <Scissors className="w-4 h-4" />
            <span className="truncate">Sewing Activity</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              activityTab === 'sewing' ? 'bg-amber-900/70 text-amber-100 font-bold' : 'bg-stone-300/80 text-stone-800'
            }`}>
              {assignedWorks.length}
            </span>
          </button>

          <button
            onClick={() => setActivityTab('finishing')}
            className={`flex-1 min-w-[135px] sm:min-w-[160px] py-2.5 px-3 sm:px-4 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 shrink-0 ${
              activityTab === 'finishing'
                ? 'bg-purple-800 text-white shadow-md ring-2 ring-purple-400/50 scale-[1.02]'
                : 'bg-stone-100/90 hover:bg-stone-200/80 text-stone-700 border border-stone-200/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span className="truncate">Finishing Activity</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              activityTab === 'finishing' ? 'bg-purple-900/70 text-purple-100 font-bold' : 'bg-stone-300/80 text-stone-800'
            }`}>
              {myFinishingEntries.length}
            </span>
          </button>

          <button
            onClick={() => setActivityTab('cutting')}
            className={`flex-1 min-w-[135px] sm:min-w-[160px] py-2.5 px-3 sm:px-4 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 shrink-0 ${
              activityTab === 'cutting'
                ? 'bg-indigo-800 text-white shadow-md ring-2 ring-indigo-400/50 scale-[1.02]'
                : 'bg-stone-100/90 hover:bg-stone-200/80 text-stone-700 border border-stone-200/60'
            }`}
          >
            <Scissors className="w-4 h-4 rotate-90" />
            <span className="truncate">Cutting Activity</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              activityTab === 'cutting' ? 'bg-indigo-900/70 text-indigo-100 font-bold' : 'bg-stone-300/80 text-stone-800'
            }`}>
              {myCuttingEntries.length}
            </span>
          </button>
        </div>
      </div>

      {/* Receive from Sewing Modal */}
      {isReceiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-purple-200 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl p-6 space-y-4 my-8 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsReceiveModalOpen(false)}
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 p-2 rounded-xl bg-stone-100 transition z-10"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <ReceiveFromSewingView
              role="worker"
              workerToken={currentWorker?.id}
              onSaveComplete={() => {
                if (currentWorker) loadWorkerData(currentWorker.id);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
