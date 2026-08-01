import React, { useState, useEffect } from 'react';
import { 
  BadgePercent, CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight, 
  AlertTriangle, DollarSign, Clock, ShieldAlert, MessageSquare, Plus,
  TrendingUp, UserCheck, RefreshCw, X
} from 'lucide-react';
import { dataService } from '../lib/dataService';
import { RateBid, UserRole, FactorySettings, Worker, GarmentProcess, ProductionEntry } from '../types';
import { WorkerAvatar } from '../components/WorkerAvatar';

interface RateBidsScreenProps {
  role: UserRole;
}

export const RateBidsScreen: React.FC<RateBidsScreenProps> = ({ role }) => {
  const [bids, setBids] = useState<RateBid[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [processes, setProcesses] = useState<GarmentProcess[]>([]);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [settings, setSettings] = useState<FactorySettings | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'countered' | 'all'>('pending');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Counter Modal State
  const [counterModal, setCounterModal] = useState<{
    bidId: string;
    workerName: string;
    processName: string;
    proposedRate: number;
    counterRate: number;
    note: string;
  } | null>(null);

  // New Bid Modal State (Supervisor/Admin submitting on worker's behalf)
  const [showNewBidModal, setShowNewBidModal] = useState<boolean>(false);
  const [newBidWorkerId, setNewBidWorkerId] = useState<string>('');
  const [newBidProcessId, setNewBidProcessId] = useState<string>('');
  const [newBidProposedRate, setNewBidProposedRate] = useState<number>(0);
  const [newBidReason, setNewBidReason] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [bidList, workerList, procList, entryList, setts] = await Promise.all([
        dataService.getRateBids(),
        dataService.getWorkers(),
        dataService.getProcesses(),
        dataService.getProductionEntries(),
        dataService.getSettings(),
      ]);
      setBids(bidList);
      setWorkers(workerList);
      setProcesses(procList);
      setEntries(entryList);
      setSettings(setts);

      if (procList.length > 0 && workerList.length > 0) {
        setNewBidProcessId(procList[0].id);
        setNewBidWorkerId(workerList[0].id);
        setNewBidProposedRate(procList[0].rate * 1.1);
      }
    } catch (err) {
      console.error('Error loading rate bids:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isAdmin = role === 'admin';

  // Helper to compute recent 30-day avg daily output for a worker on a process
  const getWorkerAvgOutput = (workerId: string, processId: string): number => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const workerProcEntries = entries.filter(e => e.worker_id === workerId && e.process_id === processId && e.entry_date >= thirtyDaysAgo);
    if (workerProcEntries.length === 0) return 150; // default estimated daily output

    const uniqueDates = new Set(workerProcEntries.map(e => e.entry_date)).size;
    const totalQty = workerProcEntries.reduce((sum, e) => sum + e.qty_ok, 0);
    return Math.round(totalQty / Math.max(1, uniqueDates));
  };

  // Handle Admin Review Actions
  const handleApprove = async (bidId: string) => {
    if (!isAdmin) {
      alert('Only Admin can approve rate bids.');
      return;
    }
    try {
      await dataService.reviewRateBid(bidId, 'approved', 'Approved by Admin');
      const updated = await dataService.getRateBids();
      setBids(updated);
    } catch (err) {
      console.error('Error approving bid:', err);
    }
  };

  const handleReject = async (bidId: string) => {
    if (!isAdmin) {
      alert('Only Admin can reject rate bids.');
      return;
    }
    try {
      await dataService.reviewRateBid(bidId, 'rejected', 'Rejected by Admin');
      const updated = await dataService.getRateBids();
      setBids(updated);
    } catch (err) {
      console.error('Error rejecting bid:', err);
    }
  };

  const handleSubmitCounter = async () => {
    if (!counterModal || !isAdmin) return;
    try {
      await dataService.reviewRateBid(
        counterModal.bidId, 
        'countered', 
        counterModal.note || 'Counter offer proposed by Admin', 
        counterModal.counterRate
      );
      setCounterModal(null);
      const updated = await dataService.getRateBids();
      setBids(updated);
    } catch (err) {
      console.error('Error countering bid:', err);
    }
  };

  const handleAcceptCounterOnWorkerBehalf = async (bidId: string) => {
    try {
      await dataService.acceptCounterBid(bidId);
      const updated = await dataService.getRateBids();
      setBids(updated);
    } catch (err) {
      console.error('Error accepting counter bid:', err);
    }
  };

  // Submit new rate bid
  const handleCreateBid = async () => {
    if (!newBidWorkerId || !newBidProcessId || newBidProposedRate <= 0) return;
    try {
      await dataService.createRateBid({
        worker_id: newBidWorkerId,
        process_id: newBidProcessId,
        proposed_rate: newBidProposedRate,
        reason: newBidReason,
      });
      setShowNewBidModal(false);
      setNewBidReason('');
      const updated = await dataService.getRateBids();
      setBids(updated);
    } catch (err) {
      console.error('Error creating rate bid:', err);
    }
  };

  const filteredBids = bids.filter(b => {
    if (filter === 'all') return true;
    return b.status === filter;
  });

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
              <BadgePercent className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-white">Rate Approvals & Exception Bidding</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Propose per-worker piece rate exceptions. Approved bids update current and future daily assignments.
          </p>
        </div>

        <button
          onClick={() => setShowNewBidModal(true)}
          className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-amber-500/20 text-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Propose Rate Exception</span>
        </button>
      </div>

      {/* RLS PERMISSION BANNER FOR SUPERVISORS */}
      {!isAdmin && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center space-x-3 text-amber-300 text-xs font-medium">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400" />
          <span>
            You are logged in as a <strong>Supervisor</strong>. You can submit rate exception proposals on behalf of workers, but ONLY Factory Admin can approve, counter, or reject bids.
          </span>
        </div>
      )}

      {/* FILTER TABS */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2">
        {(['pending', 'approved', 'countered', 'rejected', 'all'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
              filter === tab
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {tab} ({bids.filter(b => tab === 'all' ? true : b.status === tab).length})
          </button>
        ))}
      </div>

      {/* BIDS LIST GRID */}
      {filteredBids.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          No rate bids found under "{filter}" status.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBids.map(bid => {
            const avgOutput = getWorkerAvgOutput(bid.worker_id, bid.process_id);
            const proposedTotalDaily = (bid.proposed_rate || bid.current_rate) * avgOutput;
            const minWage = settings?.minimum_wage_per_day || 350;
            const isBelowMinWage = proposedTotalDaily < minWage;

            const diffAmount = bid.proposed_rate - bid.current_rate;
            const diffPercent = bid.current_rate > 0 ? (diffAmount / bid.current_rate) * 100 : 0;

            return (
              <div 
                key={bid.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4"
              >
                {/* WORKER & PROCESS TOP HEADER */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <WorkerAvatar
                      photoUrl={bid.worker_photo}
                      name={bid.worker_name || 'Worker'}
                      size="lg"
                      className="rounded-full"
                    />
                    <div>
                      <div className="text-base font-bold text-white">{bid.worker_name}</div>
                      <div className="text-xs text-amber-400 font-medium">
                        {bid.process_name} <span className="text-slate-500">({bid.style_code})</span>
                      </div>
                    </div>
                  </div>

                  {/* STATUS BADGE */}
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border capitalize ${
                    bid.status === 'approved' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : bid.status === 'rejected'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : bid.status === 'countered'
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    {bid.status}
                  </span>
                </div>

                {/* COMPARISON METRICS */}
                <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800/80 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Standard Rate</div>
                    <div className="text-sm font-bold text-slate-300">
                      {settings?.currency_symbol || '৳'}{bid.current_rate.toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Proposed Rate</div>
                    <div className="text-sm font-bold text-amber-400">
                      {settings?.currency_symbol || '৳'}{bid.proposed_rate.toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Difference</div>
                    <div className={`text-sm font-bold flex items-center justify-center ${diffAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {diffAmount >= 0 ? '+' : ''}{settings?.currency_symbol || '৳'}{diffAmount.toFixed(2)}
                      <span className="text-[10px] ml-1">({diffPercent >= 0 ? '+' : ''}{diffPercent.toFixed(1)}%)</span>
                    </div>
                  </div>
                </div>

                {/* COUNTER OFFER IF SET */}
                {bid.counter_rate && (
                  <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 flex justify-between items-center text-xs">
                    <span className="text-indigo-300 font-medium">Manager Counter Offer:</span>
                    <strong className="text-indigo-400 text-sm font-bold">
                      {settings?.currency_symbol || '৳'}{bid.counter_rate.toFixed(2)} / pc
                    </strong>
                  </div>
                )}

                {/* WORKER OUTPUT & MIN WAGE GUARD RAIL WARNING */}
                <div className="space-y-1.5 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Recent 30-Day Avg Output:</span>
                    <strong className="text-white">{avgOutput} pcs / day</strong>
                  </div>

                  {isBelowMinWage && (
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2 flex items-center space-x-2 text-rose-300 text-[11px]">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>
                        <strong>Min Wage Warning:</strong> At {avgOutput} pcs/day output, proposed rate yields {settings?.currency_symbol || '৳'}{proposedTotalDaily.toFixed(0)}/day (Below min wage {settings?.currency_symbol || '৳'}{minWage}/day).
                      </span>
                    </div>
                  )}

                  {bid.reason && (
                    <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60 text-slate-300 italic text-[11px]">
                      "{bid.reason}"
                    </div>
                  )}

                  {bid.review_note && (
                    <div className="text-[11px] text-slate-400">
                      <strong>Review Note:</strong> {bid.review_note}
                    </div>
                  )}
                </div>

                {/* ACTION BUTTONS */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end space-x-2">
                  {bid.status === 'pending' && (
                    <>
                      {isAdmin ? (
                        <>
                          <button
                            onClick={() => setCounterModal({
                              bidId: bid.id,
                              workerName: bid.worker_name || 'Worker',
                              processName: bid.process_name || 'Operation',
                              proposedRate: bid.proposed_rate,
                              counterRate: Number((bid.current_rate + (bid.proposed_rate - bid.current_rate) / 2).toFixed(2)),
                              note: '',
                            })}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                          >
                            Counter Offer
                          </button>

                          <button
                            onClick={() => handleReject(bid.id)}
                            className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold rounded-lg border border-rose-500/30 transition"
                          >
                            Reject
                          </button>

                          <button
                            onClick={() => handleApprove(bid.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition shadow-md shadow-emerald-600/20 flex items-center space-x-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        </>
                      ) : (
                        <div className="text-xs text-slate-500 italic">
                          Awaiting Admin Approval
                        </div>
                      )}
                    </>
                  )}

                  {bid.status === 'countered' && (
                    <button
                      onClick={() => handleAcceptCounterOnWorkerBehalf(bid.id)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition shadow-md shadow-indigo-600/30 flex items-center space-x-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Accept Counter (on behalf of worker)</span>
                    </button>
                  )}

                  {(bid.status === 'approved' || bid.status === 'rejected') && (
                    <div className="text-[11px] text-slate-500 italic">
                      Permanent Audit Record ({bid.reviewed_at ? new Date(bid.reviewed_at).toLocaleDateString() : 'Reviewed'})
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* COUNTER OFFER MODAL */}
      {counterModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Propose Counter Rate</h3>
              <button onClick={() => setCounterModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <div>Worker: <strong className="text-white">{counterModal.workerName}</strong></div>
              <div>Process: <strong className="text-white">{counterModal.processName}</strong></div>
              <div>Requested Rate: <strong className="text-amber-400">{settings?.currency_symbol || '৳'}{counterModal.proposedRate.toFixed(2)}</strong></div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Counter Rate ({settings?.currency_symbol || '৳'})
              </label>
              <input
                type="number"
                step="0.10"
                value={counterModal.counterRate}
                onChange={(e) => setCounterModal({ ...counterModal, counterRate: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 text-white font-bold rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Note for Supervisor / Worker
              </label>
              <textarea
                value={counterModal.note}
                onChange={(e) => setCounterModal({ ...counterModal, note: e.target.value })}
                rows={2}
                placeholder="Reason for counter offer..."
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button onClick={() => setCounterModal(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700">
                Cancel
              </button>
              <button onClick={handleSubmitCounter} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition shadow-md shadow-indigo-600/30">
                Submit Counter Offer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW RATE BID MODAL */}
      {showNewBidModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <BadgePercent className="w-5 h-5 text-amber-400" />
                <span>Submit Rate Proposal</span>
              </h3>
              <button onClick={() => setShowNewBidModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Worker</label>
              <select
                value={newBidWorkerId}
                onChange={(e) => setNewBidWorkerId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"
              >
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.full_name} ({w.worker_code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Process / Operation</label>
              <select
                value={newBidProcessId}
                onChange={(e) => {
                  setNewBidProcessId(e.target.value);
                  const p = processes.find(proc => proc.id === e.target.value);
                  if (p) setNewBidProposedRate(Number((p.rate * 1.1).toFixed(2)));
                }}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"
              >
                {processes.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — Standard: {settings?.currency_symbol || '৳'}{p.rate.toFixed(2)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Proposed Piece Rate ({settings?.currency_symbol || '৳'})</label>
              <input
                type="number"
                step="0.10"
                value={newBidProposedRate}
                onChange={(e) => setNewBidProposedRate(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 text-white font-bold rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Reason / Technical Justification</label>
              <textarea
                value={newBidReason}
                onChange={(e) => setNewBidReason(e.target.value)}
                rows={3}
                placeholder="Reason for piece rate bid..."
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3 text-xs outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button onClick={() => setShowNewBidModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700">
                Cancel
              </button>
              <button onClick={handleCreateBid} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition shadow-md shadow-amber-500/20">
                Submit Bid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
