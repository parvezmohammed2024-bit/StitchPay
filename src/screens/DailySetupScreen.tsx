import React, { useState, useEffect } from 'react';
import { 
  Calendar, Copy, Sparkles, AlertTriangle, Users, Layers, 
  DollarSign, Plus, Trash2, CheckCircle2, RefreshCw, X, Eye, ArrowRight,
  TrendingUp, UserCheck, Search, Info, FileSpreadsheet, Download
} from 'lucide-react';
import { dataService, getLocalDateString } from '../lib/dataService';
import { exportDailyPlanExcel, exportDailyReportExcel } from '../lib/excelExport';
import { DailyAssignment, GarmentStyle, GarmentProcess, Worker, FactorySettings, UserRole } from '../types';
import { WorkerAvatar } from '../components/WorkerAvatar';

interface DailySetupScreenProps {
  role?: UserRole;
  onProposeRate?: (workerId: string, processId: string, currentRate: number) => void;
}

export const DailySetupScreen: React.FC<DailySetupScreenProps> = ({ role, onProposeRate }) => {
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [processes, setProcesses] = useState<GarmentProcess[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [assignments, setAssignments] = useState<DailyAssignment[]>([]);
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
      const [allStyles, allProcesses, allWorkers, dailyList, setts] = await Promise.all([
        dataService.getStyles(),
        dataService.getProcesses(),
        dataService.getWorkers(),
        dataService.getDailyAssignments(selectedDate),
        dataService.getSettings(),
      ]);

      const activeStyles = allStyles.filter(s => !s.status || s.status.toLowerCase() === 'active');
      const activeProcesses = allProcesses.filter(p => p.is_active === undefined || p.is_active === true);
      const activeWorkers = allWorkers.filter(w => !w.status || w.status.toLowerCase() === 'active');

      setStyles(activeStyles);
      setProcesses(activeProcesses);
      setWorkers(activeWorkers);
      setAssignments(dailyList);
      setSettings(setts);

      // Auto-select all active styles so new styles and all operation lines are immediately visible for assigning workers
      if (activeStyles.length > 0) {
        setSelectedStyleIds(activeStyles.map(s => s.id));
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
  const estimatedWageCost = assignments.reduce((sum, a) => sum + ((a.target_qty || 0) * a.agreed_rate), 0);

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER & DATE SELECTOR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Layers className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-white">Daily Line Setup</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Assign operations to workers before production begins. Rate exceptions apply automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-700/60">
            <Calendar className="w-4 h-4 text-amber-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white font-semibold text-sm outline-none focus:ring-0 cursor-pointer"
            />
          </div>

          <button
            onClick={() => exportDailyPlanExcel(selectedDate)}
            className="flex items-center space-x-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-sm"
            title="Download morning Daily Production Plan (A4 printable paper backup)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Download Daily Plan</span>
          </button>

          <button
            onClick={() => exportDailyReportExcel(selectedDate)}
            className="flex items-center space-x-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-sm"
            title="Download end-of-day Daily Production Report Excel workbook"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>Download Daily Report</span>
          </button>
        </div>
      </div>

      {/* AUTO SETUP CONTROLS BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>One-Tap Auto Setup Options</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleCopyYesterday}
            disabled={isLoading}
            className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 px-4 py-3 rounded-xl transition font-medium text-sm shadow-sm"
          >
            <Copy className="w-4 h-4 text-amber-400" />
            <span>Copy Yesterday's Setup</span>
          </button>

          <button
            onClick={() => setShowCopyDateModal(true)}
            disabled={isLoading}
            className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 px-4 py-3 rounded-xl transition font-medium text-sm shadow-sm"
          >
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>Copy from Specific Date</span>
          </button>

          <button
            onClick={handleAutoAssignHistory}
            disabled={isLoading || selectedStyleIds.length === 0}
            className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-3 rounded-xl transition text-sm shadow-md shadow-indigo-600/30"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Auto-Assign from History</span>
          </button>
        </div>
      </div>

      {/* STYLE SELECTION TABS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Active Styles Running Today
          </span>
          <div className="flex items-center space-x-3 text-xs">
            <span className="text-slate-500 hidden sm:inline">
              Select one or multiple styles to configure processes
            </span>
            <button
              onClick={() => setSelectedStyleIds(styles.map(s => s.id))}
              className="text-indigo-400 hover:text-indigo-300 font-semibold transition"
            >
              Select All
            </button>
            <span className="text-slate-700">|</span>
            <button
              onClick={() => setSelectedStyleIds([])}
              className="text-slate-400 hover:text-slate-300 font-semibold transition"
            >
              Clear
            </button>
          </div>
        </div>

        {styles.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 text-center text-slate-400 text-xs">
            No active styles found. Create styles in <span className="text-amber-400 font-semibold">Styles & Processes</span> to configure operations.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {styles.map(style => {
              const isSelected = selectedStyleIds.includes(style.id);
              return (
                <button
                  key={style.id}
                  onClick={() => handleToggleStyle(style.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  <span className="font-bold">{style.style_code}</span>
                  <span className="text-xs opacity-75">({style.name})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* SUMMARY BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Workers Assigned Today</div>
            <div className="text-2xl font-bold text-white">{totalAssignedWorkersCount}</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Processes Covered</div>
            <div className="text-2xl font-bold text-white">{totalProcessesCovered}</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Est. Target Wage Cost</div>
            <div className="text-2xl font-bold text-amber-400">
              {settings?.currency_symbol || '৳'}{estimatedWageCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN ASSIGNMENT PROCESS LIST PER SELECTED STYLE */}
      {selectedStyleIds.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          Select at least one style above to configure today's daily line assignments.
        </div>
      ) : (
        selectedStyleIds.map(styleId => {
          const style = styles.find(s => s.id === styleId);
          if (!style) return null;

          const styleProcesses = processes
            .filter(p => p.style_id === styleId)
            .sort((a, b) => a.seq_no - b.seq_no);

          return (
            <div key={styleId} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <div className="text-lg font-bold text-white flex items-center space-x-2">
                    <span className="text-amber-400">{style.style_code}</span>
                    <span className="text-slate-400 text-sm font-normal">— {style.name}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Sequence order processes for this style
                  </p>
                </div>
              </div>

              {/* PROCESSES SEQUENCE */}
              <div className="space-y-4">
                {styleProcesses.length === 0 ? (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
                    No operations/processes defined for <span className="text-amber-400 font-semibold">{style.style_code} ({style.name})</span> yet. Go to <span className="font-semibold text-white">Styles & Processes</span> screen to add operations.
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
                          ? 'border-amber-500/40 bg-amber-500/5' 
                          : 'border-slate-800 bg-slate-950/60'
                      }`}
                    >
                      {/* PROCESS HEADER & gap warning */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="w-7 h-7 rounded-lg bg-slate-800 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0">
                            #{proc.seq_no}
                          </span>
                          <div>
                            <div className="text-base font-semibold text-white flex items-center space-x-2">
                              <span>{proc.name}</span>
                              <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md font-mono">
                                Standard Rate: {settings?.currency_symbol || '৳'}{proc.rate.toFixed(2)}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500">
                              Machine: {proc.machine_type || 'Standard Sewing'} • SMV: {proc.smv || '1.0'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {isGap && (
                            <div className="flex items-center space-x-1 text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30 text-xs font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Line Gap: No Worker Assigned</span>
                            </div>
                          )}

                          <button
                            onClick={() => setAssigningProcess({ styleId: proc.style_id || styleId, processId: proc.id, processName: proc.name })}
                            className="flex items-center space-x-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Assign Worker</span>
                          </button>
                        </div>
                      </div>

                      {/* ASSIGNED WORKERS LIST FOR THIS PROCESS */}
                      {procAssignments.length > 0 ? (
                        <div className="space-y-2 mt-2 pt-2 border-t border-slate-800/80">
                          {procAssignments.map(assign => {
                            const worker = workers.find(w => w.id === assign.worker_id);
                            const processCount = workerAssignmentCounts.get(assign.worker_id) || 1;
                            const isRateBidded = assign.agreed_rate !== proc.rate;

                            return (
                              <div 
                                key={assign.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800 gap-3"
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
                                    <div className="text-sm font-semibold text-white flex items-center space-x-2">
                                      <span>{assign.worker_name}</span>
                                      <span className="text-xs text-slate-400 font-mono">({assign.worker_code})</span>

                                      {/* OVERLOAD BADGE */}
                                      {processCount > 1 && (
                                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded-full font-medium" title="Assigned to multiple processes today">
                                          ⚡ {processCount} processes today
                                        </span>
                                      )}
                                    </div>

                                    {/* AGREED RATE BADGE */}
                                    <div className="text-xs text-slate-400 mt-0.5 flex items-center space-x-2">
                                      <span>Agreed Rate:</span>
                                      <span className={`font-semibold ${isRateBidded ? 'text-amber-400' : 'text-slate-200'}`}>
                                        {settings?.currency_symbol || '৳'}{assign.agreed_rate.toFixed(2)}
                                      </span>
                                      {isRateBidded && (
                                        <span 
                                          className="text-[10px] bg-amber-400/10 text-amber-300 border border-amber-400/30 px-1.5 py-0.2 rounded"
                                          title={`Standard process rate is ${settings?.currency_symbol || '৳'}${proc.rate.toFixed(2)}`}
                                        >
                                          Rate Bidded
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* EDITABLE TARGET & ACTIONS */}
                                <div className="flex items-center space-x-3 justify-end">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-slate-400 font-medium">Target Qty:</span>
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
                                      className="w-20 bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs text-center font-bold focus:border-indigo-500 outline-none"
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
                                    className="p-1.5 text-slate-400 hover:text-amber-400 bg-slate-800 hover:bg-slate-750 rounded-lg transition"
                                    title="Propose Rate Bid on behalf of worker"
                                  >
                                    <DollarSign className="w-4 h-4" />
                                  </button>

                                  {/* DELETE ASSIGNMENT */}
                                  <button
                                    onClick={() => handleDeleteAssignment(assign.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-slate-750 rounded-lg transition"
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
                        <div className="text-xs text-slate-500 italic py-2">
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <span>Copy Line Setup from Date</span>
              </h3>
              <button 
                onClick={() => setShowCopyDateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-300 text-sm">
              Select a past date to clone all style process worker assignments directly onto <span className="text-amber-400 font-semibold">{selectedDate}</span>.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Source Date
              </label>
              <input
                type="date"
                value={copySourceDate}
                onChange={(e) => setCopySourceDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-3">
              <button
                onClick={() => setShowCopyDateModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCopyFromSpecificDate}
                disabled={!copySourceDate}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition shadow-md shadow-indigo-600/30 disabled:opacity-50"
              >
                Clone Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN WORKER TO PROCESS */}
      {assigningProcess && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Assign Worker</h3>
                <p className="text-xs text-amber-400 font-semibold">{assigningProcess.processName}</p>
              </div>
              <button 
                onClick={() => setAssigningProcess(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={workerSearchTerm}
                onChange={(e) => setWorkerSearchTerm(e.target.value)}
                placeholder="Search worker name or code..."
                className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-3 py-2 rounded-xl text-sm outline-none focus:border-indigo-500"
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
                      className="flex items-center justify-between bg-slate-800/80 hover:bg-slate-800 p-3 rounded-xl border border-slate-700/60 cursor-pointer transition"
                    >
                      <div className="flex items-center space-x-3">
                        <WorkerAvatar
                          photoUrl={worker.photo_url}
                          name={worker.full_name}
                          size="md"
                          className="rounded-full shrink-0"
                        />
                        <div>
                          <div className="text-sm font-semibold text-white">{worker.full_name}</div>
                          <div className="text-xs text-slate-400">{worker.worker_code} • {worker.section || 'Sewing'}</div>
                        </div>
                      </div>

                      {assignedCount > 0 && (
                        <span className="text-[11px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-md font-medium border border-amber-500/20">
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">Review Auto-Generated Setup</h3>
              </div>
              <button 
                onClick={() => setDraftReview(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 flex-1 pr-1">
              {/* CREATED ASSIGNMENTS COUNT */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center space-x-3 text-emerald-300 text-sm font-medium">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                <span>
                  Generated <strong className="text-white">{draftReview.draft.length}</strong> process assignments based on top output history.
                </span>
              </div>

              {/* SKIPPED ABSENT WORKERS */}
              {draftReview.skippedWorkers.length > 0 && (
                <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/80 space-y-1">
                  <div className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Unavailable Today (Marked Absent)</span>
                  </div>
                  <div className="text-xs text-slate-300">
                    {draftReview.skippedWorkers.join(', ')}
                  </div>
                </div>
              )}

              {/* UNASSIGNED PROCESSES */}
              {draftReview.unassignedProcesses.length > 0 && (
                <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/80 space-y-1">
                  <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Info className="w-3.5 h-3.5" />
                    <span>Uncovered Processes (Line Gaps)</span>
                  </div>
                  <div className="text-xs text-slate-300">
                    {draftReview.unassignedProcesses.join(', ')}
                  </div>
                </div>
              )}

              {/* DRAFT ITEMS TABLE */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Draft Line Assignments
                </div>
                {draftReview.draft.map((item, idx) => {
                  const w = workers.find(work => work.id === item.worker_id);
                  const p = processes.find(proc => proc.id === item.process_id);
                  return (
                    <div key={idx} className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg text-xs border border-slate-800">
                      <div className="text-white font-medium">
                        {p?.name} → <span className="text-amber-400">{w?.full_name}</span>
                      </div>
                      <div className="text-slate-400 font-mono">
                        {settings?.currency_symbol || '৳'}{item.agreed_rate.toFixed(2)}/pc
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setDraftReview(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700 transition"
              >
                Discard
              </button>
              <button
                onClick={handleConfirmDraftAssignments}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition shadow-md shadow-indigo-600/30 flex items-center space-x-1.5"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <span>Propose Rate Bid</span>
              </h3>
              <button 
                onClick={() => setProposeRateModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 text-xs space-y-1">
              <div className="text-slate-400">Worker: <strong className="text-white">{proposeRateModal.workerName}</strong></div>
              <div className="text-slate-400">Operation: <strong className="text-white">{proposeRateModal.processName}</strong></div>
              <div className="text-slate-400">Standard Rate: <strong className="text-emerald-400">{settings?.currency_symbol || '৳'}{proposeRateModal.currentRate.toFixed(2)}</strong></div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Proposed Piece Rate ({settings?.currency_symbol || '৳'})
              </label>
              <input
                type="number"
                step="0.10"
                value={proposeRateModal.proposedRate}
                onChange={(e) => setProposeRateModal({ ...proposeRateModal, proposedRate: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 text-white font-bold rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Reason / Technical Justification
              </label>
              <textarea
                value={proposeRateModal.reason}
                onChange={(e) => setProposeRateModal({ ...proposeRateModal, reason: e.target.value })}
                rows={3}
                placeholder="e.g. Tough thick fabric requiring double stitching..."
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setProposeRateModal(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRateBid}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition shadow-md shadow-amber-500/20"
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
