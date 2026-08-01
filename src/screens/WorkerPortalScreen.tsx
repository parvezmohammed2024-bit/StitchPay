import React, { useState, useEffect } from 'react';
import { 
  UserCheck, Clock, Pause, Square, Scissors, TrendingUp, CheckCircle2, 
  Zap, Trophy, Calendar, Crown, DollarSign, LogOut, Key, ShieldAlert,
  ArrowRight, AlertCircle, RefreshCw
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { dataService } from '../lib/dataService';
import { Worker, DailyAssignment, AttendanceRecord, ProductionEntry, GarmentStyle, GarmentProcess } from '../types';
import { RateBiddingModal } from '../components/RateBiddingModal';
import { WorkerAvatar } from '../components/WorkerAvatar';

export const WorkerPortalScreen: React.FC = () => {
  // Session Worker State
  const [currentWorker, setCurrentWorker] = useState<Worker | null>(null);

  // Login Form State
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState<boolean>(false);

  // Portal Data State
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [assignedWorks, setAssignedWorks] = useState<DailyAssignment[]>([]);
  const [todayEntries, setTodayEntries] = useState<ProductionEntry[]>([]);
  const [allPeriodEntries, setAllPeriodEntries] = useState<ProductionEntry[]>([]);
  const [allEntries, setAllEntries] = useState<ProductionEntry[]>([]);
  const [workersList, setWorkersList] = useState<Worker[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals & Forms
  const [biddingAssignment, setBiddingAssignment] = useState<DailyAssignment | null>(null);
  const [entryQty, setEntryQty] = useState<string>('');
  const [selectedWork, setSelectedWork] = useState<DailyAssignment | null>(null);
  const [submittingEntry, setSubmittingEntry] = useState<boolean>(false);
  const [clockMessage, setClockMessage] = useState<string | null>(null);

  // Check existing session on mount
  useEffect(() => {
    initSession();
  }, []);

  const initSession = async () => {
    setLoading(true);
    const savedWorkerId = sessionStorage.getItem('stitchpay_worker_id');
    const allWrks = await dataService.getWorkers();
    setWorkersList(allWrks);

    if (savedWorkerId) {
      const match = allWrks.find(w => w.id === savedWorkerId);
      if (match) {
        setCurrentWorker(match);
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
  };

  const loadWorkerData = async (workerId: string) => {
    setLoading(true);
    const todayStr = new Date().toISOString().split('T')[0];

    const [wrkList, attList, assignList, entryList] = await Promise.all([
      dataService.getWorkers(),
      dataService.getAttendance(todayStr),
      dataService.getDailyAssignments(todayStr),
      dataService.getProductionEntries(),
    ]);

    setWorkersList(wrkList);
    setAllEntries(entryList);

    // Filter data strictly by workerId
    const att = attList.find(a => a.worker_id === workerId) || null;
    setTodayAttendance(att);

    const myWorks = assignList.filter(a => a.worker_id === workerId);
    setAssignedWorks(myWorks);

    const myTodayEntries = entryList.filter(e => e.worker_id === workerId && e.entry_date === todayStr);
    setTodayEntries(myTodayEntries);
    setAllPeriodEntries(entryList.filter(e => e.worker_id === workerId));

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
      setClockMessage(`Submitted rate bid of ৳${proposedRate}/pc for ${assignment.process_name}`);
      setTimeout(() => setClockMessage(null), 5000);
    }
  };

  // Submit piece production output
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

  // --- WORKER PIN LOGIN SCREEN ---
  if (!currentWorker) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
              <UserCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Worker Portal</h1>
            <p className="text-xs text-slate-400">Enter your Mobile Number and 4-digit PIN to access your account</p>
          </div>

          {loginError && (
            <div className="bg-rose-500/15 border border-rose-500/40 rounded-2xl p-3.5 text-xs text-rose-300 font-medium flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-lg font-mono tracking-widest font-bold text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all active:scale-98 flex items-center justify-center space-x-2"
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
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5 text-xs text-slate-400">
            <div className="font-bold text-slate-300 flex items-center space-x-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Test Credentials:</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                <span className="text-slate-400 block">Worker 1:</span>
                <span className="font-mono text-amber-400 font-bold">W-001</span> / <span className="font-mono text-amber-400 font-bold">1111</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                <span className="text-slate-400 block">Worker 2:</span>
                <span className="font-mono text-amber-400 font-bold">W-002</span> / <span className="font-mono text-amber-400 font-bold">2222</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- LOGGED-IN WORKER DASHBOARD VIEW ---
  const isClockedIn = todayAttendance?.status === 'present' && !!todayAttendance.in_time && !todayAttendance.out_time;
  const isOnBreak = todayAttendance?.is_on_break || false;

  const todayOutputPcs = todayEntries.reduce((sum, e) => sum + e.qty_ok, 0);
  const todayEarningsBDT = todayEntries.reduce((sum, e) => sum + e.amount, 0);

  const totalPeriodEarningsBDT = allPeriodEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalPeriodOutputPcs = allPeriodEntries.reduce((sum, e) => sum + e.qty_ok, 0);
  const outstandingAdvanceBDT = currentWorker.outstanding_advance || 0;
  const netReceivableBDT = Math.max(0, totalPeriodEarningsBDT - outstandingAdvanceBDT);

  // Compute Last 7 Days Production Breakdown
  const last7DaysData: { date: string; dateFormatted: string; pcs: number; earnings: number; entries: ProductionEntry[] }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
    const dayEntries = allPeriodEntries.filter(e => e.entry_date === dStr);
    const pcs = dayEntries.reduce((s, e) => s + e.qty_ok, 0);
    const earnings = dayEntries.reduce((s, e) => s + e.amount, 0);
    
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-28 animate-fade-in">
      {/* 1. WORKER ACCOUNT HEADER & LOGOUT */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <WorkerAvatar
            photoUrl={currentWorker.photo_url}
            name={currentWorker.full_name}
            size="2xl"
            className="rounded-2xl border-2 border-indigo-500/50 shadow-md"
          />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-black text-white">{currentWorker.full_name}</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30 font-bold">
                {currentWorker.worker_code}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
              <span>Section: <strong className="text-slate-200">{currentWorker.section || 'Sewing'}</strong></span>
              <span>•</span>
              <span>Line: <strong className="text-slate-200">{currentWorker.line_no || 'Line-01'}</strong></span>
              <span>•</span>
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" /> Rank #{currentRank} of {totalRankedWorkers}
              </span>
            </p>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all self-start md:self-center"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* 2. SHIFT TIME & ATTENDANCE CLOCK (NO GPS / LOCATION) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center space-x-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-inner ${
              isClockedIn ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
            }`}>
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center space-x-2">
                <span>Shift Time & Attendance Clock</span>
                {isClockedIn ? (
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-0.5 rounded-full border border-emerald-500/30 font-bold flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Clocked In (Active)</span>
                  </span>
                ) : (
                  <span className="text-xs bg-slate-800 text-slate-400 px-3 py-0.5 rounded-full border border-slate-700">
                    Off Duty / Not Clocked In
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isClockedIn 
                  ? `Clocked In at: ${todayAttendance?.in_time || '08:00 AM'}` 
                  : 'Click Clock In Now to record your shift start'}
              </p>
            </div>
          </div>
        </div>

        {/* Confirmation Banner */}
        {clockMessage && (
          <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-2xl p-3.5 text-xs font-bold text-emerald-300 flex items-center justify-between animate-fade-in shadow-md">
            <span>{clockMessage}</span>
            <button onClick={() => setClockMessage(null)} className="text-emerald-400 hover:text-white text-xs ml-2">✕</button>
          </div>
        )}

        {/* Attendance Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Clock In */}
          <button
            onClick={handleClockIn}
            disabled={isClockedIn}
            className={`py-3.5 px-5 rounded-2xl font-black text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center space-x-2.5 ${
              isClockedIn
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30 hover:scale-[1.02]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{isClockedIn ? 'Clocked In ✓' : 'Clock In Now'}</span>
          </button>

          {/* Break Button */}
          <button
            onClick={handleToggleBreak}
            disabled={!isClockedIn}
            className={`py-3.5 px-5 rounded-2xl font-bold text-xs sm:text-sm shadow-lg transition-all flex items-center justify-center space-x-2 ${
              !isClockedIn
                ? 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                : isOnBreak
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
            }`}
          >
            <Pause className="w-4 h-4" />
            <span>{isOnBreak ? 'Resume Work' : 'Take Break'}</span>
          </button>

          {/* Clock Out */}
          <button
            onClick={handleClockOut}
            disabled={!isClockedIn}
            className={`py-3.5 px-5 rounded-2xl font-bold text-xs sm:text-sm shadow-lg transition-all flex items-center justify-center space-x-2 ${
              !isClockedIn
                ? 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
            }`}
          >
            <Square className="w-4 h-4 fill-current" />
            <span>Clock Out</span>
          </button>
        </div>
      </div>

      {/* 3. ASSIGNED OPERATIONS & PIECE RATES (NO CLOCK-IN GATE REQUIRED) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl space-y-0">
        <div className="p-5 border-b border-slate-800 bg-slate-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black text-white flex items-center space-x-2">
              <Scissors className="w-5 h-5 text-amber-400" />
              <span>Assigned Operations & Piece Rates ({assignedWorks.length})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Operations assigned to you with target quantities and approved piece rates
            </p>
          </div>
        </div>

        {assignedWorks.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No line operations assigned to you today. Please check with line supervisor.
          </div>
        ) : (
          /* Assigned Works List available directly without clocking in */
          <div className="divide-y divide-slate-800/80">
            {assignedWorks.map(work => {
              const myOutputForWork = todayEntries
                .filter(e => e.process_id === work.process_id)
                .reduce((s, e) => s + e.qty_ok, 0);

              const targetQty = work.target_qty || 250;
              const progressPct = Math.min(100, Math.round((myOutputForWork / targetQty) * 100));

              return (
                <div key={work.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-base text-white">{work.process_name}</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-bold border border-slate-700">
                        {work.style_code}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>Style: <strong className="text-slate-200">{work.style_name}</strong></span>
                      <span>Target: <strong className="text-slate-200">{targetQty} pcs</strong></span>
                      <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                        Approved Rate: ৳{work.agreed_rate}/pc
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full max-w-md bg-slate-800 h-2.5 rounded-full overflow-hidden mt-1">
                      <div
                        className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      ></div>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Completed: <span className="font-bold text-emerald-400">{myOutputForWork}</span> / {targetQty} pcs ({progressPct}%)
                    </div>
                  </div>

                  {/* Actions: Bidding Option + Log Production */}
                  <div className="flex items-center space-x-2 self-start md:self-center shrink-0">
                    <button
                      onClick={() => setBiddingAssignment(work)}
                      className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-1"
                    >
                      <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                      <span>Bidding Option</span>
                    </button>

                    <button
                      onClick={() => setSelectedWork(work)}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-2xl text-xs shadow-md transition-all flex items-center space-x-1.5"
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
      </div>

      {/* 4. EARNINGS & PRODUCTION GRAPH WITH RANKING */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-black text-white flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <span>Production Output & Earnings Till Now</span>
            </h2>
            <p className="text-xs text-slate-400">Cumulative piece output & rate pay earnings graph</p>
          </div>

          {/* Ranking Badge */}
          <div className="bg-gradient-to-r from-amber-500/20 via-slate-800 to-indigo-500/20 border border-amber-500/30 px-4 py-2 rounded-2xl flex items-center space-x-3 self-start sm:self-center">
            <Trophy className="w-6 h-6 text-amber-400" />
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Factory Worker Rank</div>
              <div className="text-sm font-black text-white">
                Rank #{currentRank} <span className="text-xs text-slate-400 font-normal">of {totalRankedWorkers} Workers</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <div className="text-xs font-bold text-slate-400 uppercase">Today's Piece Earnings</div>
            <div className="text-2xl font-black text-amber-400 mt-1 font-mono">৳{todayEarningsBDT.toLocaleString()}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{todayOutputPcs} pieces completed today</div>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <div className="text-xs font-bold text-slate-400 uppercase">Current Period Earnings</div>
            <div className="text-2xl font-black text-indigo-400 mt-1 font-mono">৳{totalPeriodEarningsBDT.toLocaleString()}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{totalPeriodOutputPcs} total pieces logged</div>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <div className="text-xs font-bold text-slate-400 uppercase">Net Payable Amount</div>
            <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">৳{netReceivableBDT.toLocaleString()}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">After advance deductions (৳{outstandingAdvanceBDT})</div>
          </div>
        </div>

        {/* Visual Graph: Earnings & Production over last 7 days */}
        <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 space-y-2">
          <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>Last 7 Days Production Trend</span>
            <span className="text-[10px] text-slate-500 font-mono">Output Pieces & Earnings (৳ BDT)</span>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last7DaysData}>
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPcs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="dateFormatted" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px' }}
                  labelStyle={{ color: '#F8FAFC', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="earnings" name="Earnings (৳)" stroke="#10B981" fillOpacity={1} fill="url(#colorEarnings)" />
                <Area type="monotone" dataKey="pcs" name="Pieces (Pcs)" stroke="#6366F1" fillOpacity={1} fill="url(#colorPcs)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. LAST 7 DAYS PRODUCTION DETAILS BREAKDOWN */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-black text-white flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <span>Last 7 Days Production Details</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">Daily Breakdown</span>
        </div>

        <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[480px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Completed Pieces</th>
                <th className="py-2.5 px-3">Day Earnings</th>
                <th className="py-2.5 px-3">Logged Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {last7DaysData.map((day, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-3 font-bold text-white">{day.dateFormatted}</td>
                  <td className="py-3 px-3 font-mono text-indigo-300 font-bold">{day.pcs} pcs</td>
                  <td className="py-3 px-3 font-mono text-emerald-400 font-bold">৳{day.earnings.toLocaleString()}</td>
                  <td className="py-3 px-3 text-slate-400">
                    {day.entries.length > 0 ? (
                      <span className="bg-slate-800 px-2 py-1 rounded text-[11px] text-slate-300">
                        {day.entries.length} log submissions
                      </span>
                    ) : (
                      <span className="text-slate-600">No logs / Off day</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. TOP PERFORMANCE LEADERBOARD TILL NOW */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-black text-white flex items-center space-x-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <span>Top Performers Till Now (Factory Leaderboard)</span>
          </h2>
          <span className="text-xs text-amber-400 font-bold bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
            Top 5 Workers
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {topPerformers.map(item => (
            <div
              key={item.worker.id}
              className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-all ${
                item.rank === 1
                  ? 'bg-gradient-to-b from-amber-500/20 to-slate-950 border-amber-500/40 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                  item.rank === 1 ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}>
                  #{item.rank}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{item.worker.worker_code}</span>
              </div>

              <div className="flex items-center space-x-2.5">
                <WorkerAvatar
                  photoUrl={item.worker.photo_url}
                  name={item.worker.full_name}
                  size="md"
                  className="rounded-xl"
                />
                <div>
                  <div className="text-xs font-bold text-white truncate max-w-[100px]">{item.worker.full_name}</div>
                  <div className="text-[10px] text-slate-400">{item.worker.section || 'Sewing'}</div>
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Output:</span>
                  <strong className="text-indigo-300 font-mono">{item.totalPcs} pcs</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Pay:</span>
                  <strong className="text-emerald-400 font-mono">৳{item.totalAmt.toLocaleString()}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODALS */}
      {/* Rate Bidding Modal */}
      <RateBiddingModal
        isOpen={Boolean(biddingAssignment)}
        onClose={() => setBiddingAssignment(null)}
        assignment={biddingAssignment}
        onSubmitBid={handleSubmitBid}
      />

      {/* Production Output Log Modal */}
      {selectedWork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>Log Production Output</span>
            </h3>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1">
              <div className="text-amber-400 font-bold">{selectedWork.process_name}</div>
              <div className="text-slate-300">Style: {selectedWork.style_name}</div>
              <div className="text-slate-400">Approved Rate: ৳{selectedWork.agreed_rate} per piece</div>
            </div>

            <form onSubmit={handleQuickEntrySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Quantity OK Pieces Completed <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 50"
                  value={entryQty}
                  onChange={(e) => setEntryQty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-xl font-black text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedWork(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEntry}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl text-xs shadow-lg"
                >
                  {submittingEntry ? 'Submitting...' : 'Confirm & Save Output'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
