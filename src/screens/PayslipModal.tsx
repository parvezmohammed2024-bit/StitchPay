import React from 'react';
import { Shirt, Printer, Share2, X, CheckCircle2 } from 'lucide-react';
import { PayrollLine, FactorySettings, PayrollPeriod } from '../types';
import { useTranslation } from '../lib/i18n';

interface PayslipModalProps {
  line: PayrollLine;
  period: PayrollPeriod;
  settings: FactorySettings | null;
  onClose: () => void;
}

export const PayslipModal: React.FC<PayslipModalProps> = ({
  line,
  period,
  settings,
  onClose,
}) => {
  const { t } = useTranslation();
  const currency = settings?.currency_symbol || '৳';
  const worker = line.worker;

  const handleWhatsAppShare = () => {
    if (!worker?.phone) return;
    const text = `*${settings?.factory_name || 'Garments Factory'} - Payslip*
Worker: ${worker.full_name} (${worker.worker_code})
Period: ${period.start_date} to ${period.end_date}
---------------------------
Pieces Completed: ${line.pieces_total} pcs
Piece Earnings: ${currency}${line.piece_earnings}
Min Wage Topup: ${currency}${line.minimum_wage_topup || 0}
OT & Allowances: ${currency}${(line.ot_amount || 0) + (line.bonus_amount || 0) + (line.allowance_amount || 0)}
Deductions: ${currency}${line.deductions}
---------------------------
*NET PAYABLE: ${currency}${line.net_payable}*`;

    const cleanPhone = worker.phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-white animate-in fade-in zoom-in-95 print:p-0 print:border-none print:shadow-none print:bg-white print:text-black">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 print:hidden"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Factory Header */}
        <div className="text-center border-b border-slate-800 pb-4 mb-4">
          <div className="flex justify-center items-center space-x-2">
            <Shirt className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl font-black">{settings?.factory_name || 'Garment Factory'}</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">Official Piece-Rate Worker Payslip</p>
          <div className="text-xs font-mono text-amber-400 mt-2 bg-slate-800/80 inline-block px-3 py-1 rounded-full border border-slate-700">
            Period: {period.start_date} to {period.end_date}
          </div>
        </div>

        {/* Worker Info */}
        <div className="flex items-center space-x-4 bg-slate-800/60 p-3 rounded-xl mb-4 border border-slate-700/60">
          <img
            src={worker?.photo_url || ''}
            alt={worker?.full_name}
            className="w-12 h-12 rounded-xl object-cover border border-slate-600"
          />
          <div>
            <div className="font-bold text-base text-white">{worker?.full_name}</div>
            <div className="text-xs text-slate-400 font-mono">
              Code: {worker?.worker_code} • Line: {worker?.line_no} • Section: {worker?.section}
            </div>
            <div className="text-[11px] text-indigo-300 font-mono capitalize">
              Payment: {worker?.payment_method?.replace('_', ' ')} ({worker?.payment_details?.account || 'Cash'})
            </div>
          </div>
        </div>

        {/* Breakdown Items */}
        <div className="space-y-2 text-xs font-mono mb-6">
          <div className="flex justify-between py-1 border-b border-slate-800">
            <span className="text-slate-400">Total Completed Pieces:</span>
            <span className="font-bold text-white">{line.pieces_total} pcs</span>
          </div>

          <div className="flex justify-between py-1 border-b border-slate-800">
            <span className="text-slate-400">Piece Earnings (Gross):</span>
            <span className="font-bold text-emerald-400">{currency}{line.piece_earnings.toFixed(2)}</span>
          </div>

          {line.minimum_wage_topup > 0 && (
            <div className="flex justify-between py-1 border-b border-slate-800 text-amber-400 bg-amber-400/10 px-2 rounded">
              <span>Min Wage Daily Top-up:</span>
              <span className="font-bold">+{currency}{line.minimum_wage_topup.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between py-1 border-b border-slate-800">
            <span className="text-slate-400">Overtime Allowance:</span>
            <span className="text-white">{currency}{(line.ot_amount || 0).toFixed(2)}</span>
          </div>

          <div className="flex justify-between py-1 border-b border-slate-800">
            <span className="text-slate-400">Bonus & Allowances:</span>
            <span className="text-white">{currency}{((line.bonus_amount || 0) + (line.allowance_amount || 0)).toFixed(2)}</span>
          </div>

          <div className="flex justify-between py-1 border-b border-slate-800 text-rose-400">
            <span>Deductions (Advance/Fines):</span>
            <span className="font-bold">-{currency}{line.deductions.toFixed(2)}</span>
          </div>

          <div className="flex justify-between py-3 text-base font-black text-amber-400 border-t-2 border-slate-700 mt-3">
            <span>NET PAYABLE AMOUNT:</span>
            <span className="text-xl font-mono">{currency}{line.net_payable.toFixed(2)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 print:hidden">
          <button
            onClick={handleWhatsAppShare}
            className="flex-1 flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs"
          >
            <Share2 className="w-4 h-4" />
            <span>WhatsApp Payslip</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs border border-slate-700"
          >
            <Printer className="w-4 h-4 text-indigo-400" />
            <span>Print Payslip</span>
          </button>
        </div>
      </div>
    </div>
  );
};
