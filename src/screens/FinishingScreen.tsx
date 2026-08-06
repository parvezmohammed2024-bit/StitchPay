import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, Plus, Calendar, Download, AlertCircle, AlertTriangle, 
  CheckCircle2, RefreshCw, ArrowRight, ShieldAlert, Truck, Info,
  Search, X, User, ClipboardList, Check, HelpCircle
} from 'lucide-react';
import { dataService, getLocalDateString } from '../lib/dataService';
import { showErrorToast, showSuccessToast } from '../lib/toast';
import { 
  GarmentStyle, FinishingStage, FinishingEntry, Worker, 
  DeliveryReport, UserRole, FactorySettings, GarmentProcess, ProductionEntry, StyleSize, StyleSizeBreakdownRow 
} from '../types';
import { StyleImage } from '../components/StyleImage';
import { ViewEntriesModal } from '../components/ViewEntriesModal';

interface FinishingScreenProps {
  role: UserRole;
  onNavigate?: (screen: string) => void;
}

interface StageWipSummary {
  stage: FinishingStage;
  cumulativeQty: number;
  wipWaiting: number;
  isBottleneck: boolean;
  totalRework: number;
  totalReject: number;
}

interface StyleFinishingSummary {
  style: GarmentStyle;
  stages: FinishingStage[];
  stageSummaries: StageWipSummary[];
  receivedFromSewing: number;
  sewingCompletedQty: number;
  sewingWarning: boolean;
  readyToDeliverQty: number;
  readyTodayQty: number;
  totalDispatchedQty: number;
  remainingBalance: number;
  completionPercent: number;
  totalRework: number;
  totalReject: number;
  inReworkCount: number;
}

const FinishingSizeTable: React.FC<{ styleId: string }> = ({ styleId }) => {
  const [breakdown, setBreakdown] = useState<StyleSizeBreakdownRow[]>([]);

  useEffect(() => {
    let isMounted = true;
    dataService.getStyleSizeBreakdown(styleId).then(rows => {
      if (isMounted) setBreakdown(rows);
    });
    return () => { isMounted = false; };
  }, [styleId]);

  if (!breakdown || breakdown.length === 0) return null;

  return (
    <div className="bg-stone-50/80 border border-stone-200 rounded-2xl p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between border-b border-stone-200 pb-1.5">
        <span className="font-extrabold text-stone-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Ready to Deliver — Size Breakdown</span>
        </span>
        <span className="text-[10px] text-stone-500 font-medium">Size / Ordered / Ready / Balance</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {breakdown.map(sb => {
          const isOverReady = sb.ready_qty > sb.order_qty;
          return (
            <div 
              key={sb.size}
              className={`p-2 rounded-xl border flex flex-col justify-between font-mono text-xs ${
                isOverReady 
                  ? 'bg-amber-50 border-amber-300 text-amber-950 font-bold' 
                  : 'bg-white border-stone-200 text-stone-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-stone-900 bg-stone-100 border border-stone-300 rounded px-1.5 py-0.5 text-[11px]">
                  {sb.size}
                </span>
                <span className="text-[10px] text-stone-400">{sb.order_qty} ord</span>
              </div>
              <div className="flex items-center justify-between pt-1 text-[11px]">
                <span className="text-emerald-700 font-extrabold">{sb.ready_qty} ready</span>
                <span className={`text-[10px] font-black ${sb.ready_balance < 0 ? 'text-amber-800' : sb.ready_balance === 0 ? 'text-emerald-600' : 'text-stone-500'}`}>
                  {sb.ready_balance < 0 ? `+${Math.abs(sb.ready_balance)} over` : `${sb.ready_balance} bal`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const FinishingScreen: React.FC<FinishingScreenProps> = ({ role, onNavigate }) => {
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [allStages, setAllStages] = useState<FinishingStage[]>([]);
  const [allEntries, setAllEntries] = useState<FinishingEntry[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryReport[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);

  const finishingWorkers = useMemo(() => {
    const fw = workers.filter(w => w.section && w.section.toLowerCase().includes('finish'));
    return fw.length > 0 ? fw : workers;
  }, [workers]);

  const [sewingProcesses, setSewingProcesses] = useState<GarmentProcess[]>([]);
  const [sewingEntries, setSewingEntries] = useState<ProductionEntry[]>([]);
  const [settings, setSettings] = useState<FactorySettings | null>(null);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  
  // View Toggle State: OFF by default, remembered per user for session
  const [showStageDetail, setShowStageDetail] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('finishing_show_stage_detail') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [workerSelectedStageId, setWorkerSelectedStageId] = useState<Record<string, string>>({});

  const canToggleDetail = role === 'admin' || role === 'supervisor';

  // Daily Entry Form Modal State
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [entryFormStyleId, setEntryFormStyleId] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(getLocalDateString());
  const [entryShift, setEntryShift] = useState<'day' | 'night'>('day');
  const [entryNotes, setEntryNotes] = useState<string>('');
  const [stageInputs, setStageInputs] = useState<Record<string, { qty_ok: string; qty_rework: string; qty_reject: string; worker_id: string; size?: string }>>({});
  const [outOfSeqWarning, setOutOfSeqWarning] = useState<string | null>(null);
  const [confirmOutOfSeq, setConfirmOutOfSeq] = useState<boolean>(false);
  const [savingEntries, setSavingEntries] = useState<boolean>(false);

  // Quick Single Stage Log Modal State
  const [isQuickLogOpen, setIsQuickLogOpen] = useState<boolean>(false);
  const [quickLogStyle, setQuickLogStyle] = useState<GarmentStyle | null>(null);
  const [quickLogStage, setQuickLogStage] = useState<FinishingStage | null>(null);
  const [quickLogStageIdx, setQuickLogStageIdx] = useState<number>(0);
  const [quickLogPrevStageName, setQuickLogPrevStageName] = useState<string>('');
  const [quickLogPrevCumulative, setQuickLogPrevCumulative] = useState<number>(0);
  const [quickLogCurrentCumulative, setQuickLogCurrentCumulative] = useState<number>(0);
  const [quickLogWipWaiting, setQuickLogWipWaiting] = useState<number>(0);
  const [quickLogQtyOk, setQuickLogQtyOk] = useState<string>('');
  const [quickLogQtyRework, setQuickLogQtyRework] = useState<string>('0');
  const [quickLogQtyReject, setQuickLogQtyReject] = useState<string>('0');
  const [quickLogWorkerId, setQuickLogWorkerId] = useState<string>('');
  const [quickLogShift, setQuickLogShift] = useState<'day' | 'night'>('day');
  const [quickLogNotes, setQuickLogNotes] = useState<string>('');
  const [quickLogSizes, setQuickLogSizes] = useState<StyleSize[]>([]);
  const [quickLogSize, setQuickLogSize] = useState<string>('');
  const [quickLogConfirmExceed, setQuickLogConfirmExceed] = useState<boolean>(false);
  const [quickLogSaving, setQuickLogSaving] = useState<boolean>(false);

  // Dispatch / Delivery Modal State
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState<boolean>(false);
  const [dispatchStyleId, setDispatchStyleId] = useState<string>('');
  const [dispatchDate, setDispatchDate] = useState<string>(getLocalDateString());
  const [dispatchQty, setDispatchQty] = useState<string>('');
  const [dispatchVehicle, setDispatchVehicle] = useState<string>('');
  const [dispatchDriver, setDispatchDriver] = useState<string>('');
  const [dispatchDestination, setDispatchDestination] = useState<string>('');
  const [dispatchNotes, setDispatchNotes] = useState<string>('');
  const [savingDispatch, setSavingDispatch] = useState<boolean>(false);

  // View Entries Modal State (Admin Only)
  const [viewEntriesTarget, setViewEntriesTarget] = useState<{
    styleId: string;
    styleCode: string;
    styleName: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stList, stgList, entList, delList, wrkList, prodEntries, setRes, procList] = await Promise.all([
        dataService.getStyles(),
        dataService.getFinishingStages(),
        dataService.getFinishingEntries(),
        dataService.getDeliveries(),
        dataService.getWorkers(),
        dataService.getProductionEntries(),
        dataService.getSettings(),
        dataService.getProcesses(),
      ]);

      setStyles(stList);
      setAllStages(stgList);
      setAllEntries(entList);
      setDeliveries(delList);
      setWorkers(wrkList);
      setSewingEntries(prodEntries);
      setSettings(setRes);
      setSewingProcesses(procList);

      // Auto initialize default stages if any active style lacks stages
      const activeStyles = stList.filter(s => s.status === 'active' || s.status === 'upcoming');
      for (const style of activeStyles) {
        const existing = stgList.filter(s => s.style_id === style.id);
        if (existing.length === 0) {
          const created = await dataService.applyDefaultFinishingStages(style.id, true);
          stgList.push(...created);
        }
      }
      setAllStages([...stgList]);

      if (activeStyles.length > 0 && !entryFormStyleId) {
        setEntryFormStyleId(activeStyles[0].id);
        setDispatchStyleId(activeStyles[0].id);
      }
    } catch (err: any) {
      showErrorToast(`Failed to load finishing screen data: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Build Finishing Summaries per Style
  const styleSummaries: StyleFinishingSummary[] = useMemo(() => {
    const activeStyles = styles.filter(s => s.status === 'active' || s.status === 'upcoming');
    const targetStyles = selectedStyleId === 'all' 
      ? activeStyles 
      : activeStyles.filter(s => s.id === selectedStyleId);

    return targetStyles.map(style => {
      // 1. Get active finishing stages for this style sorted by seq_no
      const styleStages = allStages
        .filter(stg => stg.style_id === style.id && stg.is_active !== false)
        .sort((a, b) => a.seq_no - b.seq_no);

      // 2. Filter entries for this style
      let styleEntries = allEntries.filter(e => e.style_id === style.id);
      if (filterDate) {
        styleEntries = styleEntries.filter(e => e.entry_date === filterDate);
      }

      // 3. Compute cumulative output & WIP waiting per stage
      let maxWaiting = 0;
      let bottleneckStageId: string | null = null;
      let prevCumulative = 0;

      const summariesWithoutBottleneck: StageWipSummary[] = styleStages.map((stage, idx) => {
        const stageEntries = styleEntries.filter(e => e.stage_id === stage.id);
        const cumulativeQty = stageEntries.reduce((sum, e) => sum + (e.qty_ok || 0), 0);
        const totalRework = stageEntries.reduce((sum, e) => sum + (e.qty_rework || 0), 0);
        const totalReject = stageEntries.reduce((sum, e) => sum + (e.qty_reject || 0), 0);

        let wipWaiting = 0;
        if (idx === 0) {
          // Stage 1 (Received from Sewing) has no waiting figure — it is the input pool
          wipWaiting = 0;
        } else {
          // WAITING = previous stage cumulative total minus this stage cumulative total
          wipWaiting = Math.max(0, prevCumulative - cumulativeQty);
          if (wipWaiting > maxWaiting) {
            maxWaiting = wipWaiting;
            bottleneckStageId = stage.id;
          }
        }
        prevCumulative = cumulativeQty;

        return {
          stage,
          cumulativeQty,
          wipWaiting,
          isBottleneck: false,
          totalRework,
          totalReject,
        };
      });

      // Mark bottleneck in amber if maxWaiting > 0
      const stageSummaries = summariesWithoutBottleneck.map(s => ({
        ...s,
        isBottleneck: maxWaiting > 0 && s.stage.id === bottleneckStageId,
      }));

      // Stage 1 cumulative output is Received from Sewing
      const receivedFromSewing = stageSummaries.length > 0 ? stageSummaries[0].cumulativeQty : 0;

      // Sewing completed = MINIMUM qty_ok across all of that style's sewing processes, NOT the sum
      const styleProcesses = sewingProcesses.filter(p => p.style_id === style.id);
      let sewingCompletedQty = 0;

      if (styleProcesses.length > 0) {
        const processTotals = styleProcesses.map(proc => {
          return sewingEntries
            .filter(e => e.style_id === style.id && e.process_id === proc.id)
            .reduce((sum, e) => sum + (e.qty_ok || 0), 0);
        });
        sewingCompletedQty = Math.min(...processTotals);
      } else {
        const styleSewingEntries = sewingEntries.filter(e => e.style_id === style.id);
        sewingCompletedQty = styleSewingEntries.reduce((sum, e) => sum + (e.qty_ok || 0), 0);
      }

      // Reconcile warning: Trigger if receivedFromSewing > sewingCompletedQty
      const sewingWarning = style.requires_cutting !== false && (receivedFromSewing > sewingCompletedQty && sewingCompletedQty >= 0);

      // Final ready to deliver stage (last stage in pipeline)
      const readyStageSummary = stageSummaries.length > 0 ? stageSummaries[stageSummaries.length - 1] : null;
      const readyToDeliverQty = readyStageSummary ? readyStageSummary.cumulativeQty : 0;

      // Ready today quantity (logged on filter date or today)
      const todayStr = filterDate || getLocalDateString();
      let readyTodayQty = 0;
      if (readyStageSummary) {
        const readyTodayEntries = styleEntries.filter(
          e => e.stage_id === readyStageSummary.stage.id && e.entry_date === todayStr
        );
        readyTodayQty = readyTodayEntries.reduce((sum, e) => sum + (e.qty_ok || 0), 0);
      }

      // Dispatched quantity from deliveries
      const styleDeliveries = deliveries.filter(d => d.style_id === style.id);
      const totalDispatchedQty = styleDeliveries.reduce((sum, d) => sum + (d.delivered_qty || 0), 0);
      const remainingBalance = Math.max(0, style.order_qty - totalDispatchedQty);

      // Completion percentage of received
      const completionPercent = receivedFromSewing > 0 
        ? Math.min(100, Math.round((readyToDeliverQty / receivedFromSewing) * 100)) 
        : 0;

      const totalRework = stageSummaries.reduce((sum, s) => sum + s.totalRework, 0);
      const totalReject = stageSummaries.reduce((sum, s) => sum + s.totalReject, 0);
      const inReworkCount = totalRework;

      return {
        style,
        stages: styleStages,
        stageSummaries,
        receivedFromSewing,
        sewingCompletedQty,
        sewingWarning,
        readyToDeliverQty,
        readyTodayQty,
        totalDispatchedQty,
        remainingBalance,
        completionPercent,
        totalRework,
        totalReject,
        inReworkCount,
      };
    });
  }, [styles, allStages, allEntries, deliveries, sewingProcesses, sewingEntries, selectedStyleId, filterDate]);

  // Open Quick Stage Modal
  const isStageReady = (stage: FinishingStage, styleStages: FinishingStage[]) => {
    if (stage.code === 'ready' || stage.name.toLowerCase().includes('ready')) return true;
    const activeStages = styleStages
      .filter(s => s.style_id === stage.style_id && s.is_active !== false)
      .sort((a, b) => a.seq_no - b.seq_no);
    if (activeStages.length > 0 && activeStages[activeStages.length - 1].id === stage.id) {
      return true;
    }
    return false;
  };

  const handleOpenQuickStageModal = async (
    style: GarmentStyle,
    stage: FinishingStage,
    stageIdx: number,
    stageSummaries: StageWipSummary[],
    sewingCompletedQty: number
  ) => {
    setQuickLogStyle(style);
    setQuickLogStage(stage);
    setQuickLogStageIdx(stageIdx);

    const currentCum = stageSummaries[stageIdx]?.cumulativeQty || 0;
    setQuickLogCurrentCumulative(currentCum);

    if (stageIdx === 0) {
      setQuickLogPrevStageName('Sewing Output');
      setQuickLogPrevCumulative(sewingCompletedQty);
      setQuickLogWipWaiting(0);
      setQuickLogQtyOk('');
    } else {
      const prevSummary = stageSummaries[stageIdx - 1];
      setQuickLogPrevStageName(prevSummary.stage.name);
      setQuickLogPrevCumulative(prevSummary.cumulativeQty);
      const waiting = Math.max(0, prevSummary.cumulativeQty - currentCum);
      setQuickLogWipWaiting(waiting);
      setQuickLogQtyOk(waiting > 0 ? String(waiting) : '');
    }

    // Check if ready stage for size breakdown
    const isReady = isStageReady(stage, allStages);
    if (isReady) {
      const sizes = await dataService.getStyleSizes(style.id);
      setQuickLogSizes(sizes);
      setQuickLogSize(sizes.length > 0 ? sizes[0].size : '');
    } else {
      setQuickLogSizes([]);
      setQuickLogSize('');
    }

    setQuickLogQtyRework('0');
    setQuickLogQtyReject('0');
    setQuickLogWorkerId('');
    setQuickLogShift('day');
    setQuickLogNotes('');
    setQuickLogConfirmExceed(false);
    setIsQuickLogOpen(true);
  };

  // Submit Quick Single Stage Entry
  const handleSaveQuickStageEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickLogStyle || !quickLogStage) return;

    const qtyOk = Number(quickLogQtyOk || 0);
    const qtyRework = Number(quickLogQtyRework || 0);
    const qtyReject = Number(quickLogQtyReject || 0);

    if (qtyOk <= 0 && qtyRework <= 0 && qtyReject <= 0) {
      showErrorToast('Please enter output quantity.');
      return;
    }

    const newCumulative = quickLogCurrentCumulative + qtyOk;
    let isExceeding = false;
    let warningMsg = '';

    if (quickLogStageIdx > 0) {
      if (newCumulative > quickLogPrevCumulative) {
        isExceeding = true;
        warningMsg = `${quickLogStage.name} cannot exceed the ${quickLogPrevCumulative} pieces received (${quickLogPrevStageName})`;
      }
    } else {
      if (quickLogStyle.requires_cutting !== false && quickLogPrevCumulative > 0 && newCumulative > quickLogPrevCumulative) {
        isExceeding = true;
        warningMsg = `Received from Sewing (${newCumulative} pcs) cannot exceed actual sewing output (${quickLogPrevCumulative} pcs)`;
      }
    }

    if (isExceeding && !quickLogConfirmExceed) {
      showErrorToast(warningMsg);
      return;
    }

    const isReady = isStageReady(quickLogStage, allStages);

    setQuickLogSaving(true);
    try {
      await dataService.saveFinishingEntries([{
        style_id: quickLogStyle.id,
        stage_id: quickLogStage.id,
        worker_id: quickLogWorkerId || null,
        entry_date: getLocalDateString(),
        shift: quickLogShift,
        qty_ok: qtyOk,
        qty_rework: qtyRework,
        qty_reject: qtyReject,
        size: isReady ? (quickLogSize || null) : null,
        note: quickLogNotes || null,
      }]);

      showSuccessToast(`Logged ${qtyOk} pcs output for ${quickLogStage.name}.`);
      setIsQuickLogOpen(false);
      await loadData();
    } catch (err: any) {
      showErrorToast(`Failed to save output: ${err.message || String(err)}`);
    } finally {
      setQuickLogSaving(false);
    }
  };

  const [entryStyleSizes, setEntryStyleSizes] = useState<StyleSize[]>([]);

  // Open Daily Entry Form Modal
  const handleOpenEntryModal = (styleId?: string) => {
    const targetId = styleId || (styles.length > 0 ? styles[0].id : '');
    setEntryFormStyleId(targetId);
    setEntryDate(getLocalDateString());
    setEntryShift('day');
    setEntryNotes('');
    setOutOfSeqWarning(null);
    setConfirmOutOfSeq(false);

    dataService.getStyleSizes(targetId).then(sizes => {
      setEntryStyleSizes(sizes);
      const targetStages = allStages
        .filter(s => s.style_id === targetId && s.is_active !== false)
        .sort((a, b) => a.seq_no - b.seq_no);

      const initialInputs: Record<string, { qty_ok: string; qty_rework: string; qty_reject: string; worker_id: string; size?: string }> = {};
      targetStages.forEach(stg => {
        const isReady = isStageReady(stg, targetStages);
        initialInputs[stg.id] = { 
          qty_ok: '', 
          qty_rework: '', 
          qty_reject: '', 
          worker_id: '',
          size: isReady && sizes.length > 0 ? sizes[0].size : '' 
        };
      });
      setStageInputs(initialInputs);
    });

    setIsEntryModalOpen(true);
  };

  // Change style in Entry Form
  const handleEntryStyleChange = (styleId: string) => {
    setEntryFormStyleId(styleId);
    setOutOfSeqWarning(null);
    setConfirmOutOfSeq(false);

    dataService.getStyleSizes(styleId).then(sizes => {
      setEntryStyleSizes(sizes);
      const targetStages = allStages
        .filter(s => s.style_id === styleId && s.is_active !== false)
        .sort((a, b) => a.seq_no - b.seq_no);

      const initialInputs: Record<string, { qty_ok: string; qty_rework: string; qty_reject: string; worker_id: string; size?: string }> = {};
      targetStages.forEach(stg => {
        const isReady = isStageReady(stg, targetStages);
        initialInputs[stg.id] = { 
          qty_ok: '', 
          qty_rework: '', 
          qty_reject: '', 
          worker_id: '',
          size: isReady && sizes.length > 0 ? sizes[0].size : '' 
        };
      });
      setStageInputs(initialInputs);
    });
  };

  // Submit Daily Finishing Entry
  const handleSaveFinishingEntries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryFormStyleId) {
      showErrorToast('Please select a garment style.');
      return;
    }

    const targetStages = allStages
      .filter(s => s.style_id === entryFormStyleId && s.is_active !== false)
      .sort((a, b) => a.seq_no - b.seq_no);

    const entriesToSave: Partial<FinishingEntry>[] = [];
    let validationIssue: string | null = null;

    const styleEntries = allEntries.filter(e => e.style_id === entryFormStyleId);
    let prevStageTotal = Infinity;

    for (let i = 0; i < targetStages.length; i++) {
      const stg = targetStages[i];
      const inp = stageInputs[stg.id] || { qty_ok: '0', qty_rework: '0', qty_reject: '0', worker_id: '' };
      const qtyOk = Number(inp.qty_ok || 0);
      const qtyRework = Number(inp.qty_rework || 0);
      const qtyReject = Number(inp.qty_reject || 0);

      const existingCumulative = styleEntries
        .filter(e => e.stage_id === stg.id)
        .reduce((sum, e) => sum + (e.qty_ok || 0), 0);

      const newCumulative = existingCumulative + qtyOk;

      // Validation check against previous stage
      if (i > 0 && newCumulative > prevStageTotal) {
        const prevStgName = targetStages[i - 1].name;
        validationIssue = `${stg.name} cannot exceed the ${prevStageTotal} pieces received (${prevStgName})`;
      }
      prevStageTotal = newCumulative;

      if (qtyOk > 0 || qtyRework > 0 || qtyReject > 0) {
        const isReady = isStageReady(stg, targetStages);
        entriesToSave.push({
          style_id: entryFormStyleId,
          stage_id: stg.id,
          worker_id: inp.worker_id || null,
          entry_date: entryDate,
          shift: entryShift,
          qty_ok: qtyOk,
          qty_rework: qtyRework,
          qty_reject: qtyReject,
          size: isReady ? (inp.size || null) : null,
          note: entryNotes || null,
          entered_by: null,
        });
      }
    }

    if (entriesToSave.length === 0) {
      showErrorToast('Please enter output quantity for at least one finishing stage.');
      return;
    }

    if (validationIssue && !confirmOutOfSeq) {
      setOutOfSeqWarning(validationIssue);
      return;
    }

    setSavingEntries(true);
    try {
      await dataService.saveFinishingEntries(entriesToSave);
      showSuccessToast('Finishing output recorded successfully.');
      setIsEntryModalOpen(false);
      await loadData();
    } catch (err: any) {
      showErrorToast(`Failed to save finishing output: ${err.message || String(err)}`);
    } finally {
      setSavingEntries(false);
    }
  };

  // Submit Dispatch Record
  const handleSaveDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchStyleId || !dispatchQty || Number(dispatchQty) <= 0) {
      showErrorToast('Please select a style and enter a valid dispatch quantity.');
      return;
    }

    setSavingDispatch(true);
    try {
      await dataService.saveDelivery({
        style_id: dispatchStyleId,
        delivery_date: dispatchDate,
        delivered_qty: Number(dispatchQty),
        vehicle_no: dispatchVehicle || null,
        driver_name: dispatchDriver || null,
        destination: dispatchDestination || null,
        notes: dispatchNotes || null,
      });

      showSuccessToast('Dispatch delivery recorded against finishing order balance.');
      setIsDispatchModalOpen(false);
      setDispatchQty('');
      setDispatchVehicle('');
      setDispatchDriver('');
      setDispatchDestination('');
      setDispatchNotes('');
      await loadData();
    } catch (err: any) {
      showErrorToast(`Failed to record dispatch: ${err.message || String(err)}`);
    } finally {
      setSavingDispatch(false);
    }
  };

  // Excel / CSV Export
  const handleDownloadReport = () => {
    try {
      const headers = ['Style Code', 'Style Name', 'Buyer', 'Stage Name', 'Cumulative OK Qty', 'WIP Waiting', 'QC Rework', 'QC Reject'];
      const rows: string[] = [headers.join(',')];

      styleSummaries.forEach(s => {
        s.stageSummaries.forEach(stg => {
          rows.push([
            `"${s.style.style_code}"`,
            `"${s.style.name}"`,
            `"${s.style.buyer_name || 'N/A'}"`,
            `"${stg.stage.name}"`,
            stg.cumulativeQty,
            stg.wipWaiting,
            stg.totalRework,
            stg.totalReject
          ].join(','));
        });
      });

      const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'));
      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute('download', `Finishing_Report_${getLocalDateString()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSuccessToast('Finishing report downloaded as CSV/Excel.');
    } catch (err: any) {
      showErrorToast(`Failed to download report: ${err.message || String(err)}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-stone-900 tracking-tight">Finishing Section</h1>
              <p className="text-xs text-stone-500">Pipeline flow tracking, WIP bottlenecks, QC handling & dispatch balance</p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadReport}
            className="flex items-center space-x-2 px-3.5 py-2.5 bg-white hover:bg-stone-50 border border-stone-300 rounded-2xl text-xs font-bold text-stone-700 shadow-xs transition-all"
          >
            <Download className="w-4 h-4 text-stone-500" />
            <span>Download Report</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDispatchModalOpen(true)}
            className="flex items-center space-x-2 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-2xl text-xs font-bold text-amber-900 shadow-xs transition-all"
          >
            <Truck className="w-4 h-4 text-amber-700" />
            <span>Record Dispatch</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenEntryModal()}
            className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-2xl text-xs shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Record Finishing Output</span>
          </button>
        </div>
      </div>

      {/* FILTER & SELECTION BAR */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-stone-600">Style Filter:</span>
            <select
              value={selectedStyleId}
              onChange={(e) => setSelectedStyleId(e.target.value)}
              className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Active Styles ({styles.filter(s => s.status === 'active' || s.status === 'upcoming').length})</option>
              {styles.filter(s => s.status === 'active' || s.status === 'upcoming').map(s => (
                <option key={s.id} value={s.id}>{s.style_code} — {s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-bold text-stone-600">Entry Date:</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 focus:outline-none"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="text-stone-400 hover:text-stone-700 text-xs underline font-medium"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* TOGGLE: SHOW STAGE DETAIL (ADMIN & SUPERVISOR ONLY) */}
        {canToggleDetail && (
          <label className="flex items-center space-x-2 font-bold cursor-pointer bg-stone-50 hover:bg-stone-100 px-3.5 py-1.5 rounded-xl border border-stone-200 text-stone-800 transition-colors shrink-0">
            <input
              type="checkbox"
              checked={showStageDetail}
              onChange={(e) => {
                const val = e.target.checked;
                setShowStageDetail(val);
                try {
                  sessionStorage.setItem('finishing_show_stage_detail', String(val));
                } catch (err) {}
              }}
              className="w-4 h-4 text-indigo-600 rounded border-stone-300 focus:ring-indigo-500 cursor-pointer"
            />
            <span>Show stage detail</span>
          </label>
        )}
      </div>

      {/* PIPELINE VIEWS PER STYLE */}
      {loading ? (
        <div className="py-16 text-center text-stone-500 space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold">Loading finishing pipelines...</p>
        </div>
      ) : styleSummaries.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-stone-200 text-center space-y-3">
          <Layers className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="text-base font-bold text-stone-800">No Active Finishing Pipelines</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Create or select an active style to view the finishing pipeline flow.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {styleSummaries.map(summary => {
            const bottleneckSummary = summary.stageSummaries.find(s => s.isBottleneck && s.wipWaiting > 0);
            const totalTargetQty = summary.receivedFromSewing > 0 ? summary.receivedFromSewing : summary.style.order_qty;

            const selectedWorkerStageId = workerSelectedStageId[summary.style.id] || (summary.stageSummaries.length > 0 ? summary.stageSummaries[0].stage.id : '');
            const workerStageSummary = summary.stageSummaries.find(s => s.stage.id === selectedWorkerStageId);

            return (
              <div key={summary.style.id} className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs space-y-4">
                {/* SIMPLE VIEW CARD TOP HEADER */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <StyleImage src={summary.style.image_url} alt={summary.style.name} className="w-12 h-12 rounded-2xl border border-stone-200 object-cover shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-black text-stone-900 tracking-tight truncate">{summary.style.name}</h3>
                      <p className="text-xs text-stone-500 font-medium truncate flex items-center space-x-2 flex-wrap">
                        <span className="font-mono font-bold text-stone-800">{summary.style.style_code}</span>
                        {summary.style.buyer_name ? <span className="text-stone-700"> • {summary.style.buyer_name}</span> : ''}
                        {role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => setViewEntriesTarget({
                              styleId: summary.style.id,
                              styleCode: summary.style.style_code,
                              styleName: summary.style.name,
                            })}
                            className="inline-flex items-center space-x-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-colors cursor-pointer"
                          >
                            <ClipboardList className="w-3 h-3" />
                            <span>View entries</span>
                          </button>
                        )}
                      </p>

                    </div>
                  </div>

                  {/* LOG OUTPUT BUTTON */}
                  <button
                    type="button"
                    onClick={() => handleOpenEntryModal(summary.style.id)}
                    className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-2xl text-xs shadow-xs hover:shadow-md transition-all flex items-center justify-center space-x-1.5 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Log Output</span>
                  </button>
                </div>

                {/* HEADLINE NUMBERS: READY TODAY & TOTAL READY */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-stone-50/80 p-4 rounded-2xl border border-stone-200/80">
                  <div>
                    <span className="text-[11px] font-extrabold text-stone-500 uppercase tracking-wider block mb-0.5">
                      Ready today
                    </span>
                    <div className="text-3xl sm:text-4xl font-black text-emerald-700 font-mono tracking-tight leading-none">
                      {summary.readyTodayQty.toLocaleString()} <span className="text-base font-bold text-stone-600">pcs</span>
                    </div>
                  </div>

                  <div className="sm:border-l sm:border-stone-200 sm:pl-4">
                    <span className="text-[11px] font-extrabold text-stone-500 uppercase tracking-wider block mb-0.5">
                      Total ready
                    </span>
                    <div className="text-lg font-bold text-stone-900 font-mono">
                      <span className="text-xl sm:text-2xl font-black text-stone-900">
                        {summary.readyToDeliverQty.toLocaleString()}
                      </span>
                      <span className="text-stone-400 font-normal"> of </span>
                      <span className="text-stone-700 font-bold">
                        {totalTargetQty.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* BOTTLENECK HIGHLIGHT LINE (WHEN THERE IS ONE) */}
                {bottleneckSummary && (
                  <div className="bg-amber-50/90 border border-amber-300 px-3.5 py-2.5 rounded-2xl flex items-center space-x-2 text-xs text-amber-950 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Bottleneck: <strong className="font-black underline">{bottleneckSummary.stage.name}</strong> — <span className="font-mono">{bottleneckSummary.wipWaiting.toLocaleString()}</span> waiting
                    </span>
                  </div>
                )}

                {/* RECONCILE SEWING WARNING BANNER */}
                {summary.sewingWarning && (
                  <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex items-center space-x-3 text-xs text-rose-900">
                    <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                    <div>
                      <span className="font-bold">Sewing Output Mismatch Warning:</span> Received <strong className="font-mono">{summary.receivedFromSewing}</strong> pcs in finishing, but sewing minimum completed is only <strong className="font-mono">{summary.sewingCompletedQty}</strong> pcs — please verify your finishing entries.
                    </div>
                  </div>
                )}

                {/* FINISHING WORKERS: SIMPLE VIEW PLUS THEIR OWN STAGE */}
                {!canToggleDetail && (
                  <div className="pt-2 border-t border-stone-100 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                      <span className="flex items-center space-x-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-700" />
                        <span>Your Stage View</span>
                      </span>
                      {summary.stageSummaries.length > 1 && (
                        <select
                          value={selectedWorkerStageId}
                          onChange={(e) => setWorkerSelectedStageId({ ...workerSelectedStageId, [summary.style.id]: e.target.value })}
                          className="px-2 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-stone-800"
                        >
                          {summary.stageSummaries.map(st => (
                            <option key={st.stage.id} value={st.stage.id}>{st.stage.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {workerStageSummary && (
                      <div className={`p-3.5 rounded-2xl border transition-all ${
                        workerStageSummary.isBottleneck ? 'bg-amber-50/90 border-amber-300' : 'bg-stone-50/80 border-stone-200'
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1 space-y-1">
                            <h4 className="font-bold text-stone-900 text-sm">{workerStageSummary.stage.name}</h4>
                            <div className="flex items-center space-x-3 text-xs">
                              <span className="font-bold text-stone-800">
                                <span className="font-mono font-black text-stone-900">{workerStageSummary.cumulativeQty.toLocaleString()}</span> done
                              </span>
                              <span className="text-stone-300">·</span>
                              <span className={`font-bold ${workerStageSummary.wipWaiting > 0 ? 'text-amber-900 font-extrabold' : 'text-stone-400'}`}>
                                <span className="font-mono">{workerStageSummary.wipWaiting.toLocaleString()}</span> waiting
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const idx = summary.stageSummaries.findIndex(s => s.stage.id === workerStageSummary.stage.id);
                              handleOpenQuickStageModal(summary.style, workerStageSummary.stage, idx, summary.stageSummaries, summary.sewingCompletedQty);
                            }}
                            className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Log Output</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* DETAIL VIEW: EXPANDED WHEN showStageDetail IS TRUE (FOR ADMIN & SUPERVISOR) */}
                {canToggleDetail && showStageDetail && (
                  <div className="pt-3 border-t border-stone-200 space-y-4">
                    {/* PIPELINE STAGES LIST */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-stone-700 px-1">
                        <span className="flex items-center space-x-2">
                          <Layers className="w-4 h-4 text-indigo-700" />
                          <span>Finishing Stage Pipeline Flow</span>
                        </span>
                        <span className="text-stone-500 font-normal text-[11px]">
                          Overall Progress: <strong className="text-stone-900 font-bold">{summary.completionPercent}% of received</strong>
                        </span>
                      </div>

                      <div className="space-y-2">
                        {summary.stageSummaries.map((stgSummary, idx) => {
                          const isFirstStage = idx === 0;
                          const prevCumulative = isFirstStage ? summary.receivedFromSewing : summary.stageSummaries[idx - 1].cumulativeQty;
                          const progressPct = !isFirstStage && prevCumulative > 0 
                            ? Math.min(100, Math.round((stgSummary.cumulativeQty / prevCumulative) * 100))
                            : 100;

                          return (
                            <div
                              key={stgSummary.stage.id}
                              className={`p-3.5 rounded-2xl border transition-all ${
                                isFirstStage
                                  ? 'bg-indigo-50/40 border-indigo-200/80'
                                  : stgSummary.isBottleneck
                                  ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-400/50 shadow-xs'
                                  : 'bg-stone-50/80 border-stone-200'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex-1 space-y-1.5">
                                  <div className="flex items-center space-x-2.5">
                                    <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                                      isFirstStage 
                                        ? 'bg-indigo-600 text-white' 
                                        : stgSummary.isBottleneck 
                                        ? 'bg-amber-600 text-white' 
                                        : 'bg-stone-200 text-stone-700'
                                    }`}>
                                      {idx + 1}
                                    </span>

                                    <h4 className="font-bold text-stone-900 text-sm">
                                      {stgSummary.stage.name}
                                    </h4>

                                    {isFirstStage && (
                                      <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-indigo-200">
                                        Input Pool
                                      </span>
                                    )}

                                    {stgSummary.isBottleneck && (
                                      <span className="bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs flex items-center space-x-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span>Bottleneck</span>
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                    <span className="font-bold text-stone-800">
                                      <span className="font-mono font-black text-sm text-stone-900">{stgSummary.cumulativeQty.toLocaleString()}</span> done
                                    </span>

                                    {!isFirstStage && (
                                      <>
                                        <span className="text-stone-300">·</span>
                                        <span className={`font-bold ${stgSummary.wipWaiting > 0 ? 'text-amber-900 font-extrabold' : 'text-stone-400'}`}>
                                          <span className="font-mono">{stgSummary.wipWaiting.toLocaleString()}</span> waiting
                                        </span>

                                        <span className="text-stone-300">·</span>
                                        <span className="text-stone-500 font-mono text-[11px]">
                                          [{progressPct}%]
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  {!isFirstStage && (
                                    <div className="w-full bg-stone-200/80 rounded-full h-1.5 overflow-hidden mt-1">
                                      <div
                                        className={`h-full transition-all duration-300 ${
                                          stgSummary.isBottleneck ? 'bg-amber-500' : 'bg-indigo-600'
                                        }`}
                                        style={{ width: `${progressPct}%` }}
                                      />
                                    </div>
                                  )}
                                </div>

                                <div className="shrink-0 flex items-center">
                                  {isFirstStage ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenQuickStageModal(summary.style, stgSummary.stage, idx, summary.stageSummaries, summary.sewingCompletedQty)}
                                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Log Received</span>
                                    </button>
                                  ) : stgSummary.wipWaiting > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenQuickStageModal(summary.style, stgSummary.stage, idx, summary.stageSummaries, summary.sewingCompletedQty)}
                                      className={`px-3.5 py-2 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 ${
                                        stgSummary.isBottleneck
                                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                          : 'bg-indigo-700 hover:bg-indigo-800 text-white'
                                      }`}
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Log Output</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled
                                      className="px-3.5 py-2 bg-stone-100 border border-stone-200 text-stone-400 font-medium text-xs rounded-xl cursor-not-allowed flex items-center space-x-1.5"
                                    >
                                      <X className="w-3.5 h-3.5 text-stone-300" />
                                      <span>Nothing waiting</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <FinishingSizeTable styleId={summary.style.id} />

                    {/* QC BREAKDOWN MOVED HERE INSIDE DETAIL VIEW */}
                    <div className="bg-stone-50 border border-stone-200 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center space-x-4">
                        <span className="font-bold text-stone-700">QC Status Breakdown:</span>
                        <span className="text-emerald-700 font-bold">Passed: {summary.readyToDeliverQty} pcs</span>
                        <span className="text-amber-800 font-bold">In Rework: {summary.inReworkCount} pcs</span>
                        <span className="text-rose-700 font-bold">Rejected: {summary.totalReject} pcs</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenEntryModal(summary.style.id)}
                        className="text-indigo-700 hover:text-indigo-900 font-bold underline"
                      >
                        + Record Output for {summary.style.style_code}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* QUICK SINGLE STAGE LOG MODAL */}
      {isQuickLogOpen && quickLogStage && quickLogStyle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-3">
          <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0">
            <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">Log Output — {quickLogStage.name}</h3>
                  <p className="text-xs text-stone-500">{quickLogStyle.style_code} • {quickLogStyle.name}</p>
                </div>
              </div>
              <button onClick={() => setIsQuickLogOpen(false)} className="p-2 rounded-xl text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickStageEntry} className="p-4 sm:p-6 space-y-4">
              {/* CONTEXT SUMMARY BOX */}
              <div className="bg-stone-50 border border-stone-200 p-3 rounded-2xl text-xs space-y-1">
                <div className="flex justify-between text-stone-600">
                  <span>Previous Stage ({quickLogPrevStageName}):</span>
                  <span className="font-mono font-bold text-stone-900">{quickLogPrevCumulative} pcs</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Current Stage Completed:</span>
                  <span className="font-mono font-bold text-stone-900">{quickLogCurrentCumulative} pcs</span>
                </div>
                {quickLogStageIdx > 0 && (
                  <div className="flex justify-between text-amber-900 font-bold pt-1 border-t border-stone-200">
                    <span>Pieces Waiting at this Stage:</span>
                    <span className="font-mono">{quickLogWipWaiting} pcs</span>
                  </div>
                )}
              </div>

              {/* QUANTITY & SIZE INPUT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Completed OK Qty (pcs) *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="0"
                    value={quickLogQtyOk}
                    onChange={(e) => setQuickLogQtyOk(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                {isStageReady(quickLogStage, allStages) && (
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Size {quickLogSizes.length > 0 ? '*' : '(Free Text)'}
                    </label>
                    {quickLogSizes.length > 0 ? (
                      <select
                        required
                        value={quickLogSize}
                        onChange={(e) => setQuickLogSize(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {quickLogSizes.map(sz => (
                          <option key={sz.size} value={sz.size}>
                            {sz.size} (Order: {sz.order_qty} pcs)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="e.g. S, M, L, XL"
                        value={quickLogSize}
                        onChange={(e) => setQuickLogSize(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* EXCEED WARNING & CONFIRMATION */}
              {(() => {
                const qtyOk = Number(quickLogQtyOk || 0);
                const newCum = quickLogCurrentCumulative + qtyOk;
                const isExceeding = quickLogStageIdx > 0 
                  ? newCum > quickLogPrevCumulative 
                  : quickLogStyle.requires_cutting !== false && quickLogPrevCumulative > 0 && newCum > quickLogPrevCumulative;

                if (!isExceeding) return null;

                const msg = quickLogStageIdx > 0
                  ? `${quickLogStage.name} cannot exceed the ${quickLogPrevCumulative} pieces received`
                  : `Received from Sewing (${newCum} pcs) cannot exceed actual sewing output (${quickLogPrevCumulative} pcs)`;

                return (
                  <div className="bg-amber-50 border border-amber-300 p-3 rounded-2xl space-y-2 text-xs text-amber-900">
                    <div className="flex items-start space-x-2 font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <span>{msg}</span>
                    </div>
                    <label className="flex items-center space-x-2 font-bold cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={quickLogConfirmExceed}
                        onChange={(e) => setQuickLogConfirmExceed(e.target.checked)}
                        className="w-4 h-4 text-amber-700 rounded border-stone-300"
                      />
                      <span>I confirm logging quantity exceeding previous stage</span>
                    </label>
                  </div>
                );
              })()}

              {/* WORKER & SHIFT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Worker (Optional)</label>
                  <select
                    value={quickLogWorkerId}
                    onChange={(e) => setQuickLogWorkerId(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900"
                  >
                    <option value="">Select Worker...</option>
                    {finishingWorkers.map(w => (
                      <option key={w.id} value={w.id}>{w.full_name} ({w.worker_code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Shift</label>
                  <select
                    value={quickLogShift}
                    onChange={(e) => setQuickLogShift(e.target.value as 'day' | 'night')}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900"
                  >
                    <option value="day">Day Shift</option>
                    <option value="night">Night Shift</option>
                  </select>
                </div>
              </div>

              {/* NOTES */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Batch completed"
                  value={quickLogNotes}
                  onChange={(e) => setQuickLogNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900"
                />
              </div>

              {/* FOOTER */}
              <div className="pt-2 border-t border-stone-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsQuickLogOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickLogSaving}
                  className="px-5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl text-xs shadow-xs flex items-center space-x-1.5"
                >
                  {quickLogSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{quickLogSaving ? 'Saving...' : 'Save Output'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: RECORD FINISHING OUTPUT */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-2 sm:p-4 overflow-hidden">
          <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl my-auto overflow-hidden">
            {/* FIXED MODAL HEADER */}
            <div className="p-4 sm:p-5 border-b border-stone-200 shrink-0 flex items-center justify-between bg-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">Record Finishing Output</h3>
                  <p className="text-xs text-stone-500">Enter completed pieces per stage for line accountability</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEntryModalOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORM CONTAINER WITH SCROLLABLE BODY AND FIXED FOOTER */}
            <form onSubmit={handleSaveFinishingEntries} className="flex flex-col flex-1 overflow-hidden min-h-0">
              {/* SCROLLABLE BODY CONTENT */}
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {/* TOP SELECTORS: STYLE, DATE, SHIFT */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Garment Style</label>
                    <select
                      value={entryFormStyleId}
                      onChange={(e) => handleEntryStyleChange(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {styles.filter(s => s.status === 'active' || s.status === 'upcoming').map(s => (
                        <option key={s.id} value={s.id}>{s.style_code} — {s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Entry Date</label>
                    <input
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-900 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Shift</label>
                    <select
                      value={entryShift}
                      onChange={(e) => setEntryShift(e.target.value as 'day' | 'night')}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-900 focus:outline-none"
                    >
                      <option value="day">Day Shift</option>
                      <option value="night">Night Shift</option>
                    </select>
                  </div>
                </div>

                {/* STAGES INPUT MATRIX */}
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold text-stone-700 uppercase tracking-wider">Stages Output Entry</div>
                  
                  <div className="border border-stone-200 rounded-2xl overflow-hidden divide-y divide-stone-200 text-xs">
                    {allStages
                      .filter(s => s.style_id === entryFormStyleId && s.is_active !== false)
                      .sort((a, b) => a.seq_no - b.seq_no)
                      .map((stg, idx) => {
                        const targetStages = allStages
                          .filter(s => s.style_id === entryFormStyleId && s.is_active !== false)
                          .sort((a, b) => a.seq_no - b.seq_no);
                        const isReady = isStageReady(stg, targetStages);
                        const inp = stageInputs[stg.id] || { qty_ok: '', qty_rework: '', qty_reject: '', worker_id: '', size: '' };
                        const isQc = stg.code === 'qc' || stg.name.toLowerCase().includes('qc');

                        return (
                          <div key={stg.id} className="p-3 bg-stone-50/60 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="font-bold text-stone-900 text-xs flex items-center space-x-2">
                                <span className="text-stone-500 font-mono">{idx + 1}.</span>
                                <span>{stg.name}</span>
                                {isReady && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-emerald-200">
                                    Final / Ready Stage
                                  </span>
                                )}
                              </div>

                              {/* Worker Assignment Dropdown */}
                              <select
                                value={inp.worker_id}
                                onChange={(e) => {
                                  setStageInputs({
                                    ...stageInputs,
                                    [stg.id]: { ...inp, worker_id: e.target.value }
                                  });
                                }}
                                className="px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-700"
                              >
                                <option value="">Optional Worker Assignment...</option>
                                {finishingWorkers.map(w => (
                                  <option key={w.id} value={w.id}>{w.full_name} ({w.worker_code})</option>
                                ))}
                              </select>
                            </div>

                            {/* Quantity & Size Inputs */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                              <div>
                                <span className="text-[10px] font-bold text-stone-500 block">Completed OK Qty</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={inp.qty_ok}
                                  onChange={(e) => {
                                    setOutOfSeqWarning(null);
                                    setConfirmOutOfSeq(false);
                                    setStageInputs({
                                      ...stageInputs,
                                      [stg.id]: { ...inp, qty_ok: e.target.value }
                                    });
                                  }}
                                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-xl font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>

                              {isReady && (
                                <div>
                                  <span className="text-[10px] font-bold text-stone-600 block">
                                    Size {entryStyleSizes.length > 0 ? '*' : '(Free Text)'}
                                  </span>
                                  {entryStyleSizes.length > 0 ? (
                                    <select
                                      value={inp.size || (entryStyleSizes[0]?.size || '')}
                                      onChange={(e) => {
                                        setStageInputs({
                                          ...stageInputs,
                                          [stg.id]: { ...inp, size: e.target.value }
                                        });
                                      }}
                                      className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-xl font-bold text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                      {entryStyleSizes.map(sz => (
                                        <option key={sz.size} value={sz.size}>
                                          {sz.size} ({sz.order_qty} pcs)
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      placeholder="e.g. S, M, L"
                                      value={inp.size || ''}
                                      onChange={(e) => {
                                        setStageInputs({
                                          ...stageInputs,
                                          [stg.id]: { ...inp, size: e.target.value }
                                        });
                                      }}
                                      className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-xl font-bold text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  )}
                                </div>
                              )}

                              {isQc && (
                                <>
                                  <div>
                                    <span className="text-[10px] font-bold text-amber-800 block">Qty Rework</span>
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      value={inp.qty_rework}
                                      onChange={(e) => {
                                        setStageInputs({
                                          ...stageInputs,
                                          [stg.id]: { ...inp, qty_rework: e.target.value }
                                        });
                                      }}
                                      className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl font-mono font-bold text-amber-900 focus:outline-none"
                                    />
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-bold text-rose-800 block">Qty Reject</span>
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      value={inp.qty_reject}
                                      onChange={(e) => {
                                        setStageInputs({
                                          ...stageInputs,
                                          [stg.id]: { ...inp, qty_reject: e.target.value }
                                        });
                                      }}
                                      className="w-full px-3 py-1.5 bg-white border border-rose-300 rounded-xl font-mono font-bold text-rose-900 focus:outline-none"
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* OUT OF SEQUENCE WARNING */}
                {outOfSeqWarning && (
                  <div className="bg-amber-50 border border-amber-300 p-3 rounded-2xl space-y-2 text-xs">
                    <div className="flex items-start space-x-2 text-amber-900 font-bold">
                      <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                      <div>{outOfSeqWarning}</div>
                    </div>
                    <label className="flex items-center space-x-2 text-stone-900 cursor-pointer pt-1 font-bold">
                      <input
                        type="checkbox"
                        checked={confirmOutOfSeq}
                        onChange={(e) => setConfirmOutOfSeq(e.target.checked)}
                        className="w-4 h-4 text-amber-700 rounded border-stone-300"
                      />
                      <span>I confirm out-of-sequence floor entry</span>
                    </label>
                  </div>
                )}

                {/* OPTIONAL NOTES */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Supervisor Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Batch #4 thread cutting delayed due to machine maintenance"
                    value={entryNotes || ''}
                    onChange={(e) => setEntryNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900"
                  />
                </div>
              </div>

              {/* FIXED FOOTER WITH ACTION BUTTONS */}
              <div className="p-4 sm:p-5 border-t border-stone-200 shrink-0 flex items-center justify-end space-x-2 bg-stone-50/80">
                <button
                  type="button"
                  onClick={() => setIsEntryModalOpen(false)}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded-2xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEntries}
                  className="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-2xl text-xs shadow-xs flex items-center space-x-2"
                >
                  {savingEntries ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{savingEntries ? 'Saving Output...' : 'Save Finishing Output'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD DISPATCH */}
      {isDispatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-2 sm:p-4 overflow-hidden">
          <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl my-auto overflow-hidden">
            {/* FIXED MODAL HEADER */}
            <div className="p-4 sm:p-5 border-b border-stone-200 shrink-0 flex items-center justify-between bg-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center font-bold">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">Record Dispatch Delivery</h3>
                  <p className="text-xs text-stone-500">Deduct dispatched garments from finishing order balance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDispatchModalOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORM CONTAINER */}
            <form onSubmit={handleSaveDispatch} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Garment Style</label>
                  <select
                    value={dispatchStyleId}
                    onChange={(e) => setDispatchStyleId(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-900 focus:outline-none"
                  >
                    {styles.filter(s => s.status === 'active' || s.status === 'upcoming').map(s => (
                      <option key={s.id} value={s.id}>{s.style_code} — {s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Dispatch Date</label>
                    <input
                      type="date"
                      value={dispatchDate}
                      onChange={(e) => setDispatchDate(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Dispatched Quantity (pcs)</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 500"
                      value={dispatchQty}
                      onChange={(e) => setDispatchQty(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-900"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Vehicle / Truck No.</label>
                    <input
                      type="text"
                      placeholder="e.g. Dhaka Metro-T-11-2049"
                      value={dispatchVehicle || ''}
                      onChange={(e) => setDispatchVehicle(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Driver Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahim Uddin"
                      value={dispatchDriver || ''}
                      onChange={(e) => setDispatchDriver(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Destination / Warehouse</label>
                  <input
                    type="text"
                    placeholder="e.g. Buyer Port Warehouse, Chittagong"
                    value={dispatchDestination || ''}
                    onChange={(e) => setDispatchDestination(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900"
                  />
                </div>
              </div>

              {/* FIXED FOOTER */}
              <div className="p-4 sm:p-5 border-t border-stone-200 shrink-0 flex items-center justify-end space-x-2 bg-stone-50/80">
                <button
                  type="button"
                  onClick={() => setIsDispatchModalOpen(false)}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded-2xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDispatch}
                  className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-2xl text-xs shadow-xs flex items-center space-x-2"
                >
                  {savingDispatch ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                  <span>{savingDispatch ? 'Recording Dispatch...' : 'Save Dispatch'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW ENTRIES MODAL (ADMIN ONLY) */}
      {viewEntriesTarget && (
        <ViewEntriesModal
          isOpen={!!viewEntriesTarget}
          onClose={() => setViewEntriesTarget(null)}
          styleId={viewEntriesTarget.styleId}
          styleCode={viewEntriesTarget.styleCode}
          styleName={viewEntriesTarget.styleName}
          entryType="finishing"
          role={role}
          onRefresh={loadData}
        />
      )}
    </div>
  );
};

