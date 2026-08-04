import React, { useState, useEffect } from 'react';
import { 
  Calendar, Copy, Sparkles, AlertTriangle, Users, Layers, 
  DollarSign, Plus, Trash2, CheckCircle2, RefreshCw, X, Eye, ArrowRight,
  TrendingUp, UserCheck, Search, Info, FileSpreadsheet, Download,
  Scissors, Clock
} from 'lucide-react';
import { dataService, getLocalDateString } from '../lib/dataService';
import { exportDailyPlanExcel, exportDailyReportExcel } from '../lib/excelExport';
import { DailyAssignment, GarmentStyle, GarmentProcess, Worker, FactorySettings, UserRole, CuttingEntry, ProductionEntry } from '../types';
import { WorkerAvatar } from '../components/WorkerAvatar';
import { isStyleUnlockedForSewing, getStyleSewingAvailability } from '../lib/cuttingGate';

interface DailySetupScreenProps {
  role?: UserRole;
  onProposeRate?: (workerId: string, processId: string, currentRate: number) => void;
  onNavigate?: (screen: string) => void;
}

export const DailySetupScreen: React.FC<DailySetupScreenProps> = ({ role, onProposeRate, onNavigate }) => {
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [processes, setProcesses] = useState<GarmentProcess[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [assignments, setAssignments] = useState<DailyAssignment[]>([]);
  const [cuttingEntries, setCuttingEntries] = useState<CuttingEntry[]>([]);
  const [productionEntries, setProductionEntries] = useState<ProductionEntry[]>([]);
  const [settings, setSettings] = useState<FactorySettings | null>(null);
  const [selectedStyleIds, setSelectedStyleIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Auto setup & copy modal states
  const [showCopyDateModal, setShowCopyDateModal] = useState<boolean>(false);
  const [copySourceDate, setCopySourceDate] = useState<string>('');
  
  // Review Draft Modal
  const [draftReview, setDraftReview] = useState<{
    draft: DailyAssignment[];
    skippedWorkers: string[];
    unassignedProcesses: string[];
  } | null>(null);

  // Worker Selection Modal for a process
  const [assigningProcess, setAssigningProcess] = useState<{ styleId: string; processId: string; processName: string } | null>(null);
  const [workerSearchTerm, setWorkerSearchTerm] = useState<string>('');

  // Propose Rate Modal
  const [proposeRateModal, setProposeRateModal] = useState<{
    workerId: string;
    workerName: string;
    processId: string;
    processName: string;
    currentRate: number;
    proposedRate: number;
    reason: string;
  } | null>(null);

  useEffect(() => {
    loadInitialData();
  }, [selectedDate]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [allStyles, allProcesses, allWorkers, dailyList, setts, cutEntries, prodEntries] = await Promise.all([
        dataService.getStyles(),
        dataService.getProcesses(),
        dataService.getWorkers(),
        dataService.getDailyAssignments(selectedDate),
        dataService.getSettings(),
        dataService.getCuttingEntries(),
        dataService.getProductionEntries(),
      ]);

      const activeStyles = allStyles.filter(s => !s.status || s.status.toLowerCase() === 'active');
      const activeProcesses = allProcesses.filter(p => p.is_active === undefined || p.is_active === true);
      const activeWorkers = allWorkers.filter(w => !w.status || w.status.toLowerCase() === 'active');

      setStyles(activeStyles);
      setProcesses(activeProcesses);
      setWorkers(activeWorkers);
      setAssignments(dailyList);
      setSettings(setts);
      setCuttingEntries(cutEntries);
      setProductionEntries(prodEntries);

      // Auto-select all selectable (unlocked) active styles so new unlocked styles and all operation lines are immediately visible
      const selectableStyles = activeStyles.filter(s => isStyleUnlockedForSewing(s, cutEntries));
      if (selectableStyles.length > 0) {
        setSelectedStyleIds(selectableStyles.map(s => s.id));
      } else {
        setSelectedStyleIds([]);
      }
    } catch (err) {
      console.error('Error loading Daily Setup data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStyle = (styleId: string) => {
    if (selectedStyleIds.includes(styleId)) {
      setSelectedStyleIds(selectedStyleIds.filter(id => id !== styleId));
    } else {
      setSelectedStyleIds([...selectedStyleIds, styleId]);
    }
  };

  // Helper map: counts how many processes each worker is assigned to today across all styles
  const workerAssignmentCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assignments) {
      counts.set(a.worker_id, (counts.get(a.worker_id) || 0) + 1);
    }
    return counts;
  }, [assignments]);

  // Save / Update Target Qty directly
  const handleTargetQtyChange = (id: string, newQty: number) => {
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, target_qty: newQty } : a));
  };

  const handleTargetQtyBlur = async (id: string, newQty: number) => {
    try {
      await dataService.updateDailyAssignment(id, { target_qty: newQty });
    } catch (err) {
      console.error('Failed to update target qty:', err);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    try {
      await dataService.deleteDailyAssignment(id);
      setAssignments(assignments.filter(a => a.id !== id));
    } catch (err) {
      console.error('Failed to delete assignment:', err);
    }
  };

  // Assign worker to process
  const handleAssignWorkerToProcess = async (workerId: string) => {
    if (!assigningProcess) return;
    try {
      const proc = processes.find(p => p.id === assigningProcess.processId);
      const resolvedStyleId = assigningProcess.styleId || proc?.style_id;

      await dataService.saveDailyAssignment({
        work_date: selectedDate,
        style_id: resolvedStyleId,
        process_id: assigningProcess.processId,
        worker_id: workerId,
        target_qty: 250,
      });
      const updatedList = await dataService.getDailyAssignments(selectedDate);
      setAssignments(updatedList);
    } catch (err) {
      console.error('Error assigning worker:', err);
    }
  };

  // ONE-TAP AUTO SETUP 1: Copy Yesterday
  const handleCopyYesterday = async () => {
    setIsLoading(true);
    try {
      // Find yesterday's date
      const cur = new Date(selectedDate);
      cur.setDate(cur.getDate() - 1);
      const yesterdayStr = cur.toISOString().split('T')[0];

      const cloned = await dataService.copyAssignmentsFromDate(yesterdayStr, selectedDate);
      const updated = await dataService.getDailyAssignments(selectedDate);
      setAssignments(updated);
      
      setDraftReview({
        draft: cloned,
        skippedWorkers: [],
        unassignedProcesses: [],
      });
    } catch (err) {
      console.error('Error copying yesterday:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ONE-TAP AUTO SETUP 2: Copy from specific date
  const handleCopyFromSpecificDate = async () => {
    if (!copySourceDate) return;
    setIsLoading(true);
    try {
      const cloned = await dataService.copyAssignmentsFromDate(copySourceDate, selectedDate);
      const updated = await dataService.getDailyAssignments(selectedDate);
      setAssignments(updated);
      setShowCopyDateModal(false);

      setDraftReview({
        draft: cloned,
        skippedWorkers: [],
        unassignedProcesses: [],
      });
    } catch (err) {
      console.error('Error copying date:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ONE-TAP AUTO SETUP 3: Auto Assign from 30-day History
  const handleAutoAssignHistory = async () => {
    if (selectedStyleIds.length === 0) return;
    setIsLoading(true);
    try {
      const res = await dataService.autoAssignFromHistory(selectedStyleIds, selectedDate);
      setDraftReview(res);
    } catch (err) {
      console.error('Error generating history auto setup:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDraftAssignments = async () => {
    if (!draftReview || draftReview.draft.length === 0) return;
    setIsLoading(true);
    try {
      const itemsToSave = draftReview.draft.map(item => {
        const proc = processes.find(p => p.id === item.process_id);
        return {
          work_date: selectedDate,
          style_id: item.style_id || proc?.style_id,
          process_id: item.process_id,
          worker_id: item.worker_id,
          target_qty: item.target_qty,
          agreed_rate: item.agreed_rate,
          status: 'planned',
        };
      });

      await dataService.saveDailyAssignmentsBulk(itemsToSave);
      const updated = await dataService.getDailyAssignments(selectedDate);
      setAssignments(updated);
      setDraftReview(null);
    } catch (err) {
      console.error('Error saving draft setup:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Propose Rate submit
  const handleSubmitRateBid = async () => {
    if (!proposeRateModal) return;
    try {
      await dataService.createRateBid({
        worker_id: proposeRateModal.workerId,
        process_id: proposeRateModal.processId,
        current_rate: proposeRateModal.currentRate,
        proposed_rate: proposeRateModal.proposedRate,
        reason: proposeRateModal.reason,
      });
      setProposeRateModal(null);
      alert('Rate bid submitted successfully! Manager approval pending.');
    } catch (err) {
      console.error('Error submitting rate bid:', err);
    }
  };

  // Calculate Summary metrics
  const totalAssignedWorkersCount = new Set(assignments.map(a => a.worker_id)).size;
  const totalProcessesCovered = new Set(assignments.map(a => a.process_id)).size;
  
  const pieceRateAssignments = assignments.filter(a => {
    const w = workers.find(work => work.id === a.worker_id);
    return !w || w.pay_type !== 'monthly_salary';
  });
  const salariedAssignmentsCount = new Set(assignments.filter(a => {
    const w = workers.find(work => work.id === a.worker_id);
    return w?.pay_type === 'monthly_salary';
  }).map(a => a.worker_id)).size;

  const estimatedPieceWageCost = pieceRateAssignments.reduce((sum, a) => sum + ((a.target_qty || 0) * a.agreed_rate), 0);

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER & DATE SELECTOR */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
              <Layers className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-stone-900">Daily Line Setup</h1>
          </div>
          <p className="text-stone-600 text-sm mt-1">
            Assign operations to workers before production begins. Rate exceptions apply automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-stone-50 px-3 py-2 rounded-xl border border-stone-200">
            <Calendar className="w-4 h-4 text-amber-700" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-stone-900 font-semibold text-sm outline-none focus:ring-0 cursor-pointer"
            />
          </div>

          <button
            onClick={() => exportDailyPlanExcel(selectedDate)}
            className="flex items-center space-x-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-xs"
            title="Download morning Daily Production Plan (A4 printable paper backup)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Download Daily Plan</span>
          </button>

          <button
            onClick={() => exportDailyReportExcel(selectedDate)}
            className="flex items-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-xs"
            title="Download end-of-day Daily Production Report Excel workbook"
          >
            <Download className="w-4 h-4 text-indigo-700" />
            <span>Download Daily Report</span>
          </button>
        </div>
      </div>

      {/* AUTO SETUP CONTROLS BAR */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
        <div className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
          <Sparkles className="w-4 h-4 text-amber-700" />
          <span>One-Tap Auto Setup Options</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleCopyYesterday}
            disabled={isLoading}
            className="flex items-center justify-center space-x-2 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 px-4 py-3 rounded-xl transition font-medium text-sm shadow-xs"
          >
            <Copy className="w-4 h-4 text-amber-700" />
            <span>Copy Yesterday's Setup</span>
          </button>

          <button
            onClick={() => setShowCopyDateModal(true)}
            disabled={isLoading}
            className="flex items-center justify-center space-x-2 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 px-4 py-3 rounded-xl transition font-medium text-sm shadow-xs"
          >
            <Calendar className="w-4 h-4 text-indigo-700" />
            <span>Copy from Specific Date</span>
          </button>

          <button
            onClick={handleAutoAssignHistory}
            disabled={isLoading || selectedStyleIds.length === 0}
            className="flex items-center justify-center space-x-2 bg-indigo-700 hover:bg-indigo-800 text-white font-medium px-4 py-3 rounded-xl transition text-sm shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Auto-Assign from History</span>
          </button>
        </div>
      </div>

      {/* STYLE SELECTION TABS */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <span className="text-xs font-semibold text-stone-600 uppercase tracking-wider">
            Active Styles Running Today
          </span>
          <div className="flex items-center space-x-3 text-xs">
            <span className="text-stone-500 hidden sm:inline">
              Select one or multiple styles to configure processes
            </span>
            <button
              onClick={() => {
                const selectable = styles.filter(s => isStyleUnlockedForSewing(s, cuttingEntries));
                setSelectedStyleIds(selectable.map(s => s.id));
              }}
              className="text-indigo-700 hover:text-indigo-800 font-semibold transition"
            >
              Select All Ready
            </button>
            <span className="text-stone-300">|</span>
            <button
              onClick={() => setSelectedStyleIds([])}
              className="text-stone-500 hover:text-stone-800 font-semibold transition"
            >
              Clear
            </button>
          </div>
        </div>

        {styles.length === 0 ? (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-center text-stone-600 text-xs">
            No active styles found. Create styles in <span className="text-amber-800 font-semibold">Styles & Processes</span> to configure operations.
          </div>
        ) : (() => {
          const selectableStyles = styles.filter(s => isStyleUnlockedForSewing(s, cuttingEntries));
          const awaitingCuttingStyles = styles.filter(s => !isStyleUnlockedForSewing(s, cuttingEntries));

          return (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {selectableStyles.map(style => {
                  const isSelected = selectedStyleIds.includes(style.id);
                  const avail = getStyleSewingAvailability(style, cuttingEntries, processes, productionEntries);
                  const figureLabel = avail.requiresCutting
                    ? `${avail.bulkCutTotal.toLocaleString()} cut / ${avail.totalSewn.toLocaleString()} sewn / ${avail.availableToSew.toLocaleString()} available`
                    : `${(style.order_qty || 0).toLocaleString()} order / ${avail.totalSewn.toLocaleString()} sewn / ${avail.availableToSew.toLocaleString()} available`;

                  return (
                    <button
                      key={style.id}
                      onClick={() => handleToggleStyle(style.id)}
                      className={`flex flex-col items-start px-3.5 py-2 rounded-xl text-xs border transition-all ${
                        isSelected
                          ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold shadow-xs'
                          : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-sm">{style.style_code}</span>
                        <span className="text-[11px] opacity-80">({style.name})</span>
                      </div>
                      <span className="text-[10px] opacity-90 mt-0.5 font-mono">
                        {figureLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* MUTED SECTION: AWAITING CUTTING */}
              {awaitingCuttingStyles.length > 0 && (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-2 mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1.5 font-semibold text-stone-600">
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      <span>Awaiting cutting ({awaitingCuttingStyles.length})</span>
                    </div>
                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('cutting')}
                        className="text-xs text-indigo-700 hover:text-indigo-800 font-bold flex items-center space-x-1 transition"
                      >
                        <span>Go to Cutting Screen</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {awaitingCuttingStyles.map(st => (
                      <div key={st.id} className="bg-stone-200/70 border border-stone-300 text-stone-700 px-3 py-1.5 rounded-lg flex items-center space-x-2 text-xs">
                        <Scissors className="w-3.5 h-3.5 text-stone-600" />
                        <span className="font-bold">{st.style_code}</span>
                        <span className="text-stone-600">({st.name})</span>
                        <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-medium">0 pcs cut</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* SUMMARY BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center space-x-4 shadow-xs">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-stone-600 font-medium">Workers Assigned Today</div>
            <div className="text-2xl font-bold text-stone-900">{totalAssignedWorkersCount}</div>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center space-x-4 shadow-xs">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-stone-600 font-medium">Processes Covered</div>
            <div className="text-2xl font-bold text-stone-900">{totalProcessesCovered}</div>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center space-x-4 shadow-xs">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-stone-600 font-medium">Est. Piece Target Wage Cost</div>
            <div className="text-xl font-bold text-amber-800">
              {settings?.currency_symbol || 'MYR'}{estimatedPieceWageCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              {salariedAssignmentsCount > 0 && (
                <span className="text-[11px] font-normal text-stone-500 block">
                  ({salariedAssignmentsCount} salaried worker{salariedAssignmentsCount > 1 ? 's' : ''} assigned)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN ASSIGNMENT PROCESS LIST PER SELECTED STYLE */}
      {selectedStyleIds.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center text-stone-500 shadow-xs">
          Select at least one style above to configure today's daily line assignments.
        </div>
      ) : (
        selectedStyleIds.map(styleId => {
          const style = styles.find(s => s.id === styleId);
          if (!style) return null;

          const styleProcesses = processes
            .filter(p => p.style_id === styleId)
            .sort((a, b) => a.seq_no - b.seq_no);

          const avail = getStyleSewingAvailability(style, cuttingEntries, processes, productionEntries);
          const styleAssignments = assignments.filter(a => a.style_id === styleId);
          const maxTarget = styleAssignments.length > 0 ? Math.max(...styleAssignments.map(a => Number(a.target_qty || 0))) : 0;
          const totalTarget = styleAssignments.reduce((sum, a) => sum + Number(a.target_qty || 0), 0);
          const targetVal = maxTarget > 0 ? maxTarget : totalTarget;
          const isTargetExceeding = styleAssignments.length > 0 && targetVal > avail.availableToSew;

          return (
            <div key={styleId} className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-stone-200 pb-3 flex-wrap gap-2">
                <div>
                  <div className="text-lg font-bold text-stone-900 flex items-center space-x-2">
                    <span className="text-amber-800">{style.style_code}</span>
                    <span className="text-stone-600 text-sm font-normal">— {style.name}</span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Sequence order processes for this style
                  </p>
                </div>

                <div className="text-xs font-mono font-semibold text-stone-700 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200">
                  {avail.requiresCutting
                    ? `${avail.bulkCutTotal.toLocaleString()} cut / ${avail.totalSewn.toLocaleString()} sewn / ${avail.availableToSew.toLocaleString()} available`
                    : `${(style.order_qty || 0).toLocaleString()} order / ${avail.totalSewn.toLocaleString()} sewn / ${avail.availableToSew.toLocaleString()} available`}
                </div>
              </div>

              {/* TARGET WARNING IF TARGETS EXCEED AVAILABLE PIECES */}
              {isTargetExceeding && (
                <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-3 flex items-center space-x-2 text-xs font-medium">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Only <strong>{avail.availableToSew}</strong> pieces are cut and unsewn — targets total <strong>{targetVal}</strong>.
                  </span>
                </div>
              )}

              {/* PROCESSES SEQUENCE */}
              <div className="space-y-4">
                {styleProcesses.length === 0 ? (
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-8 text-center text-stone-600 text-xs">
                    No operations/processes defined for <span className="text-amber-800 font-semibold">{style.style_code} ({style.name})</span> yet. Go to <span className="font-semibold text-stone-900">Styles & Processes</span> screen to add operations.
                  </div>
                ) : (
                  styleProcesses.map(proc => {
                  const procAssignments = assignments.filter(a => a.process_id === proc.id && a.style_id === styleId);
                  const isGap = procAssignments.length === 0;

                  return (
                    <div 
                      key={proc.id} 
                      className={`border rounded-xl p-4 transition-all ${
                        isGap 
                          ? 'border-amber-300 bg-amber-50/50' 
                          : 'border-stone-200 bg-stone-50'
                      }`}
                    >
                      {/* PROCESS HEADER & gap warning */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="w-7 h-7 rounded-lg bg-stone-200 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0">
                            #{proc.seq_no}
                          </span>
                          <div>
                            <div className="text-base font-semibold text-stone-900 flex items-center space-x-2">
                              <span>{proc.name}</span>
                              <span className="text-xs text-stone-600 bg-stone-200 px-2 py-0.5 rounded-md font-mono">
                                Standard Rate: {settings?.currency_symbol || 'MYR'}{(proc.rate || 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="text-xs text-stone-500">
                              Machine: {proc.machine_type || 'Standard Sewing'} • SMV: {proc.smv || '1.0'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {isGap && (
                            <div className="flex items-center space-x-1 text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300 text-xs font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Line Gap: No Worker Assigned</span>
                            </div>
                          )}

                          <button
                            onClick={() => setAssigningProcess({ styleId: proc.style_id || styleId, processId: proc.id, processName: proc.name })}
                            className="flex items-center space-x-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Assign Worker</span>
                          </button>
                        </div>
                      </div>

                      {/* ASSIGNED WORKERS LIST FOR THIS PROCESS */}
                      {procAssignments.length > 0 ? (
                        <div className="space-y-2 mt-2 pt-2 border-t border-stone-200">
                          {procAssignments.map(assign => {
                            const worker = workers.find(w => w.id === assign.worker_id);
                            const processCount = workerAssignmentCounts.get(assign.worker_id) || 1;
                            const isRateBidded = assign.agreed_rate !== proc.rate;

                            return (
                              <div 
                                key={assign.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 rounded-xl border border-stone-200 gap-3"
                              >
                                {/* WORKER INFO */}
                                <div className="flex items-center space-x-3">
                                  <WorkerAvatar
                                    photoUrl={assign.worker_photo}
                                    name={assign.worker_name || 'Worker'}
                                    size="lg"
                                    className="rounded-full shrink-0"
                                  />

                                  <div>
                                    <div className="text-sm font-semibold text-stone-900 flex items-center space-x-2">
                                      <span>{assign.worker_name}</span>
                                      <span className="text-xs text-stone-500 font-mono">({assign.worker_code})</span>

                                      {/* OVERLOAD BADGE */}
                                      {processCount > 1 && (
                                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] px-2 py-0.5 rounded-full font-medium" title="Assigned to multiple processes today">
                                          ⚡ {processCount} processes today
                                        </span>
                                      )}
                                    </div>

                                    {/* AGREED RATE BADGE */}
                                    <div className="text-xs text-stone-600 mt-0.5 flex items-center space-x-2">
                                      {worker?.pay_type === 'monthly_salary' ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                                          Monthly Salaried ({settings?.currency_symbol || 'MYR'}{(worker.monthly_salary || 0).toLocaleString()}/mo)
                                        </span>
                                      ) : (
                                        <>
                                          <span>Agreed Rate:</span>
                                          <span className={`font-semibold ${isRateBidded ? 'text-amber-800' : 'text-stone-900'}`}>
                                            {settings?.currency_symbol || 'MYR'}{(assign.agreed_rate || 0).toFixed(2)}
                                          </span>
                                          {isRateBidded && (
                                            <span 
                                              className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded"
                                              title={`Standard process rate is ${settings?.currency_symbol || 'MYR'}${(proc.rate || 0).toFixed(2)}`}
                                            >
                                              Rate Bidded
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* EDITABLE TARGET & ACTIONS */}
                                <div className="flex items-center space-x-3 justify-end">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-stone-600 font-medium">Target Qty:</span>
                                    <input
                                      type="number"
                                      value={assign.target_qty || ''}
                                      onChange={(e) => handleTargetQtyChange(assign.id, Number(e.target.value))}
                                      onBlur={(e) => handleTargetQtyBlur(assign.id, Number(e.target.value))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          (e.target as HTMLInputElement).blur();
                                        }
                                      }}
                                      className="w-20 bg-stone-50 border border-stone-300 text-stone-900 rounded-lg px-2 py-1 text-xs text-center font-bold focus:border-indigo-600 outline-none"
                                      placeholder="250"
                                    />
                                  </div>

                                  {/* PROPOSE RATE BUTTON */}
                                  <button
                                    onClick={() => setProposeRateModal({
                                      workerId: assign.worker_id,
                                      workerName: assign.worker_name || 'Worker',
                                      processId: proc.id,
                                      processName: proc.name,
                                      currentRate: proc.rate,
                                      proposedRate: assign.agreed_rate,
                                      reason: '',
                                    })}
                                    className="p-1.5 text-stone-500 hover:text-amber-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition"
                                    title="Propose Rate Bid on behalf of worker"
                                  >
                                    <DollarSign className="w-4 h-4" />
                                  </button>

                                  {/* DELETE ASSIGNMENT */}
                                  <button
                                    onClick={() => handleDeleteAssignment(assign.id)}
                                    className="p-1.5 text-stone-500 hover:text-rose-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition"
                                    title="Remove assignment"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-stone-500 italic py-2">
                          No worker assigned to this operation yet. Click "Assign Worker" above.
                        </div>
                      )}
                    </div>
                  );
                }))}
              </div>
            </div>
          );
        })
      )}

      {/* MODAL: COPY FROM SPECIFIC DATE */}
      {showCopyDateModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-stone-200 pb-3">
              <h3 className="text-lg font-bold text-stone-900 flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-indigo-700" />
                <span>Copy Line Setup from Date</span>
              </h3>
              <button 
                onClick={() => setShowCopyDateModal(false)}
                className="text-stone-500 hover:text-stone-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-stone-600 text-sm">
              Select a past date to clone all style process worker assignments directly onto <span className="text-amber-800 font-semibold">{selectedDate}</span>.
            </p>

            <div>
              <label className="text-xs font-semibold text-stone-600 uppercase tracking-wider block mb-2">
                Source Date
              </label>
              <input
                type="date"
                value={copySourceDate}
                onChange={(e) => setCopySourceDate(e.target.value)}
                className="w-full bg-white border border-stone-300 text-stone-900 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-600"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-3">
              <button
                onClick={() => setShowCopyDateModal(false)}
                className="px-4 py-2 bg-stone-100 text-stone-800 rounded-xl text-sm font-medium hover:bg-stone-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCopyFromSpecificDate}
                disabled={!copySourceDate}
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-sm font-medium transition shadow-xs disabled:opacity-50"
              >
                Clone Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN WORKER TO PROCESS */}
      {assigningProcess && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Assign Worker</h3>
                <p className="text-xs text-amber-800 font-semibold">{assigningProcess.processName}</p>
              </div>
              <button 
                onClick={() => setAssigningProcess(null)}
                className="text-stone-500 hover:text-stone-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                value={workerSearchTerm}
                onChange={(e) => setWorkerSearchTerm(e.target.value)}
                placeholder="Search worker name or code..."
                className="w-full bg-white border border-stone-300 text-stone-900 pl-9 pr-3 py-2 rounded-xl text-sm outline-none focus:border-indigo-600"
              />
            </div>

            {/* Worker List */}
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {workers
                .filter(w => w.full_name.toLowerCase().includes(workerSearchTerm.toLowerCase()) || w.worker_code.toLowerCase().includes(workerSearchTerm.toLowerCase()))
                .map(worker => {
                  const assignedCount = workerAssignmentCounts.get(worker.id) || 0;
                  return (
                    <div
                      key={worker.id}
                      onClick={async () => {
                        await handleAssignWorkerToProcess(worker.id);
                        setAssigningProcess(null);
                      }}
                      className="flex items-center justify-between bg-stone-50 hover:bg-stone-100 p-3 rounded-xl border border-stone-200 cursor-pointer transition"
                    >
                      <div className="flex items-center space-x-3">
                        <WorkerAvatar
                          photoUrl={worker.photo_url}
                          name={worker.full_name}
                          size="md"
                          className="rounded-full shrink-0"
                        />
                        <div>
                          <div className="text-sm font-semibold text-stone-900">{worker.full_name}</div>
                          <div className="text-xs text-stone-600">{worker.worker_code} • {worker.section || 'Sewing'}</div>
                        </div>
                      </div>

                      {assignedCount > 0 && (
                        <span className="text-[11px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-medium border border-amber-300">
                          Assigned to {assignedCount} processes today
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DIFF REVIEW DRAFT AUTO SETUP */}
      {draftReview && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-stone-200 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-700" />
                <h3 className="text-lg font-bold text-stone-900">Review Auto-Generated Setup</h3>
              </div>
              <button 
                onClick={() => setDraftReview(null)}
                className="text-stone-500 hover:text-stone-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 flex-1 pr-1">
              {/* CREATED ASSIGNMENTS COUNT */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center space-x-3 text-emerald-900 text-sm font-medium">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-700" />
                <span>
                  Generated <strong className="text-stone-900">{draftReview.draft.length}</strong> process assignments based on top output history.
                </span>
              </div>

              {/* SKIPPED ABSENT WORKERS */}
              {draftReview.skippedWorkers.length > 0 && (
                <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200 space-y-1">
                  <div className="text-xs font-semibold text-rose-700 uppercase tracking-wider flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Unavailable Today (Marked Absent)</span>
                  </div>
                  <div className="text-xs text-stone-700">
                    {draftReview.skippedWorkers.join(', ')}
                  </div>
                </div>
              )}

              {/* UNASSIGNED PROCESSES */}
              {draftReview.unassignedProcesses.length > 0 && (
                <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200 space-y-1">
                  <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <Info className="w-3.5 h-3.5" />
                    <span>Uncovered Processes (Line Gaps)</span>
                  </div>
                  <div className="text-xs text-stone-700">
                    {draftReview.unassignedProcesses.join(', ')}
                  </div>
                </div>
              )}

              {/* DRAFT ITEMS TABLE */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold text-stone-600 uppercase tracking-wider">
                  Draft Line Assignments
                </div>
                {draftReview.draft.map((item, idx) => {
                  const w = workers.find(work => work.id === item.worker_id);
                  const p = processes.find(proc => proc.id === item.process_id);
                  return (
                    <div key={idx} className="flex justify-between items-center bg-stone-50 p-2.5 rounded-lg text-xs border border-stone-200">
                      <div className="text-stone-900 font-medium">
                        {p?.name} → <span className="text-amber-800">{w?.full_name}</span>
                      </div>
                      <div className="text-stone-600 font-mono">
                        {settings?.currency_symbol || 'MYR'}{(item.agreed_rate || 0).toFixed(2)}/pc
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-stone-200">
              <button
                onClick={() => setDraftReview(null)}
                className="px-4 py-2 bg-stone-100 text-stone-800 rounded-xl text-sm font-medium hover:bg-stone-200 transition"
              >
                Discard
              </button>
              <button
                onClick={handleConfirmDraftAssignments}
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-sm font-medium transition shadow-xs flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Apply Setup</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PROPOSE RATE BID */}
      {proposeRateModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-stone-200 pb-3">
              <h3 className="text-lg font-bold text-stone-900 flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-amber-700" />
                <span>Propose Rate Bid</span>
              </h3>
              <button 
                onClick={() => setProposeRateModal(null)}
                className="text-stone-500 hover:text-stone-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs space-y-1">
              <div className="text-stone-600">Worker: <strong className="text-stone-900">{proposeRateModal.workerName}</strong></div>
              <div className="text-stone-600">Operation: <strong className="text-stone-900">{proposeRateModal.processName}</strong></div>
              <div className="text-stone-600">Standard Rate: <strong className="text-emerald-800">{settings?.currency_symbol || 'MYR'}{(proposeRateModal.currentRate || 0).toFixed(2)}</strong></div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 uppercase tracking-wider block mb-1">
                Proposed Piece Rate ({settings?.currency_symbol || 'MYR'})
              </label>
              <input
                type="number"
                step="0.10"
                value={proposeRateModal.proposedRate}
                onChange={(e) => setProposeRateModal({ ...proposeRateModal, proposedRate: Number(e.target.value) })}
                className="w-full bg-white border border-stone-300 text-stone-900 font-bold rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 uppercase tracking-wider block mb-1">
                Reason / Technical Justification
              </label>
              <textarea
                value={proposeRateModal.reason}
                onChange={(e) => setProposeRateModal({ ...proposeRateModal, reason: e.target.value })}
                rows={3}
                placeholder="e.g. Tough thick fabric requiring double stitching..."
                className="w-full bg-white border border-stone-300 text-stone-900 rounded-xl p-3 text-xs outline-none focus:border-indigo-600"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setProposeRateModal(null)}
                className="px-4 py-2 bg-stone-100 text-stone-800 rounded-xl text-sm font-medium hover:bg-stone-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRateBid}
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl text-sm transition shadow-xs"
              >
                Submit Bid for Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
