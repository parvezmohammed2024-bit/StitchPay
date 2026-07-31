import React, { useState, useEffect } from 'react';
import { 
  Truck, Plus, Search, Calendar, PackageCheck, AlertCircle, 
  BarChart3, CheckCircle2, RefreshCw, FileText, ArrowRight, ShieldAlert, X
} from 'lucide-react';
import { dataService } from '../lib/dataService';
import { GarmentStyle, DeliveryReport } from '../types';

export const DeliveriesScreen: React.FC = () => {
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryReport[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalStyleId, setModalStyleId] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [deliveredQty, setDeliveredQty] = useState<string>('');
  const [vehicleNo, setVehicleNo] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedStyleId]);

  const loadData = async () => {
    setLoading(true);
    const [stList, delList] = await Promise.all([
      dataService.getStyles(),
      dataService.getDeliveries(selectedStyleId === 'all' ? undefined : selectedStyleId),
    ]);
    setStyles(stList);
    setDeliveries(delList);
    setLoading(false);

    if (stList.length > 0 && !modalStyleId) {
      setModalStyleId(stList[0].id);
    }
  };

  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalStyleId || !deliveredQty || Number(deliveredQty) <= 0) {
      setErrorMsg('Please select a style and enter a valid delivery quantity');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      await dataService.saveDelivery({
        style_id: modalStyleId,
        delivery_date: deliveryDate,
        delivered_qty: Number(deliveredQty),
        vehicle_no: vehicleNo || null,
        driver_name: driverName || null,
        destination: destination || null,
        notes: notes || null,
      });

      setIsModalOpen(false);
      setDeliveredQty('');
      setVehicleNo('');
      setDriverName('');
      setDestination('');
      setNotes('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record delivery dispatch');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDelivery = async (id: string) => {
    if (confirm('Are you sure you want to delete this delivery report? The quantity will be added back to remaining balance.')) {
      await dataService.deleteDelivery(id);
      await loadData();
    }
  };

  // Filtered deliveries list
  const filteredDeliveries = deliveries.filter(d => {
    const search = searchQuery.toLowerCase();
    return (
      (d.style_code?.toLowerCase().includes(search) || false) ||
      (d.style_name?.toLowerCase().includes(search) || false) ||
      (d.destination?.toLowerCase().includes(search) || false) ||
      (d.vehicle_no?.toLowerCase().includes(search) || false)
    );
  });

  // Active style stats calculation
  const currentStyleObj = styles.find(s => s.id === selectedStyleId);
  const totalOrderQty = currentStyleObj ? currentStyleObj.order_qty : styles.reduce((s, x) => s + x.order_qty, 0);
  const totalCompletedPcs = currentStyleObj ? (currentStyleObj.completed_pieces || 0) : styles.reduce((s, x) => s + (x.completed_pieces || 0), 0);
  const totalDeliveredPcs = currentStyleObj ? (currentStyleObj.delivered_pieces || 0) : styles.reduce((s, x) => s + (x.delivered_pieces || 0), 0);
  const remainingToDeliverPcs = Math.max(0, totalOrderQty - totalDeliveredPcs);
  const deliveryProgressPct = totalOrderQty > 0 ? Math.min(100, Math.round((totalDeliveredPcs / totalOrderQty) * 100)) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Daily Delivery & Dispatch Reports
            </h1>
            <p className="text-xs text-slate-400">
              Track daily shipments, automatic order deductions, vehicle dispatches & remaining balance
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Record Daily Delivery</span>
          </button>
        </div>
      </div>

      {/* Style Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-3 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
            Filter Garment Style:
          </span>
          <button
            onClick={() => setSelectedStyleId('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              selectedStyleId === 'all'
                ? 'bg-indigo-600 text-white font-bold shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All Styles ({styles.length})
          </button>
          {styles.map(st => (
            <button
              key={st.id}
              onClick={() => setSelectedStyleId(st.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                selectedStyleId === st.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {st.style_code} - {st.name}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search delivery notes, vehicle, buyer..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Order Quantity */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase">Total Order Qty</span>
            <PackageCheck className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-white">{totalOrderQty.toLocaleString()} <span className="text-xs text-slate-400 font-normal">pcs</span></div>
            <p className="text-[11px] text-slate-500 mt-1">
              {currentStyleObj ? `Buyer: ${currentStyleObj.buyer_name}` : 'Across active factory orders'}
            </p>
          </div>
        </div>

        {/* Card 2: Factory Completed Output */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase">Factory Output Completed</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-400">{totalCompletedPcs.toLocaleString()} <span className="text-xs text-slate-400 font-normal">pcs</span></div>
            <p className="text-[11px] text-slate-500 mt-1">Ready in packing section</p>
          </div>
        </div>

        {/* Card 3: Delivered to Date */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase">Total Delivered to Date</span>
            <Truck className="w-5 h-5 text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-amber-400">{totalDeliveredPcs.toLocaleString()} <span className="text-xs text-slate-400 font-normal">pcs</span></div>
            <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
              <div className="bg-amber-400 h-full rounded-full" style={{ width: `${deliveryProgressPct}%` }}></div>
            </div>
          </div>
        </div>

        {/* Card 4: Remaining Quantity to Deliver */}
        <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 shadow-lg bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 uppercase">Remaining Balance to Deliver</span>
            <AlertCircle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-3xl font-extrabold text-white">{remainingToDeliverPcs.toLocaleString()} <span className="text-xs text-amber-400 font-normal">pcs remain</span></div>
            <p className="text-[11px] text-amber-300/80 mt-1">
              Deducted automatically as daily dispatches are entered
            </p>
          </div>
        </div>
      </div>

      {/* ACTIVE GARMENT ITEMS DELIVERY & BALANCE STATUS BOARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-black text-white flex items-center space-x-2">
              <PackageCheck className="w-5 h-5 text-amber-400" />
              <span>Active Garment Items & Delivery Balances</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live status for all active garment styles: Total Order, Completed Output, Delivered Qty & Remaining Balance
            </p>
          </div>

          <div className="text-xs text-slate-400 font-mono bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 self-start sm:self-center">
            Total Items: <strong className="text-amber-400">{styles.length} Active Styles</strong>
          </div>
        </div>

        {styles.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No active garment styles configured in factory system yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {styles.map(st => {
              const orderQty = st.order_qty || 0;
              const completedPcs = st.completed_pieces || 0;
              const deliveredPcs = st.delivered_pieces || 0;
              const remainingBalance = Math.max(0, orderQty - deliveredPcs);
              const pctDelivered = orderQty > 0 ? Math.min(100, Math.round((deliveredPcs / orderQty) * 100)) : 0;

              return (
                <div
                  key={st.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {st.style_code}
                        </span>
                        <h3 className="text-base font-black text-white mt-1">{st.name}</h3>
                        <p className="text-xs text-slate-400">Buyer: <strong className="text-slate-200">{st.buyer_name}</strong></p>
                      </div>
                      <img
                        src={st.image_url || 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=150&auto=format&fit=crop&q=80'}
                        alt={st.name}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-800 shrink-0"
                      />
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Dispatched:</span>
                        <span className="font-bold text-amber-400">{pctDelivered}% ({deliveredPcs.toLocaleString()} / {orderQty.toLocaleString()} pcs)</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-400 h-full rounded-full transition-all" style={{ width: `${pctDelivered}%` }}></div>
                      </div>
                    </div>

                    {/* Quantities Breakdown Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                      <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Total Order</div>
                        <div className="text-base font-extrabold text-white font-mono mt-0.5">{orderQty.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">pcs</span></div>
                      </div>

                      <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        <div className="text-[10px] font-bold text-emerald-400 uppercase">Factory Ready</div>
                        <div className="text-base font-extrabold text-emerald-400 font-mono mt-0.5">{completedPcs.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">pcs</span></div>
                      </div>

                      <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        <div className="text-[10px] font-bold text-amber-400 uppercase">Delivered / Dispatched</div>
                        <div className="text-base font-extrabold text-amber-400 font-mono mt-0.5">{deliveredPcs.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">pcs</span></div>
                      </div>

                      <div className="bg-slate-900 p-2.5 rounded-xl border border-amber-500/30 bg-gradient-to-br from-slate-900 to-amber-950/20">
                        <div className="text-[10px] font-bold text-amber-300 uppercase">Remaining Balance</div>
                        <div className="text-base font-extrabold text-white font-mono mt-0.5">{remainingBalance.toLocaleString()} <span className="text-[10px] font-normal text-amber-400">pcs</span></div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setModalStyleId(st.id);
                      setIsModalOpen(true);
                    }}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center space-x-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Record Dispatch Delivery</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delivery Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Daily Delivery Log History ({filteredDeliveries.length})</span>
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">Loading delivery records...</div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Truck className="w-10 h-10 text-slate-700 mx-auto" />
            <p className="text-sm font-medium text-slate-400">No delivery reports recorded yet</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Click "Record Daily Delivery" to log daily shipments (e.g., 500 pcs) and deduct from total order quantity.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Style & Code</th>
                  <th className="py-3 px-4 text-right">Delivered Qty</th>
                  <th className="py-3 px-4">Vehicle No</th>
                  <th className="py-3 px-4">Driver Name</th>
                  <th className="py-3 px-4">Destination / Buyer</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {filteredDeliveries.map(del => (
                  <tr key={del.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">
                      {del.delivery_date}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{del.style_code}</div>
                      <div className="text-[11px] text-slate-400">{del.style_name}</div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-extrabold text-sm text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        +{del.delivered_qty.toLocaleString()} pcs
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {del.vehicle_no || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {del.driver_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {del.destination || del.buyer_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-[200px] truncate">
                      {del.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDeleteDelivery(del.id)}
                        className="text-rose-400 hover:text-rose-300 text-[11px] hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Delivery Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Record Daily Delivery Dispatch</h3>
                  <p className="text-xs text-slate-400">Deducts quantity from remaining style order</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDelivery} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Garment Style Order <span className="text-rose-400">*</span>
                </label>
                <select
                  value={modalStyleId}
                  onChange={(e) => setModalStyleId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {styles.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.style_code} - {st.name} (Total: {st.order_qty} pcs, Remaining: {st.remaining_pieces ?? st.order_qty} pcs)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Delivery Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Delivered Qty (pcs) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 500"
                    value={deliveredQty}
                    onChange={(e) => setDeliveredQty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Vehicle No</label>
                  <input
                    type="text"
                    placeholder="e.g. DHAKA-METRO-TA-1122"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Driver Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Mohammad Ali"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Destination / Buyer Warehouse</label>
                <input
                  type="text"
                  placeholder="e.g. Chittagong Port Depot / Apex Warehouse"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Delivery Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Quality inspection certificate attached, carton 1-25"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg transition-all"
                >
                  {saving ? 'Saving...' : 'Confirm Delivery Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
