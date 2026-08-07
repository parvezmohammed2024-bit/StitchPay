import React, { useState, useEffect } from 'react';
import { 
  Scissors, Shirt, Sparkles, Truck, Users, AlertTriangle, Calendar, Filter, 
  X, CheckCircle2, ChevronDown, ChevronUp
} from 'lucide-react';
import { 
  FactorySummary, FactoryStatusRow, 
  DrillCuttingRow, DrillSewingRow, DrillFinishingStageRow, DrillReadyRow 
} from '../types';
import { dataService } from '../lib/dataService';

interface FactoryStatusSectionProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onNavigate?: (screen: string) => void;
}

type ActivePanel = 'cutting' | 'sewing' | 'finishing' | 'ready' | null;
type FilterChip = 'all' | 'cutting_pending' | 'sewing_pending' | 'finishing_wip' | 'ready_to_dispatch';

export const FactoryStatusSection: React.FC<FactoryStatusSectionProps> = ({
  selectedDate,
  onDateChange,
  onNavigate,
}) => {
  const [summary, setSummary] = useState<FactorySummary>({
    cut_pending: 0,
    cut_today: 0,
    sew_pending: 0,
    sewn_today: 0,
    fin_wip: 0,
    fin_today: 0,
    fin_ready: 0,
    dispatched: 0,
    workers_present: 0,
    workers_total: 0,
    styles_at_risk: 0,
  });

  const [statusRows, setStatusRows] = useState<FactoryStatusRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');

  // Drilldown state
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [drillCutting, setDrillCutting] = useState<DrillCuttingRow[]>([]);
  const [drillSewing, setDrillSewing] = useState<DrillSewingRow[]>([]);
  const [drillFinishing, setDrillFinishing] = useState<DrillFinishingStageRow[]>([]);
  const [drillReady, setDrillReady] = useState<DrillReadyRow[]>([]);
  const [drillLoading, setDrillLoading] = useState<boolean>(false);
  const [expandedFinishingStyles, setExpandedFinishingStyles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    const fetchStatusData = async () => {
      setLoading(true);
      try {
        const [sumData, rowsData] = await Promise.all([
          dataService.getFactorySummary(selectedDate),
          dataService.getFactoryStatus(selectedDate),
        ]);
        if (isMounted) {
          setSummary(sumData);
          setStatusRows(rowsData);
        }
      } catch (err) {
        console.error('Error loading Factory Status:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchStatusData();
    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  // Fetch drilldown data when activePanel or selectedDate changes
  useEffect(() => {
    if (!activePanel) return;
    let isMounted = true;

    const fetchDrill = async () => {
      setDrillLoading(true);
      try {
        if (activePanel === 'cutting') {
          const res = await dataService.getDrillCutting(selectedDate);
          if (isMounted) setDrillCutting(res);
        } else if (activePanel === 'sewing') {
          const res = await dataService.getDrillSewing(selectedDate);
          if (isMounted) setDrillSewing(res);
        } else if (activePanel === 'finishing') {
          const res = await dataService.getDrillFinishing(selectedDate);
          if (isMounted) setDrillFinishing(res);
        } else if (activePanel === 'ready') {
          const res = await dataService.getDrillReady(selectedDate);
          if (isMounted) setDrillReady(res);
        }
      } catch (err) {
        console.error('Error fetching drilldown:', err);
      } finally {
        if (isMounted) setDrillLoading(false);
      }
    };

    fetchDrill();
    return () => {
      isMounted = false;
    };
  }, [activePanel, selectedDate]);

  const togglePanel = (panel: ActivePanel) => {
    if (activePanel === panel) {
      setActivePanel(null);
    } else {
      setActivePanel(panel);
    }
  };

  // Grouping finishing stages by style
  const finishingStyleGroups = React.useMemo(() => {
    const waitingStages = drillFinishing.filter(r => r.waiting > 0);
    const styleKeys = Array.from(new Set(waitingStages.map(r => r.style_id || r.style_code)));

    return styleKeys.map(stKey => {
      const styleStages = drillFinishing
        .filter(r => (r.style_id || r.style_code) === stKey)
        .sort((a, b) => (a.seq_no ?? 0) - (b.seq_no ?? 0));

      let maxWaitingStage = styleStages[0];
      for (const stage of styleStages) {
        if (stage.waiting > (maxWaitingStage?.waiting || 0)) {
          maxWaitingStage = stage;
        }
      }

      return {
        styleKey: stKey,
        style_name: maxWaitingStage?.style_name || maxWaitingStage?.style_code || stKey,
        style_code: maxWaitingStage?.style_code || stKey,
        buyer: maxWaitingStage?.buyer,
        maxWaitingStage,
        stages: styleStages,
      };
    });
  }, [drillFinishing]);

  // Client side filtering on already fetched rows
  const filteredRows = React.useMemo(() => {
    return statusRows.filter(row => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'cutting_pending') {
        return row.requires_cutting !== false && (row.cut_pending || 0) > 0;
      }
      if (activeFilter === 'sewing_pending') {
        if (row.sew_pending !== undefined) return row.sew_pending > 0;
        return row.requires_cutting !== false 
          ? (row.cut_total - row.sewn_total > 0)
          : (row.order_qty - row.sewn_total > 0);
      }
      if (activeFilter === 'finishing_wip') {
        return (row.fin_wip || 0) > 0;
      }
      if (activeFilter === 'ready_to_dispatch') {
        return row.balance > 0 && row.fin_ready >= row.balance;
      }
      return true;
    });
  }, [statusRows, activeFilter]);

  // Sort: overdue first, then nearest ship date, then largest balance
  const sortedRows = React.useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const aOverdue = a.days_to_ship < 0;
      const bOverdue = b.days_to_ship < 0;

      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      if (a.days_to_ship !== b.days_to_ship) {
        return a.days_to_ship - b.days_to_ship;
      }

      return b.balance - a.balance;
    });
  }, [filteredRows]);

  const getStatusPill = (row: FactoryStatusRow) => {
    if (row.days_to_ship < 0) {
      const days = Math.abs(row.days_to_ship);
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          Overdue by {days} {days === 1 ? 'day' : 'days'}
        </span>
      );
    }
    if (row.days_to_ship <= 3) {
      const days = row.days_to_ship;
      const label = days === 0 ? 'Ships today' : `Ships in ${days} ${days === 1 ? 'day' : 'days'}`;
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          {label}
        </span>
      );
    }
    if (row.balance > 0 && row.fin_ready >= row.balance) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          Ready to dispatch
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
        {row.status || 'Active'}
      </span>
    );
  };

  const getPanelHeaderDetails = () => {
    if (activePanel === 'cutting') {
      return {
        title: 'Pending Cutting Details',
        total: summary.cut_pending,
        count: drillCutting.length,
      };
    }
    if (activePanel === 'sewing') {
      return {
        title: 'Pending Sewing Details',
        total: summary.sew_pending,
        count: drillSewing.length,
      };
    }
    if (activePanel === 'finishing') {
      return {
        title: 'Stuck in Finishing Details',
        total: summary.fin_wip,
        count: finishingStyleGroups.length,
      };
    }
    if (activePanel === 'ready') {
      return {
        title: 'Ready to Deliver Details',
        total: summary.fin_ready,
        count: drillReady.length,
      };
    }
    return { title: '', total: 0, count: 0 };
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-6 w-full max-w-full">
      {/* Header & Date Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <span>Factory Status</span>
            {loading && (
              <span className="text-xs font-medium text-stone-400 animate-pulse">(Updating...)</span>
            )}
          </h2>
          <p className="text-xs text-stone-500">Real-time floor pipeline, department WIP & style dispatch status</p>
        </div>

        <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl shrink-0">
          <Calendar className="w-4 h-4 text-stone-500" />
          <span className="text-xs font-semibold text-stone-600">Date:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="bg-transparent text-xs font-bold text-stone-900 focus:outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* TOP ROW — 4 Metric Cards (Clickable) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Pending Cutting */}
        <div
          onClick={() => togglePanel('cutting')}
          className={`cursor-pointer transition-all duration-200 rounded-xl p-4 flex flex-col justify-between space-y-2 border ${
            activePanel === 'cutting'
              ? 'bg-sky-50/70 border-sky-500 ring-2 ring-sky-500/40 shadow-sm'
              : 'bg-stone-50/80 border-stone-200/90 hover:border-stone-300'
          }`}
        >
          <div className="flex justify-between items-center text-xs font-bold text-stone-600 uppercase tracking-wide">
            <span>Pending Cutting</span>
            <Scissors className={`w-4 h-4 ${activePanel === 'cutting' ? 'text-sky-600' : 'text-stone-400'}`} />
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono tracking-tight tabular-nums">
            {summary.cut_pending.toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span>
          </div>
          <div className="text-xs font-semibold text-stone-500 flex justify-between items-center">
            <span>{summary.cut_today.toLocaleString()} cut today</span>
            <span className="text-[10px] text-stone-400 font-bold">{activePanel === 'cutting' ? '▲ Hide' : '▼ Details'}</span>
          </div>
        </div>

        {/* Card 2: Pending Sewing */}
        <div
          onClick={() => togglePanel('sewing')}
          className={`cursor-pointer transition-all duration-200 rounded-xl p-4 flex flex-col justify-between space-y-2 border ${
            activePanel === 'sewing'
              ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/40 shadow-sm'
              : 'bg-stone-50/80 border-stone-200/90 hover:border-stone-300'
          }`}
        >
          <div className="flex justify-between items-center text-xs font-bold text-stone-600 uppercase tracking-wide">
            <span>Pending Sewing</span>
            <Shirt className={`w-4 h-4 ${activePanel === 'sewing' ? 'text-indigo-600' : 'text-indigo-500'}`} />
          </div>
          <div className="text-2xl font-black text-indigo-900 font-mono tracking-tight tabular-nums">
            {summary.sew_pending.toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span>
          </div>
          <div className="text-xs font-semibold text-stone-500 flex justify-between items-center">
            <span>{summary.sewn_today.toLocaleString()} sewn today</span>
            <span className="text-[10px] text-stone-400 font-bold">{activePanel === 'sewing' ? '▲ Hide' : '▼ Details'}</span>
          </div>
        </div>

        {/* Card 3: Stuck in Finishing */}
        <div
          onClick={() => togglePanel('finishing')}
          className={`cursor-pointer transition-all duration-200 rounded-xl p-4 flex flex-col justify-between space-y-2 border ${
            activePanel === 'finishing'
              ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/40 shadow-sm'
              : 'bg-stone-50/80 border-stone-200/90 hover:border-stone-300'
          }`}
        >
          <div className="flex justify-between items-center text-xs font-bold text-stone-600 uppercase tracking-wide">
            <span>Stuck in Finishing</span>
            <Sparkles className={`w-4 h-4 ${activePanel === 'finishing' ? 'text-amber-600' : 'text-amber-500'}`} />
          </div>
          <div className="text-2xl font-black text-amber-900 font-mono tracking-tight tabular-nums">
            {summary.fin_wip.toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span>
          </div>
          <div className="text-xs font-semibold text-stone-500 flex justify-between items-center">
            <span>{summary.fin_today.toLocaleString()} finished today</span>
            <span className="text-[10px] text-stone-400 font-bold">{activePanel === 'finishing' ? '▲ Hide' : '▼ Details'}</span>
          </div>
        </div>

        {/* Card 4: Ready to Deliver */}
        <div
          onClick={() => togglePanel('ready')}
          className={`cursor-pointer transition-all duration-200 rounded-xl p-4 flex flex-col justify-between space-y-2 border ${
            activePanel === 'ready'
              ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/40 shadow-sm'
              : 'bg-stone-50/80 border-stone-200/90 hover:border-stone-300'
          }`}
        >
          <div className="flex justify-between items-center text-xs font-bold text-stone-600 uppercase tracking-wide">
            <span>Ready to Deliver</span>
            <Truck className={`w-4 h-4 ${activePanel === 'ready' ? 'text-emerald-700' : 'text-emerald-600'}`} />
          </div>
          <div className="text-2xl font-black text-emerald-900 font-mono tracking-tight tabular-nums">
            {summary.fin_ready.toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span>
          </div>
          <div className="text-xs font-semibold text-stone-500 flex justify-between items-center">
            <span>{summary.dispatched.toLocaleString()} dispatched</span>
            <span className="text-[10px] text-stone-400 font-bold">{activePanel === 'ready' ? '▲ Hide' : '▼ Details'}</span>
          </div>
        </div>
      </div>

      {/* EXPANDABLE INLINE DRILLDOWN PANEL */}
      {activePanel && (
        <div className="bg-stone-50/90 border border-stone-300 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Panel Header */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <div>
              <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                <span>{getPanelHeaderDetails().title}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">
                  {getPanelHeaderDetails().total.toLocaleString()} pcs total · {getPanelHeaderDetails().count} {getPanelHeaderDetails().count === 1 ? 'style' : 'styles'}
                </span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Detailed stage breakdown for <strong className="text-stone-800">{selectedDate}</strong>
              </p>
            </div>
            <button
              onClick={() => setActivePanel(null)}
              className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-200/80 rounded-lg transition cursor-pointer"
              title="Close Panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Panel Body */}
          {drillLoading ? (
            <div className="space-y-3 py-2">
              <div className="h-16 bg-stone-200/60 animate-pulse rounded-xl" />
              <div className="h-16 bg-stone-200/60 animate-pulse rounded-xl" />
              <div className="h-16 bg-stone-200/60 animate-pulse rounded-xl" />
            </div>
          ) : (
            <>
              {/* CARD 1: PENDING CUTTING LIST */}
              {activePanel === 'cutting' && (
                drillCutting.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 bg-white rounded-xl border border-dashed border-stone-200">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <p className="text-sm font-bold text-stone-800">Nothing pending</p>
                    <p className="text-xs text-stone-500">All styles have completed cutting for {selectedDate}.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {drillCutting.map(row => {
                      const styleCodeName = row.style_name
                        ? `${row.style_name} (${row.style_code})`
                        : row.style_code;
                      return (
                        <div
                          key={row.style_id || row.style_code}
                          className="bg-white border border-stone-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-stone-900 text-sm">
                                {styleCodeName}
                              </h4>
                              {row.buyer && (
                                <span className="text-xs font-medium text-stone-500">· {row.buyer}</span>
                              )}
                              {row.workers_today === 0 && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                                  no cutter assigned today
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-stone-500 flex items-center gap-1.5 flex-wrap">
                              <span><strong className="text-stone-700 font-bold">{row.cut_total.toLocaleString()}</strong> cut</span>
                              <span>·</span>
                              <span><strong className="text-stone-700 font-bold">{row.cut_today.toLocaleString()}</strong> today</span>
                              <span>·</span>
                              <span>
                                last cut:{' '}
                                {row.last_cut_date ? (
                                  <strong className="text-stone-700 font-bold">{row.last_cut_date}</strong>
                                ) : (
                                  <span className="text-amber-700 font-bold px-1.5 py-0.2 bg-amber-50 rounded border border-amber-200 text-[10px]">
                                    not started yet
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-100">
                            <div className="text-right">
                              <div className="text-lg font-black text-stone-900 font-mono tabular-nums">
                                {row.cut_pending.toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span>
                              </div>
                              <div className="text-[11px] font-semibold text-stone-400">
                                of {row.order_qty.toLocaleString()}
                              </div>
                            </div>
                            <button
                              onClick={() => onNavigate?.('cutting')}
                              className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                            >
                              Record cutting
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* CARD 2: PENDING SEWING LIST */}
              {activePanel === 'sewing' && (
                drillSewing.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 bg-white rounded-xl border border-dashed border-stone-200">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <p className="text-sm font-bold text-stone-800">Nothing pending</p>
                    <p className="text-xs text-stone-500">All styles have completed sewing for {selectedDate}.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {drillSewing.map(row => {
                      const styleCodeName = row.style_name
                        ? `${row.style_name} (${row.style_code})`
                        : row.style_code;
                      const isWaitingForCutting = row.ready_to_sew === 0 && row.sew_pending > 0;

                      return (
                        <div
                          key={row.style_id || row.style_code}
                          className="bg-white border border-stone-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-stone-900 text-sm">
                                {styleCodeName}
                              </h4>
                              {row.buyer && (
                                <span className="text-xs font-medium text-stone-500">· {row.buyer}</span>
                              )}
                              {isWaitingForCutting && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  waiting for cutting
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-stone-500 flex items-center gap-1.5 flex-wrap">
                              <span><strong className="text-stone-700 font-bold">{row.sewn_total.toLocaleString()}</strong> sewn</span>
                              <span>·</span>
                              <span><strong className="text-stone-700 font-bold">{row.sewn_today.toLocaleString()}</strong> today</span>
                              <span>·</span>
                              <span><strong className="text-indigo-700 font-bold">{row.workers_assigned}</strong> workers on line</span>
                              <span>·</span>
                              <span><strong className="text-emerald-700 font-bold">{row.ready_to_sew.toLocaleString()}</strong> ready to sew</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-100">
                            <div className="text-right">
                              <div className="text-lg font-black text-indigo-950 font-mono tabular-nums">
                                {row.sew_pending.toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span>
                              </div>
                              <div className="text-[11px] font-semibold text-stone-400">
                                of {row.order_qty.toLocaleString()}
                              </div>
                            </div>
                            <button
                              onClick={() => onNavigate?.('dailySetup')}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                            >
                              Open line setup
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* CARD 3: STUCK IN FINISHING LIST (GROUPED BY STYLE) */}
              {activePanel === 'finishing' && (
                finishingStyleGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 bg-white rounded-xl border border-dashed border-stone-200">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <p className="text-sm font-bold text-stone-800">Nothing pending</p>
                    <p className="text-xs text-stone-500">No styles currently stuck in finishing stages.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {finishingStyleGroups.map(grp => {
                      const isExpanded = !!expandedFinishingStyles[grp.styleKey];
                      const maxStage = grp.maxWaitingStage;

                      return (
                        <div
                          key={grp.styleKey}
                          className="bg-white border border-stone-200 rounded-xl p-3.5 space-y-3 shadow-xs"
                        >
                          {/* Main Style Summary Row */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-stone-900 text-sm">
                                  {grp.style_name} — <span className="text-amber-800 font-extrabold">waiting at {maxStage?.stage_name}</span>
                                </h4>
                                {grp.buyer && (
                                  <span className="text-xs font-medium text-stone-500">· {grp.buyer}</span>
                                )}
                              </div>
                              <div className="text-xs text-stone-500 flex items-center gap-2">
                                <button
                                  onClick={() => setExpandedFinishingStyles(prev => ({ ...prev, [grp.styleKey]: !prev[grp.styleKey] }))}
                                  className="text-stone-600 hover:text-stone-900 font-semibold flex items-center gap-1 cursor-pointer underline decoration-stone-300 underline-offset-2"
                                >
                                  {isExpanded ? (
                                    <><span>Hide all stages</span> <ChevronUp className="w-3.5 h-3.5" /></>
                                  ) : (
                                    <><span>Show stage stepper ({grp.stages.length})</span> <ChevronDown className="w-3.5 h-3.5" /></>
                                  )}
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-100">
                              <div className="text-right">
                                <div className="text-lg font-black text-amber-950 font-mono tabular-nums">
                                  {maxStage?.waiting.toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs waiting</span>
                                </div>
                                <div className="text-[11px] font-semibold text-emerald-700">
                                  {maxStage?.done_today.toLocaleString()} today
                                </div>
                              </div>
                              <button
                                onClick={() => onNavigate?.('finishing')}
                                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                              >
                                Log output
                              </button>
                            </div>
                          </div>

                          {/* Expanded Stage Stepper */}
                          {isExpanded && (
                            <div className="pt-2 border-t border-stone-100 space-y-2 bg-stone-50/70 p-3 rounded-lg">
                              <h5 className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                                Stage Workflow Sequence
                              </h5>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {grp.stages.map((stg, idx) => (
                                  <div
                                    key={stg.stage_id || idx}
                                    className="bg-white border border-stone-200 p-2.5 rounded-lg space-y-1"
                                  >
                                    <div className="flex justify-between items-center text-xs font-bold text-stone-900">
                                      <span>{stg.seq_no !== undefined ? `${stg.seq_no}. ` : ''}{stg.stage_name}</span>
                                      <span className={`font-mono text-xs ${stg.waiting > 0 ? 'text-amber-800 font-extrabold' : 'text-stone-400 font-normal'}`}>
                                        {stg.waiting.toLocaleString()} waiting
                                      </span>
                                    </div>

                                    <div className="text-[11px] text-stone-500 flex justify-between">
                                      <span>Done: <strong className="text-stone-800">{stg.done.toLocaleString()}</strong> / {stg.received.toLocaleString()}</span>
                                      <span className="text-emerald-700 font-semibold">+{stg.done_today} today</span>
                                    </div>

                                    {/* Separate chips for rework/reject if > 0 */}
                                    {(stg.rework > 0 || stg.reject > 0) && (
                                      <div className="flex items-center gap-1.5 pt-1">
                                        {stg.rework > 0 && (
                                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 rounded-full">
                                            Rework: {stg.rework}
                                          </span>
                                        )}
                                        {stg.reject > 0 && (
                                          <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 rounded-full">
                                            Reject: {stg.reject}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* CARD 4: READY TO DELIVER LIST */}
              {activePanel === 'ready' && (
                drillReady.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 bg-white rounded-xl border border-dashed border-stone-200">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <p className="text-sm font-bold text-stone-800">Nothing pending</p>
                    <p className="text-xs text-stone-500">No styles ready to deliver for {selectedDate}.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {drillReady.map(row => {
                      const styleCodeName = row.style_name
                        ? `${row.style_name} (${row.style_code})`
                        : row.style_code;
                      const isOverdue = row.days_to_ship < 0;

                      return (
                        <div
                          key={row.style_id || row.style_code}
                          className="bg-white border border-stone-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-stone-900 text-sm">
                                {styleCodeName}
                              </h4>
                              {row.buyer && (
                                <span className="text-xs font-medium text-stone-500">· {row.buyer}</span>
                              )}
                              {isOverdue && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  overdue by {Math.abs(row.days_to_ship)} {Math.abs(row.days_to_ship) === 1 ? 'day' : 'days'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-stone-500 flex items-center gap-1.5 flex-wrap">
                              <span><strong className="text-stone-700 font-bold">{row.dispatched.toLocaleString()}</strong> dispatched</span>
                              <span>·</span>
                              <span><strong className="text-stone-700 font-bold">{row.balance.toLocaleString()}</strong> balance</span>
                              <span>·</span>
                              <span>ships: <strong className="text-stone-700 font-bold">{row.target_ship_date || 'N/A'}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-100">
                            <div className="text-right">
                              <div className="text-lg font-black text-emerald-950 font-mono tabular-nums">
                                {row.qty_available.toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span>
                              </div>
                              <div className="text-[11px] font-semibold text-stone-400">
                                ready to deliver
                              </div>
                            </div>
                            <button
                              onClick={() => onNavigate?.('finishing')}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                            >
                              Record dispatch
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}

      {/* Thin Summary Line */}
      <div className="pt-1 pb-2 border-b border-stone-100 flex items-center justify-between text-xs text-stone-600 font-medium">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-stone-400" />
          <span>
            <strong className="text-stone-900 font-bold">{summary.workers_present}</strong> of <strong className="text-stone-900 font-bold">{summary.workers_total}</strong> present
          </span>
          <span className="text-stone-300">·</span>
          <span>
            <strong className="text-amber-700 font-bold">{summary.styles_at_risk}</strong> styles shipping within 7 days
          </span>
        </div>
      </div>

      {/* FILTER CHIPS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-stone-400 font-semibold flex items-center gap-1 mr-1 shrink-0">
          <Filter className="w-3.5 h-3.5" />
          Filter:
        </span>
        {[
          { id: 'all', label: 'All' },
          { id: 'cutting_pending', label: 'Cutting pending' },
          { id: 'sewing_pending', label: 'Sewing pending' },
          { id: 'finishing_wip', label: 'Finishing WIP' },
          { id: 'ready_to_dispatch', label: 'Ready to dispatch' },
        ].map(chip => (
          <button
            key={chip.id}
            onClick={() => setActiveFilter(chip.id as FilterChip)}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeFilter === chip.id
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* STYLE CARDS LIST */}
      <div className="space-y-4 pt-1">
        {sortedRows.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
            <p className="text-xs text-stone-500 font-medium">
              {loading ? 'Loading style status...' : 'No active styles match the selected filter.'}
            </p>
          </div>
        ) : (
          sortedRows.map(row => {
            const reqCutting = row.requires_cutting !== false;
            const styleCodeName = row.style_name
              ? `${row.style_name} (${row.style_code})`
              : row.style_code;

            return (
              <div
                key={row.style_id || row.style_code}
                className="bg-stone-50/50 border border-stone-200 rounded-xl p-4 hover:border-stone-300 transition-all space-y-3.5"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/60 pb-2.5">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-stone-900">
                        {styleCodeName}
                      </h3>
                      {getStatusPill(row)}
                    </div>
                    <p className="text-xs text-stone-500 font-medium">
                      {row.buyer ? `${row.buyer} · ` : ''}Order: <strong className="text-stone-800 font-bold">{row.order_qty.toLocaleString()} pcs</strong>
                    </p>
                  </div>
                </div>

                {/* 4 (or 3) Columns */}
                <div
                  className={`grid gap-3 pt-1 ${
                    reqCutting
                      ? 'grid-cols-2 sm:grid-cols-4'
                      : 'grid-cols-1 sm:grid-cols-3'
                  }`}
                >
                  {/* Column 1: Cutting */}
                  {reqCutting && (
                    <div className="bg-white p-2.5 rounded-lg border border-stone-200/80">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-stone-500">
                        Cutting
                      </div>
                      <div className="text-sm font-extrabold text-stone-900 font-mono mt-0.5">
                        {row.cut_total.toLocaleString()} <span className="text-[10px] font-normal text-stone-400">/ {row.order_qty.toLocaleString()}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-stone-500 mt-0.5">
                        {row.cut_pending.toLocaleString()} pending
                      </div>
                    </div>
                  )}

                  {/* Column 2: Sewing */}
                  <div className="bg-white p-2.5 rounded-lg border border-stone-200/80">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-stone-500">
                      Sewing
                    </div>
                    <div className="text-sm font-extrabold text-stone-900 font-mono mt-0.5">
                      {row.sewn_total.toLocaleString()} <span className="text-[10px] font-normal text-stone-400">/ {row.order_qty.toLocaleString()}</span>
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                      +{row.sewn_today.toLocaleString()} today
                    </div>
                  </div>

                  {/* Column 3: Finishing */}
                  <div className="bg-white p-2.5 rounded-lg border border-stone-200/80">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-stone-500">
                      Finishing
                    </div>
                    <div className="text-sm font-extrabold text-stone-900 font-mono mt-0.5">
                      {row.fin_ready.toLocaleString()} <span className="text-[10px] font-normal text-stone-400">/ {row.fin_received.toLocaleString()}</span>
                    </div>
                    <div className="text-[11px] font-semibold text-amber-700 mt-0.5">
                      {row.fin_wip.toLocaleString()} in WIP
                    </div>
                  </div>

                  {/* Column 4: Dispatched */}
                  <div className="bg-white p-2.5 rounded-lg border border-stone-200/80">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-stone-500">
                      Dispatched
                    </div>
                    <div className="text-sm font-extrabold text-stone-900 font-mono mt-0.5">
                      {row.dispatched.toLocaleString()}
                    </div>
                    <div className="text-[11px] font-semibold text-stone-500 mt-0.5">
                      {row.balance.toLocaleString()} balance
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between items-center text-[11px] font-semibold text-stone-500">
                    <span>Overall Completion</span>
                    <span className="font-mono font-bold text-stone-800">{Math.min(100, Math.max(0, Math.round(row.pct_complete)))}%</span>
                  </div>
                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, row.pct_complete))}%` }}
                    />
                  </div>
                </div>

                {/* Bottleneck Warning Line */}
                {row.bottleneck_qty !== undefined && row.bottleneck_qty > 0 && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      Bottleneck: <strong className="font-bold">{row.bottleneck_stage || 'Process'}</strong> — <span className="font-mono font-bold">{row.bottleneck_qty}</span> waiting
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
