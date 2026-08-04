import React, { useState, useEffect } from 'react';
import { 
  Building2, Calendar, FileSpreadsheet, Info, PackageCheck, 
  Truck, DollarSign, TrendingUp, LogOut, ArrowRight, ShieldCheck, 
  RefreshCw, LayoutDashboard, BarChart3, AlertCircle, Clock, CheckCircle2, Phone, Lock
} from 'lucide-react';
import { dataService } from '../lib/dataService';
import { StyleFinancialRecord, MgmtValueTodayRecord, MgmtOrderOverviewRecord, FactorySettings } from '../types';
import { FooterCredit } from '../components/FooterCredit';

export const ManagementPortalScreen: React.FC = () => {
  // Authentication State
  const [userToken, setUserToken] = useState<string | null>(() => {
    return localStorage.getItem('mgmt_portal_token') || localStorage.getItem('mgmt_token') || null;
  });
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('mgmt_user_name') || 'Management Executive';
  });

  // Login Form State
  const [phone, setPhone] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Portal View Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports'>('dashboard');

  // Dashboard Data State
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [valueToday, setValueToday] = useState<MgmtValueTodayRecord | null>(null);
  const [overviewOrders, setOverviewOrders] = useState<MgmtOrderOverviewRecord[]>([]);

  // Reports Data State
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [financials, setFinancials] = useState<StyleFinancialRecord[]>([]);

  // Settings & General Loading
  const [settings, setSettings] = useState<FactorySettings | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  const currencySymbol = settings?.currency_symbol || 'MYR';

  useEffect(() => {
    dataService.getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (userToken) {
      loadPortalData();
    }
  }, [userToken, selectedDate, activeTab, fromDate, toDate]);

  const loadPortalData = async () => {
    if (!userToken) return;
    setLoadingData(true);
    try {
      if (activeTab === 'dashboard') {
        const [todayRes, overviewRes] = await Promise.all([
          dataService.getMgmtValueToday(userToken, selectedDate),
          dataService.getMgmtOverview(userToken),
        ]);
        setValueToday(todayRes);
        setOverviewOrders(overviewRes);
      } else {
        const finRes = await dataService.getMgmtFinancials(userToken, fromDate || null, toDate || null);
        setFinancials(finRes);
      }
    } catch (err) {
      console.error('Error loading management data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !pin.trim()) {
      setLoginError('Please enter Mobile Number and 6-digit PIN');
      return;
    }

    setLoginLoading(true);
    setLoginError(null);

    try {
      const userRes = await dataService.mgmtLogin(phone.trim(), pin.trim());
      if (userRes && userRes.token) {
        setUserToken(userRes.token);
        setUserName(userRes.name || 'Executive Owner');
        localStorage.setItem('mgmt_portal_token', userRes.token);
        localStorage.setItem('mgmt_user_name', userRes.name || 'Executive Owner');
      } else {
        setLoginError('Invalid mobile number or PIN.');
      }
    } catch (err: any) {
      console.error('Management login failed:', err);
      setLoginError(err.message || 'Invalid credentials. Please verify mobile number and PIN.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignOut = () => {
    setUserToken(null);
    setUserName('');
    localStorage.removeItem('mgmt_portal_token');
    localStorage.removeItem('mgmt_token');
    localStorage.removeItem('mgmt_user_name');
  };

  const handleQuickFilter = (type: 'this_week' | 'this_month' | 'all') => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (type === 'this_week') {
      const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setFromDate(pastWeek);
      setToDate(todayStr);
    } else if (type === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(todayStr);
    } else {
      setFromDate('');
      setToDate('');
    }
  };

  const handleExportCSV = () => {
    let csv = 'Style,Buyer,Order Qty,Price per Piece,Garments Sewn,Ready to Deliver,Production Value,Deliverable Value,Labour Cost,Gross Margin,Margin %\n';
    financials.forEach(f => {
      const styleName = f.style || `${f.style_code || ''} ${f.style_name || ''}`.trim();
      const buyer = f.buyer || f.buyer_name || 'N/A';
      csv += `"${styleName}","${buyer}",${f.order_qty},${f.price || 0},${f.garments_sewn},${f.ready_to_deliver},${f.production_value},${f.deliverable_value},${f.labour_cost},${f.gross_margin},${f.margin_pct.toFixed(2)}%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `style_financials_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Financials table totals
  const totalProductionVal = financials.reduce((sum, f) => sum + Number(f.production_value || 0), 0);
  const totalDeliverableVal = financials.reduce((sum, f) => sum + Number(f.deliverable_value || 0), 0);
  const totalLabourCostVal = financials.reduce((sum, f) => sum + Number(f.labour_cost || 0), 0);
  const totalGrossMarginVal = totalDeliverableVal - totalLabourCostVal;
  const totalMarginPctVal = totalDeliverableVal > 0 ? (totalGrossMarginVal / totalDeliverableVal) * 100 : 0;

  // ==========================================
  // 1. STANDALONE LOGIN SCREEN AT /management
  // ==========================================
  if (!userToken) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col justify-center items-center p-4 font-sans selection:bg-amber-500 selection:text-stone-950">
        {/* Background Decorative Blur Blobs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="w-full max-w-md relative z-10 space-y-6">
          {/* Header Branding */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-amber-400 text-stone-950 font-black shadow-lg shadow-amber-400/10 mb-1">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Stitch<span className="text-amber-400">Pay</span> Management
              </h1>
              <p className="text-sm font-semibold text-stone-400 mt-0.5">
                {settings?.factory_name || 'StitchPay Garments Ltd.'}
              </p>
            </div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-stone-800 border border-stone-700 text-xs text-amber-300">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Executive Portal Authentication</span>
            </div>
          </div>

          {/* Login Card */}
          <div className="bg-stone-800/90 border border-stone-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
            <div className="flex items-center space-x-3 pb-4 border-b border-stone-700/80">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Management Sign In</h2>
                <p className="text-xs text-stone-400">Enter your registered phone and PIN</p>
              </div>
            </div>

            {loginError && (
              <div className="p-3.5 bg-rose-950/80 border border-rose-800 rounded-2xl text-rose-200 text-xs font-medium flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1.5">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="e.g. 0123456789"
                    className="w-full bg-stone-900 border border-stone-700 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-amber-400 transition-colors font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1.5">
                  6-Digit PIN
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    maxLength={6}
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    placeholder="••••••"
                    className="w-full bg-stone-900 border border-stone-700 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-amber-400 transition-colors font-mono tracking-widest"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 active:scale-[0.99] disabled:opacity-50 text-stone-950 font-black text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2 mt-2"
              >
                {loginLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In to Executive Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="text-center space-y-3">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/');
                window.dispatchEvent(new Event('popstate'));
              }}
              className="inline-flex items-center space-x-1 text-xs text-stone-400 hover:text-white transition-colors cursor-pointer"
            >
              <span>← Back to Main App</span>
            </a>
            <FooterCredit />
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. AFTER LOGIN: EXECUTIVE PORTAL DASHBOARD
  // ==========================================
  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col font-sans selection:bg-amber-500 selection:text-stone-950">
      {/* Header */}
      <header className="bg-stone-950/90 backdrop-blur-md border-b border-stone-800 px-4 py-3.5 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-400 text-stone-950 font-black flex items-center justify-center text-sm shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-sm text-white tracking-tight">
                  {settings?.factory_name || 'StitchPay Garments Ltd.'}
                </span>
                <span className="text-[10px] bg-amber-400/10 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-400/20">
                  Management
                </span>
              </div>
              <p className="text-xs text-stone-400">Welcome, {userName}</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-semibold border border-stone-700 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 pb-24 space-y-6">
        {activeTab === 'dashboard' ? (
          /* ==========================================
             DASHBOARD TAB
             ========================================== */
          <div className="space-y-6">
            {/* Top Bar with Date Selector */}
            <div className="bg-stone-800 border border-stone-700/80 p-4 sm:p-5 rounded-3xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-amber-400" />
                  <span>Daily Valuation & Output Summary</span>
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Real-time factory metrics and financial valuation
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="bg-stone-900 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={loadPortalData}
                  title="Refresh Data"
                  className="p-1.5 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-xl transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Four Valuation Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Production Value Today */}
              <div className="bg-stone-800 border border-stone-700/80 p-5 rounded-2xl shadow-md space-y-1.5">
                <div className="flex items-center justify-between text-indigo-300">
                  <span className="text-xs font-bold uppercase tracking-wider">Production Value Today</span>
                  <PackageCheck className="w-4.5 h-4.5 text-indigo-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-white">
                  {currencySymbol} {(valueToday?.production_value_today || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-stone-400 leading-tight">
                  Value of garments produced today. Not yet delivered or invoiced.
                </p>
              </div>

              {/* Deliverable Value Today */}
              <div className="bg-stone-800 border border-stone-700/80 p-5 rounded-2xl shadow-md space-y-1.5">
                <div className="flex items-center justify-between text-emerald-300">
                  <span className="text-xs font-bold uppercase tracking-wider">Deliverable Value Today</span>
                  <Truck className="w-4.5 h-4.5 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                  {currencySymbol} {(valueToday?.deliverable_value_today || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-stone-400 leading-tight">
                  Ready to deliver value produced today (billable).
                </p>
              </div>

              {/* Labour Cost Today */}
              <div className="bg-stone-800 border border-stone-700/80 p-5 rounded-2xl shadow-md space-y-1.5">
                <div className="flex items-center justify-between text-amber-300">
                  <span className="text-xs font-bold uppercase tracking-wider">Labour Cost Today</span>
                  <DollarSign className="w-4.5 h-4.5 text-amber-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-amber-300">
                  {currencySymbol} {(valueToday?.labour_cost_today || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-stone-400 leading-tight">
                  Piece-rate labour wage expense incurred today.
                </p>
              </div>

              {/* Net Today */}
              <div className="bg-stone-800 border border-stone-700/80 p-5 rounded-2xl shadow-md space-y-1.5">
                <div className="flex items-center justify-between text-sky-300">
                  <span className="text-xs font-bold uppercase tracking-wider">Net Today</span>
                  <TrendingUp className="w-4.5 h-4.5 text-sky-400" />
                </div>
                <div className={`text-2xl sm:text-3xl font-black font-mono ${(valueToday?.net_today || 0) >= 0 ? 'text-sky-300' : 'text-rose-400'}`}>
                  {currencySymbol} {(valueToday?.net_today || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-stone-400 leading-tight">
                  Deliverable value minus labour cost today.
                </p>
              </div>
            </div>

            {/* Active Orders List */}
            <div className="bg-stone-800 border border-stone-700/80 rounded-3xl p-5 sm:p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-stone-700 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Clock className="w-4.5 h-4.5 text-amber-400" />
                    <span>Active Orders Status</span>
                  </h3>
                  <p className="text-xs text-stone-400">Order completion progress and shipping target days</p>
                </div>
                <span className="text-xs text-stone-400 font-mono">
                  {overviewOrders.length} {overviewOrders.length === 1 ? 'Order' : 'Orders'}
                </span>
              </div>

              {loadingData ? (
                <div className="p-8 text-center text-stone-400 text-xs font-mono">
                  Loading active order status...
                </div>
              ) : overviewOrders.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs">
                  No active garment orders currently in progress.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {overviewOrders.map((ord, idx) => {
                    const orderQty = ord.order_qty || 1;
                    const sewnQty = ord.garments_sewn || 0;
                    const progressPct = Math.min(100, Math.round((sewnQty / orderQty) * 100));

                    return (
                      <div 
                        key={ord.style_id || idx} 
                        className="bg-stone-900 border border-stone-700/80 rounded-2xl p-4 space-y-3 hover:border-stone-600 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-black text-white font-mono">{ord.style_code}</div>
                            <div className="text-xs text-stone-400 font-medium">{ord.buyer}</div>
                          </div>

                          {/* Days to ship pill */}
                          {ord.days_to_ship !== undefined && (
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full font-mono shrink-0 border ${
                              ord.days_to_ship < 0
                                ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                                : ord.days_to_ship <= 3
                                ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                                : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                            }`}>
                              {ord.days_to_ship < 0 
                                ? `Overdue by ${Math.abs(ord.days_to_ship)} days` 
                                : ord.days_to_ship === 0 
                                ? 'Ship Today' 
                                : `${ord.days_to_ship} days left`}
                            </span>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-stone-400">Sewn Progress:</span>
                            <span className="text-white font-bold">
                              {sewnQty.toLocaleString()} / {orderQty.toLocaleString()} pcs ({progressPct}%)
                            </span>
                          </div>
                          <div className="w-full bg-stone-800 h-2.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full transition-all duration-500 rounded-full"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ==========================================
             REPORTS TAB — Style Financial Performance
             ========================================== */
          <div className="space-y-6">
            {/* Header & Controls */}
            <div className="bg-stone-800 border border-stone-700/80 p-5 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-400" />
                  <span>Style Financial Performance</span>
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Detailed order revenue, piece-rate labour cost, and gross margins
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Date Inputs */}
                <div className="flex items-center space-x-2 bg-stone-900 px-3 py-1.5 border border-stone-700 rounded-2xl text-xs font-mono">
                  <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
                  <input
                    type="date"
                    value={fromDate}
                    onChange={e => setFromDate(e.target.value)}
                    className="bg-transparent text-white font-medium focus:outline-none"
                  />
                  <span className="text-stone-500">to</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={e => setToDate(e.target.value)}
                    className="bg-transparent text-white font-medium focus:outline-none"
                  />
                </div>

                {/* Presets */}
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleQuickFilter('this_week')}
                    className="px-2.5 py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    This Week
                  </button>
                  <button
                    onClick={() => handleQuickFilter('this_month')}
                    className="px-2.5 py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    This Month
                  </button>
                  <button
                    onClick={() => handleQuickFilter('all')}
                    className="px-2.5 py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    All
                  </button>
                </div>

                <button
                  onClick={handleExportCSV}
                  className="flex items-center space-x-2 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold px-4 py-2 rounded-xl transition-all text-xs shrink-0 shadow-md cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Financial Performance Table */}
            <div className="bg-stone-800 border border-stone-700/80 rounded-3xl overflow-hidden shadow-lg">
              {loadingData ? (
                <div className="p-12 text-center text-stone-400 text-xs font-mono">
                  Calculating style financials...
                </div>
              ) : financials.length === 0 ? (
                <div className="p-12 text-center text-stone-400 text-xs">
                  No financial data available for the selected period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-stone-900/90 text-stone-400 border-b border-stone-700 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-3.5">Style</th>
                        <th className="p-3.5">Buyer</th>
                        <th className="p-3.5 text-right">Order Qty</th>
                        <th className="p-3.5 text-right">Price ({currencySymbol})</th>
                        <th className="p-3.5 text-right">Garments Sewn</th>
                        <th className="p-3.5 text-right">Ready to Deliver</th>
                        <th className="p-3.5 text-right text-indigo-300 bg-indigo-950/40">Production Val ({currencySymbol})</th>
                        <th className="p-3.5 text-right text-emerald-300 bg-emerald-950/40">Deliverable Val ({currencySymbol})</th>
                        <th className="p-3.5 text-right">Labour Cost ({currencySymbol})</th>
                        <th className="p-3.5 text-right font-black text-white">Gross Margin ({currencySymbol})</th>
                        <th className="p-3.5 text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-700/80 text-stone-200">
                      {financials.map((f, idx) => {
                        const styleDisplay = f.style || `${f.style_code || ''} ${f.style_name || ''}`.trim() || 'Style';
                        const buyerDisplay = f.buyer || f.buyer_name || 'N/A';
                        const price = Number(f.price || f.selling_price || 0);

                        return (
                          <tr key={f.style_id || idx} className="hover:bg-stone-700/40 transition-colors">
                            <td className="p-3.5 font-bold text-white font-mono">{styleDisplay}</td>
                            <td className="p-3.5 text-stone-400">{buyerDisplay}</td>
                            <td className="p-3.5 text-right font-mono">{Number(f.order_qty || 0).toLocaleString()} pcs</td>
                            <td className="p-3.5 text-right font-mono font-medium text-amber-300">
                              {price > 0 ? price.toFixed(2) : <span className="text-stone-500">—</span>}
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-white">
                              {Number(f.garments_sewn || 0).toLocaleString()} pcs
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-sky-300">
                              {Number(f.ready_to_deliver || 0).toLocaleString()} pcs
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-indigo-200 bg-indigo-950/20">
                              {Number(f.production_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3.5 text-right font-mono font-black text-emerald-300 bg-emerald-950/20">
                              {Number(f.deliverable_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3.5 text-right font-mono text-amber-200">
                              {Number(f.labour_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className={`p-3.5 text-right font-mono font-black ${Number(f.gross_margin || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {Number(f.gross_margin || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold">
                              <span className={`px-2.5 py-1 rounded-md text-[11px] ${
                                f.margin_pct > 30 
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                                  : f.margin_pct > 0 
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800' 
                                  : 'bg-rose-950 text-rose-300 border border-rose-800'
                              }`}>
                                {Number(f.margin_pct || 0).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-stone-900/90 font-bold text-white border-t-2 border-stone-700">
                        <td colSpan={2} className="p-3.5 text-xs">Summary Totals</td>
                        <td className="p-3.5 text-right font-mono">
                          {financials.reduce((sum, f) => sum + Number(f.order_qty || 0), 0).toLocaleString()} pcs
                        </td>
                        <td className="p-3.5 text-right font-mono text-stone-500">—</td>
                        <td className="p-3.5 text-right font-mono">
                          {financials.reduce((sum, f) => sum + Number(f.garments_sewn || 0), 0).toLocaleString()} pcs
                        </td>
                        <td className="p-3.5 text-right font-mono text-sky-300">
                          {financials.reduce((sum, f) => sum + Number(f.ready_to_deliver || 0), 0).toLocaleString()} pcs
                        </td>
                        <td className="p-3.5 text-right font-mono text-indigo-300">
                          {totalProductionVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3.5 text-right font-mono text-emerald-400">
                          {totalDeliverableVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3.5 text-right font-mono text-amber-300">
                          {totalLabourCostVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`p-3.5 text-right font-mono font-black ${totalGrossMarginVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {totalGrossMarginVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3.5 text-right font-mono">
                          {totalMarginPctVal.toFixed(1)}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Simple Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-stone-950/95 border-t border-stone-800 py-2 px-4 z-50 backdrop-blur-md">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center space-y-1 px-6 py-1.5 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-amber-400/10 text-amber-400 font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-xs">Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center space-y-1 px-6 py-1.5 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-amber-400/10 text-amber-400 font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-xs">Reports</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
