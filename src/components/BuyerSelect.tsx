import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Check, Plus, Building2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { showErrorToast, showSuccessToast } from '../lib/toast';

export interface BuyerItem {
  id: string;
  name: string;
}

interface BuyerSelectProps {
  selectedBuyerId?: string | null;
  initialBuyerName?: string | null;
  onSelectBuyer: (buyer: { id: string; name: string } | null) => void;
  className?: string;
}

export const BuyerSelect: React.FC<BuyerSelectProps> = ({
  selectedBuyerId,
  initialBuyerName,
  onSelectBuyer,
  className = '',
}) => {
  const [buyers, setBuyers] = useState<BuyerItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // New buyer quick form state
  const [newBuyerForm, setNewBuyerForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    country: '',
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. Load buyers fresh from Supabase every time the Add/Edit Style form opens:
  // select id, name from buyers where is_active = true order by name
  const loadBuyers = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase client is not configured (missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY)');
      }

      const { data, error } = await supabase
        .from('buyers')
        .select('id, name')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.error('Supabase buyers query error:', error);
        // 2. If the query returns an error, show it on screen. Do not hide it or fall back to empty.
        setErrorMessage(error.message || JSON.stringify(error));
        return;
      }

      const loadedList: BuyerItem[] = (data || []).map(b => ({
        id: String(b.id),
        name: String(b.name),
      }));

      setBuyers(loadedList);
    } catch (err: any) {
      console.error('Error fetching buyers:', err);
      // 2. If the query returns an error, show it on screen. Do not hide it or fall back to empty.
      setErrorMessage(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Fresh load every time form opens (component mount)
  useEffect(() => {
    loadBuyers();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredBuyers = buyers.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const selectedBuyer =
    buyers.find(b => b.id === selectedBuyerId) ||
    (initialBuyerName ? buyers.find(b => b.name.toLowerCase() === initialBuyerName.toLowerCase()) : null) ||
    null;

  const displayName = selectedBuyer ? selectedBuyer.name : (initialBuyerName || '');

  // 3. After "+ Add new buyer" saves, add the new buyer to the list and select it right away.
  const handleCreateNewBuyer = async (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const trimmedName = newBuyerForm.name.trim();
    if (!trimmedName) {
      showErrorToast('Buyer name is required');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not configured');
      }

      const newId = crypto.randomUUID();
      const payload: any = {
        id: newId,
        name: trimmedName,
        is_active: true,
      };

      if (newBuyerForm.contact_person.trim()) payload.contact_person = newBuyerForm.contact_person.trim();
      if (newBuyerForm.phone.trim()) payload.phone = newBuyerForm.phone.trim();
      if (newBuyerForm.email.trim()) payload.email = newBuyerForm.email.trim();
      if (newBuyerForm.country.trim()) payload.country = newBuyerForm.country.trim();

      let createdBuyer: BuyerItem = { id: newId, name: trimmedName };

      const { data, error: insertError } = await supabase
        .from('buyers')
        .insert(payload)
        .select('id, name')
        .single();

      if (insertError) {
        // If optional columns are not defined in schema, retry with basic required fields
        const { data: minData, error: minError } = await supabase
          .from('buyers')
          .insert({ id: newId, name: trimmedName, is_active: true })
          .select('id, name')
          .single();

        if (minError) {
          throw new Error(minError.message || insertError.message);
        }
        if (minData) {
          createdBuyer = { id: String(minData.id), name: String(minData.name) };
        }
      } else if (data) {
        createdBuyer = { id: String(data.id), name: String(data.name) };
      }

      // 3. Add the new buyer to the list and select it right away
      setBuyers(prev => {
        const withoutNew = prev.filter(b => b.id !== createdBuyer.id);
        const updated = [...withoutNew, createdBuyer];
        return updated.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      });

      // Clear any previous query error
      setErrorMessage(null);

      // Select it right away
      onSelectBuyer(createdBuyer);

      showSuccessToast(`Buyer "${createdBuyer.name}" created and selected.`);
      setShowAddModal(false);
      setIsOpen(false);
      setNewBuyerForm({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        country: '',
      });
    } catch (err: any) {
      console.error('Error creating buyer:', err);
      setSaveError(err?.message || String(err));
      showErrorToast(err?.message || 'Failed to create buyer');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsOpen(prev => {
              const next = !prev;
              if (next && buyers.length === 0 && !isLoading) {
                loadBuyers();
              }
              return next;
            });
          }}
          className={`w-full bg-stone-50 hover:bg-stone-100/80 border ${
            errorMessage ? 'border-rose-300 ring-1 ring-rose-300' : 'border-stone-200'
          } rounded-xl px-3 py-2 text-sm text-stone-900 flex items-center justify-between transition focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left cursor-pointer`}
        >
          <span className="truncate flex items-center gap-1.5 flex-1 mr-1">
            <Building2 className={`w-4 h-4 shrink-0 ${errorMessage ? 'text-rose-500' : 'text-stone-400'}`} />
            {errorMessage ? (
              <span className="text-xs text-rose-600 font-medium truncate flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="truncate">Database error (see below)</span>
              </span>
            ) : isLoading ? (
              <span className="text-xs text-stone-500 flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span>Loading buyers...</span>
              </span>
            ) : displayName ? (
              <span className="font-semibold text-stone-900 truncate">
                {displayName}
              </span>
            ) : (
              <span className="text-stone-600">Select Buyer (Optional)</span>
            )}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {displayName && !errorMessage && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onSelectBuyer(null);
                }}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-200/60"
                title="Clear buyer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>
      </div>

      {/* 2. If the query returns an error, show it on screen. Do not hide it or fall back to empty. */}
      {errorMessage && (
        <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-1.5 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-bold block text-rose-800">Supabase Buyers Error:</span>
            <span className="break-words font-mono text-[11px] text-rose-700 block mt-0.5">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              loadBuyers();
            }}
            className="text-[11px] text-rose-800 font-bold underline shrink-0 hover:text-rose-950 cursor-pointer ml-1 inline-flex items-center gap-0.5"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in duration-100">
          {/* If there was an error, also display it prominently inside the dropdown */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-rose-800">Error querying buyers from Supabase:</div>
                <div className="break-words font-mono text-[11px] mt-0.5 text-rose-700">{errorMessage}</div>
                <button
                  type="button"
                  onClick={() => loadBuyers()}
                  className="mt-2 px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold rounded-lg text-xs cursor-pointer inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Query</span>
                </button>
              </div>
            </div>
          )}

          {/* Search Box */}
          <div className="p-2 border-b border-stone-100 bg-stone-50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search active buyers..."
                className="w-full bg-white border border-stone-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Buyers List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-stone-50">
            {/* Clear option */}
            <button
              type="button"
              onClick={() => {
                onSelectBuyer(null);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-stone-500 hover:bg-stone-50 flex items-center justify-between transition cursor-pointer"
            >
              <span>None (No Buyer)</span>
              {!selectedBuyerId && !initialBuyerName && <Check className="w-3.5 h-3.5 text-indigo-600" />}
            </button>

            {isLoading ? (
              <div className="px-3 py-4 text-xs text-stone-500 text-center flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span>Loading buyers fresh from Supabase...</span>
              </div>
            ) : filteredBuyers.length > 0 ? (
              filteredBuyers.map(b => {
                const isSelected = b.id === selectedBuyerId || (!selectedBuyerId && initialBuyerName?.toLowerCase() === b.name.toLowerCase());
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      onSelectBuyer(b);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition cursor-pointer ${
                      isSelected ? 'bg-indigo-50/70 text-indigo-950 font-semibold' : 'text-stone-800 hover:bg-stone-100'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-medium text-stone-900 truncate">{b.name}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                  </button>
                );
              })
            ) : errorMessage ? (
              <div className="px-3 py-4 text-xs text-rose-600 text-center flex flex-col items-center gap-1">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>Could not load buyers due to database error</span>
              </div>
            ) : (
              <div className="px-3 py-3 text-xs text-stone-600 text-center">
                No matching active buyers
              </div>
            )}
          </div>

          {/* Last Option: + Add new buyer */}
          <div className="p-1.5 border-t border-stone-200 bg-stone-50">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(true);
                setIsOpen(false);
              }}
              className="w-full py-2 px-3 rounded-lg text-xs font-bold text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 transition flex items-center justify-center gap-1.5 border border-dashed border-indigo-200 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add new buyer</span>
            </button>
          </div>
        </div>
      )}

      {/* Small Modal: Add New Buyer (Rendered via Portal and using div instead of nested form to avoid invalid HTML nesting inside parent form) */}
      {showAddModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={e => e.stopPropagation()}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-stone-900">Add New Buyer</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveError && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Error saving buyer:</span>
                  <span className="break-words">{saveError}</span>
                </div>
              </div>
            )}

            <div
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCreateNewBuyer(e);
                }
              }}
              className="space-y-3 pt-3"
            >
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Buyer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newBuyerForm.name}
                  onChange={e => setNewBuyerForm({ ...newBuyerForm, name: e.target.value })}
                  placeholder="e.g. Zara Sourcing / H&M Global"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">
                    Contact Person <span className="text-stone-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newBuyerForm.contact_person}
                    onChange={e => setNewBuyerForm({ ...newBuyerForm, contact_person: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">
                    Country <span className="text-stone-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newBuyerForm.country}
                    onChange={e => setNewBuyerForm({ ...newBuyerForm, country: e.target.value })}
                    placeholder="e.g. Spain / Germany"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">
                    Phone <span className="text-stone-400">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={newBuyerForm.phone}
                    onChange={e => setNewBuyerForm({ ...newBuyerForm, phone: e.target.value })}
                    placeholder="e.g. +1 555-0199"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">
                    Email <span className="text-stone-400">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={newBuyerForm.email}
                    onChange={e => setNewBuyerForm({ ...newBuyerForm, email: e.target.value })}
                    placeholder="buyer@example.com"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAddModal(false);
                  }}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewBuyer}
                  disabled={isSaving || !newBuyerForm.name.trim()}
                  className="flex-1 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save & Select Buyer'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
