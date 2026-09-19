import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Plus, Search, ArrowLeft, Phone, Mail, Globe, 
  User, FileText, CheckCircle2, XCircle, Edit3, Scissors, Calendar, AlertCircle
} from 'lucide-react';
import { Buyer, GarmentStyle, UserRole } from '../types';
import { dataService } from '../lib/dataService';
import { showSuccessToast, showErrorToast } from '../lib/toast';

interface BuyersScreenProps {
  role: UserRole;
}

interface BuyerOrderData {
  style: GarmentStyle;
  bulkCutPcs: number;
  garmentsSewn: number;
}

export const BuyersScreen: React.FC<BuyersScreenProps> = ({ role }) => {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Selected buyer for Detail Page
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [buyerOrders, setBuyerOrders] = useState<BuyerOrderData[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Add / Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    country: '',
    notes: '',
    is_active: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedBuyers, fetchedStyles] = await Promise.all([
        dataService.getAllBuyers(),
        dataService.getStyles(),
      ]);
      setBuyers(fetchedBuyers || []);
      setStyles(fetchedStyles || []);
    } catch (err: any) {
      showErrorToast(`Failed to load buyers: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute orders count and total qty per buyer
  const buyerStats = useMemo(() => {
    const stats = new Map<string, { orderCount: number; totalQty: number }>();
    styles.forEach(st => {
      if (st.buyer_id) {
        const current = stats.get(st.buyer_id) || { orderCount: 0, totalQty: 0 };
        current.orderCount += 1;
        current.totalQty += Number(st.order_qty || 0);
        stats.set(st.buyer_id, current);
      }
    });
    return stats;
  }, [styles]);

  // Load orders for selected buyer detail page
  useEffect(() => {
    if (!selectedBuyerId) {
      setBuyerOrders([]);
      return;
    }

    const loadOrdersForBuyer = async () => {
      setLoadingOrders(true);
      try {
        const matchingStyles = styles.filter(s => s.buyer_id === selectedBuyerId);
        const cuttingEntries = await dataService.getCuttingEntries();

        // For garments sewn: strictly call RPC fn_garments_sewn via dataService.getGarmentsSewnOnlyRpc
        const ordersData: BuyerOrderData[] = await Promise.all(
          matchingStyles.map(async style => {
            // Bulk cut pieces calculation: sum pieces_cut where cut_type is 'bulk' (or default bulk)
            const styleCutEntries = cuttingEntries.filter(
              c => c.style_id === style.id && (c.cut_type === 'bulk' || !c.cut_type)
            );
            const bulkCutPcs = styleCutEntries.reduce(
              (sum, entry) => sum + Number(entry.pieces_cut || 0),
              0
            );

            // ONLY call database function fn_garments_sewn; never calculate sewn quantity yourself
            const garmentsSewn = await dataService.getGarmentsSewnOnlyRpc(style.id);

            return {
              style,
              bulkCutPcs,
              garmentsSewn,
            };
          })
        );

        // Sort orders by start_date or created_at descending
        ordersData.sort((a, b) => {
          const dateA = a.style.start_date || a.style.created_at || '';
          const dateB = b.style.start_date || b.style.created_at || '';
          return dateB.localeCompare(dateA);
        });

        setBuyerOrders(ordersData);
      } catch (err: any) {
        showErrorToast(`Failed to load buyer orders: ${err.message || String(err)}`);
      } finally {
        setLoadingOrders(false);
      }
    };

    loadOrdersForBuyer();
  }, [selectedBuyerId, styles]);

  // Modal Open Handlers
  const handleOpenAddModal = () => {
    setEditingBuyer(null);
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      country: '',
      notes: '',
      is_active: true,
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (buyer: Buyer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingBuyer(buyer);
    setFormData({
      name: buyer.name || '',
      contact_person: buyer.contact_person || '',
      phone: buyer.phone || '',
      email: buyer.email || '',
      country: buyer.country || '',
      notes: buyer.notes || '',
      is_active: buyer.is_active !== false,
    });
    setShowModal(true);
  };

  // Toggle active status without delete button
  const handleToggleActive = async (buyer: Buyer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newStatus = !buyer.is_active;
    try {
      await dataService.saveBuyer({
        ...buyer,
        is_active: newStatus,
      });
      showSuccessToast(`${buyer.name} marked as ${newStatus ? 'Active' : 'Inactive'}.`);
      await loadData();
    } catch (err: any) {
      showErrorToast(`Failed to update status: ${err.message || String(err)}`);
    }
  };

  const handleSaveBuyer = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      showErrorToast('Buyer name is required.');
      return;
    }

    setFormSaving(true);
    try {
      await dataService.saveBuyer({
        id: editingBuyer ? editingBuyer.id : undefined,
        name: trimmedName,
        contact_person: formData.contact_person.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        country: formData.country.trim() || null,
        notes: formData.notes.trim() || null,
        is_active: formData.is_active,
      });

      showSuccessToast(editingBuyer ? `Buyer "${trimmedName}" updated.` : `Buyer "${trimmedName}" created.`);
      setShowModal(false);
      await loadData();
    } catch (err: any) {
      showErrorToast(`Failed to save buyer: ${err.message || String(err)}`);
    } finally {
      setFormSaving(false);
    }
  };

  const selectedBuyer = useMemo(() => {
    return buyers.find(b => b.id === selectedBuyerId) || null;
  }, [buyers, selectedBuyerId]);

  // Filtered buyers list
  const filteredBuyers = useMemo(() => {
    return buyers.filter(b => {
      const matchesStatus = 
        statusFilter === 'all' ? true :
        statusFilter === 'active' ? b.is_active !== false :
        b.is_active === false;

      if (!matchesStatus) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        b.name.toLowerCase().includes(q) ||
        (b.contact_person && b.contact_person.toLowerCase().includes(q)) ||
        (b.country && b.country.toLowerCase().includes(q)) ||
        (b.email && b.email.toLowerCase().includes(q)) ||
        (b.phone && b.phone.toLowerCase().includes(q))
      );
    });
  }, [buyers, searchQuery, statusFilter]);

  return (
    <div className="space-y-6 pb-20">
      {/* If a buyer is selected, show Detail View */}
      {selectedBuyer ? (
        <div className="space-y-6">
          {/* Detail View Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-stone-200 p-5 rounded-3xl shadow-xs">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setSelectedBuyerId(null)}
                className="p-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
                title="Back to Buyers list"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-black text-stone-900 tracking-tight">{selectedBuyer.name}</h1>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                      selectedBuyer.is_active !== false
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-stone-100 text-stone-600 border-stone-200'
                    }`}
                  >
                    {selectedBuyer.is_active !== false ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Active
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 text-stone-400" />
                        Inactive
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Buyer details and order history
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Active / Inactive Switch Button */}
              <button
                type="button"
                onClick={() => handleToggleActive(selectedBuyer)}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  selectedBuyer.is_active !== false
                    ? 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'
                    : 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                }`}
                title={selectedBuyer.is_active !== false ? 'Set buyer to Inactive' : 'Set buyer to Active'}
              >
                <span>{selectedBuyer.is_active !== false ? 'Mark Inactive' : 'Activate Buyer'}</span>
              </button>

              {/* Edit Buyer Button */}
              <button
                type="button"
                onClick={() => handleOpenEditModal(selectedBuyer)}
                className="flex items-center space-x-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-xs transition cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Buyer</span>
              </button>
            </div>
          </div>

          {/* Contact Details Card */}
          <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-stone-500 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Contact Details</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80">
                <span className="text-[11px] font-medium text-stone-500 block mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-stone-400" /> Contact Person
                </span>
                <span className="text-sm font-bold text-stone-900">
                  {selectedBuyer.contact_person || '—'}
                </span>
              </div>

              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80">
                <span className="text-[11px] font-medium text-stone-500 block mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-stone-400" /> Phone
                </span>
                {selectedBuyer.phone ? (
                  <a
                    href={`tel:${selectedBuyer.phone}`}
                    className="text-sm font-bold text-indigo-600 hover:underline"
                  >
                    {selectedBuyer.phone}
                  </a>
                ) : (
                  <span className="text-sm text-stone-400 font-medium">—</span>
                )}
              </div>

              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80">
                <span className="text-[11px] font-medium text-stone-500 block mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-stone-400" /> Email
                </span>
                {selectedBuyer.email ? (
                  <a
                    href={`mailto:${selectedBuyer.email}`}
                    className="text-sm font-bold text-indigo-600 hover:underline truncate block"
                    title={selectedBuyer.email}
                  >
                    {selectedBuyer.email}
                  </a>
                ) : (
                  <span className="text-sm text-stone-400 font-medium">—</span>
                )}
              </div>

              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80">
                <span className="text-[11px] font-medium text-stone-500 block mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-stone-400" /> Country
                </span>
                <span className="text-sm font-bold text-stone-900">
                  {selectedBuyer.country || '—'}
                </span>
              </div>
            </div>

            {selectedBuyer.notes && (
              <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/60 text-xs text-amber-950 flex items-start gap-2">
                <FileText className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-[11px] text-amber-800">Notes</span>
                  <p className="mt-0.5 text-stone-700 leading-relaxed whitespace-pre-wrap">{selectedBuyer.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Orders Section */}
          <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center space-x-2">
                <Scissors className="w-4 h-4 text-indigo-600" />
                <h2 className="text-lg font-black text-stone-900 tracking-tight">
                  Orders ({buyerOrders.length})
                </h2>
              </div>
              <span className="text-xs text-stone-500">
                Total Order Qty:{' '}
                <strong className="text-stone-900 font-mono">
                  {buyerOrders.reduce((sum, o) => sum + (o.style.order_qty || 0), 0).toLocaleString()}
                </strong>{' '}
                pcs
              </span>
            </div>

            {loadingOrders ? (
              <div className="py-12 text-center text-stone-500 text-sm">
                Loading orders and sewing outputs...
              </div>
            ) : buyerOrders.length === 0 ? (
              <div className="py-12 text-center text-stone-500 text-sm">
                No orders recorded for this buyer yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500 text-xs uppercase tracking-wider font-semibold">
                      <th className="py-3 px-3">Style Code</th>
                      <th className="py-3 px-3">Name</th>
                      <th className="py-3 px-3 text-right">Order Qty</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3">Start Date</th>
                      <th className="py-3 px-3">Ship Deadline</th>
                      <th className="py-3 px-3 text-right">Bulk Cut (pcs)</th>
                      <th className="py-3 px-3 text-right">Garments Sewn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {buyerOrders.map(({ style, bulkCutPcs, garmentsSewn }) => (
                      <tr key={style.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-stone-900">
                          {style.style_code}
                        </td>
                        <td className="py-3 px-3 font-medium text-stone-900 max-w-[200px] truncate">
                          {style.name}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-stone-900">
                          {(style.order_qty || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block text-[10px] font-bold uppercase rounded-lg px-2 py-0.5 border ${
                              style.status === 'active'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : style.status === 'upcoming'
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                                : style.status === 'completed'
                                ? 'bg-blue-50 border-blue-200 text-blue-800'
                                : 'bg-stone-100 border-stone-300 text-stone-700'
                            }`}
                          >
                            {style.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-stone-600 font-mono">
                          {style.start_date || '—'}
                        </td>
                        <td className="py-3 px-3 text-xs text-stone-600 font-mono">
                          {style.target_ship_date || '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-stone-800 font-bold">
                          {bulkCutPcs.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-indigo-700 font-bold">
                          {garmentsSewn.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Main Buyers List View */
        <div className="space-y-6">
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-stone-200 p-5 rounded-3xl shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-2xl">
                  <Building2 className="w-6 h-6" />
                </div>
                <h1 className="text-2xl font-black text-stone-900 tracking-tight">Buyers</h1>
              </div>
              <p className="text-xs text-stone-600 pl-1">
                Manage buyers, active accounts, and explore order history
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="flex items-center justify-center space-x-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all text-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Buyer</span>
            </button>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white border border-stone-200 p-4 rounded-2xl shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search buyers by name, country, or contact person..."
                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center space-x-1.5 border border-stone-200 rounded-xl p-1 bg-stone-50">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  statusFilter === 'all'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                All ({buyers.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  statusFilter === 'active'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Active ({buyers.filter(b => b.is_active !== false).length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  statusFilter === 'inactive'
                    ? 'bg-white text-stone-700 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Inactive ({buyers.filter(b => b.is_active === false).length})
              </button>
            </div>
          </div>

          {/* Buyers Table / List */}
          <div className="bg-white border border-stone-200 rounded-3xl shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-stone-500 text-sm">
                Loading buyers...
              </div>
            ) : filteredBuyers.length === 0 ? (
              <div className="py-16 text-center text-stone-500 text-sm space-y-2">
                <Building2 className="w-10 h-10 text-stone-300 mx-auto" />
                <p>No buyers found matching your criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500 text-xs uppercase tracking-wider font-semibold bg-stone-50/50">
                      <th className="py-3.5 px-4">Buyer Name</th>
                      <th className="py-3.5 px-4">Contact</th>
                      <th className="py-3.5 px-4 text-center">Orders</th>
                      <th className="py-3.5 px-4 text-right">Total Order Qty</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredBuyers.map(b => {
                      const stats = buyerStats.get(b.id) || { orderCount: 0, totalQty: 0 };
                      const isActive = b.is_active !== false;

                      return (
                        <tr
                          key={b.id}
                          onClick={() => setSelectedBuyerId(b.id)}
                          className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0 group-hover:bg-indigo-700 group-hover:text-white transition">
                                {b.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-stone-900 group-hover:text-indigo-700 transition block">
                                  {b.name}
                                </span>
                                {b.country && (
                                  <span className="text-[11px] text-stone-500 flex items-center gap-1">
                                    <Globe className="w-3 h-3 text-stone-400" />
                                    {b.country}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-xs text-stone-600">
                            {b.contact_person || b.phone || b.email ? (
                              <div className="space-y-0.5">
                                {b.contact_person && (
                                  <span className="font-medium text-stone-900 block">{b.contact_person}</span>
                                )}
                                {b.phone && (
                                  <span className="text-stone-500 block">{b.phone}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-stone-400">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-block px-2.5 py-0.5 bg-stone-100 border border-stone-200 text-stone-800 font-bold rounded-lg text-xs font-mono">
                              {stats.orderCount}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-bold text-stone-900">
                            {stats.totalQty > 0 ? stats.totalQty.toLocaleString() : '0'} pcs
                          </td>

                          {/* Active / Inactive Switch Toggle */}
                          <td className="py-3.5 px-4 text-center" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={e => handleToggleActive(b, e)}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                isActive ? 'bg-emerald-600' : 'bg-stone-300'
                              }`}
                              title={isActive ? 'Active (click to deactivate)' : 'Inactive (click to activate)'}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  isActive ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                            <span className="block text-[10px] text-stone-500 font-medium mt-0.5">
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Edit Button (No delete button as specified) */}
                          <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={e => handleOpenEditModal(b, e)}
                              className="p-1.5 text-stone-500 hover:text-indigo-700 hover:bg-stone-100 rounded-lg transition"
                              title="Edit buyer details"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Buyer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-stone-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-lg font-black text-stone-900 tracking-tight">
                {editingBuyer ? 'Edit Buyer' : 'Add New Buyer'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBuyer} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Buyer Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Zara, H&M, Levi's"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-stone-700 block mb-1">
                    Contact Person (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-stone-700 block mb-1">
                    Country (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={e => setFormData({ ...formData, country: e.target.value })}
                    placeholder="e.g. Spain, UK, USA"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-stone-700 block mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. +44 20 7946 0912"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-stone-700 block mb-1">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="buyer@brand.com"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-stone-700 block mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional buyer terms, shipping preferences, or special instructions"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Active / Inactive switch in form */}
              <div className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-stone-900 block">Active Status</span>
                  <span className="text-[11px] text-stone-500">
                    {formData.is_active ? 'Buyer is available for new orders' : 'Buyer is inactive'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formData.is_active ? 'bg-emerald-600' : 'bg-stone-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      formData.is_active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={formSaving}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-700 hover:bg-indigo-800 text-white shadow-xs transition"
                >
                  {formSaving ? 'Saving...' : editingBuyer ? 'Save Changes' : 'Create Buyer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
