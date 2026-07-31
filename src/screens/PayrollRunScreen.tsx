import React, { useState, useEffect } from 'react';
import { Banknote, Lock, CheckCircle, Calculator, FileText, AlertTriangle, Plus } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { dataService } from '../lib/dataService';
import { PayrollPeriod, PayrollLine, FactorySettings, UserRole } from '../types';
import { PayslipModal } from './PayslipModal';

interface PayrollRunScreenProps {
  role: UserRole;
}

export const PayrollRunScreen: React.FC<PayrollRunScreenProps> = ({ role }) => {
  const { t } = useTranslation();

  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [payrollLines, setPayrollLines] = useState<PayrollLine[]>([]);
  const [settings, setSettings] = useState<FactorySettings | null>(null);
  const [selectedLine, setSelectedLine] = useState<PayrollLine | null>(null);
  const [loading, setLoading] = useState(false);

  // Adjustment Modal State
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjWorkerId, setAdjWorkerId] = useState<string>('');
  const [adjType, setAdjType] = useState<'bonus' | 'fine' | 'advance_repay' | 'allowance'>('bonus');
  const [adjAmount, setAdjAmount] = useState<number>(500);

  useEffect(() => {
    loadPayrollData();
  }, []);

  const loadPayrollData = async () => {
    setLoading(true);
    const p = await dataService.getPayrollPeriod();
    const setRes = await dataService.getSettings();
    setPeriod(p);
    setSettings(setRes);
    const lines = await dataService.getPayrollLines();
    setPayrollLines(lines);
    setLoading(false);
  };

  const handleRunRPC = async () => {
    setLoading(true);
    const lines = await dataService.calculatePayrollRPC();
    setPayrollLines(lines);
    setLoading(false);
  };

  const handleLockPeriod = async () => {
    if (!period) return;
    const updated = await dataService.updatePayrollPeriodStatus('locked');
    setPeriod({ ...updated });
  };

  const handleMarkPaid = async () => {
    if (!period) return;
    const updated = await dataService.updatePayrollPeriodStatus('paid');
    setPeriod({ ...updated });
  };

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjWorkerId || !adjAmount) return;

    await dataService.saveAdjustment({
      worker_id: adjWorkerId,
      date: new Date().toISOString().split('T')[0],
      type: adjType,
      amount: adjAmount,
    });

    setShowAdjModal(false);
    setAdjWorkerId('');
    setAdjAmount(500);
    await loadPayrollData();
  };

  const currencySymbol = settings?.currency_symbol || '৳';
  const totalPayrollCost = payrollLines.reduce((sum, l) => sum + l.net_payable, 0);
  const totalPiecesDone = payrollLines.reduce((sum, l) => sum + l.pieces_total, 0);
  const totalTopup = payrollLines.reduce((sum, l) => sum + (l.minimum_wage_topup || 0), 0);

  return (
    <div className="space-y-6 pb-24 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Banknote className="w-6 h-6 text-emerald-400" />
            <span>Payroll Run & Wage Disbursements</span>
          </h1>
          <p className="text-xs text-slate-400">Automatic piece-rate calculation with minimum wage top-up protection</p>
        </div>

        {period && (
          <div className="flex items-center space-x-2">
            <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider font-mono ${
              period.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
              period.status === 'locked' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
              'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
            }`}>
              Status: {period.status}
            </span>
          </div>
        )}
      </div>

      {/* Period Banner & RPC Trigger */}
      {period && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-400 font-mono">ACTIVE PAYROLL PERIOD</div>
            <div className="text-lg font-bold text-white mt-0.5">
              {period.start_date} <span className="text-slate-500">to</span> {period.end_date}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Top-up Threshold: <span className="text-amber-400 font-bold">{currencySymbol}{settings?.minimum_wage_per_day}/day</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAdjModal(true)}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold px-3 py-2.5 rounded-xl transition-all"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Add Adjustment / Bonus</span>
            </button>

            <button
              onClick={handleRunRPC}
              disabled={loading}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all"
            >
              <Calculator className="w-4 h-4" />
              <span>{t('calculatePayroll')}</span>
            </button>

            {period.status === 'open' && (
              <button
                onClick={handleLockPeriod}
                className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all"
              >
                <Lock className="w-4 h-4" />
                <span>Lock Period</span>
              </button>
            )}

            {period.status === 'locked' && (
              <button
                onClick={handleMarkPaid}
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Mark Period as Paid</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs text-slate-400 uppercase font-semibold">Total Net Liability</span>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
            {currencySymbol}{totalPayrollCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs text-slate-400 uppercase font-semibold">Total Garment Pieces</span>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {totalPiecesDone.toLocaleString()} pcs
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs text-slate-400 uppercase font-semibold">Min Wage Top-up Total</span>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">
            {currencySymbol}{totalTopup.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Payroll Lines Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-400 font-mono uppercase">
              <th className="p-3">Worker</th>
              <th className="p-3 text-right">Pieces</th>
              <th className="p-3 text-right">Piece Gross</th>
              <th className="p-3 text-right">Min Wage Topup</th>
              <th className="p-3 text-right">Deductions</th>
              <th className="p-3 text-right">Net Payable</th>
              <th className="p-3 text-center">Payslip</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {payrollLines.map(line => (
              <tr key={line.id} className="hover:bg-slate-800/40">
                <td className="p-3 font-medium text-white flex items-center space-x-3">
                  <img src={line.worker?.photo_url || ''} className="w-8 h-8 rounded-full object-cover" />
                  <div>
                    <div className="font-bold">{line.worker?.full_name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{line.worker?.worker_code} • {line.worker?.line_no}</div>
                  </div>
                </td>

                <td className="p-3 text-right font-mono text-slate-300 font-bold">
                  {line.pieces_total} pcs
                </td>

                <td className="p-3 text-right font-mono text-emerald-400 font-bold">
                  {currencySymbol}{line.piece_earnings.toFixed(2)}
                </td>

                <td className="p-3 text-right font-mono">
                  {line.minimum_wage_topup > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 font-bold border border-amber-400/30">
                      +{currencySymbol}{line.minimum_wage_topup.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-slate-600">-</span>
                  )}
                </td>

                <td className="p-3 text-right font-mono text-rose-400">
                  -{currencySymbol}{line.deductions.toFixed(2)}
                </td>

                <td className="p-3 text-right font-mono font-black text-amber-400 text-sm">
                  {currencySymbol}{line.net_payable.toFixed(2)}
                </td>

                <td className="p-3 text-center">
                  <button
                    onClick={() => setSelectedLine(line)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-lg border border-slate-700 transition-colors"
                    title="View Printable Payslip"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payslip Modal */}
      {selectedLine && period && (
        <PayslipModal
          line={selectedLine}
          period={period}
          settings={settings}
          onClose={() => setSelectedLine(null)}
        />
      )}

      {/* Adjustment Modal */}
      {showAdjModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Add Worker Payroll Adjustment</h3>
            <form onSubmit={handleAddAdjustment} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Select Worker</label>
                <select
                  required
                  value={adjWorkerId}
                  onChange={e => setAdjWorkerId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white mt-1"
                >
                  <option value="">-- Choose Worker --</option>
                  {payrollLines.map(l => (
                    <option key={l.worker_id} value={l.worker_id}>
                      {l.worker?.full_name} ({l.worker?.worker_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">Adjustment Type</label>
                <select
                  value={adjType}
                  onChange={e => setAdjType(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white mt-1"
                >
                  <option value="bonus">Bonus / Incentive (+)</option>
                  <option value="allowance">Attendance Allowance (+)</option>
                  <option value="fine">Quality Fine (-)</option>
                  <option value="advance_repay">Advance Repayment (-)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">Amount ({currencySymbol})</label>
                <input
                  type="number"
                  required
                  value={adjAmount}
                  onChange={e => setAdjAmount(parseFloat(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white mt-1 font-mono font-bold"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAdjModal(false)}
                  className="flex-1 bg-slate-800 text-slate-300 font-semibold py-2 rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white font-semibold py-2 rounded-xl text-sm"
                >
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
