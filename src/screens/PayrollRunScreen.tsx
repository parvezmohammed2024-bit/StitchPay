import React, { useState, useEffect } from 'react';
import { Banknote, Lock, CheckCircle, Calculator, FileText, AlertTriangle, Plus } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { dataService } from '../lib/dataService';
import { PayrollPeriod, PayrollLine, FactorySettings, UserRole } from '../types';
import { PayslipModal } from './PayslipModal';
import { WorkerAvatar } from '../components/WorkerAvatar';

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-stone-200 p-5 rounded-3xl shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <Banknote className="w-6 h-6 text-emerald-700" />
            <span>Payroll Run & Wage Disbursements</span>
          </h1>
          <p className="text-xs text-stone-600">Automatic piece-rate calculation with minimum wage top-up protection</p>
        </div>

        {period && (
          <div className="flex items-center space-x-2">
            <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider font-mono ${
              period.status === 'paid' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
              period.status === 'locked' ? 'bg-amber-50 text-amber-900 border border-amber-300' :
              'bg-indigo-50 text-indigo-800 border border-indigo-200'
            }`}>
              Status: {period.status}
            </span>
          </div>
        )}
      </div>

      {/* Period Banner & RPC Trigger */}
      {period && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs text-stone-500 font-mono font-semibold">ACTIVE PAYROLL PERIOD</div>
            <div className="text-lg font-bold text-stone-900 mt-0.5">
              {period.start_date} <span className="text-stone-400">to</span> {period.end_date}
            </div>
            <div className="text-xs text-stone-600 mt-1">
              Top-up Threshold: <span className="text-amber-800 font-bold">{currencySymbol}{settings?.minimum_wage_per_day}/day</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAdjModal(true)}
              className="flex items-center space-x-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 text-xs font-bold px-3 py-2.5 rounded-xl transition-all"
            >
              <Plus className="w-4 h-4 text-amber-800" />
              <span>Add Adjustment / Bonus</span>
            </button>

            <button
              onClick={handleRunRPC}
              disabled={loading}
              className="flex items-center space-x-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all"
            >
              <Calculator className="w-4 h-4" />
              <span>{t('calculatePayroll')}</span>
            </button>

            {period.status === 'open' && (
              <button
                onClick={handleLockPeriod}
                className="flex items-center space-x-1.5 bg-amber-700 hover:bg-amber-800 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all"
              >
                <Lock className="w-4 h-4" />
                <span>Lock Period</span>
              </button>
            )}

            {period.status === 'locked' && (
              <button
                onClick={handleMarkPaid}
                className="flex items-center space-x-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Mark Period as Paid</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-3">
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-stone-600 uppercase font-bold tracking-wider">Total Net Liability</span>
          <div className="text-2xl font-black text-emerald-800 font-mono tracking-tight mt-1 tabular-nums">
            {currencySymbol}{totalPayrollCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-stone-600 uppercase font-bold tracking-wider">Total Garment Pieces</span>
          <div className="text-2xl font-black text-stone-900 font-mono tracking-tight mt-1 tabular-nums">
            {totalPiecesDone.toLocaleString()} <span className="text-xs text-stone-500 font-normal">pcs</span>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-stone-600 uppercase font-bold tracking-wider">Min Wage Top-up Total</span>
          <div className="text-2xl font-black text-amber-800 font-mono tracking-tight mt-1 tabular-nums">
            {currencySymbol}{totalTopup.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Payroll Lines Table */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs w-full max-w-full overflow-hidden">
        {/* Mobile View: Stacked Cards */}
        <div className="space-y-3 md:hidden">
          {payrollLines.map(line => (
            <div key={line.id} className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <WorkerAvatar
                    photoUrl={line.worker?.photo_url}
                    name={line.worker?.full_name || 'Worker'}
                    size="md"
                    className="rounded-full shrink-0"
                  />
                  <div>
                    <div className="font-bold text-stone-900 text-sm">{line.worker?.full_name}</div>
                    <div className="text-xs text-stone-600 font-mono">{line.worker?.worker_code} • {line.worker?.line_no}</div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLine(line)}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold text-xs hover:bg-indigo-100 flex items-center space-x-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Payslip</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-stone-200">
                <div>
                  <span className="text-stone-500 uppercase text-[10px] block font-bold">Pieces Logged</span>
                  <span className="font-mono font-bold text-stone-900">{line.pieces_total} pcs</span>
                </div>
                <div>
                  <span className="text-stone-500 uppercase text-[10px] block font-bold">Piece Gross</span>
                  <span className="font-mono font-bold text-emerald-800">{currencySymbol}{(line.piece_earnings || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-stone-500 uppercase text-[10px] block font-bold">Min Wage Top-up</span>
                  <span className="font-mono font-bold text-amber-800">
                    {(line.minimum_wage_topup || 0) > 0 ? `+${currencySymbol}${(line.minimum_wage_topup || 0).toFixed(2)}` : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 uppercase text-[10px] block font-bold">Net Payable</span>
                  <span className="font-mono font-black text-amber-800 text-sm">{currencySymbol}{(line.net_payable || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View: Scrollable Table */}
        <div className="hidden md:block w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-mono uppercase">
                <th className="p-3">Worker</th>
                <th className="p-3 text-right">Pieces</th>
                <th className="p-3 text-right">Piece Gross</th>
                <th className="p-3 text-right">Min Wage Topup</th>
                <th className="p-3 text-right">Deductions</th>
                <th className="p-3 text-right">Net Payable</th>
                <th className="p-3 text-center">Payslip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {payrollLines.map(line => {
                const isSalaried = line.worker?.pay_type === 'monthly_salary';
                return (
                  <tr key={line.id} className="hover:bg-stone-50">
                    <td className="p-3 font-medium text-stone-900 flex items-center space-x-3">
                      <WorkerAvatar
                        photoUrl={line.worker?.photo_url}
                        name={line.worker?.full_name || 'Worker'}
                        size="sm"
                        className="rounded-full shrink-0"
                      />
                      <div>
                        <div className="font-bold flex items-center space-x-1.5">
                          <span>{line.worker?.full_name}</span>
                          {isSalaried && (
                            <span className="text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded">
                              Monthly
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-500 font-mono">{line.worker?.worker_code} • {line.worker?.line_no}</div>
                      </div>
                    </td>

                    <td className="p-3 text-right font-mono text-stone-900 font-bold">
                      {line.pieces_total} pcs
                    </td>

                    <td className="p-3 text-right font-mono text-emerald-800 font-bold">
                      {isSalaried ? (
                        <span className="text-stone-700 font-sans text-xs">Prorated Salary: {currencySymbol}{(line.gross_wage || 0).toFixed(2)}</span>
                      ) : (
                        <span>{currencySymbol}{(line.piece_earnings || 0).toFixed(2)}</span>
                      )}
                    </td>

                    <td className="p-3 text-right font-mono">
                      {!isSalaried && (line.minimum_wage_topup || 0) > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
                          +{currencySymbol}{(line.minimum_wage_topup || 0).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>

                    <td className="p-3 text-right font-mono text-rose-700">
                      -{currencySymbol}{(line.deductions || 0).toFixed(2)}
                    </td>

                    <td className="p-3 text-right font-mono font-black text-amber-800 text-sm">
                      {currencySymbol}{(line.net_payable || 0).toFixed(2)}
                    </td>

                    <td className="p-3 text-center">
                      <button
                        onClick={() => setSelectedLine(line)}
                        className="p-1.5 bg-stone-100 hover:bg-stone-200 text-indigo-700 rounded-lg border border-stone-200 transition-colors"
                        title="View Printable Payslip"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-stone-900 mb-4">Add Worker Payroll Adjustment</h3>
            <form onSubmit={handleAddAdjustment} className="space-y-3">
              <div>
                <label className="text-xs text-stone-700 font-medium">Select Worker</label>
                <select
                  required
                  value={adjWorkerId}
                  onChange={e => setAdjWorkerId(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 mt-1"
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
                <label className="text-xs text-stone-700 font-medium">Adjustment Type</label>
                <select
                  value={adjType}
                  onChange={e => setAdjType(e.target.value as any)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 mt-1"
                >
                  <option value="bonus">Bonus / Incentive (+)</option>
                  <option value="allowance">Attendance Allowance (+)</option>
                  <option value="fine">Quality Fine (-)</option>
                  <option value="advance_repay">Advance Repayment (-)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-stone-700 font-medium">Amount ({currencySymbol})</label>
                <input
                  type="number"
                  required
                  value={adjAmount}
                  onChange={e => setAdjAmount(parseFloat(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 mt-1 font-mono font-bold"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAdjModal(false)}
                  className="flex-1 bg-stone-100 text-stone-800 font-semibold py-2 rounded-xl text-sm border border-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-700 text-white font-semibold py-2 rounded-xl text-sm shadow-xs"
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
