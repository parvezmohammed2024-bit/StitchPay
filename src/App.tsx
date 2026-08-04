import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Navigation, ScreenId } from './components/Navigation';
import { UserRoleManagerModal } from './components/UserRoleManagerModal';
import { ToastContainer } from './components/ToastContainer';
import { FooterCredit } from './components/FooterCredit';
import { LanguageContext, Language, translations } from './lib/i18n';
import { dataService } from './lib/dataService';
import { UserRole, FactorySettings, UserAccount, Worker } from './types';

// Screens
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { WorkerPortalScreen } from './screens/WorkerPortalScreen';
import { DailySetupScreen } from './screens/DailySetupScreen';
import { QuickEntryScreen } from './screens/QuickEntryScreen';
import { CuttingScreen } from './screens/CuttingScreen';
import { FinishingScreen } from './screens/FinishingScreen';
import { BulkGridScreen } from './screens/BulkGridScreen';
import { RateBidsScreen } from './screens/RateBidsScreen';
import { StylesBuilderScreen } from './screens/StylesBuilderScreen';
import { WorkersScreen } from './screens/WorkersScreen';
import { AttendanceScreen } from './screens/AttendanceScreen';
import { PayrollRunScreen } from './screens/PayrollRunScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ManagementPortalScreen } from './screens/ManagementPortalScreen';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard');
  const [role, setRole] = useState<UserRole>('admin');
  const [lang, setLang] = useState<Language>('en');
  const [settings, setSettings] = useState<FactorySettings | null>(null);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isRoleManagerOpen, setIsRoleManagerOpen] = useState<boolean>(false);
  const [pathname, setPathname] = useState<string>(() => {
    return window.location.pathname + window.location.hash + window.location.search;
  });

  useEffect(() => {
    const handleLocationChange = () => {
      setPathname(window.location.pathname + window.location.hash + window.location.search);
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  useEffect(() => {
    dataService.getSettings().then(setSettings);
    dataService.getWorkers().then(setWorkers);
    
    dataService.initSupabaseAuthSession().then(user => {
      if (user) {
        setCurrentUser(user);
        if (user.role !== 'worker') {
          setRole(user.role);
        }
      }
    });
  }, []);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    dataService.setRole(newRole);

    // Redirect to permitted screen if current screen is restricted for role
    if (newRole === 'supervisor' && (activeScreen === 'payroll' || activeScreen === 'reports' || activeScreen === 'settings')) {
      setActiveScreen('quickEntry');
    } else if (newRole === 'accounts' && (activeScreen === 'quickEntry' || activeScreen === 'bulkGrid' || activeScreen === 'settings' || activeScreen === 'dailySetup')) {
      setActiveScreen('payroll');
    }
  };

  const handleAuthSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    if (user.role === 'worker') {
      window.history.pushState({}, '', '/worker');
      setPathname('/worker');
    } else {
      setRole(user.role);
      dataService.setRole(user.role);
    }
  };

  const handleLogout = async () => {
    await dataService.logoutUser();
    setCurrentUser(null);
  };

  const t = (key: keyof typeof translations.en) => {
    return translations[lang]?.[key] || translations.en[key] || (key as string);
  };

  const isWorkerRoute = 
    pathname.includes('/worker') || 
    pathname.includes('#worker') || 
    pathname.includes('?worker');

  const isMgmtRoute = 
    pathname.includes('/management') || 
    pathname.includes('#management') || 
    pathname.includes('?management') ||
    pathname.includes('/mgmt') || 
    pathname.includes('#mgmt') || 
    pathname.includes('?mgmt');

  // DEDICATED MANAGEMENT PORTAL ROUTE (/management)
  if (isMgmtRoute) {
    return (
      <LanguageContext.Provider value={{ lang, setLang, t }}>
        <ToastContainer />
        <ManagementPortalScreen />
      </LanguageContext.Provider>
    );
  }

  // DEDICATED WORKER ROUTE (/worker)
  if (isWorkerRoute) {
    return (
      <LanguageContext.Provider value={{ lang, setLang, t }}>
        <ToastContainer />
        <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
          <header className="bg-white/95 backdrop-blur-md border-b border-stone-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-indigo-700 flex items-center justify-center font-black text-white text-sm shadow-sm">
                SP
              </div>
              <div>
                <span className="font-black text-sm text-stone-900 tracking-tight">{settings?.factory_name || 'StitchPay Garments Ltd.'}</span>
                <span className="text-[10px] bg-sky-50 text-sky-800 font-bold px-2 py-0.5 rounded-full ml-2 border border-sky-200">
                  Worker Portal
                </span>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <WorkerPortalScreen />
          </main>
        </div>
      </LanguageContext.Provider>
    );
  }

  // IF NOT AUTHENTICATED -> SHOW FULL-PAGE LOGIN SCREEN
  if (!currentUser) {
    return (
      <LanguageContext.Provider value={{ lang, setLang, t }}>
        <ToastContainer />
        <LoginScreen
          onAuthSuccess={handleAuthSuccess}
          factoryName={settings?.factory_name || 'StitchPay Garments Ltd.'}
        />
      </LanguageContext.Provider>
    );
  }

  // ADMIN / SUPERVISOR / ACCOUNTS APP ROUTE (AUTHENTICATED)
  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      <ToastContainer />
      <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white max-w-full overflow-x-hidden">
        {/* Header */}
        <Header
          currentRole={role}
          onRoleChange={handleRoleChange}
          lang={lang}
          onLangChange={setLang}
          factoryName={settings?.factory_name || 'StitchPay Garments Ltd.'}
          logoUrl={settings?.logo_url}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenRoleManager={() => setIsRoleManagerOpen(true)}
          isWorkerPortal={false}
        />

        {/* Master Admin User Role Manager Modal */}
        <UserRoleManagerModal
          isOpen={isRoleManagerOpen}
          onClose={() => setIsRoleManagerOpen(false)}
        />

        {/* Main Body */}
        <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto pb-16 md:pb-0">
          {/* Desktop Navigation Sidebar */}
          <Navigation
            activeScreen={activeScreen}
            onNavigate={setActiveScreen}
            role={role}
            onLogout={handleLogout}
          />

          {/* Screen Content Container */}
          <main className="flex-1 p-3 sm:p-6 overflow-y-auto w-full max-w-full">
            {activeScreen === 'dashboard' && <DashboardScreen />}
            {activeScreen === 'dailySetup' && <DailySetupScreen role={role} onNavigate={(scr) => setActiveScreen(scr as ScreenId)} />}
            {activeScreen === 'quickEntry' && <QuickEntryScreen role={role} />}
            {activeScreen === 'cutting' && <CuttingScreen role={role} />}
            {activeScreen === 'finishing' && <FinishingScreen role={role} onNavigate={(scr) => setActiveScreen(scr as ScreenId)} />}
            {activeScreen === 'bulkGrid' && <BulkGridScreen role={role} onNavigate={(scr) => setActiveScreen(scr)} />}
            {activeScreen === 'rateBids' && <RateBidsScreen role={role} />}
            {activeScreen === 'styles' && <StylesBuilderScreen role={role} />}
            {activeScreen === 'workers' && <WorkersScreen role={role} />}
            {activeScreen === 'attendance' && <AttendanceScreen role={role} />}
            {activeScreen === 'payroll' && <PayrollRunScreen role={role} />}
            {activeScreen === 'reports' && <ReportsScreen role={role} />}
            {activeScreen === 'mgmtPortal' && <ManagementPortalScreen />}
            {activeScreen === 'settings' && <SettingsScreen role={role} />}

            <FooterCredit hasBottomNav={true} />
          </main>
        </div>
      </div>
    </LanguageContext.Provider>
  );
}
