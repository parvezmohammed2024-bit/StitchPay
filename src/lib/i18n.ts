import { useState, createContext, useContext, ReactNode, useEffect } from 'react';

export type Language = 'en' | 'bn';

export const translations = {
  en: {
    // Navigation
    navDashboard: 'Dashboard',
    navStyles: 'Styles & Processes',
    navWorkers: 'Workers',
    navQuickEntry: 'Quick Entry (Floor)',
    navBulkGrid: 'Bulk Grid',
    navAttendance: 'Attendance',
    navPayroll: 'Payroll Run',
    navReports: 'Reports',
    navSettings: 'Settings',

    // Roles
    roleAdmin: 'Owner / Admin',
    roleSupervisor: 'Floor Supervisor',
    roleAccounts: 'Accounts Manager',
    currentRole: 'Active Role',
    switchRoleNotice: 'Supervisor cannot edit rates or view payroll. Accounts cannot edit production entries.',

    // Common
    today: "Today's",
    pieces: 'Pieces',
    totalWage: 'Wage Cost',
    activeWorkers: 'Active Floor Workers',
    topEarners: 'Top Daily Earners',
    outputTrend: '14-Day Production Output',
    styleProgress: 'Garment Styles Completion',
    actions: 'Actions',
    save: 'Save',
    saveAll: 'Save All Entries',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    search: 'Search...',
    status: 'Status',
    date: 'Date',
    shift: 'Shift',
    dayShift: 'Day Shift',
    nightShift: 'Night Shift',
    add: 'Add New',
    close: 'Close',
    exportCSV: 'Export to CSV',

    // Quick Entry
    selectDate: '1. Select Date',
    selectStyle: '2. Select Style',
    selectProcess: '3. Select Operation / Process',
    tapWorkerToAdd: '4. Tap Worker to Log Production',
    runningTotal: 'Running Total',
    entriesSaved: 'entries saved',
    duplicateWarningTitle: 'Duplicate Production Entry Detected',
    duplicateWarningMsg: 'An entry already exists for this worker, style, process, date, and shift. Would you like to add an additional entry or edit the existing quantity?',
    addAnyway: 'Add Anyway',
    editExisting: 'Update Existing',

    // Styles & Builder
    totalLabourCost: 'Total Labour Cost per Garment:',
    cloneProcesses: 'Clone Processes from Style',
    importCSV: 'Import CSV Processes',
    processSeq: 'Seq',
    processName: 'Operation Name',
    machineType: 'Machine Type',
    smv: 'SMV (min)',
    pieceRate: 'Rate / Piece',
    active: 'Active',
    completed: 'Completed',

    // Workers
    workerCode: 'Worker Code',
    workerName: 'Full Name',
    section: 'Section',
    lineNo: 'Line No',
    paymentMethod: 'Payment Method',
    outstandingAdvance: 'Outstanding Advance',
    attendanceRate: 'Attendance Rate',
    monthlyEarnings: 'This Month Earnings',

    // Attendance
    present: 'Present',
    absent: 'Absent',
    halfDay: 'Half Day',
    leave: 'Leave',
    holiday: 'Holiday',
    otHours: 'OT Hours',

    // Payroll
    calculatePayroll: 'Calculate Payroll',
    lockPeriod: 'Lock Period',
    markPaid: 'Mark as Paid',
    locked: 'LOCKED',
    paid: 'PAID',
    open: 'OPEN',
    pieceEarnings: 'Piece Earnings',
    minWageTopup: 'Min Wage Top-up',
    netPayable: 'Net Payable',
    deductions: 'Deductions / Advances',
    bonusAllowance: 'Bonus & Allowances',
    shareWhatsApp: 'Share Payslip on WhatsApp',
    printPayslip: 'Print Payslip',

    // Settings
    factoryName: 'Factory Name',
    currencySymbol: 'Currency Symbol',
    minWagePerDay: 'Minimum Wage / Day',
    reworkPayPct: 'Rework Pay %',
    rejectPayPct: 'Reject Pay %',
    enableTopup: 'Enable Minimum Wage Top-up Guarantee',
  },
  bn: {
    // Navigation
    navDashboard: 'ড্যাশবোর্ড',
    navStyles: 'স্টাইল ও প্রসেস',
    navWorkers: 'শ্রমিকবৃন্দ',
    navQuickEntry: 'কুইক এন্ট্রি (ফ্লোর)',
    navBulkGrid: 'বাল্ক গ্রিড এন্ট্রি',
    navAttendance: 'উপস্থিতি',
    navPayroll: 'পে-রোল শীট',
    navReports: 'রিপোর্টসমূহ',
    navSettings: 'সেটিংস',

    // Roles
    roleAdmin: 'মালিক / অ্যাডমিন',
    roleSupervisor: 'ফ্লোর সুপারভাইজার',
    roleAccounts: 'একাউন্টস ম্যানেজার',
    currentRole: 'বর্তমান রোল',
    switchRoleNotice: 'সুপারভাইজার রেট বা পে-রোল দেখতে পারবেন না। একাউন্টস প্রোডাকশন এন্ট্রি পরিবর্তন করতে পারবেন না।',

    // Common
    today: 'আজকের',
    pieces: 'পিস (উৎপাদন)',
    totalWage: 'মোট মজুরি',
    activeWorkers: 'উপস্থিত শ্রমিক',
    topEarners: 'আজকের শীর্ষ উপার্জনকারী',
    outputTrend: '১৪ দিনের উৎপাদন গ্রাফ',
    styleProgress: 'স্টাইল ভিত্তিক অগ্রগতি',
    actions: 'অ্যাকশন',
    save: 'সংরক্ষণ',
    saveAll: 'সব সংরক্ষণ করুন',
    cancel: 'বাতিল',
    edit: 'এডিট',
    delete: 'মুছে ফেলুন',
    search: 'খুঁজুন...',
    status: 'স্ট্যাটাস',
    date: 'তারিখ',
    shift: 'শিফট',
    dayShift: 'ডে শিফট',
    nightShift: 'নাইট শিফট',
    add: 'নতুন যোগ করুন',
    close: 'বন্ধ করুন',
    exportCSV: 'সিএসভি ডাউনলোড',

    // Quick Entry
    selectDate: '১. তারিখ নির্বাচন',
    selectStyle: '২. স্টাইল নির্বাচন',
    selectProcess: '৩. প্রসেস / অপারেশন নির্বাচন',
    tapWorkerToAdd: '৪. শ্রমিকের গায়ে ট্যাপ করে প্রোডাকশন লিখুন',
    runningTotal: 'মোট হিসাব',
    entriesSaved: 'টি এন্ট্রি সংরক্ষিত হয়েছে',
    duplicateWarningTitle: 'একই শ্রমিকের পুনরাবৃত্তি এন্ট্রি',
    duplicateWarningMsg: 'আজ এই শ্রমিকের একই প্রসেসে ইতিমধ্যে একটি এন্ট্রি রয়েছে। আপনি কি নতুন আরেকটি এন্ট্রি যোগ করবেন নাকি আগেরটি এডিট করবেন?',
    addAnyway: 'নতুন যোগ করুন',
    editExisting: 'আগেরটি আপডেট করুন',

    // Styles & Builder
    totalLabourCost: 'প্রতি পোশাকে মোট মজুরি খরচ:',
    cloneProcesses: 'অন্য স্টাইল থেকে প্রসেস কপি করুন',
    importCSV: 'সিএসভি প্রসেস ফাইল আপলোড',
    processSeq: 'ক্রম',
    processName: 'অপারেশনের নাম',
    machineType: 'মেশিনের ধরন',
    smv: 'এসএমভি (মিনিট)',
    pieceRate: 'পিস রেট (টাকা)',
    active: 'চলতি',
    completed: 'সম্পন্ন',

    // Workers
    workerCode: 'শ্রমিক কোড',
    workerName: 'পূর্ণ নাম',
    section: 'সেকশন',
    lineNo: 'লাইন নং',
    paymentMethod: 'পেমেন্ট পদ্ধতি',
    outstandingAdvance: 'বকেয়া অ্যাডভান্স/অগ্রিম',
    attendanceRate: 'উপস্থিতির হার',
    monthlyEarnings: 'চলতি মাসের আয়',

    // Attendance
    present: 'উপস্থিত',
    absent: 'অনুপস্থিত',
    halfDay: 'হাফ-ডে',
    leave: 'ছুটি',
    holiday: 'সরকারি ছুটি',
    otHours: 'ওভারটাইম (ঘণ্টা)',

    // Payroll
    calculatePayroll: 'পে-রোল হিসেব করুন',
    lockPeriod: 'পিরিয়ড লক করুন',
    markPaid: 'পরিশোধিত হিসেবে মার্ক করুন',
    locked: 'লক করা',
    paid: 'পরিশোধিত',
    open: 'উন্মুক্ত',
    pieceEarnings: 'পিস রেট আয়',
    minWageTopup: 'ন্যূনতম মজুরি ভর্তুকি',
    netPayable: 'সর্বমোট প্রদেয়',
    deductions: 'কর্তন / অগ্রিম কর্তন',
    bonusAllowance: 'বোনাস ও ভাতা',
    shareWhatsApp: 'হোয়াটসঅ্যাপে পে-স্লিপ পাঠান',
    printPayslip: 'পে-স্লিপ প্রিন্ট করুন',

    // Settings
    factoryName: 'গার্মেন্টস নাম',
    currencySymbol: 'মুদ্রা প্রতীক',
    minWagePerDay: 'দৈনিক সর্বনিম্ন মজুরি',
    reworkPayPct: 'রিওয়ার্ক মজুরি %',
    rejectPayPct: 'রিজেক্ট মজুরি %',
    enableTopup: 'সর্বনিম্ন মজুরি গ্যারান্টি চালু রাখুন',
  },
};

export interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: keyof typeof translations.en) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key) => translations.en[key] || (key as string),
});

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context || typeof context.t !== 'function') {
    return {
      lang: 'en' as Language,
      setLang: () => {},
      t: (key: keyof typeof translations.en) => translations.en[key] || (key as string),
    };
  }
  return context;
};
