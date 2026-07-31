import React, { useState, useEffect } from 'react';
import { BarChart3, Download, TrendingUp, AlertTriangle, FileSpreadsheet, PieChart as PieIcon } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useTranslation } from '../lib/i18n';
import { dataService } from '../lib/dataService';
import { ProductionEntry, GarmentStyle, Worker, FactorySettings } from '../types';

export const ReportsScreen: React.FC = () => {
  const { t } = useTranslation();

  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [settings, setSettings] = useState<FactorySettings | null>(null);

  useEffect(() => {
    loadReportsData();
  }, []);

  const loadReportsData = async () => {
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
  };

  const currencySymbol = settings?.currency_symbol || '৳';

  // Process Bottleneck Data (avg pieces per entry or total rejects)
  const procRejectMap = new Map<string, number>();
  entries.forEach(e => {
    const name = e.process_name || 'Process';
    const cur = procRejectMap.get(name) || 0;
    procRejectMap.set(name, cur + e.qty_reject);
  });

  const bottleneckData = Array.from(procRejectMap.entries())
    .map(([name, rejects]) => ({ name: name.slice(0, 15), rejects }))
    .sort((a, b) => b.rejects - a.rejects)
    .slice(0, 6);

  // Worker Earnings Ranking
  const workerEarnMap = new Map<string, number>();
  entries.forEach(e => {
    const cur = workerEarnMap.get(e.worker_id) || 0;
    workerEarnMap.set(e.worker_id, cur + e.amount);
  });

  const workersMap = new Map<string, Worker>(workers.map(w => [w.id, w]));
  const workerRankData = Array.from(workerEarnMap.entries())
    .map(([wId, amt]) => ({
      name: workersMap.get(wId)?.full_name || 'Worker',
      amount: Math.round(amt),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  // CSV Export
  const handleExportCSV = () => {
    let csv = 'Entry Date,Worker Code,Worker Name,Style,Process,Qty OK,Qty Rework,Qty Reject,Piece Rate,Total Amount\n';
    entries.forEach(e => {
      csv += `"${e.entry_date}","${e.worker_code}","${e.worker_name}","${e.style_name}","${e.process_name}",${e.qty_ok},${e.qty_rework},${e.qty_reject},${e.rate_snapshot},${e.amount}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stitchpay_production_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 pb-24 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            <span>Factory Production Analytics & Audit Reports</span>
          </h1>
          <p className="text-xs text-slate-400">Bottlenecks, style costings, defect rates & worker rankings</p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-4 py-2.5 rounded-xl transition-all text-xs shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Export Production CSV</span>
        </button>
      </div>

      {/* Grid: Worker Earnings Ranking & Process Bottleneck */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Worker Earnings Ranking Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Top Worker Piece Earnings</span>
          </h3>
          <p className="text-xs text-slate-400 mb-4">Cumulative earnings across current period</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workerRankData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#64748b" fontSize={10} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={90} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                <Bar dataKey="amount" fill="#10b981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Process Defect / Rejection Bottlenecks */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Process Rejection Bottlenecks</span>
          </h3>
          <p className="text-xs text-slate-400 mb-4">Operations with highest defective piece counts</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bottleneckData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                <Bar dataKey="rejects" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
