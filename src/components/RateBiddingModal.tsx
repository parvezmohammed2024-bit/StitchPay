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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Price Rate & Bidding Option</h2>
              <p className="text-xs text-slate-400">Review approved piece rate or submit bid</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Work Summary Box */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-bold text-white">{assignment.process_name}</div>
              <div className="text-[11px] text-slate-400">Style: {assignment.style_name} ({assignment.style_code})</div>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono font-bold px-2.5 py-1 rounded-full border border-emerald-500/30">
              Approved: ৳{assignment.agreed_rate}/pc
            </span>
          </div>
          <div className="text-xs text-slate-400 flex justify-between pt-1">
            <span>Target Volume: <strong>{assignment.target_qty || 250} pcs</strong></span>
            <span>Target Earning: <strong className="text-emerald-400 font-bold">৳{((assignment.target_qty || 250) * assignment.agreed_rate).toFixed(0)}</strong></span>
          </div>
        </div>

        {successMsg ? (
          <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Proposed Bid Rate per Piece (৳ BDT)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-amber-400 font-black text-sm">৳</span>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={proposedRate}
                  onChange={e => setProposedRate(e.target.value)}
                  placeholder="e.g. 5.50"
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-8 pr-4 py-2.5 text-base font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Current factory standard rate is ৳{assignment.agreed_rate}/pc.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Reason / Note for Bidding (Optional)
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Complex fabric handling, extra seam trimming required"
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 h-20"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold"
              >
                Accept Approved Rate
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl text-xs shadow-lg flex items-center space-x-1.5"
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
