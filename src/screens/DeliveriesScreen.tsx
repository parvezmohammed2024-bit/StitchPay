import React, { useState, useEffect } from 'react';
import { 
  Truck, Plus, Search, Calendar, PackageCheck, AlertCircle, 
  BarChart3, CheckCircle2, RefreshCw, FileText, ArrowRight, ShieldAlert, X
} from 'lucide-react';
import { dataService } from '../lib/dataService';
import { showErrorToast } from '../lib/toast';
import { GarmentStyle, DeliveryReport } from '../types';
import { StyleImage } from '../components/StyleImage';

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
    try {
      const [stList, delList] = await Promise.all([
        dataService.getStyles(),
        dataService.getDeliveries(selectedStyleId === 'all' ? undefined : selectedStyleId),
      ]);
      setStyles(stList);
      setDeliveries(delList);

      if (stList.length > 0 && !modalStyleId) {
        setModalStyleId(stList[0].id);
      }
    } catch (err: any) {
      showErrorToast(`Failed to load deliveries data: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-800 shadow-xs">
            <Truck className="w-6 h-6 text-amber-700" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight">
              Daily Delivery & Dispatch Reports
            </h1>
            <p className="text-xs text-stone-600">
              Track daily shipments, automatic order deductions, vehicle dispatches & remaining balance
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-xs transition-all flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Record Daily Delivery</span>
          </button>
        </div>
      </div>

      {/* Style Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
        <div className="flex items-center space-x-3 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-stone-600 uppercase tracking-wider whitespace-nowrap">
            Filter Garment Style:
          </span>
          <button
            onClick={() => setSelectedStyleId('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              selectedStyleId === 'all'
                ? 'bg-indigo-700 text-white font-bold shadow-xs'
                : 'bg-stone-200 text-stone-700 hover:text-stone-900'
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
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold shadow-xs'
                  : 'bg-stone-200 text-stone-700 hover:text-stone-900'
              }`}
            >
              {st.style_code} - {st.name}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search delivery notes, vehicle, buyer..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-indigo-600"
          />
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Order Quantity */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-600 uppercase">Total Order Qty</span>
            <PackageCheck className="w-5 h-5 text-indigo-700" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-stone-900">{totalOrderQty.toLocaleString()} <span className="text-xs text-stone-500 font-normal">pcs</span></div>
            <p className="text-[11px] text-stone-500 mt-1">
              {currentStyleObj ? `Buyer: ${currentStyleObj.buyer_name}` : 'Across active factory orders'}
            </p>
          </div>
        </div>

        {/* Card 2: Factory Completed Output */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-600 uppercase">Factory Output Completed</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-700">{totalCompletedPcs.toLocaleString()} <span className="text-xs text-stone-500 font-normal">pcs</span></div>
            <p className="text-[11px] text-stone-500 mt-1">Ready in packing section</p>
          </div>
        </div>

        {/* Card 3: Delivered to Date */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-600 uppercase">Total Delivered to Date</span>
            <Truck className="w-5 h-5 text-amber-700" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-amber-700">{totalDeliveredPcs.toLocaleString()} <span className="text-xs text-stone-500 font-normal">pcs</span></div>
            <div className="w-full bg-stone-200 h-2 rounded-full mt-2 overflow-hidden">
              <div className="bg-amber-600 h-full rounded-full" style={{ width: `${deliveryProgressPct}%` }}></div>
            </div>
          </div>
        </div>

        {/* Card 4: Remaining Quantity to Deliver */}
        <div className="bg-white border border-amber-300 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase">Remaining Balance to Deliver</span>
            <AlertCircle className="w-5 h-5 text-amber-700" />
          </div>
          <div className="mt-2">
            <div className="text-3xl font-extrabold text-stone-900">{remainingToDeliverPcs.toLocaleString()} <span className="text-xs text-amber-800 font-normal">pcs remain</span></div>
            <p className="text-[11px] text-stone-600 mt-1">
              Deducted automatically as daily dispatches are entered
            </p>
          </div>
        </div>
      </div>

      {/* ACTIVE GARMENT ITEMS DELIVERY & BALANCE STATUS BOARD */}
      <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
          <div>
            <h2 className="text-lg font-black text-stone-900 flex items-center space-x-2">
              <PackageCheck className="w-5 h-5 text-amber-700" />
              <span>Active Garment Items & Delivery Balances</span>
            </h2>
            <p className="text-xs text-stone-600 mt-0.5">
              Live status for all active garment styles: Total Order, Completed Output, Delivered Qty & Remaining Balance
            </p>
          </div>

          <div className="text-xs text-stone-700 font-mono bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200 self-start sm:self-center">
            Total Items: <strong className="text-amber-800">{styles.length} Active Styles</strong>
          </div>
        </div>

        {styles.length === 0 ? (
          <div className="p-8 text-center text-stone-500 text-xs">
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
                  className="bg-stone-50 border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-amber-400 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-amber-900 tracking-wider bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                          {st.style_code}
                        </span>
                        <h3 className="text-base font-black text-stone-900 mt-1">{st.name}</h3>
                        <p className="text-xs text-stone-600">Buyer: <strong className="text-stone-800">{st.buyer_name}</strong></p>
                      </div>
                      <StyleImage
                        imageUrl={st.image_url}
                        styleName={st.name}
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-stone-600">Dispatched:</span>
                        <span className="font-bold text-amber-800">{pctDelivered}% ({deliveredPcs.toLocaleString()} / {orderQty.toLocaleString()} pcs)</span>
                      </div>
                      <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-600 h-full rounded-full transition-all" style={{ width: `${pctDelivered}%` }}></div>
                      </div>
                    </div>

                    {/* Quantities Breakdown Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                      <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                        <div className="text-[10px] font-bold text-stone-600 uppercase">Total Order</div>
                        <div className="text-base font-extrabold text-stone-900 font-mono mt-0.5">{orderQty.toLocaleString()} <span className="text-[10px] font-normal text-stone-500">pcs</span></div>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                        <div className="text-[10px] font-bold text-emerald-700 uppercase">Factory Ready</div>
                        <div className="text-base font-extrabold text-emerald-700 font-mono mt-0.5">{completedPcs.toLocaleString()} <span className="text-[10px] font-normal text-stone-500">pcs</span></div>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                        <div className="text-[10px] font-bold text-amber-800 uppercase">Delivered / Dispatched</div>
                        <div className="text-base font-extrabold text-amber-800 font-mono mt-0.5">{deliveredPcs.toLocaleString()} <span className="text-[10px] font-normal text-stone-500">pcs</span></div>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-amber-300">
                        <div className="text-[10px] font-bold text-amber-900 uppercase">Remaining Balance</div>
                        <div className="text-base font-extrabold text-stone-900 font-mono mt-0.5">{remainingBalance.toLocaleString()} <span className="text-[10px] font-normal text-amber-800">pcs</span></div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setModalStyleId(st.id);
                      setIsModalOpen(true);
                    }}
                    className="w-full py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center justify-center space-x-1.5"
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
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div>
            <h2 className="text-base font-bold text-stone-900 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-amber-700" />
              <span>Daily Delivery Log History ({filteredDeliveries.length})</span>
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-stone-500 text-xs">Loading delivery records...</div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Truck className="w-10 h-10 text-stone-300 mx-auto" />
            <p className="text-sm font-medium text-stone-700">No delivery reports recorded yet</p>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Click "Record Daily Delivery" to log daily shipments (e.g., 500 pcs) and deduct from total order quantity.
            </p>
          </div>
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-stone-100 text-stone-700 uppercase font-semibold border-b border-stone-200">
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
              <tbody className="divide-y divide-stone-200 text-stone-800">
                {filteredDeliveries.map(del => (
                  <tr key={del.id} className="hover:bg-stone-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-stone-900">
                      {del.delivery_date}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-stone-900">{del.style_code}</div>
                      <div className="text-[11px] text-stone-600">{del.style_name}</div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-extrabold text-sm text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        +{del.delivered_qty.toLocaleString()} pcs
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-stone-700">
                      {del.vehicle_no || '—'}
                    </td>
                    <td className="py-3 px-4 text-stone-700">
                      {del.driver_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-stone-700">
                      {del.destination || del.buyer_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-stone-600 max-w-[200px] truncate">
                      {del.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDeleteDelivery(del.id)}
                        className="text-rose-700 hover:text-rose-800 text-[11px] hover:underline"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-stone-200 bg-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-300">
                  <Truck className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">Record Daily Delivery Dispatch</h3>
                  <p className="text-xs text-stone-600">Deducts quantity from remaining style order</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-500 hover:text-stone-900 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDelivery} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Select Garment Style Order <span className="text-rose-600">*</span>
                </label>
                <select
                  value={modalStyleId}
                  onChange={(e) => setModalStyleId(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
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
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Delivery Date <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Delivered Qty (pcs) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 500"
                    value={deliveredQty}
                    onChange={(e) => setDeliveredQty(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Vehicle No</label>
                  <input
                    type="text"
                    placeholder="e.g. DHAKA-METRO-TA-1122"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Driver Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Mohammad Ali"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Destination / Buyer Warehouse</label>
                <input
                  type="text"
                  placeholder="e.g. Chittagong Port Depot / Apex Warehouse"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Delivery Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Quality inspection certificate attached, carton 1-25"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl text-xs shadow-xs transition-all"
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
