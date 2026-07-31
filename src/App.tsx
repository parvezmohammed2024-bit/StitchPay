import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Navigation, ScreenId } from './components/Navigation';
import { UserRoleManagerModal } from './components/UserRoleManagerModal';
import { AuthModal } from './components/AuthModal';
import { LanguageContext, Language, translations } from './lib/i18n';
import { dataService } from './lib/dataService';
import { UserRole, FactorySettings, UserAccount, Worker } from './types';

// Screens
import { DashboardScreen } from './screens/DashboardScreen';
import { WorkerPortalScreen } from './screens/WorkerPortalScreen';
import { DailySetupScreen } from './screens/DailySetupScreen';
import { QuickEntryScreen } from './screens/QuickEntryScreen';
import { DeliveriesScreen } from './screens/DeliveriesScreen';
import { BulkGridScreen } from './screens/BulkGridScreen';
import { RateBidsScreen } from './screens/RateBidsScreen';
import { StylesBuilderScreen } from './screens/StylesBuilderScreen';
import { WorkersScreen } from './screens/WorkersScreen';
import { AttendanceScreen } from './screens/AttendanceScreen';
import { PayrollRunScreen } from './screens/PayrollRunScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard');
  const [role, setRole] = useState<UserRole>('admin');
  const [lang, setLang] = useState<Language>('en');
  const [settings, setSettings] = useState<FactorySettings | null>(null);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isRoleManagerOpen, setIsRoleManagerOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  useEffect(() => {
    dataService.getSettings().then(setSettings);
    dataService.getWorkers().then(setWorkers);
    const user = dataService.getCurrentAuthUser();
    if (user) {
      setCurrentUser(user);
      setRole(user.role);
      if (user.role === 'worker') {
        setActiveScreen('workerPortal');
      }
    }
  }, []);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    dataService.setRole(newRole);

    // Redirect to permitted screen if current screen is restricted for role
    if (newRole === 'worker') {
      setActiveScreen('workerPortal');
    } else if (newRole === 'supervisor' && (activeScreen === 'payroll' || activeScreen === 'reports' || activeScreen === 'settings')) {
      setActiveScreen('quickEntry');
    } else if (newRole === 'accounts' && (activeScreen === 'quickEntry' || activeScreen === 'bulkGrid' || activeScreen === 'settings' || activeScreen === 'dailySetup')) {
      setActiveScreen('payroll');
    }
  };

  const handleAuthSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    handleRoleChange(user.role);
  };

  const handleLogout = () => {
    dataService.logoutUser();
    setCurrentUser(null);
  };

  const t = (key: keyof typeof translations.en) => {
    return translations[lang]?.[key] || translations.en[key] || (key as string);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
        {/* Header */}
        <Header
          currentRole={role}
          onRoleChange={handleRoleChange}
          lang={lang}
          onLangChange={setLang}
          factoryName={settings?.factory_name || 'StitchPay Garments Ltd.'}
          logoUrl={settings?.logo_url}
          currentUser={currentUser}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
          onOpenRoleManager={() => setIsRoleManagerOpen(true)}
          isWorkerPortal={activeScreen === 'workerPortal'}
        />

        {/* Master Admin User Role Manager Modal */}
        <UserRoleManagerModal
          isOpen={isRoleManagerOpen}
          onClose={() => setIsRoleManagerOpen(false)}
        />

        {/* Authentication Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={handleAuthSuccess}
          workers={workers}
        />

        {/* Main Body */}
        <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto">
          {/* Desktop Navigation Sidebar */}
          <Navigation
            activeScreen={activeScreen}
            onNavigate={setActiveScreen}
            role={role}
          />

          {/* Screen Content Container */}
          <main className="flex-1 p-3 sm:p-6 overflow-y-auto">
            {activeScreen === 'workerPortal' && <WorkerPortalScreen />}
            {activeScreen === 'dashboard' && <DashboardScreen />}
            {activeScreen === 'dailySetup' && <DailySetupScreen role={role} />}
            {activeScreen === 'quickEntry' && <QuickEntryScreen role={role} />}
            {activeScreen === 'deliveries' && <DeliveriesScreen />}
            {activeScreen === 'bulkGrid' && <BulkGridScreen role={role} />}
            {activeScreen === 'rateBids' && <RateBidsScreen role={role} />}
            {activeScreen === 'styles' && <StylesBuilderScreen role={role} />}
            {activeScreen === 'workers' && <WorkersScreen role={role} />}
            {activeScreen === 'attendance' && <AttendanceScreen role={role} />}
            {activeScreen === 'payroll' && <PayrollRunScreen role={role} />}
            {activeScreen === 'reports' && <ReportsScreen />}
            {activeScreen === 'settings' && <SettingsScreen role={role} />}
          </main>
        </div>
      </div>
    </LanguageContext.Provider>
  );
}
