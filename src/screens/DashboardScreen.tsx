import React, { useEffect, useState } from 'react';
import { 
  Shirt, Users, DollarSign, Award, TrendingUp, CheckCircle2, ArrowUpRight 
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useTranslation } from '../lib/i18n';
import { dataService } from '../lib/dataService';
import { ProductionEntry, GarmentStyle, Worker, FactorySettings } from '../types';

export const DashboardScreen: React.FC = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [settings, setSettings] = useState<FactorySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    const [eList, sList, wList, setRes] = await Promise.all([
      dataService.getProductionEntries(),
      dataService.getStyles(),
      dataService.getWorkers(),
      dataService.getSettings(),
    ]);
    setEntries(eList);
    setStyles(sList);
    setWorkers(wList);
    setSettings(setRes);
    setLoading(false);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayEntries = entries.filter(e => e.entry_date === todayStr);

  const todayPieces = todayEntries.reduce((sum, e) => sum + e.qty_ok, 0);
  const todayWageCost = todayEntries.reduce((sum, e) => sum + e.amount, 0);

  // Active floor workers today
  const activeWorkerIds = new Set(todayEntries.map(e => e.worker_id));
  const activeWorkersCount = activeWorkerIds.size;

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
      date: dStr.slice(5), // '07-31'
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
          <p className="text-xs text-slate-400">Live floor production summary & daily payroll metrics</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Pieces */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('today')} {t('pieces')}</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Shirt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums">
              {todayPieces.toLocaleString()} <span className="text-sm font-normal text-slate-400">pcs</span>
            </div>
            <p className="text-[11px] text-emerald-400 mt-1 flex items-center font-medium">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> Logged on floor today
            </p>
          </div>
        </div>

        {/* Today's Wage Cost */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('today')} {t('totalWage')}</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tabular-nums">
              {currencySymbol}{todayWageCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Piece rate liability</p>
          </div>
        </div>

        {/* Active Floor Workers */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('activeWorkers')}</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums">
              {activeWorkersCount} <span className="text-sm font-normal text-slate-400">/ {workers.length}</span>
            </div>
            <p className="text-[11px] text-emerald-400 mt-1 font-medium">Recorded entries today</p>
          </div>
        </div>

        {/* Garment Styles */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Styles</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums">
              {styles.filter(s => s.status === 'active').length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">In active sewing lines</p>
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
