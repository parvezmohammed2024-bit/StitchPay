import React, { useState } from 'react';
import { X, DollarSign, CheckCircle2, AlertCircle, ArrowUpRight, Send, ShieldCheck } from 'lucide-react';
import { DailyAssignment } from '../types';

interface RateBiddingModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: DailyAssignment | null;
  onSubmitBid: (assignmentId: string, proposedRate: number, reason: string) => Promise<void>;
}

export const RateBiddingModal: React.FC<RateBiddingModalProps> = ({
  isOpen,
  onClose,
  assignment,
  onSubmitBid,
}) => {
  const [proposedRate, setProposedRate] = useState<string>(
    assignment ? String(assignment.agreed_rate) : ''
  );
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen || !assignment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = parseFloat(proposedRate);
    if (isNaN(rateNum) || rateNum <= 0) {
      alert('Please enter a valid rate amount in BDT');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitBid(assignment.id, rateNum, reason);
      setSuccessMsg('Your rate bid has been submitted to the line supervisor for review!');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to submit bid');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-stone-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-stone-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-700 font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Price Rate & Bidding Option</h2>
              <p className="text-xs text-stone-600">Review approved piece rate or submit bid</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Work Summary Box */}
        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-bold text-stone-900">{assignment.process_name}</div>
              <div className="text-[11px] text-stone-600">Style: {assignment.style_name} ({assignment.style_code})</div>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 font-mono font-bold px-2.5 py-1 rounded-full border border-emerald-200">
              Approved: ৳{assignment.agreed_rate}/pc
            </span>
          </div>
          <div className="text-xs text-stone-600 flex justify-between pt-1">
            <span>Target Volume: <strong className="text-stone-900">{assignment.target_qty || 250} pcs</strong></span>
            <span>Target Earning: <strong className="text-amber-700 font-bold">৳{((assignment.target_qty || 250) * assignment.agreed_rate).toFixed(0)}</strong></span>
          </div>
        </div>

        {successMsg ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>{successMsg}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Proposed Bid Rate per Piece (৳ BDT)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-amber-700 font-black text-sm">৳</span>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={proposedRate}
                  onChange={e => setProposedRate(e.target.value)}
                  placeholder="e.g. 5.50"
                  className="w-full bg-white border border-stone-300 rounded-2xl pl-8 pr-4 py-2.5 text-base font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                />
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                Current factory standard rate is ৳{assignment.agreed_rate}/pc.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Reason / Note for Bidding (Optional)
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Complex fabric handling, extra seam trimming required"
                className="w-full bg-white border border-stone-300 rounded-2xl p-3 text-xs text-stone-900 focus:outline-none focus:border-amber-600 h-20"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded-2xl text-xs font-bold"
              >
                Accept Approved Rate
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-2xl text-xs shadow-xs flex items-center space-x-1.5"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Submitting...' : 'Submit Rate Bid'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
