import React, { useState, useEffect } from 'react';
import { 
  Zap, Calendar, Shirt, Scissors, Plus, Minus, Check, 
  ChevronDown, ChevronUp, AlertCircle, Sparkles, CheckCircle 
} from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { dataService } from '../lib/dataService';
import { 
  GarmentStyle, GarmentProcess, Worker, ProductionEntry, 
  FactorySettings, UserRole 
} from '../types';
import { DuplicateConfirmModal } from '../components/DuplicateConfirmModal';

interface QuickEntryScreenProps {
  role: UserRole;
}

interface DraftRow {
  worker: Worker;
  qty_ok: number;
  qty_rework: number;
  qty_reject: number;
  expanded: boolean;
}

export const QuickEntryScreen: React.FC<QuickEntryScreenProps> = ({ role }) => {
  const { t } = useTranslation();

  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [processes, setProcesses] = useState<GarmentProcess[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [settings, setSettings] = useState<FactorySettings | null>(null);

  // Selector selections
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<'day' | 'night'>('day');
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');
  const [selectedProcessId, setSelectedProcessId] = useState<string>('');

  // Draft worker entry quantities map
  const [drafts, setDrafts] = useState<Map<string, DraftRow>>(new Map());

  // Duplicate Guard State
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    workerName: string;
    processName: string;
    existing: ProductionEntry;
    pendingWorkerId: string;
    pendingQty: number;
  } | null>(null);

  // Toast confirmation feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSelectors();
  }, []);

  const loadSelectors = async () => {
    const [stList, wList, setRes] = await Promise.all([
      dataService.getStyles(),
      dataService.getWorkers(),
      dataService.getSettings(),
    ]);
    setStyles(stList);
    setWorkers(wList);
    setSettings(setRes);

    if (stList.length > 0) {
      const firstStyle = stList[0];
      setSelectedStyleId(firstStyle.id);
      loadProcessesForStyle(firstStyle.id);
    }
  };

  const loadProcessesForStyle = async (styleId: string) => {
    const pList = await dataService.getProcesses(styleId);
    setProcesses(pList);
    if (pList.length > 0) {
      setSelectedProcessId(pList[0].id);
    } else {
      setSelectedProcessId('');
    }
  };

  const handleStyleChange = (styleId: string) => {
    setSelectedStyleId(styleId);
    loadProcessesForStyle(styleId);
  };

  const selectedProcess = processes.find(p => p.id === selectedProcessId);
  const pieceRate = selectedProcess?.rate || 0;
  const currencySymbol = settings?.currency_symbol || '৳';

  // Toggle or increment worker quantity
  const handleWorkerTap = (worker: Worker) => {
    const existing = drafts.get(worker.id);
    if (!existing) {
      const newDrafts = new Map(drafts);
      newDrafts.set(worker.id, {
        worker,
        qty_ok: 10,
        qty_rework: 0,
        qty_reject: 0,
        expanded: false,
      });
      setDrafts(newDrafts);
    } else {
      // Toggle expand
      const newDrafts = new Map(drafts);
      newDrafts.set(worker.id, {
        ...existing,
        expanded: !existing.expanded,
      });
      setDrafts(newDrafts);
    }
  };

  const updateQty = (workerId: string, field: 'qty_ok' | 'qty_rework' | 'qty_reject', delta: number) => {
    const existing = drafts.get(workerId);
    if (!existing) return;
    const newQty = Math.max(0, existing[field] + delta);
    const newDrafts = new Map(drafts);
    newDrafts.set(workerId, {
      ...existing,
      [field]: newQty,
    });
    setDrafts(newDrafts);
  };

  const setQtyDirect = (workerId: string, field: 'qty_ok' | 'qty_rework' | 'qty_reject', val: number) => {
    const existing = drafts.get(workerId);
    if (!existing) return;
    const newDrafts = new Map(drafts);
    newDrafts.set(workerId, {
      ...existing,
      [field]: Math.max(0, val),
    });
    setDrafts(newDrafts);
  };

  // Calculate totals across all active worker drafts
  const draftList = Array.from(drafts.values()) as DraftRow[];
  const totalPieces = draftList.reduce((sum, d) => sum + d.qty_ok, 0);
  const reworkPct = settings?.rework_pay_percent || 0;
  const totalMoney = draftList.reduce((sum, d) => {
    const okEarn = d.qty_ok * pieceRate;
    const reworkEarn = d.qty_rework * pieceRate * (reworkPct / 100);
    return sum + okEarn + reworkEarn;
  }, 0);

  // Save all entries
  const handleSaveAll = async () => {
    if (!selectedStyleId || !selectedProcessId || drafts.size === 0) return;

    // Check duplicate guard first
    for (const [wId, draft] of drafts.entries()) {
      const dup = dataService.checkDuplicateEntry(wId, selectedProcessId, entryDate, shift);
      if (dup) {
        setDuplicateInfo({
          workerName: draft.worker.full_name,
          processName: selectedProcess?.name || 'Operation',
          existing: dup,
          pendingWorkerId: wId,
          pendingQty: draft.qty_ok,
        });
        setDuplicateModalOpen(true);
        return; // Pause until user resolves
      }
    }

    // Save batch
    let count = 0;
    for (const [wId, draft] of drafts.entries()) {
      if (draft.qty_ok > 0 || draft.qty_rework > 0) {
        await dataService.saveProductionEntry({
          entry_date: entryDate,
          shift,
          style_id: selectedStyleId,
          process_id: selectedProcessId,
          worker_id: wId,
          qty_ok: draft.qty_ok,
          qty_rework: draft.qty_rework,
          qty_reject: draft.qty_reject,
          rate_snapshot: pieceRate,
        });
        count++;
      }
    }

    setToastMessage(`${count} entries saved — ${currencySymbol}${totalMoney.toFixed(0)}`);
    setDrafts(new Map());

    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleDuplicateAddAnyway = async () => {
    setDuplicateModalOpen(false);
    if (!duplicateInfo) return;

    await dataService.saveProductionEntry({
      entry_date: entryDate,
      shift,
      style_id: selectedStyleId,
      process_id: selectedProcessId,
      worker_id: duplicateInfo.pendingWorkerId,
      qty_ok: duplicateInfo.pendingQty,
      rate_snapshot: pieceRate,
    });

    setToastMessage(`Duplicate entry added anyway for ${duplicateInfo.workerName}`);
    setDuplicateInfo(null);
  };

  const handleDuplicateEditExisting = async (existing: ProductionEntry) => {
    setDuplicateModalOpen(false);
    if (!duplicateInfo) return;

    await dataService.saveProductionEntry({
      id: existing.id,
      qty_ok: existing.qty_ok + duplicateInfo.pendingQty,
    });

    setToastMessage(`Updated existing entry for ${duplicateInfo.workerName} to ${existing.qty_ok + duplicateInfo.pendingQty} pcs`);
    setDuplicateInfo(null);
  };

  return (
    <div className="space-y-4 pb-32 max-w-4xl mx-auto">
      {/* Toast Confirmation */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-bold px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 border border-emerald-400 animate-bounce">
          <CheckCircle className="w-5 h-5 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Screen Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-400 fill-amber-400" />
            <span>Floor Quick Entry</span>
          </h1>
          <p className="text-xs text-slate-400">Optimized for high-speed factory floor tapping</p>
        </div>

        {/* Shift selector */}
        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
          <button
            onClick={() => setShift('day')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              shift === 'day' ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-slate-400'
            }`}
          >
            Day Shift
          </button>
          <button
            onClick={() => setShift('night')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              shift === 'night' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'
            }`}
          >
            Night Shift
          </button>
        </div>
      </div>

      {/* 1. Date & Style & Process Selector Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Date Picker */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              {t('selectDate')}
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white"
            />
          </div>

          {/* Garment Style Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              {t('selectStyle')}
            </label>
            <select
              value={selectedStyleId}
              onChange={e => handleStyleChange(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-semibold"
            >
              {styles.map(s => (
                <option key={s.id} value={s.id}>
                  {s.style_code} — {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Process / Operation Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              {t('selectProcess')}
            </label>
            <select
              value={selectedProcessId}
              onChange={e => setSelectedProcessId(e.target.value)}
              className="w-full bg-slate-800 border border-amber-500/50 rounded-xl px-3 py-2 text-sm text-amber-400 font-bold"
            >
              {processes.map(p => (
                <option key={p.id} value={p.id}>
                  #{p.seq_no} {p.name} ({currencySymbol}{p.rate})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Worker Chips List Header */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
        <span>{t('tapWorkerToAdd')}</span>
        <span>{workers.length} Workers</span>
      </div>

      {/* Worker Cards / Stepper List */}
      <div className="space-y-2">
        {workers.map(worker => {
          const draft = drafts.get(worker.id);
          const isSelected = Boolean(draft);

          return (
            <div
              key={worker.id}
              className={`rounded-2xl border transition-all ${
                isSelected
                  ? 'bg-slate-800 border-indigo-500/80 shadow-lg'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Main Worker Tap Row */}
              <div 
                onClick={() => handleWorkerTap(worker)}
                className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <img
                    src={worker.photo_url || ''}
                    alt={worker.full_name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-white text-base truncate">{worker.full_name}</div>
                    <div className="text-xs text-slate-400 font-mono">
                      {worker.worker_code} • {worker.line_no}
                    </div>
                  </div>
                </div>

                {/* Right Badge / Stepper Controls */}
                {!isSelected ? (
                  <button className="px-3 py-2 bg-slate-800 hover:bg-indigo-600/30 text-indigo-400 font-bold rounded-xl border border-indigo-500/30 text-xs shrink-0 flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Log Entry
                  </button>
                ) : (
                  <div className="flex items-center space-x-2 shrink-0" onClick={e => e.stopPropagation()}>
                    {/* Large Stepper for Qty OK */}
                    <button
                      onClick={() => updateQty(worker.id, 'qty_ok', -5)}
                      className="w-12 h-12 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-black text-lg flex items-center justify-center active:scale-95 transition-all shadow-md touch-manipulation"
                      title="-5 pcs"
                    >
                      <Minus className="w-5 h-5 text-rose-400" />
                    </button>

                    <div className="w-16 text-center">
                      <input
                        type="number"
                        value={draft.qty_ok}
                        onChange={e => setQtyDirect(worker.id, 'qty_ok', parseInt(e.target.value) || 0)}
                        className="w-full text-center bg-slate-950 border border-amber-400 rounded-xl py-1 text-lg font-black font-mono text-amber-400"
                      />
                      <span className="text-[10px] text-slate-400 font-mono block">pcs OK</span>
                    </div>

                    <button
                      onClick={() => updateQty(worker.id, 'qty_ok', 10)}
                      className="w-12 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg flex items-center justify-center active:scale-95 transition-all shadow-md touch-manipulation"
                      title="+10 pcs"
                    >
                      <Plus className="w-5 h-5 text-amber-400" />
                    </button>
                  </div>
                )}
              </div>

              {/* Collapsed Optional Fields for Rework / Reject */}
              {isSelected && draft.expanded && (
                <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-700/50 bg-slate-850/50 rounded-b-2xl grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block text-[11px] font-semibold mb-1">Rework Qty (10% Pay)</label>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => updateQty(worker.id, 'qty_rework', -1)}
                        className="w-8 h-8 rounded-lg bg-slate-700 text-white font-bold"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={draft.qty_rework}
                        onChange={e => setQtyDirect(worker.id, 'qty_rework', parseInt(e.target.value) || 0)}
                        className="w-16 text-center bg-slate-950 border border-slate-700 rounded-lg py-1 text-white font-mono"
                      />
                      <button
                        onClick={() => updateQty(worker.id, 'qty_rework', 1)}
                        className="w-8 h-8 rounded-lg bg-slate-700 text-white font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block text-[11px] font-semibold mb-1">Reject Qty (0% Pay)</label>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => updateQty(worker.id, 'qty_reject', -1)}
                        className="w-8 h-8 rounded-lg bg-slate-700 text-white font-bold"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={draft.qty_reject}
                        onChange={e => setQtyDirect(worker.id, 'qty_reject', parseInt(e.target.value) || 0)}
                        className="w-16 text-center bg-slate-950 border border-slate-700 rounded-lg py-1 text-white font-mono"
                      />
                      <button
                        onClick={() => updateQty(worker.id, 'qty_reject', 1)}
                        className="w-8 h-8 rounded-lg bg-slate-700 text-white font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky Bottom Save Bar */}
      <div className="fixed bottom-16 lg:bottom-4 left-0 right-0 z-30 px-4 max-w-4xl mx-auto">
        <div className="bg-slate-950/95 border border-indigo-500/50 p-4 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">{t('runningTotal')}</div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono">
              {totalPieces.toLocaleString()} pcs • <span className="text-amber-400">{currencySymbol}{totalMoney.toFixed(0)}</span>
            </div>
          </div>

          <button
            onClick={handleSaveAll}
            disabled={drafts.size === 0}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-black text-sm py-3 px-6 rounded-xl shadow-xl transition-all shrink-0 active:scale-95"
          >
            <Check className="w-5 h-5 text-amber-400" />
            <span>{t('saveAll')} ({drafts.size})</span>
          </button>
        </div>
      </div>

      {/* Duplicate Guard Confirm Dialog */}
      {duplicateInfo && (
        <DuplicateConfirmModal
          isOpen={duplicateModalOpen}
          workerName={duplicateInfo.workerName}
          processName={duplicateInfo.processName}
          existingEntry={duplicateInfo.existing}
          onAddAnyway={handleDuplicateAddAnyway}
          onEditExisting={handleDuplicateEditExisting}
          onClose={() => setDuplicateModalOpen(false)}
        />
      )}
    </div>
  );
};
