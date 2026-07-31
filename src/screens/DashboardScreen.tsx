import React, { useEffect, useState } from 'react';
import { 
  Shirt, Users, DollarSign, Award, TrendingUp, CheckCircle2, ArrowUpRight,
  AlertTriangle, Flame, Clock, BarChart3, Layers
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { useTranslation } from '../lib/i18n';
import { dataService } from '../lib/dataService';
import { ProductionEntry, GarmentStyle, Worker, FactorySettings, DailyAssignment, GarmentProcess } from '../types';

export const DashboardScreen: React.FC = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [processes, setProcesses] = useState<GarmentProcess[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [assignments, setAssignments] = useState<DailyAssignment[]>([]);
  const [settings, setSettings] = useState<FactorySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    const [eList, sList, pList, wList, aList, setRes] = await Promise.all([
      dataService.getProductionEntries(),
      dataService.getStyles(),
      dataService.getProcesses(),
      dataService.getWorkers(),
      dataService.getDailyAssignments(todayStr),
      dataService.getSettings(),
    ]);
    setEntries(eList);
    setStyles(sList);
    setProcesses(pList);
    setWorkers(wList);
    setAssignments(aList);
    setSettings(setRes);
    setLoading(false);
  };

  const todayEntries = entries.filter(e => e.entry_date === todayStr);

  const todayPieces = todayEntries.reduce((sum, e) => sum + e.qty_ok, 0);
  const todayWageCost = todayEntries.reduce((sum, e) => sum + e.amount, 0);

  // Active floor workers today
  const activeWorkerIds = new Set(todayEntries.map(e => e.worker_id));
  const activeWorkersCount = activeWorkerIds.size;

  // Planned targets today
  const todayTargetTotal = assignments.reduce((sum, a) => sum + (a.target_qty || 250), 0);
  const todayTargetCompletionPct = todayTargetTotal > 0 ? Math.min(100, Math.round((todayPieces / todayTargetTotal) * 100)) : 0;

  // Compute Completed Garments vs Total Operations
  // Completed Garments = Sum over active styles of min(output across operations in style sequence)
  const completedGarments = React.useMemo(() => {
    let sumGarments = 0;
    const styleIds = Array.from(new Set(assignments.map(a => a.style_id)));
    for (const sId of styleIds) {
      const styleProcesses = processes.filter(p => p.style_id === sId);
      if (styleProcesses.length === 0) continue;

      let minProcOutput = Infinity;
      for (const proc of styleProcesses) {
        const procOutput = todayEntries
          .filter(e => e.style_id === sId && e.process_id === proc.id)
          .reduce((sum, e) => sum + e.qty_ok, 0);
        if (procOutput < minProcOutput) minProcOutput = procOutput;
      }
      if (minProcOutput !== Infinity) sumGarments += minProcOutput;
    }
    return sumGarments;
  }, [assignments, processes, todayEntries]);

  // Per Process Completion Percentage Bar Chart (Bottleneck analysis - lowest completion first)
  const processCompletionChart = React.useMemo(() => {
    const procMap = new Map<string, { processName: string; styleCode: string; target: number; done: number; pct: number }>();

    for (const a of assignments) {
      const p = processes.find(proc => proc.id === a.process_id);
      const s = styles.find(st => st.id === a.style_id);
      const cur = procMap.get(a.process_id) || {
        processName: p?.name || 'Operation',
        styleCode: s?.style_code || '',
        target: 0,
        done: 0,
        pct: 0,
      };

      const aDone = todayEntries
        .filter(e => e.process_id === a.process_id && e.worker_id === a.worker_id)
        .reduce((sum, e) => sum + e.qty_ok, 0);

      cur.target += (a.target_qty || 250);
      cur.done += aDone;
      procMap.set(a.process_id, cur);
    }

    const list = Array.from(procMap.values()).map(item => ({
      ...item,
      pct: item.target > 0 ? Math.min(100, Math.round((item.done / item.target) * 100)) : 0,
      label: `${item.styleCode} - ${item.processName}`,
    }));

    // Sort lowest completion percentage first (Bottlenecks at top!)
    return list.sort((a, b) => a.pct - b.pct);
  }, [assignments, processes, styles, todayEntries]);

  // "Not Started" List: Assignments with 0 output today
  const notStartedList = React.useMemo(() => {
    const list: { assignment: DailyAssignment; worker: Worker | undefined; process: GarmentProcess | undefined; style: GarmentStyle | undefined }[] = [];

    for (const a of assignments) {
      const aDone = todayEntries
        .filter(e => e.process_id === a.process_id && e.worker_id === a.worker_id)
        .reduce((sum, e) => sum + e.qty_ok, 0);

      if (aDone === 0) {
        list.push({
          assignment: a,
          worker: workers.find(w => w.id === a.worker_id),
          process: processes.find(p => p.id === a.process_id),
          style: styles.find(s => s.id === a.style_id),
        });
      }
    }
    return list;
  }, [assignments, todayEntries, workers, processes, styles]);

  // Top 5 earners today
  const workerEarningsMap = new Map<string, number>();
  todayEntries.forEach(e => {
    const cur = workerEarningsMap.get(e.worker_id) || 0;
    workerEarningsMap.set(e.worker_id, cur + e.amount);
  });

  const workersMap = new Map(workers.map(w => [w.id, w]));
  const topEarnerList: { worker: Worker; amount: number }[] = Array.from(workerEarningsMap.entries())
    .map(([wId, amt]) => ({
      worker: workersMap.get(wId),
      amount: amt,
    }))
    .filter((item): item is { worker: Worker; amount: number } => Boolean(item.worker))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // 14-day production output data for Recharts
  const chartData: { date: string; pieces: number; amount: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
    const dayEntries = entries.filter(e => e.entry_date === dStr);
    const pSum = dayEntries.reduce((sum, e) => sum + e.qty_ok, 0);
    const aSum = dayEntries.reduce((sum, e) => sum + e.amount, 0);
    chartData.push({
      date: dStr.slice(5),
      pieces: pSum,
      amount: Math.round(aSum),
    });
  }

  const currencySymbol = settings?.currency_symbol || '৳';

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Production Overview</span>
            <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
              {todayStr}
            </span>
          </h1>
          <p className="text-xs text-slate-400">Live floor line setup, bottleneck operations & payroll metrics</p>
        </div>
      </div>

      {/* TODAY'S PRODUCTION KPI CARD & BOTTLENECK SUMMARY */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Flame className="w-5 h-5 text-amber-400 fill-amber-400" />
            <span>Today's Line Setup & Production Completion</span>
          </h2>
          <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
            {todayTargetCompletionPct}% Target Met
          </span>
        </div>

        {/* Global Line Target Completion Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400 font-semibold">
            <span>Overall Floor Progress: <strong className="text-white">{todayPieces.toLocaleString()} / {todayTargetTotal.toLocaleString()} pcs</strong></span>
            <span className="text-emerald-400 font-bold">{todayTargetCompletionPct}%</span>
          </div>
          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${todayTargetCompletionPct}%` }}
            />
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Completed Garments</div>
            <div className="text-xl font-black text-emerald-400 font-mono mt-1">
              {completedGarments.toLocaleString()} <span className="text-xs font-normal text-slate-400">full garments</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Slowest bottleneck capacity</div>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Total Operations Logged</div>
            <div className="text-xl font-black text-indigo-400 font-mono mt-1">
              {todayPieces.toLocaleString()} <span className="text-xs font-normal text-slate-400">op steps</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Sum across all processes</div>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Today's Piece Wage Cost</div>
            <div className="text-xl font-black text-amber-400 font-mono mt-1">
              {currencySymbol}{todayWageCost.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Accrued piece rate pay</div>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Active Floor Workers</div>
            <div className="text-xl font-black text-white font-mono mt-1">
              {activeWorkersCount} <span className="text-xs font-normal text-slate-400">/ {workers.length}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Logged pieces today</div>
          </div>
        </div>
      </div>

      {/* BOTTLENECK ANALYSIS & NOT STARTED WORKERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Process Completion % Chart (Lowest Completion First) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-rose-400" />
              <span>Process Line Completion (Bottlenecks First)</span>
            </h3>
            <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded font-mono">Lowest % Top</span>
          </div>

          {processCompletionChart.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No process assignments planned today.</div>
          ) : (
            <div className="space-y-3">
              {processCompletionChart.slice(0, 6).map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-white truncate max-w-[220px]">{item.label}</span>
                    <span className={`font-mono font-bold ${item.pct < 30 ? 'text-rose-400' : item.pct < 70 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {item.done} / {item.target} pcs ({item.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.pct < 30 ? 'bg-rose-500' : item.pct < 70 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Not Started List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Not Started Today ({notStartedList.length})</span>
              </h3>
              <span className="text-[10px] bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded font-mono">0 Output Logged</span>
            </div>

            {notStartedList.length === 0 ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center text-emerald-300 text-xs font-medium">
                All planned line workers have logged output today! Excellent line activation.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {notStartedList.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                    <div className="flex items-center space-x-3">
                      {item.worker?.photo_url ? (
                        <img src={item.worker.photo_url} alt={item.worker.full_name} className="w-9 h-9 rounded-full object-cover border border-slate-600" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold">
                          {item.worker?.full_name.substring(0, 2)}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-white">{item.worker?.full_name}</div>
                        <div className="text-[11px] text-amber-400 font-medium">
                          {item.process?.name} <span className="text-slate-500">({item.style?.style_code})</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-[11px] font-mono text-slate-400">
                      Target: {item.assignment.target_qty || 250} pcs
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: 14-Day Chart & Top Earners */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 14-Day Production Output Line Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <span>{t('outputTrend')}</span>
              </h3>
              <p className="text-xs text-slate-400">Total pieces completed per day over the last two weeks</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                  formatter={(val: any) => [`${val} pcs`, 'Pieces']}
                />
                <Line 
                  type="monotone" 
                  dataKey="pieces" 
                  stroke="#6366f1" 
                  strokeWidth={3} 
                  dot={{ fill: '#fbbf24', r: 4 }} 
                  activeDot={{ r: 6 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 5 Earners Today */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span>{t('topEarners')}</span>
              </h3>
              <span className="text-[10px] bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded font-mono">Today</span>
            </div>

            <div className="space-y-3">
              {topEarnerList.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No production entries logged yet today.
                </div>
              ) : (
                topEarnerList.map((item, idx) => (
                  <div 
                    key={item.worker?.id || idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <img 
                          src={item.worker?.photo_url || ''} 
                          alt={item.worker?.full_name} 
                          className="w-10 h-10 rounded-full object-cover border border-slate-600"
                        />
                        <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-950 ${
                          idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-slate-300' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300'
                        }`}>
                          {idx + 1}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-white truncate max-w-[130px]">
                          {item.worker?.full_name}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {item.worker?.worker_code} • {item.worker?.line_no}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-amber-400 font-mono">
                        {currencySymbol}{item.amount.toFixed(0)}
                      </div>
                      <div className="text-[10px] text-slate-500">Earned</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Per-Style Progress Bars */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{t('styleProgress')}</span>
        </h3>
        <p className="text-xs text-slate-400 mb-4">Completed order garments vs buyer target</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {styles.map(style => {
            const completed = style.completed_pieces || 0;
            const target = style.order_qty || 1;
            const percent = Math.min(100, Math.round((completed / target) * 100));

            return (
              <div key={style.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-3">
                    <img 
                      src={style.image_url || ''} 
                      alt={style.name} 
                      className="w-12 h-12 rounded-lg object-cover border border-slate-600"
                    />
                    <div>
                      <h4 className="font-bold text-sm text-white">{style.name}</h4>
                      <p className="text-xs text-slate-400 font-mono">{style.style_code} • {style.buyer_name}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg border border-indigo-500/30">
                    {percent}% Done
                  </span>
                </div>

                <div className="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden mt-3">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-amber-400 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-xs font-mono text-slate-400 mt-2">
                  <span>{completed.toLocaleString()} completed</span>
                  <span>Target: {target.toLocaleString()} pcs</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
