import React, { useState, useEffect, useMemo } from 'react';
import { Table, Save, CheckCircle, AlertCircle, Plus, ArrowRight, UserPlus, Info, RefreshCw, Printer } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { dataService } from '../lib/dataService';
import { GarmentStyle, GarmentProcess, Worker, FactorySettings, UserRole, DailyAssignment, CuttingEntry } from '../types';
import { WorkerAvatar } from '../components/WorkerAvatar';
import { PrintTallySheetModal } from '../components/PrintTallySheetModal';
import { isStyleUnlockedForSewing } from '../lib/cuttingGate';

type ScreenId = string;

interface BulkGridScreenProps {
  role: UserRole;
  onNavigate?: (screen: ScreenId) => void;
}

export const BulkGridScreen: React.FC<BulkGridScreenProps> = ({ role, onNavigate }) => {
  const { t } = useTranslation();

  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');
  const [processes, setProcesses] = useState<GarmentProcess[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [settings, setSettings] = useState<FactorySettings | null>(null);

  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<'day' | 'night'>('day');

  // Daily Assignments & Production Entries state
  const [dailyAssignments, setDailyAssignments] = useState<DailyAssignment[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>({});
  
  // UI states
  const [showUnassignedWorkers, setShowUnassignedWorkers] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Quick Assign Shortcut Modal state
  const [quickAssignModal, setQuickAssignModal] = useState<{
    worker: Worker;
    process: GarmentProcess;
    targetQty: number;
    agreedRate: number;
  } | null>(null);
  const [assigning, setAssigning] = useState<boolean>(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedStyleId && entryDate) {
      loadDateAndStyleData(entryDate, selectedStyleId);
    }
  }, [entryDate, selectedStyleId, shift]);

  const loadInitialData = async () => {
    setLoadingData(true);
    const [stList, wList, setRes, cutEntries] = await Promise.all([
      dataService.getStyles(),
      dataService.getWorkers(),
      dataService.getSettings(),
      dataService.getCuttingEntries(),
    ]);

    const activeStyles = stList.filter(s => !s.status || s.status.toLowerCase() === 'active');
    const unlockedStyles = activeStyles.filter(s => isStyleUnlockedForSewing(s, cutEntries));

    setStyles(unlockedStyles);
    setWorkers(wList);
    setSettings(setRes);

    if (unlockedStyles.length > 0) {
      const firstStyleId = unlockedStyles[0].id;
      setSelectedStyleId(firstStyleId);
      const pList = await dataService.getProcesses(firstStyleId);
      setProcesses(pList);
      await loadDateAndStyleData(entryDate, firstStyleId);
    }
    setLoadingData(false);
  };

  const loadDateAndStyleData = async (dateStr: string, styleId: string) => {
    setLoadingData(true);
    const [pList, assignList, allEntries] = await Promise.all([
      dataService.getProcesses(styleId),
      dataService.getDailyAssignments(dateStr),
      dataService.getProductionEntries(),
    ]);

    const entryList = allEntries.filter(e => e.entry_date === dateStr);

    setProcesses(pList);
    
    // Filter assignments for selected style
    const styleAssignments = assignList.filter(a => a.style_id === styleId);
    setDailyAssignments(styleAssignments);

    // Build existing production entries matrix for workerId -> processId -> qty
    const newMatrix: Record<string, Record<string, number>> = {};
    entryList.forEach(entry => {
      if (entry.style_id === styleId && entry.shift === shift) {
        if (!newMatrix[entry.worker_id]) {
          newMatrix[entry.worker_id] = {};
        }
        newMatrix[entry.worker_id][entry.process_id] = entry.qty_ok;
      }
    });

    setMatrix(newMatrix);
    setLoadingData(false);
  };

  const handleStyleChange = async (styleId: string) => {
    setSelectedStyleId(styleId);
  };

  // Build assignment lookup map: worker_id -> process_id -> DailyAssignment
  const assignmentLookup = useMemo(() => {
    const map: Record<string, Record<string, DailyAssignment>> = {};
    dailyAssignments.forEach(assign => {
      if (!map[assign.worker_id]) {
        map[assign.worker_id] = {};
      }
      map[assign.worker_id][assign.process_id] = assign;
    });
    return map;
  }, [dailyAssignments]);

  // Set of worker IDs who have at least one assignment for this date and style
  const assignedWorkerIds = useMemo(() => {
    const set = new Set<string>();
    dailyAssignments.forEach(a => {
      if (a.worker_id) set.add(a.worker_id);
    });
    return set;
  }, [dailyAssignments]);

  // Filter workers to show: hide unassigned workers by default unless toggled
  const displayedWorkers = useMemo(() => {
    if (showUnassignedWorkers) {
      return workers;
    }
    return workers.filter(w => assignedWorkerIds.has(w.id));
  }, [workers, assignedWorkerIds, showUnassignedWorkers]);

  const handleCellChange = (workerId: string, processId: string, value: string) => {
    const val = parseInt(value, 10);
    const numVal = isNaN(val) ? 0 : Math.max(0, val);
    
    setMatrix(prev => ({
      ...prev,
      [workerId]: {
        ...(prev[workerId] || {}),
        [processId]: numVal,
      },
    }));
  };

  const handleSaveGrid = async () => {
    setSaving(true);
    try {
      let count = 0;
      for (const workerId of Object.keys(matrix)) {
        for (const processId of Object.keys(matrix[workerId])) {
          const qty = matrix[workerId][processId];
          // Only save entries where an assignment exists for that worker and process
          const assignment = assignmentLookup[workerId]?.[processId];
          if (assignment && qty >= 0) {
            const proc = processes.find(p => p.id === processId);
            await dataService.saveProductionEntry({
              entry_date: entryDate,
              shift,
              style_id: selectedStyleId,
              process_id: processId,
              worker_id: workerId,
              assignment_id: assignment.id,
              qty_ok: qty,
              qty_rework: 0,
              qty_reject: 0,
              rate_snapshot: assignment.agreed_rate || proc?.rate || 3.5,
              note: 'Bulk grid desktop submission',
            });
            count++;
          }
        }
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      await loadDateAndStyleData(entryDate, selectedStyleId);
    } catch (err: any) {
      alert(err?.message || 'Error saving bulk entries');
    } finally {
      setSaving(false);
    }
  };

  // Quick Assign Shortcut Handler
  const handleQuickAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAssignModal || !selectedStyleId) return;

    setAssigning(true);
    try {
      await dataService.saveDailyAssignment({
        work_date: entryDate,
        style_id: selectedStyleId,
        process_id: quickAssignModal.process.id,
        worker_id: quickAssignModal.worker.id,
        target_qty: quickAssignModal.targetQty,
        agreed_rate: quickAssignModal.agreedRate,
        status: 'active',
      });

      setQuickAssignModal(null);
      // Reload daily assignments data which unlocks the cell
      await loadDateAndStyleData(entryDate, selectedStyleId);
    } catch (err: any) {
      alert(err?.message || 'Failed to assign worker to operation');
    } finally {
      setAssigning(false);
    }
  };

  const currencySymbol = settings?.currency_symbol || 'MYR';
  const selectedStyleObj = styles.find(s => s.id === selectedStyleId);

  return (
    <div className="space-y-6 pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-stone-200 p-5 rounded-3xl shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <Table className="w-6 h-6 text-emerald-700" />
            <span>Spreadsheet Bulk Grid Entry</span>
          </h1>
          <p className="text-xs text-stone-600">Desktop matrix entry — locked to planned daily line assignments</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center space-x-2 font-bold px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 shadow-xs transition-all text-sm"
          >
            <Printer className="w-4 h-4 text-stone-700" />
            <span>Print Blank Sheet</span>
          </button>

          <button
            onClick={handleSaveGrid}
            disabled={saving || dailyAssignments.length === 0}
            className={`flex items-center space-x-2 font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all text-sm shrink-0 ${
              dailyAssignments.length === 0
                ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white'
            }`}
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : savedSuccess ? (
              <CheckCircle className="w-4 h-4 text-emerald-200" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? 'Saving...' : savedSuccess ? 'Grid Saved!' : 'Save Grid Entries'}</span>
          </button>
        </div>
      </div>

      {/* Selectors & Filter Bar */}
      <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block mb-1">Entry Date</label>
            <input
              type="date"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block mb-1">Select Garment Style</label>
            <select
              value={selectedStyleId}
              onChange={e => handleStyleChange(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 font-semibold"
            >
              {styles.map(s => (
                <option key={s.id} value={s.id}>
                  {s.style_code} — {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block mb-1">Shift</label>
            <select
              value={shift}
              onChange={e => setShift(e.target.value as any)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 font-semibold"
            >
              <option value="day">Day Shift</option>
              <option value="night">Night Shift</option>
            </select>
          </div>
        </div>

        {/* Unassigned Worker Toggle Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-stone-100 gap-2">
          <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-stone-700 font-medium select-none">
            <input
              type="checkbox"
              checked={showUnassignedWorkers}
              onChange={e => setShowUnassignedWorkers(e.target.checked)}
              className="w-4 h-4 rounded border-stone-300 text-indigo-700 focus:ring-indigo-600"
            />
            <span>Show unassigned workers (greyed out)</span>
          </label>

          <div className="text-[11px] text-stone-500 font-mono">
            <span>Assigned Today: <strong className="text-emerald-800">{assignedWorkerIds.size}</strong> / {workers.length} workers</span>
          </div>
        </div>
      </div>

      {/* Spreadsheet Matrix Table OR Empty State */}
      {loadingData ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center text-stone-500 flex flex-col items-center justify-center space-y-3 shadow-xs">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-xs font-semibold">Loading assignments & production grid...</p>
        </div>
      ) : dailyAssignments.length === 0 ? (
        /* EMPTY STATE: No workers assigned for this style today */
        <div className="bg-white border border-stone-200 rounded-3xl p-8 sm:p-12 text-center space-y-5 shadow-xs max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto shadow-xs">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xl font-black text-stone-900">
              No workers assigned for this style today
            </h3>
            <p className="text-xs text-stone-600 max-w-md mx-auto">
              There are no line assignments created for <strong className="text-stone-800">{selectedStyleObj?.style_code || 'this style'}</strong> on <span className="font-mono">{entryDate}</span>. Please assign workers in Daily Line Setup to unlock production logging.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {onNavigate && (
              <button
                onClick={() => onNavigate('dailySetup')}
                className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 py-3 rounded-2xl shadow-xs transition-all text-xs flex items-center justify-center space-x-2"
              >
                <span>Go to Daily Line Setup</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setShowUnassignedWorkers(true)}
              className="w-full sm:w-auto bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 font-bold px-5 py-3 rounded-2xl transition-all text-xs flex items-center justify-center space-x-2"
            >
              <UserPlus className="w-4 h-4 text-stone-600" />
              <span>Show Unassigned Grid</span>
            </button>
          </div>
        </div>
      ) : (
        /* MATRIX TABLE WITH LOCKED & UNLOCKED CELLS */
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs w-full max-w-full overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-mono">
                  <th className="p-3 sticky left-0 z-10 bg-stone-50 min-w-[170px]">Worker Name</th>
                  {processes.map(proc => (
                    <th key={proc.id} className="p-2 text-center min-w-[110px]">
                      <div className="font-bold text-stone-900 truncate max-w-[100px]">{proc.name}</div>
                      <div className="text-[10px] text-amber-800 font-bold">{currencySymbol}{proc.rate} / pc</div>
                    </th>
                  ))}
                  <th className="p-3 text-right bg-stone-50 sticky right-0 z-10 min-w-[100px]">Row Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {displayedWorkers.map(worker => {
                  const isWorkerAssignedToday = assignedWorkerIds.has(worker.id);
                  const workerRowMatrix = matrix[worker.id] || {};
                  
                  let rowPieces = 0;
                  let rowMoney = 0;

                  processes.forEach(proc => {
                    const assignment = assignmentLookup[worker.id]?.[proc.id];
                    if (assignment) {
                      const q = workerRowMatrix[proc.id] || 0;
                      rowPieces += q;
                      rowMoney += q * (assignment.agreed_rate || proc.rate);
                    }
                  });

                  return (
                    <tr
                      key={worker.id}
                      className={`transition-colors ${
                        !isWorkerAssignedToday ? 'bg-stone-50/70 opacity-70' : 'hover:bg-stone-50/50'
                      }`}
                    >
                      {/* Worker Header Cell */}
                      <td className="p-3 sticky left-0 z-10 bg-white font-medium text-stone-900 flex items-center space-x-2">
                        <WorkerAvatar
                          photoUrl={worker.photo_url}
                          name={worker.full_name}
                          size="sm"
                          className="rounded-full shrink-0"
                        />
                        <div className="truncate">
                          <div className="font-bold flex items-center space-x-1">
                            <span className="truncate">{worker.full_name}</span>
                            {worker.pay_type === 'monthly_salary' && (
                              <span className="text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1 rounded shrink-0">
                                Monthly
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-stone-500 font-mono">
                            {worker.worker_code}
                            {!isWorkerAssignedToday && (
                              <span className="ml-1 text-stone-400 font-sans italic">(No Assignment)</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Process Cells */}
                      {processes.map(proc => {
                        const assignment = assignmentLookup[worker.id]?.[proc.id];
                        const isEditable = Boolean(assignment);

                        if (isEditable) {
                          const currentQtyVal = workerRowMatrix[proc.id] ?? '';
                          const targetQtyGoal = assignment?.target_qty || 250;

                          return (
                            <td key={proc.id} className="p-1.5 text-center align-middle">
                              <div className="flex flex-col items-center">
                                <input
                                  type="number"
                                  min="0"
                                  value={currentQtyVal}
                                  onChange={e => handleCellChange(worker.id, proc.id, e.target.value)}
                                  placeholder="0"
                                  className="w-full text-center bg-white border border-stone-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-lg py-1.5 text-sm text-stone-900 font-mono font-bold shadow-2xs"
                                />
                                <span className="text-[10px] text-stone-600 font-mono font-medium mt-0.5">
                                  / {targetQtyGoal}
                                </span>
                              </div>
                            </td>
                          );
                        }

                        // DISABLED CELL (No assignment)
                        return (
                          <td key={proc.id} className="p-1.5 text-center align-middle">
                            <div
                              title="Not assigned to this operation today"
                              className="relative group w-full bg-[#F5F5F4] border border-stone-200 rounded-lg py-1.5 text-center font-mono text-stone-400 text-sm cursor-not-allowed flex items-center justify-center min-h-[42px]"
                            >
                              <span>-</span>
                              
                              {/* Quick Assign Overlay Button */}
                              <button
                                type="button"
                                tabIndex={-1}
                                onClick={() =>
                                  setQuickAssignModal({
                                    worker,
                                    process: proc,
                                    targetQty: 250,
                                    agreedRate: proc.rate,
                                  })
                                }
                                className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-emerald-800/90 text-white font-sans text-[11px] font-bold rounded-lg flex items-center justify-center transition-opacity shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5 mr-0.5" /> Assign
                              </button>
                            </div>
                          </td>
                        );
                      })}

                      {/* Row Total */}
                      <td className="p-3 text-right sticky right-0 z-10 bg-white font-mono font-bold text-amber-800">
                        {rowPieces} pcs
                        {worker.pay_type === 'monthly_salary' ? (
                          <div className="text-[10px] text-stone-500 font-sans font-medium">(Fixed Monthly)</div>
                        ) : (
                          <div className="text-[10px] text-stone-500">{currencySymbol}{(rowMoney || 0).toFixed(0)}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QUICK ASSIGN MODAL */}
      {quickAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-stone-900 flex items-center space-x-2">
              <UserPlus className="w-5 h-5 text-emerald-700" />
              <span>Assign Operation on the Spot</span>
            </h3>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 text-xs space-y-1">
              <div className="text-stone-700">Worker: <strong className="text-stone-900">{quickAssignModal.worker.full_name}</strong> ({quickAssignModal.worker.worker_code})</div>
              <div className="text-stone-700">Operation: <strong className="text-stone-900">{quickAssignModal.process.name}</strong></div>
              <div className="text-stone-700">Garment Style: <strong className="text-stone-900">{selectedStyleObj?.style_code} — {selectedStyleObj?.name}</strong></div>
              <div className="text-stone-500 font-mono pt-1">Standard Rate: {currencySymbol}{quickAssignModal.process.rate}/pc</div>
            </div>

            <form onSubmit={handleQuickAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Target Quantity (pcs)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={quickAssignModal.targetQty}
                  onChange={e =>
                    setQuickAssignModal({
                      ...quickAssignModal,
                      targetQty: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-2.5 text-sm font-mono font-bold text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Agreed Rate per Piece ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={quickAssignModal.agreedRate}
                  onChange={e =>
                    setQuickAssignModal({
                      ...quickAssignModal,
                      agreedRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-2.5 text-sm font-mono font-bold text-stone-900"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickAssignModal(null)}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded-2xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl text-xs shadow-xs"
                >
                  {assigning ? 'Assigning...' : 'Confirm & Unlock Cell'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT BLANK PAPER TALLY SHEET MODAL & PRINTABLE DOM */}
      <PrintTallySheetModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        entryDate={entryDate}
        shift={shift}
        selectedStyleId={selectedStyleId}
        styles={styles}
        workers={workers}
        settings={settings}
        onNavigate={onNavigate}
      />
    </div>
  );
};
