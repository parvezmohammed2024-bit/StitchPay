import React, { useState, useEffect } from 'react';
import { 
  Scissors, Shirt, Sparkles, Truck, Users, AlertTriangle, Calendar, Filter, Clock
} from 'lucide-react';
import { FactorySummary, FactoryStatusRow } from '../types';
import { dataService } from '../lib/dataService';

interface FactoryStatusSectionProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

type FilterChip = 'all' | 'cutting_pending' | 'sewing_pending' | 'finishing_wip' | 'ready_to_dispatch';

export const FactoryStatusSection: React.FC<FactoryStatusSectionProps> = ({
  selectedDate,
  onDateChange,
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

      {/* TOP ROW — 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Pending Cutting */}
        <div className="bg-stone-50/80 border border-stone-200/90 rounded-xl p-4 flex flex-col justify-between space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-stone-600 uppercase tracking-wide">
            <span>Pending Cutting</span>
            <Scissors className="w-4 h-4 text-stone-400" />
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono tracking-tight tabular-nums">
            {summary.cut_pending.toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span>
          </div>
          <div className="text-xs font-semibold text-stone-500">
            {summary.cut_today.toLocaleString()} cut today
          </div>
        </div>

        {/* Card 2: Pending Sewing */}
        <div className="bg-stone-50/80 border border-stone-200/90 rounded-xl p-4 flex flex-col justify-between space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-stone-600 uppercase tracking-wide">
            <span>Pending Sewing</span>
            <Shirt className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-900 font-mono tracking-tight tabular-nums">
            {summary.sew_pending.toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span>
          </div>
          <div className="text-xs font-semibold text-stone-500">
            {summary.sewn_today.toLocaleString()} sewn today
          </div>
        </div>

        {/* Card 3: Stuck in Finishing */}
        <div className="bg-stone-50/80 border border-stone-200/90 rounded-xl p-4 flex flex-col justify-between space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-stone-600 uppercase tracking-wide">
            <span>Stuck in Finishing</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-900 font-mono tracking-tight tabular-nums">
            {summary.fin_wip.toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span>
          </div>
          <div className="text-xs font-semibold text-stone-500">
            {summary.fin_today.toLocaleString()} finished today
          </div>
        </div>

        {/* Card 4: Ready to Deliver */}
        <div className="bg-stone-50/80 border border-stone-200/90 rounded-xl p-4 flex flex-col justify-between space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-stone-600 uppercase tracking-wide">
            <span>Ready to Deliver</span>
            <Truck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 font-mono tracking-tight tabular-nums">
            {summary.fin_ready.toLocaleString()} <span className="text-xs font-normal text-stone-500">pcs</span>
          </div>
          <div className="text-xs font-semibold text-stone-500">
            {summary.dispatched.toLocaleString()} dispatched
          </div>
        </div>
      </div>

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
