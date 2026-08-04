import React, { useState, useEffect } from 'react';
import { BarChart3, Download, TrendingUp, AlertTriangle, FileSpreadsheet, PackageCheck, DollarSign } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useTranslation } from '../lib/i18n';
import { dataService } from '../lib/dataService';
import { ProductionEntry, GarmentStyle, Worker, FactorySettings, UserRole } from '../types';
import { StyleReportScreen } from './StyleReportScreen';
import { FinancialsReportView } from '../components/FinancialsReportView';

type ReportTab = 'style_report' | 'overview' | 'financials';

interface ReportsScreenProps {
  role?: UserRole;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({ role }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ReportTab>('style_report');

  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [settings, setSettings] = useState<FactorySettings | null>(null);

  const currentRole = role || dataService.getRole();
  const isAdmin = currentRole === 'admin';

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

  const currencySymbol = settings?.currency_symbol || 'MYR';

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

  // Worker Piece Earnings Ranking (Exclude salaried workers)
  const workersMap = new Map<string, Worker>(workers.map(w => [w.id, w]));
  const workerEarnMap = new Map<string, number>();
  entries.forEach(e => {
    const w = workersMap.get(e.worker_id);
    if (w?.pay_type === 'monthly_salary') return; // Exclude monthly salaried workers from piece earnings ranking
    const cur = workerEarnMap.get(e.worker_id) || 0;
    workerEarnMap.set(e.worker_id, cur + e.amount);
  });

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
      {/* Top Report Module Tabs */}
      <div className="flex items-center space-x-2 bg-stone-200/60 p-1.5 rounded-2xl max-w-lg print:hidden">
        <button
          onClick={() => setActiveTab('style_report')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'style_report'
              ? 'bg-white text-indigo-900 shadow-2xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <PackageCheck className="w-4 h-4 text-indigo-700" />
          <span>Style Journey Report</span>
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'overview'
              ? 'bg-white text-indigo-900 shadow-2xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-emerald-700" />
          <span>Factory Overview</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('financials')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'financials'
                ? 'bg-white text-emerald-950 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <DollarSign className="w-4 h-4 text-emerald-700" />
            <span>Financials</span>
          </button>
        )}
      </div>

      {activeTab === 'financials' && isAdmin ? (
        <FinancialsReportView currencySymbol={currencySymbol} />
      ) : activeTab === 'style_report' ? (
        <StyleReportScreen />
      ) : (
        <div className="space-y-6">
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-stone-200 p-5 rounded-3xl shadow-xs">
            <div>
              <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-indigo-700" />
                <span>Factory Production Analytics & Audit Reports</span>
              </h1>
              <p className="text-xs text-stone-600">Bottlenecks, style costings, defect rates & worker rankings</p>
            </div>

            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-2 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 font-bold px-4 py-2.5 rounded-xl transition-all text-xs shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Export Production CSV</span>
            </button>
          </div>

          {/* Grid: Worker Earnings Ranking & Process Bottleneck */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Worker Earnings Ranking Chart */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs">
              <h3 className="text-base font-bold text-stone-900 mb-1 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-700" />
                <span>Top Worker Piece Earnings</span>
              </h3>
              <p className="text-xs text-stone-600 mb-4">Cumulative earnings across current period</p>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workerRankData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis type="number" stroke="#78716c" fontSize={10} />
                    <YAxis dataKey="name" type="category" stroke="#1c1917" fontSize={11} width={90} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e7e5e4', color: '#1c1917' }} />
                    <Bar dataKey="amount" fill="#047857" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Process Defect / Rejection Bottlenecks */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs">
              <h3 className="text-base font-bold text-stone-900 mb-1 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700" />
                <span>Process Rejection Bottlenecks</span>
              </h3>
              <p className="text-xs text-stone-600 mb-4">Operations with highest defective piece counts</p>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bottleneckData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="name" stroke="#78716c" fontSize={10} />
                    <YAxis stroke="#78716c" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e7e5e4', color: '#1c1917' }} />
                    <Bar dataKey="rejects" fill="#be123c" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

