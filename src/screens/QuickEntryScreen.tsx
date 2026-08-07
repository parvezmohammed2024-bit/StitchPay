import React, { useState, useEffect } from 'react';
import { 
  Zap, Calendar, Shirt, Scissors, Plus, Minus, Check, 
  ChevronDown, ChevronUp, AlertCircle, Sparkles, CheckCircle,
  PlusCircle, Target, TrendingUp, Layers, HelpCircle, PackageCheck, Lock, Users
} from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { dataService, getLocalDateString } from '../lib/dataService';
import { 
  GarmentStyle, GarmentProcess, Worker, ProductionEntry, 
  FactorySettings, UserRole, DailyAssignment, CuttingEntry 
} from '../types';
import { DuplicateConfirmModal } from '../components/DuplicateConfirmModal';
import { WorkerAvatar } from '../components/WorkerAvatar';
import { isStyleUnlockedForSewing } from '../lib/cuttingGate';
import { ReceiveFromSewingView } from '../components/ReceiveFromSewingView';
import { TeamOutputModal } from '../components/TeamOutputModal';

interface QuickEntryScreenProps {
  role: UserRole;
  workerToken?: string;
  workerSection?: string;
}

interface AssignmentEntryDraft {
  qty_ok: number;
  qty_rework: number;
  qty_reject: number;
  expanded: boolean;
  savedQtyOk: number; // accumulated output already saved today
}

export const QuickEntryScreen: React.FC<QuickEntryScreenProps> = ({ role, workerToken: initialWorkerToken, workerSection: initialWorkerSection }) => {
  const { t } = useTranslation();

  // Mode state: 'sewing' | 'receive'
  const [mode, setMode] = useState<'sewing' | 'receive'>('sewing');
  const [currentWorker, setCurrentWorker] = useState<Worker | null>(null);
  const [workerToken, setWorkerToken] = useState<string>(initialWorkerToken || '');

  const [entryDate, setEntryDate] = useState<string>(getLocalDateString());
  const [shift, setShift] = useState<'day' | 'night'>('day');

  const [assignments, setAssignments] = useState<DailyAssignment[]>([]);
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [processes, setProcesses] = useState<GarmentProcess[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [settings, setSettings] = useState<FactorySettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Draft amounts map keyed by assignment.id
  const [drafts, setDrafts] = useState<Map<string, AssignmentEntryDraft>>(new Map());

  // Unplanned Entry Modal State
  const [showUnplannedModal, setShowUnplannedModal] = useState<boolean>(false);
  const [showTeamOutputModal, setShowTeamOutputModal] = useState<boolean>(false);
  const [unplannedStyleId, setUnplannedStyleId] = useState<string>('');
  const [unplannedProcessId, setUnplannedProcessId] = useState<string>('');
  const [unplannedWorkerId, setUnplannedWorkerId] = useState<string>('');
  const [unplannedTargetQty, setUnplannedTargetQty] = useState<number>(250);

  // Duplicate Guard Modal
  const [duplicateModalOpen, setDuplicateModalOpen] = useState<boolean>(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    workerName: string;
    processName: string;
    existing: ProductionEntry;
    pendingAssignmentId: string;
    pendingQty: number;
  } | null>(null);

  // Toast confirmation
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    checkWorkerAndRole();
  }, [role]);

  const checkWorkerAndRole = async () => {
    const savedWorkerId = sessionStorage.getItem('stitchpay_worker_id');
    const token = initialWorkerToken || savedWorkerId || '';
    setWorkerToken(token);

    if (savedWorkerId) {
      const wList = await dataService.getWorkers();
      const match = wList.find(w => w.id === savedWorkerId);
      if (match) {
        setCurrentWorker(match);
        const sec = (match.section || '').toLowerCase();
        if (role === 'worker' && sec.includes('finish')) {
          setMode('receive');
        }
      }
    } else if (role === 'worker' && initialWorkerSection && initialWorkerSection.toLowerCase().includes('finish')) {
      setMode('receive');
    }
  };

  useEffect(() => {
    if (mode === 'sewing') {
      loadData();
    }
  }, [entryDate, mode]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [assignList, stList, procList, wList, entryList, setts, cutEntries] = await Promise.all([
        dataService.getDailyAssignments(entryDate),
        dataService.getEntryStyles('sewing', false),
        dataService.getProcesses(),
        dataService.getWorkers(),
        dataService.getProductionEntries(),
        dataService.getSettings(),
        dataService.getCuttingEntries(),
      ]);

      const unlockedStyles = stList.filter(s => isStyleUnlockedForSewing(s, cutEntries));
      const unlockedStyleIds = new Set(unlockedStyles.map(s => s.id));

      const validAssignments = assignList.filter(a => unlockedStyleIds.has(a.style_id));

      setAssignments(validAssignments);
      setStyles(unlockedStyles);
      setProcesses(procList);
      setWorkers(wList);
      setEntries(entryList);
      setSettings(setts);

      // Initialize drafts map with accumulated saved output from today's production entries
      const initialDrafts = new Map<string, AssignmentEntryDraft>();
      for (const a of validAssignments) {
        const savedForAssignment = entryList
          .filter(e => e.worker_id === a.worker_id && e.process_id === a.process_id && e.entry_date === entryDate)
          .reduce((sum, e) => sum + e.qty_ok, 0);

        initialDrafts.set(a.id, {
          qty_ok: savedForAssignment,
          qty_rework: 0,
          qty_reject: 0,
          expanded: false,
          savedQtyOk: savedForAssignment,
        });
      }
      setDrafts(initialDrafts);

      if (unlockedStyles.length > 0) setUnplannedStyleId(unlockedStyles[0].id);
      if (procList.length > 0) setUnplannedProcessId(procList[0].id);
      if (wList.length > 0) setUnplannedWorkerId(wList[0].id);
    } catch (err) {
      console.error('Error loading Quick Entry data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const currencySymbol = settings?.currency_symbol || 'MYR';

  // Helper to update draft qty
  const updateDraftQty = (assignmentId: string, field: 'qty_ok' | 'qty_rework' | 'qty_reject', delta: number) => {
    const cur = drafts.get(assignmentId) || { qty_ok: 0, qty_rework: 0, qty_reject: 0, expanded: false, savedQtyOk: 0 };
    const newQty = Math.max(0, cur[field] + delta);
    const newDrafts = new Map(drafts);
    newDrafts.set(assignmentId, {
      ...cur,
      [field]: newQty,
    });
    setDrafts(newDrafts);
  };

  const setDraftQtyDirect = (assignmentId: string, field: 'qty_ok' | 'qty_rework' | 'qty_reject', val: number) => {
    const cur = drafts.get(assignmentId) || { qty_ok: 0, qty_rework: 0, qty_reject: 0, expanded: false, savedQtyOk: 0 };
    const newDrafts = new Map(drafts);
    newDrafts.set(assignmentId, {
      ...cur,
      [field]: Math.max(0, val),
    });
    setDrafts(newDrafts);
  };

  const toggleExpand = (assignmentId: string) => {
    const cur = drafts.get(assignmentId);
    if (!cur) return;
    const newDrafts = new Map(drafts);
    newDrafts.set(assignmentId, {
      ...cur,
      expanded: !cur.expanded,
    });
    setDrafts(newDrafts);
  };

  // Calculate Running Totals
  const totalPiecesEnteredToday = Array.from(drafts.values()).reduce((sum: number, d: any) => sum + Number(d?.qty_ok || 0), 0);
  const totalTargetPiecesToday = assignments.reduce((sum: number, a: any) => sum + Number(a.target_qty || 250), 0);
  const targetPercent = totalTargetPiecesToday > 0 ? Math.min(100, Math.round((Number(totalPiecesEnteredToday) / Number(totalTargetPiecesToday)) * 100)) : 0;

  const totalWageValueAccrued = assignments.reduce((sum, a) => {
    const w = workers.find(work => work.id === a.worker_id);
    if (w?.pay_type === 'monthly_salary') return sum;
    const draft = drafts.get(a.id);
    const qty = draft ? draft.qty_ok : 0;
    return sum + (qty * a.agreed_rate);
  }, 0);

  // Group assignments by Style -> Process
  const groupedAssignments = React.useMemo(() => {
    const groups: {
      style: GarmentStyle | undefined;
      processes: {
        process: GarmentProcess | undefined;
        items: DailyAssignment[];
      }[];
    }[] = [];

    const styleIds = Array.from(new Set(assignments.map(a => a.style_id)));
    for (const sId of styleIds) {
      const style = styles.find(s => s.id === sId);
      const styleAssigns = assignments.filter(a => a.style_id === sId);

      const procIds = Array.from(new Set(styleAssigns.map(a => a.process_id)));
      const procGroups: { process: GarmentProcess | undefined; items: DailyAssignment[] }[] = [];

      for (const pId of procIds) {
        const proc = processes.find(p => p.id === pId);
        const procAssigns = styleAssigns.filter(a => a.process_id === pId);
        procGroups.push({ process: proc, items: procAssigns });
      }

      procGroups.sort((a, b) => (a.process?.seq_no || 0) - (b.process?.seq_no || 0));
      groups.push({ style, processes: procGroups });
    }

    return groups;
  }, [assignments, styles, processes]);

  const handleSaveAll = async () => {
    let savedCount = 0;
    for (const assign of assignments) {
      const draft = drafts.get(assign.id);
      if (!draft) continue;

      const diffQty = draft.qty_ok - draft.savedQtyOk;
      if (diffQty > 0 || draft.qty_rework > 0 || draft.qty_reject > 0) {
        await dataService.saveProductionEntry({
          assignment_id: assign.id,
          entry_date: entryDate,
          shift,
          worker_id: assign.worker_id,
          style_id: assign.style_id,
          process_id: assign.process_id,
          qty_ok: diffQty > 0 ? diffQty : draft.qty_ok,
          qty_rework: draft.qty_rework,
          qty_reject: draft.qty_reject,
          rate_snapshot: assign.agreed_rate,
        });
        savedCount++;
      }
    }

    setToastMessage(`Saved ${savedCount} line entry logs — Total ${currencySymbol}${totalWageValueAccrued.toFixed(0)}`);
    await loadData();

    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleCreateUnplannedEntry = async () => {
    if (!unplannedStyleId || !unplannedProcessId || !unplannedWorkerId) return;
    try {
      if (unplannedProcessId === 'all_operations') {
        const styleProcs = processes.filter(p => p.style_id === unplannedStyleId);
        if (styleProcs.length > 0) {
          for (const proc of styleProcs) {
            await dataService.saveDailyAssignment({
              work_date: entryDate,
              style_id: unplannedStyleId,
              process_id: proc.id,
              worker_id: unplannedWorkerId,
              target_qty: unplannedTargetQty,
              agreed_rate: proc.rate || 0,
              note: 'Full garment unplanned entry',
            });
          }
        }
      } else {
        const proc = processes.find(p => p.id === unplannedProcessId);
        await dataService.saveDailyAssignment({
          work_date: entryDate,
          style_id: proc?.style_id || unplannedStyleId,
          process_id: unplannedProcessId,
          worker_id: unplannedWorkerId,
          target_qty: unplannedTargetQty,
          agreed_rate: proc?.rate || 4.0,
          note: 'Unplanned entry created on floor',
        });
      }

      setShowUnplannedModal(false);
      await loadData();
      setToastMessage('Worker assignment added to today\'s line plan!');
    } catch (err) {
      console.error('Error creating unplanned assignment:', err);
    }
  };

  // Section check for worker role
  const workerSec = (currentWorker?.section || initialWorkerSection || '').toLowerCase();
  const isFinishingWorker = role === 'worker' && workerSec.includes('finish');
  const isNonFinishingWorker = role === 'worker' && !workerSec.includes('finish');

  // If worker is not in finishing section and role === 'worker'
  if (isNonFinishingWorker) {
    return (
      <div className="bg-white border border-stone-200 rounded-3xl p-8 max-w-2xl mx-auto my-8 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 bg-amber-100 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto text-amber-800">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-stone-900">Quick Entry Access Notice</h2>
        <p className="text-xs text-stone-600 leading-relaxed">
          Quick Entry mode is reserved for <strong>Sewing Line Supervisors</strong> (Sewing Output) and <strong>Finishing Workers</strong> (Receive from Sewing).
        </p>
        <p className="text-xs text-stone-500">
          Logged in as <strong>{currentWorker?.full_name || 'Worker'} ({currentWorker?.section || 'Sewing'})</strong>. Please use your Worker Portal to log daily section activities.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32 max-w-4xl mx-auto">
      {/* Toast Confirmation */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white font-bold px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 border border-emerald-500 animate-bounce">
          <CheckCircle className="w-5 h-5 text-emerald-100" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MODE TOGGLE AT THE TOP: [ Sewing Output ] [ Receive from Sewing ] */}
      {(role === 'admin' || role === 'supervisor') && (
        <div className="bg-stone-100 p-1.5 rounded-2xl border border-stone-200/80 flex items-center justify-center max-w-md mx-auto shadow-inner">
          <button
            type="button"
            onClick={() => setMode('sewing')}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-2 ${
              mode === 'sewing'
                ? 'bg-white text-amber-900 shadow-sm border border-stone-200/80'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-700 fill-amber-700" />
            <span>Sewing Output</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('receive')}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-2 ${
              mode === 'receive'
                ? 'bg-purple-900 text-white shadow-sm border border-purple-800'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <PackageCheck className="w-4 h-4 text-purple-300" />
            <span>Receive from Sewing</span>
          </button>
        </div>
      )}

      {/* RENDER RECEIVE MODE FOR FINISHING WORKERS OR WHEN TOGGLED */}
      {(mode === 'receive' || isFinishingWorker) ? (
        <ReceiveFromSewingView
          role={role}
          workerToken={workerToken}
          onSaveComplete={() => {
            if (mode === 'sewing') loadData();
          }}
        />
      ) : (
        /* EXISTING SEWING OUTPUT SCREEN (UNCHANGED) */
        <>
          {/* Screen Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
                <Zap className="w-6 h-6 text-amber-700 fill-amber-700" />
                <span>Plan-Driven Quick Entry</span>
              </h1>
              <p className="text-xs text-stone-600">Direct recording against today's assigned line plan</p>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-3 flex-wrap">
              {/* Log Team Output Button */}
              <button
                onClick={() => setShowTeamOutputModal(true)}
                className="flex items-center space-x-1.5 bg-indigo-700 hover:bg-indigo-800 text-white border border-indigo-800 px-3.5 py-2 rounded-xl font-bold text-xs transition shrink-0 shadow-xs cursor-pointer"
              >
                <Users className="w-4 h-4 text-indigo-200" />
                <span>Log Team Output</span>
              </button>

              {/* Unplanned Entry Button */}
              <button
                onClick={() => setShowUnplannedModal(true)}
                className="flex items-center space-x-1.5 bg-stone-100 hover:bg-stone-200 text-amber-800 border border-amber-300 px-3.5 py-2 rounded-xl font-semibold text-xs transition shrink-0 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Unplanned Entry</span>
              </button>

              {/* Shift selector */}
              <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs shrink-0">
                <button
                  onClick={() => setShift('day')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    shift === 'day' ? 'bg-amber-800 text-white shadow-xs' : 'text-stone-600'
                  }`}
                >
                  Day
                </button>
                <button
                  onClick={() => setShift('night')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    shift === 'night' ? 'bg-indigo-700 text-white shadow-xs' : 'text-stone-600'
                  }`}
                >
                  Night
                </button>
              </div>
            </div>
          </div>

      {/* RUNNING TOTALS BAR */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-1">
              Pieces Entered Today
            </div>
            <div className="text-2xl font-black text-stone-900 font-mono">
              {totalPiecesEnteredToday.toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-1">
              Total Accrued Wage Value
            </div>
            <div className="text-2xl font-black text-amber-800 font-mono">
              {currencySymbol}{totalWageValueAccrued.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-1">
              Line Target Completion
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-black text-emerald-700 font-mono">{targetPercent}%</span>
              <span className="text-xs text-stone-500">({totalPiecesEnteredToday} / {totalTargetPiecesToday} pcs)</span>
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
          <div 
            className="bg-emerald-600 h-full transition-all duration-500 rounded-full"
            style={{ width: `${targetPercent}%` }}
          />
        </div>
      </div>

      {/* ASSIGNMENTS GROUPED BY STYLE & PROCESS */}
      {assignments.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center text-stone-500 space-y-3 shadow-xs">
          <p className="text-base font-semibold text-stone-900">No line assignments planned for today yet.</p>
          <p className="text-xs text-stone-600">
            Use the "Daily Line Setup" screen to plan worker assignments or tap "Unplanned Entry" above to add an assignment on the fly.
          </p>
        </div>
      ) : (
        groupedAssignments.map((group, gIdx) => (
          <div key={gIdx} className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-4">
            {/* STYLE HEADER */}
            <div className="border-b border-stone-200 pb-2.5 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Shirt className="w-5 h-5 text-amber-700" />
                <h2 className="text-lg font-bold text-stone-900">{group.style?.style_code}</h2>
                <span className="text-xs text-stone-600">— {group.style?.name}</span>
              </div>
            </div>

            {/* PROCESSES SEQUENCE */}
            <div className="space-y-4">
              {group.processes.map((procGroup, pIdx) => (
                <div key={pIdx} className="border border-stone-200 bg-stone-50 rounded-xl p-4 space-y-3">
                  {/* PROCESS TITLE */}
                  <div className="flex justify-between items-center text-xs font-semibold text-stone-600">
                    <span className="text-stone-900 font-bold text-sm flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-md bg-stone-200 text-amber-800 text-xs flex items-center justify-center font-mono">
                        #{procGroup.process?.seq_no}
                      </span>
                      <span>{procGroup.process?.name}</span>
                    </span>
                    <span>Standard Rate: {currencySymbol}{(procGroup.process?.rate || 0).toFixed(2)}</span>
                  </div>

                  {/* ASSIGNED WORKERS ROWS */}
                  <div className="space-y-3 pt-1">
                    {procGroup.items.map(assign => {
                      const worker = workers.find(w => w.id === assign.worker_id);
                      const draft = drafts.get(assign.id) || { qty_ok: 0, qty_rework: 0, qty_reject: 0, expanded: false, savedQtyOk: 0 };
                      const targetQty = assign.target_qty || 250;
                      const progressPct = Math.min(100, Math.round((draft.qty_ok / targetQty) * 100));

                      return (
                        <div 
                          key={assign.id}
                          className="bg-white border border-stone-200 rounded-xl p-3.5 space-y-3 shadow-xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            {/* WORKER PHOTO & INFO */}
                            <div className="flex items-center space-x-3">
                              <WorkerAvatar
                                photoUrl={worker?.photo_url}
                                name={worker?.full_name || 'Worker'}
                                size="lg"
                                className="rounded-full shrink-0"
                              />

                              <div>
                                <div className="text-sm font-bold text-stone-900 flex items-center space-x-2">
                                  <span>{worker?.full_name}</span>
                                  <span className="text-xs text-stone-500 font-mono">({worker?.worker_code})</span>
                                </div>
                                <div className="text-xs text-amber-800 font-semibold mt-0.5">
                                  {worker?.pay_type === 'monthly_salary' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                                      Monthly Salaried ({currencySymbol}{(worker.monthly_salary || 0).toLocaleString()}/mo)
                                    </span>
                                  ) : (
                                    <span>Agreed Rate: {currencySymbol}{(assign.agreed_rate || 0).toFixed(2)} / pc</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* LARGE STEPPER CONTROLS FOR QTY OK */}
                            <div className="flex items-center space-x-2 shrink-0 justify-end">
                              <button
                                onClick={() => updateDraftQty(assign.id, 'qty_ok', -10)}
                                className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 hover:bg-stone-200 text-rose-700 font-bold flex items-center justify-center transition active:scale-95"
                                title="-10 pcs"
                              >
                                -10
                              </button>

                              <button
                                onClick={() => updateDraftQty(assign.id, 'qty_ok', -1)}
                                className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 hover:bg-stone-200 text-stone-800 font-bold flex items-center justify-center transition active:scale-95"
                              >
                                <Minus className="w-4 h-4" />
                              </button>

                              <div className="w-20 text-center">
                                <input
                                  type="number"
                                  value={draft.qty_ok}
                                  onChange={(e) => setDraftQtyDirect(assign.id, 'qty_ok', parseInt(e.target.value) || 0)}
                                  className="w-full text-center bg-stone-50 border border-amber-500 rounded-xl py-1.5 text-base font-black font-mono text-amber-800 outline-none"
                                />
                                <span className="text-[10px] text-stone-500 font-mono block">pcs OK</span>
                              </div>

                              <button
                                onClick={() => updateDraftQty(assign.id, 'qty_ok', 1)}
                                className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center transition active:scale-95"
                              >
                                <Plus className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => updateDraftQty(assign.id, 'qty_ok', 10)}
                                className="w-10 h-10 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold flex items-center justify-center transition active:scale-95 shadow-xs"
                                title="+10 pcs"
                              >
                                +10
                              </button>

                              <button
                                onClick={() => toggleExpand(assign.id)}
                                className="p-2 text-stone-500 hover:text-stone-900 bg-stone-100 rounded-lg transition"
                                title="Expand rework & reject"
                              >
                                {draft.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* TARGET PROGRESS BAR */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] text-stone-600">
                              <span>Target Progress: <strong className="text-stone-900">{draft.qty_ok} / {targetQty} pcs</strong></span>
                              <span className="font-bold text-emerald-700">{progressPct}%</span>
                            </div>
                            <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 rounded-full ${progressPct >= 100 ? 'bg-emerald-600' : 'bg-indigo-700'}`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          {/* COLLAPSIBLE REWORK & REJECT */}
                          {draft.expanded && (
                            <div className="pt-2 border-t border-stone-200 grid grid-cols-2 gap-3 text-xs bg-stone-50 p-2.5 rounded-lg">
                              <div>
                                <label className="text-stone-600 block text-[10px] font-semibold mb-1">Rework Qty (10% Pay)</label>
                                <input
                                  type="number"
                                  value={draft.qty_rework}
                                  onChange={e => setDraftQtyDirect(assign.id, 'qty_rework', parseInt(e.target.value) || 0)}
                                  className="w-20 text-center bg-white border border-stone-300 rounded-lg py-1 text-stone-900 font-mono"
                                />
                              </div>

                              <div>
                                <label className="text-stone-600 block text-[10px] font-semibold mb-1">Reject Qty (0% Pay)</label>
                                <input
                                  type="number"
                                  value={draft.qty_reject}
                                  onChange={e => setDraftQtyDirect(assign.id, 'qty_reject', parseInt(e.target.value) || 0)}
                                  className="w-20 text-center bg-white border border-stone-300 rounded-lg py-1 text-stone-900 font-mono"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* STICKY BOTTOM SAVE BAR */}
      <div className="fixed bottom-16 lg:bottom-4 left-0 right-0 z-30 px-4 max-w-4xl mx-auto">
        <div className="bg-white/95 border border-stone-200 p-4 rounded-2xl shadow-xl backdrop-blur-md flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-stone-600 font-semibold uppercase">{t('runningTotal')}</div>
            <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono">
              {totalPiecesEnteredToday.toLocaleString()} pcs • <span className="text-amber-800">{currencySymbol}{totalWageValueAccrued.toFixed(0)}</span>
            </div>
          </div>

          <button
            onClick={handleSaveAll}
            className="flex items-center space-x-2 bg-indigo-700 hover:bg-indigo-800 text-white font-black text-sm py-3 px-6 rounded-xl shadow-xs transition-all shrink-0 active:scale-95"
          >
            <Check className="w-5 h-5 text-amber-300" />
            <span>Save Production Log</span>
          </button>
        </div>
      </div>

      {/* UNPLANNED ENTRY MODAL */}
      {showUnplannedModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-stone-200 pb-3">
              <h3 className="text-lg font-bold text-stone-900 flex items-center space-x-2">
                <PlusCircle className="w-5 h-5 text-amber-700" />
                <span>Add Unplanned Line Entry</span>
              </h3>
            </div>

            <p className="text-xs text-stone-600">
              Assign a worker on the fly to an operation not originally planned today.
            </p>

            <div>
              <label className="text-xs font-semibold text-stone-600 uppercase tracking-wider block mb-1">Style</label>
              <select
                value={unplannedStyleId}
                onChange={(e) => setUnplannedStyleId(e.target.value)}
                className="w-full bg-white border border-stone-300 text-stone-900 rounded-xl px-3 py-2 text-sm outline-none"
              >
                {styles.map(s => (
                  <option key={s.id} value={s.id}>{s.style_code} — {s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 uppercase tracking-wider block mb-1">Process</label>
              <select
                value={unplannedProcessId}
                onChange={(e) => setUnplannedProcessId(e.target.value)}
                className="w-full bg-white border border-stone-300 text-stone-900 rounded-xl px-3 py-2 text-sm outline-none font-medium"
              >
                <option value="all_operations">⭐ Full Garment Sewing (Assign to ALL Operations for this Style)</option>
                {processes.filter(p => p.style_id === unplannedStyleId).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({currencySymbol}{p.rate})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 uppercase tracking-wider block mb-1">Worker</label>
              <select
                value={unplannedWorkerId}
                onChange={(e) => setUnplannedWorkerId(e.target.value)}
                className="w-full bg-white border border-stone-300 text-stone-900 rounded-xl px-3 py-2 text-sm outline-none"
              >
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.full_name} ({w.worker_code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 uppercase tracking-wider block mb-1">Target Qty</label>
              <input
                type="number"
                value={unplannedTargetQty}
                onChange={(e) => setUnplannedTargetQty(Number(e.target.value))}
                className="w-full bg-white border border-stone-300 text-stone-900 font-bold rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowUnplannedModal(false)}
                className="px-4 py-2 bg-stone-100 text-stone-800 rounded-xl text-sm font-medium hover:bg-stone-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUnplannedEntry}
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl text-sm transition shadow-xs"
              >
                Add Assignment to Today's Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEAM OUTPUT MODAL */}
      <TeamOutputModal
        isOpen={showTeamOutputModal}
        onClose={() => setShowTeamOutputModal(false)}
        initialWorkDate={entryDate}
        role={role}
        onSuccess={(msg) => {
          setToastMessage(msg);
          setTimeout(() => setToastMessage(null), 5000);
          loadData();
        }}
      />
        </>
      )}
    </div>
  );
};
