import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Navigation, ScreenId } from './components/Navigation';
import { LanguageContext, Language, translations } from './lib/i18n';
import { dataService } from './lib/dataService';
import { UserRole, FactorySettings } from './types';

// Screens
import { DashboardScreen } from './screens/DashboardScreen';
import { QuickEntryScreen } from './screens/QuickEntryScreen';
import { BulkGridScreen } from './screens/BulkGridScreen';
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

  useEffect(() => {
    dataService.getSettings().then(setSettings);
  }, []);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    dataService.setRole(newRole);

    // Redirect to permitted screen if current screen is restricted for role
    if (newRole === 'supervisor' && (activeScreen === 'payroll' || activeScreen === 'reports' || activeScreen === 'settings')) {
      setActiveScreen('quickEntry');
    } else if (newRole === 'accounts' && (activeScreen === 'quickEntry' || activeScreen === 'bulkGrid' || activeScreen === 'settings')) {
      setActiveScreen('payroll');
    }
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
          <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
            {activeScreen === 'dashboard' && <DashboardScreen />}
            {activeScreen === 'quickEntry' && <QuickEntryScreen role={role} />}
            {activeScreen === 'bulkGrid' && <BulkGridScreen role={role} />}
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
