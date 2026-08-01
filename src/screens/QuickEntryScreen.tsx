import React, { useState, useEffect } from 'react';
import { 
  Zap, Calendar, Shirt, Scissors, Plus, Minus, Check, 
  ChevronDown, ChevronUp, AlertCircle, Sparkles, CheckCircle,
  PlusCircle, Target, TrendingUp, Layers, HelpCircle
} from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { dataService } from '../lib/dataService';
import { 
  GarmentStyle, GarmentProcess, Worker, ProductionEntry, 
  FactorySettings, UserRole, DailyAssignment 
} from '../types';
import { DuplicateConfirmModal } from '../components/DuplicateConfirmModal';

interface QuickEntryScreenProps {
  role: UserRole;
}

interface AssignmentEntryDraft {
  qty_ok: number;
  qty_rework: number;
  qty_reject: number;
  expanded: boolean;
  savedQtyOk: number; // accumulated output already saved today
}

export const QuickEntryScreen: React.FC<QuickEntryScreenProps> = ({ role }) => {
  const { t } = useTranslation();

  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
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
    loadData();
  }, [entryDate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [assignList, stList, procList, wList, entryList, setts] = await Promise.all([
        dataService.getDailyAssignments(entryDate),
        dataService.getStyles(),
        dataService.getProcesses(),
        dataService.getWorkers(),
        dataService.getProductionEntries(),
        dataService.getSettings(),
      ]);

      setAssignments(assignList);
      setStyles(stList.filter(s => !s.status || s.status.toLowerCase() === 'active'));
      setProcesses(procList);
      setWorkers(wList);
      setEntries(entryList);
      setSettings(setts);

      // Initialize drafts map with accumulated saved output from today's production entries
      const initialDrafts = new Map<string, AssignmentEntryDraft>();
      for (const a of assignList) {
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

      if (stList.length > 0) setUnplannedStyleId(stList[0].id);
      if (procList.length > 0) setUnplannedProcessId(procList[0].id);
      if (wList.length > 0) setUnplannedWorkerId(wList[0].id);
    } catch (err) {
      console.error('Error loading Quick Entry data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const currencySymbol = settings?.currency_symbol || '৳';

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

      // Sort process groups by seq_no
      procGroups.sort((a, b) => (a.process?.seq_no || 0) - (b.process?.seq_no || 0));
      groups.push({ style, processes: procGroups });
    }

    return groups;
  }, [assignments, styles, processes]);

  // Save all changed entries
  const handleSaveAll = async () => {
    let savedCount = 0;
    for (const assign of assignments) {
      const draft = drafts.get(assign.id);
      if (!draft) continue;

      const diffQty = draft.qty_ok - draft.savedQtyOk;
      if (diffQty > 0 || draft.qty_rework > 0 || draft.qty_reject > 0) {
        // Save entry
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
          rate_snapshot: assign.agreed_rate, // uses assignment agreed_rate
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

  // Add Unplanned Entry
  const handleCreateUnplannedEntry = async () => {
    if (!unplannedStyleId || !unplannedProcessId || !unplannedWorkerId) return;
    try {
      const proc = processes.find(p => p.id === unplannedProcessId);
      const newAssign = await dataService.saveDailyAssignment({
        work_date: entryDate,
        style_id: unplannedStyleId,
        process_id: unplannedProcessId,
        worker_id: unplannedWorkerId,
        target_qty: unplannedTargetQty,
        agreed_rate: proc?.rate || 4.0,
        note: 'Unplanned entry created on floor',
      });

      setShowUnplannedModal(false);
      await loadData();
      setToastMessage('Unplanned worker assignment added to today\'s line plan!');
    } catch (err) {
      console.error('Error creating unplanned assignment:', err);
    }
  };

  return (
    <div className="space-y-6 pb-32 max-w-4xl mx-auto">
      {/* Toast Confirmation */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-bold px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 border border-emerald-400 animate-bounce">
          <CheckCircle className="w-5 h-5 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-400 fill-amber-400" />
            <span>Plan-Driven Quick Entry</span>
          </h1>
          <p className="text-xs text-slate-400">Direct recording against today's assigned line plan</p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Unplanned Entry Button */}
          <button
            onClick={() => setShowUnplannedModal(true)}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-750 text-amber-400 border border-amber-500/30 px-3.5 py-2 rounded-xl font-semibold text-xs transition shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Unplanned Entry</span>
          </button>

          {/* Shift selector */}
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs shrink-0">
            <button
              onClick={() => setShift('day')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                shift === 'day' ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-slate-400'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setShift('night')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                shift === 'night' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'
              }`}
            >
              Night
            </button>
          </div>
        </div>
      </div>

      {/* RUNNING TOTALS BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Pieces Entered Today
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {totalPiecesEnteredToday.toLocaleString()} <span className="text-xs font-normal text-slate-400">pcs</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Total Accrued Wage Value
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono">
              {currencySymbol}{totalWageValueAccrued.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Line Target Completion
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-black text-emerald-400 font-mono">{targetPercent}%</span>
              <span className="text-xs text-slate-400">({totalPiecesEnteredToday} / {totalTargetPiecesToday} pcs)</span>
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div 
            className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
            style={{ width: `${targetPercent}%` }}
          />
        </div>
      </div>

      {/* ASSIGNMENTS GROUPED BY STYLE & PROCESS */}
      {assignments.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <p className="text-base font-semibold text-white">No line assignments planned for today yet.</p>
          <p className="text-xs text-slate-500">
            Use the "Daily Line Setup" screen to plan worker assignments or tap "Unplanned Entry" above to add an assignment on the fly.
          </p>
        </div>
      ) : (
        groupedAssignments.map((group, gIdx) => (
          <div key={gIdx} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            {/* STYLE HEADER */}
            <div className="border-b border-slate-800 pb-2.5 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Shirt className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">{group.style?.style_code}</h2>
                <span className="text-xs text-slate-400">— {group.style?.name}</span>
              </div>
            </div>

            {/* PROCESSES SEQUENCE */}
            <div className="space-y-4">
              {group.processes.map((procGroup, pIdx) => (
                <div key={pIdx} className="border border-slate-800 bg-slate-950/60 rounded-xl p-4 space-y-3">
                  {/* PROCESS TITLE */}
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                    <span className="text-white font-bold text-sm flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-md bg-slate-800 text-amber-400 text-xs flex items-center justify-center">
                        #{procGroup.process?.seq_no}
                      </span>
                      <span>{procGroup.process?.name}</span>
                    </span>
                    <span>Standard Rate: {currencySymbol}{procGroup.process?.rate.toFixed(2)}</span>
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
                          className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            {/* WORKER PHOTO & INFO */}
                            <div className="flex items-center space-x-3">
                              {worker?.photo_url ? (
                                <img 
                                  src={worker.photo_url} 
                                  alt={worker.full_name} 
                                  className="w-11 h-11 rounded-full object-cover border border-slate-700 shrink-0" 
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-full bg-slate-800 flex items-center justify-center text-slate-200 font-bold shrink-0">
                                  {worker?.full_name.substring(0, 2).toUpperCase()}
                                </div>
                              )}

                              <div>
                                <div className="text-sm font-bold text-white flex items-center space-x-2">
                                  <span>{worker?.full_name}</span>
                                  <span className="text-xs text-slate-400 font-mono">({worker?.worker_code})</span>
                                </div>
                                <div className="text-xs text-amber-400 font-semibold mt-0.5">
                                  Agreed Rate: {currencySymbol}{assign.agreed_rate.toFixed(2)} / pc
                                </div>
                              </div>
                            </div>

                            {/* LARGE STEPPER CONTROLS FOR QTY OK */}
                            <div className="flex items-center space-x-2 shrink-0 justify-end">
                              <button
                                onClick={() => updateDraftQty(assign.id, 'qty_ok', -10)}
                                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold flex items-center justify-center transition active:scale-95"
                                title="-10 pcs"
                              >
                                -10
                              </button>

                              <button
                                onClick={() => updateDraftQty(assign.id, 'qty_ok', -1)}
                                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition active:scale-95"
                              >
                                <Minus className="w-4 h-4" />
                              </button>

                              <div className="w-20 text-center">
                                <input
                                  type="number"
                                  value={draft.qty_ok}
                                  onChange={(e) => setDraftQtyDirect(assign.id, 'qty_ok', parseInt(e.target.value) || 0)}
                                  className="w-full text-center bg-slate-950 border border-amber-400 rounded-xl py-1.5 text-base font-black font-mono text-amber-400 outline-none"
                                />
                                <span className="text-[10px] text-slate-400 font-mono block">pcs OK</span>
                              </div>

                              <button
                                onClick={() => updateDraftQty(assign.id, 'qty_ok', 1)}
                                className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 hover:bg-indigo-600/50 text-indigo-300 font-bold flex items-center justify-center transition active:scale-95"
                              >
                                <Plus className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => updateDraftQty(assign.id, 'qty_ok', 10)}
                                className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center transition active:scale-95 shadow-md shadow-indigo-600/20"
                                title="+10 pcs"
                              >
                                +10
                              </button>

                              <button
                                onClick={() => toggleExpand(assign.id)}
                                className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition"
                                title="Expand rework & reject"
                              >
                                {draft.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* TARGET PROGRESS BAR */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] text-slate-400">
                              <span>Target Progress: <strong className="text-white">{draft.qty_ok} / {targetQty} pcs</strong></span>
                              <span className="font-bold text-emerald-400">{progressPct}%</span>
                            </div>
                            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 rounded-full ${progressPct >= 100 ? 'bg-emerald-400' : 'bg-indigo-500'}`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          {/* COLLAPSIBLE REWORK & REJECT */}
                          {draft.expanded && (
                            <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs bg-slate-950/50 p-2.5 rounded-lg">
                              <div>
                                <label className="text-slate-400 block text-[10px] font-semibold mb-1">Rework Qty (10% Pay)</label>
                                <input
                                  type="number"
                                  value={draft.qty_rework}
                                  onChange={e => setDraftQtyDirect(assign.id, 'qty_rework', parseInt(e.target.value) || 0)}
                                  className="w-20 text-center bg-slate-900 border border-slate-700 rounded-lg py-1 text-white font-mono"
                                />
                              </div>

                              <div>
                                <label className="text-slate-400 block text-[10px] font-semibold mb-1">Reject Qty (0% Pay)</label>
                                <input
                                  type="number"
                                  value={draft.qty_reject}
                                  onChange={e => setDraftQtyDirect(assign.id, 'qty_reject', parseInt(e.target.value) || 0)}
                                  className="w-20 text-center bg-slate-900 border border-slate-700 rounded-lg py-1 text-white font-mono"
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
        <div className="bg-slate-950/95 border border-indigo-500/50 p-4 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">{t('runningTotal')}</div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono">
              {totalPiecesEnteredToday.toLocaleString()} pcs • <span className="text-amber-400">{currencySymbol}{totalWageValueAccrued.toFixed(0)}</span>
            </div>
          </div>

          <button
            onClick={handleSaveAll}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm py-3 px-6 rounded-xl shadow-xl transition-all shrink-0 active:scale-95"
          >
            <Check className="w-5 h-5 text-amber-400" />
            <span>Save Production Log</span>
          </button>
        </div>
      </div>

      {/* UNPLANNED ENTRY MODAL */}
      {showUnplannedModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <PlusCircle className="w-5 h-5 text-amber-400" />
                <span>Add Unplanned Line Entry</span>
              </h3>
            </div>

            <p className="text-xs text-slate-300">
              Assign a worker on the fly to an operation not originally planned today.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Style</label>
              <select
                value={unplannedStyleId}
                onChange={(e) => setUnplannedStyleId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none"
              >
                {styles.map(s => (
                  <option key={s.id} value={s.id}>{s.style_code} — {s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Process</label>
              <select
                value={unplannedProcessId}
                onChange={(e) => setUnplannedProcessId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none"
              >
                {processes.filter(p => p.style_id === unplannedStyleId).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({currencySymbol}{p.rate})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Worker</label>
              <select
                value={unplannedWorkerId}
                onChange={(e) => setUnplannedWorkerId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none"
              >
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.full_name} ({w.worker_code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Target Qty</label>
              <input
                type="number"
                value={unplannedTargetQty}
                onChange={(e) => setUnplannedTargetQty(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 text-white font-bold rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowUnplannedModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUnplannedEntry}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition shadow-md shadow-amber-500/20"
              >
                Add Assignment to Today's Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
