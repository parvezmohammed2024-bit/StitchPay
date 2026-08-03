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
  DeliveryReport, UserRole, FactorySettings, GarmentProcess, ProductionEntry 
} from '../types';
import { StyleImage } from '../components/StyleImage';

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
  totalDispatchedQty: number;
  remainingBalance: number;
  completionPercent: number;
  totalRework: number;
  totalReject: number;
  inReworkCount: number;
}

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

  // Daily Entry Form Modal State
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [entryFormStyleId, setEntryFormStyleId] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(getLocalDateString());
  const [entryShift, setEntryShift] = useState<'day' | 'night'>('day');
  const [entryNotes, setEntryNotes] = useState<string>('');
  const [stageInputs, setStageInputs] = useState<Record<string, { qty_ok: string; qty_rework: string; qty_reject: string; worker_id: string }>>({});
  const [outOfSeqWarning, setOutOfSeqWarning] = useState<string | null>(null);
  const [confirmOutOfSeq, setConfirmOutOfSeq] = useState<boolean>(false);
  const [savingEntries, setSavingEntries] = useState<boolean>(false);

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stList, stgList, entList, delList, wrkList, prodEntries, setRes] = await Promise.all([
        dataService.getStyles(),
        dataService.getFinishingStages(),
        dataService.getFinishingEntries(),
        dataService.getDeliveries(),
        dataService.getWorkers(),
        dataService.getProductionEntries(),
        dataService.getSettings(),
      ]);

      setStyles(stList);
      setAllStages(stgList);
      setAllEntries(entList);
      setDeliveries(delList);
      setWorkers(wrkList);
      setSewingEntries(prodEntries);
      setSettings(setRes);

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
      // 1. Get active finishing stages for this style
      const styleStages = allStages
        .filter(stg => stg.style_id === style.id && stg.is_active !== false)
        .sort((a, b) => a.seq_no - b.seq_no);

      // 2. Filter entries for this style
      let styleEntries = allEntries.filter(e => e.style_id === style.id);
      if (filterDate) {
        styleEntries = styleEntries.filter(e => e.entry_date === filterDate);
      }

      // 3. Compute cumulative metrics per stage
      let maxGap = -1;
      let bottleneckStageId: string | null = null;
      let prevCumulative = 0;

      const summariesWithoutBottleneck: StageWipSummary[] = styleStages.map((stage, idx) => {
        const stageEntries = styleEntries.filter(e => e.stage_id === stage.id);
        const cumulativeQty = stageEntries.reduce((sum, e) => sum + (e.qty_ok || 0), 0);
        const totalRework = stageEntries.reduce((sum, e) => sum + (e.qty_rework || 0), 0);
        const totalReject = stageEntries.reduce((sum, e) => sum + (e.qty_reject || 0), 0);

        let wipWaiting = 0;
        if (idx === 0) {
          wipWaiting = 0;
        } else {
          wipWaiting = Math.max(0, prevCumulative - cumulativeQty);
          if (wipWaiting > maxGap && wipWaiting > 0) {
            maxGap = wipWaiting;
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

      // Mark bottleneck
      const stageSummaries = summariesWithoutBottleneck.map(s => ({
        ...s,
        isBottleneck: s.stage.id === bottleneckStageId,
      }));

      // Received from sewing = stage 1 cumulative output (or 0 if no stages)
      const receivedFromSewing = stageSummaries.length > 0 ? stageSummaries[0].cumulativeQty : 0;

      // Calculate sewing completed garments (MINIMUM qty_ok across sewing processes)
      const styleSewingEntries = sewingEntries.filter(e => e.style_id === style.id);
      const processTotalsMap = new Map<string, number>();
      styleSewingEntries.forEach(e => {
        const cur = processTotalsMap.get(e.process_id) || 0;
        processTotalsMap.set(e.process_id, cur + (e.qty_ok || 0));
      });

      let sewingCompletedQty = 0;
      if (processTotalsMap.size > 0) {
        sewingCompletedQty = Math.min(...Array.from(processTotalsMap.values()));
      }

      // Skip reconciliation warning for pre-cut styles (requires_cutting = false)
      const sewingWarning = style.requires_cutting !== false && (receivedFromSewing > sewingCompletedQty && sewingCompletedQty > 0);

      // Final ready to deliver stage (last stage in pipeline)
      const readyStageSummary = stageSummaries.length > 0 ? stageSummaries[stageSummaries.length - 1] : null;
      const readyToDeliverQty = readyStageSummary ? readyStageSummary.cumulativeQty : 0;

      // Dispatched quantity from deliveries
      const styleDeliveries = deliveries.filter(d => d.style_id === style.id);
      const totalDispatchedQty = styleDeliveries.reduce((sum, d) => sum + (d.delivered_qty || 0), 0);
      const remainingBalance = Math.max(0, style.order_qty - totalDispatchedQty);

      const completionPercent = receivedFromSewing > 0 
        ? Math.min(100, Math.round((readyToDeliverQty / receivedFromSewing) * 100)) 
        : 0;

      const totalRework = stageSummaries.reduce((sum, s) => sum + s.totalRework, 0);
      const totalReject = stageSummaries.reduce((sum, s) => sum + s.totalReject, 0);
      const inReworkCount = totalRework; // Sent for rework, pending re-inspection

      return {
        style,
        stages: styleStages,
        stageSummaries,
        receivedFromSewing,
        sewingCompletedQty,
        sewingWarning,
        readyToDeliverQty,
        totalDispatchedQty,
        remainingBalance,
        completionPercent,
        totalRework,
        totalReject,
        inReworkCount,
      };
    });
  }, [styles, allStages, allEntries, deliveries, sewingEntries, selectedStyleId, filterDate]);

  // Open Daily Entry Form
  const handleOpenEntryModal = (styleId?: string) => {
    const targetId = styleId || (styles.length > 0 ? styles[0].id : '');
    setEntryFormStyleId(targetId);
    setEntryDate(getLocalDateString());
    setEntryShift('day');
    setEntryNotes('');
    setOutOfSeqWarning(null);
    setConfirmOutOfSeq(false);

    // Initialize inputs for target style stages
    const targetStages = allStages
      .filter(s => s.style_id === targetId && s.is_active !== false)
      .sort((a, b) => a.seq_no - b.seq_no);

    const initialInputs: Record<string, { qty_ok: string; qty_rework: string; qty_reject: string; worker_id: string }> = {};
    targetStages.forEach(stg => {
      initialInputs[stg.id] = { qty_ok: '', qty_rework: '', qty_reject: '', worker_id: '' };
    });
    setStageInputs(initialInputs);

    setIsEntryModalOpen(true);
  };

  // Change style in Entry Form
  const handleEntryStyleChange = (styleId: string) => {
    setEntryFormStyleId(styleId);
    setOutOfSeqWarning(null);
    setConfirmOutOfSeq(false);

    const targetStages = allStages
      .filter(s => s.style_id === styleId && s.is_active !== false)
      .sort((a, b) => a.seq_no - b.seq_no);

    const initialInputs: Record<string, { qty_ok: string; qty_rework: string; qty_reject: string; worker_id: string }> = {};
    targetStages.forEach(stg => {
      initialInputs[stg.id] = { qty_ok: '', qty_rework: '', qty_reject: '', worker_id: '' };
    });
    setStageInputs(initialInputs);
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

    // Calculate existing cumulative output per stage
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
        validationIssue = `Stage cumulative output for "${stg.name}" (${newCumulative} pcs) would exceed previous stage "${prevStgName}" (${prevStageTotal} pcs).`;
      }
      prevStageTotal = newCumulative;

      if (qtyOk > 0 || qtyRework > 0 || qtyReject > 0) {
        entriesToSave.push({
          style_id: entryFormStyleId,
          stage_id: stg.id,
          worker_id: inp.worker_id || null,
          entry_date: entryDate,
          shift: entryShift,
          qty_ok: qtyOk,
          qty_rework: qtyRework,
          qty_reject: qtyReject,
          note: entryNotes || null,
          entered_by: 'Supervisor',
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

        <div className="text-stone-500 italic text-[11px]">
          💡 Note: Finishing output is tracking-only; staff wages are managed via their worker pay type.
        </div>
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
          {styleSummaries.map(summary => (
            <div key={summary.style.id} className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs space-y-5">
              {/* STYLE HEADER METRICS */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 pb-4">
                <div className="flex items-center space-x-3">
                  <StyleImage src={summary.style.image_url} alt={summary.style.name} className="w-12 h-12 rounded-2xl border border-stone-200 object-cover shrink-0" />
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-black bg-stone-100 text-stone-800 px-2 py-0.5 rounded-lg border border-stone-200">
                        {summary.style.style_code}
                      </span>
                      <h3 className="text-base font-bold text-stone-900">{summary.style.name}</h3>
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      Buyer: <span className="font-semibold text-stone-700">{summary.style.buyer_name || 'N/A'}</span> • Order Qty: <span className="font-bold text-stone-900">{summary.style.order_qty.toLocaleString()} pcs</span>
                    </div>
                  </div>
                </div>

                {/* SUMMARY NUMBERS */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-stone-50 border border-stone-200 p-2.5 rounded-2xl text-center">
                    <span className="text-[10px] font-bold text-stone-500 uppercase block">Received (Sewing)</span>
                    <span className="text-sm font-black text-stone-900">{summary.receivedFromSewing.toLocaleString()} pcs</span>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-2xl text-center">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">Ready to Deliver</span>
                    <span className="text-sm font-black text-emerald-900">{summary.readyToDeliverQty.toLocaleString()} pcs</span>
                  </div>

                  <div className="bg-sky-50 border border-sky-200 p-2.5 rounded-2xl text-center">
                    <span className="text-[10px] font-bold text-sky-700 uppercase block">Dispatched</span>
                    <span className="text-sm font-black text-sky-900">{summary.totalDispatchedQty.toLocaleString()} pcs</span>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-2xl text-center">
                    <span className="text-[10px] font-bold text-amber-800 uppercase block">Order Balance</span>
                    <span className="text-sm font-black text-amber-900">{summary.remainingBalance.toLocaleString()} pcs</span>
                  </div>
                </div>
              </div>

              {/* RECONCILE SEWING WARNING BANNER */}
              {summary.sewingWarning && (
                <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex items-center space-x-3 text-xs text-rose-900">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <span className="font-bold">Sewing Output Mismatch Warning:</span> Received <strong className="font-mono">{summary.receivedFromSewing}</strong> pcs in finishing, but sewing minimum completed is only <strong className="font-mono">{summary.sewingCompletedQty}</strong> pcs — please verify your finishing entries.
                  </div>
                </div>
              )}

              {/* HORIZONTAL STAGE PIPELINE FLOW */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-600 px-1">
                  <span>Finishing Stage Pipeline Flow</span>
                  <span className="text-indigo-700 font-bold">Overall Progress: {summary.completionPercent}%</span>
                </div>

                <div className="overflow-x-auto pb-3 pt-1">
                  <div className="flex items-stretch min-w-[700px] gap-2">
                    {summary.stageSummaries.map((stgSummary, idx) => {
                      return (
                        <React.Fragment key={stgSummary.stage.id}>
                          {/* STAGE CARD */}
                          <div className={`flex-1 rounded-2xl p-3 border transition-all relative flex flex-col justify-between ${
                            stgSummary.isBottleneck 
                              ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-400/50 shadow-xs' 
                              : 'bg-stone-50 border-stone-200'
                          }`}>
                            {/* Bottleneck Badge */}
                            {stgSummary.isBottleneck && (
                              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs flex items-center space-x-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Bottleneck</span>
                              </div>
                            )}

                            <div>
                              <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 mb-1">
                                <span>Stage {idx + 1}</span>
                                <span className="font-mono text-[9px] bg-white px-1.5 py-0.5 rounded border border-stone-200">
                                  {stgSummary.stage.code}
                                </span>
                              </div>
                              <h4 className="font-black text-stone-900 text-xs truncate" title={stgSummary.stage.name}>
                                {stgSummary.stage.name}
                              </h4>
                            </div>

                            {/* NUMBERS */}
                            <div className="mt-3 space-y-1.5 pt-2 border-t border-stone-200/60">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-stone-500 font-medium">Done:</span>
                                <span className="font-mono font-black text-stone-900">{stgSummary.cumulativeQty.toLocaleString()}</span>
                              </div>

                              {idx > 0 && (
                                <div className={`flex justify-between items-center text-xs p-1 rounded-lg ${
                                  stgSummary.isBottleneck ? 'bg-amber-200/60 text-amber-900 font-bold' : 'bg-stone-200/50 text-stone-700'
                                }`}>
                                  <span className="text-[10px] font-bold">WIP Waiting:</span>
                                  <span className="font-mono font-black">{stgSummary.wipWaiting.toLocaleString()}</span>
                                </div>
                              )}

                              {/* QC Stats if QC stage */}
                              {(stgSummary.stage.code === 'qc' || stgSummary.stage.name.toLowerCase().includes('qc')) && (
                                <div className="text-[10px] space-y-0.5 pt-1 text-stone-600 font-mono">
                                  <div className="flex justify-between text-amber-800 font-bold">
                                    <span>Rework:</span>
                                    <span>{stgSummary.totalRework}</span>
                                  </div>
                                  <div className="flex justify-between text-rose-700 font-bold">
                                    <span>Reject:</span>
                                    <span>{stgSummary.totalReject}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Arrow Divider */}
                          {idx < summary.stageSummaries.length - 1 && (
                            <div className="flex items-center justify-center text-stone-300 px-0.5">
                              <ArrowRight className="w-4 h-4" />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* QC & REWORK SUMMARY BAR */}
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
          ))}
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
                        const inp = stageInputs[stg.id] || { qty_ok: '', qty_rework: '', qty_reject: '', worker_id: '' };
                        const isQc = stg.code === 'qc' || stg.name.toLowerCase().includes('qc');

                        return (
                          <div key={stg.id} className="p-3 bg-stone-50/60 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="font-bold text-stone-900 text-xs">
                                <span className="text-stone-500 font-mono mr-1.5">{idx + 1}.</span>
                                <span>{stg.name}</span>
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

                            {/* Quantity Inputs */}
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
                    value={entryNotes}
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
                      value={dispatchVehicle}
                      onChange={(e) => setDispatchVehicle(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Driver Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahim Uddin"
                      value={dispatchDriver}
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
                    value={dispatchDestination}
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
    </div>
  );
};
