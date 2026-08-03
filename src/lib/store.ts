import { 
  Worker, GarmentStyle, GarmentProcess, ProductionEntry, 
  AttendanceRecord, Adjustment, PayrollPeriod, PayrollLine, 
  FactorySettings, UserRole, ProcessRateHistory, CuttingEntry, GarmentSample 
} from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

// INITIAL DEMO DATA (Matches migration 04)
export const INITIAL_SETTINGS: FactorySettings = {
  id: 'stg-1',
  factory_name: 'StitchPay Garments Ltd.',
  logo_url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=150&auto=format&fit=crop&q=80',
  currency_code: 'BDT',
  currency_symbol: '৳',
  pay_cycle: 'monthly',
  week_start_day: 'saturday',
  rework_pay_percent: 10,
  reject_pay_percent: 0,
  minimum_wage_per_day: 350,
  enable_minimum_wage_topup: true,
};

export const INITIAL_WORKERS: Worker[] = [
  {
    id: 'b1111111-1111-1111-1111-111111111101',
    worker_code: 'W-101',
    full_name: 'Rahim Uddin',
    phone: '+8801711001122',
    photo_url: null,
    section: 'Sewing',
    line_no: 'Line-01',
    joined_at: '2025-08-01',
    payment_method: 'mobile_wallet',
    payment_details: { provider: 'bKash', account: '01711001122' },
    status: 'active',
  },
  {
    id: 'b1111111-1111-1111-1111-111111111102',
    worker_code: 'W-102',
    full_name: 'Fatema Begum',
    phone: '+8801811001123',
    photo_url: null,
    section: 'Sewing',
    line_no: 'Line-01',
    joined_at: '2025-11-15',
    payment_method: 'cash',
    payment_details: {},
    status: 'active',
  },
  {
    id: 'b1111111-1111-1111-1111-111111111103',
    worker_code: 'W-103',
    full_name: 'Abdul Karim',
    phone: '+8801911001124',
    photo_url: null,
    section: 'Sewing',
    line_no: 'Line-01',
    joined_at: '2025-03-10',
    payment_method: 'bank',
    payment_details: { bank_name: 'DBBL', account: '110.120.3456' },
    status: 'active',
  },
  {
    id: 'b1111111-1111-1111-1111-111111111104',
    worker_code: 'W-104',
    full_name: 'Nusrat Jahan',
    phone: '+8801611001125',
    photo_url: null,
    section: 'Sewing',
    line_no: 'Line-02',
    joined_at: '2025-12-01',
    payment_method: 'mobile_wallet',
    payment_details: { provider: 'Nagad', account: '01611001125' },
    status: 'active',
  },
  {
    id: 'b1111111-1111-1111-1111-111111111105',
    worker_code: 'W-105',
    full_name: 'Tariqul Islam',
    phone: '+8801511001126',
    photo_url: null,
    section: 'Sewing',
    line_no: 'Line-02',
    joined_at: '2024-10-01',
    payment_method: 'cash',
    payment_details: {},
    status: 'active',
  },
  {
    id: 'b1111111-1111-1111-1111-111111111106',
    worker_code: 'W-106',
    full_name: 'Salma Akhter',
    phone: '+8801711001127',
    photo_url: null,
    section: 'Sewing',
    line_no: 'Line-02',
    joined_at: '2026-02-01',
    payment_method: 'mobile_wallet',
    payment_details: { provider: 'bKash', account: '01711001127' },
    status: 'active',
  },
  {
    id: 'b1111111-1111-1111-1111-111111111107',
    worker_code: 'W-107',
    full_name: 'Kamal Hossain',
    phone: '+8801811001128',
    photo_url: null,
    section: 'Finishing',
    line_no: 'Line-03',
    joined_at: '2025-06-01',
    payment_method: 'cash',
    payment_details: {},
    status: 'active',
  },
  {
    id: 'b1111111-1111-1111-1111-111111111108',
    worker_code: 'W-108',
    full_name: 'Rashida Parvin',
    phone: '+8801911001129',
    photo_url: null,
    section: 'Finishing',
    line_no: 'Line-03',
    joined_at: '2026-01-15',
    payment_method: 'mobile_wallet',
    payment_details: { provider: 'bKash', account: '01911001129' },
    status: 'active',
  },
  {
    id: 'b1111111-1111-1111-1111-111111111109',
    worker_code: 'W-109',
    full_name: 'Jahangir Alam',
    phone: '+8801611001130',
    photo_url: null,
    section: 'Cutting',
    line_no: 'Line-04',
    joined_at: '2024-05-20',
    payment_method: 'bank',
    payment_details: { bank_name: 'Islami Bank', account: '205011' },
    status: 'active',
  },
  {
    id: 'b1111111-1111-1111-1111-111111111110',
    worker_code: 'W-110',
    full_name: 'Momena Khatun',
    phone: '+8801511001131',
    photo_url: null,
    section: 'Cutting',
    line_no: 'Line-04',
    joined_at: '2026-03-01',
    payment_method: 'cash',
    payment_details: {},
    status: 'active',
  },
];

export const INITIAL_STYLES: GarmentStyle[] = [
  {
    id: 'a1111111-1111-1111-1111-111111111111',
    style_code: 'MS-2401',
    name: "Men's Formal Shirt",
    buyer_name: 'Apex Garments Global',
    image_url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&auto=format&fit=crop&q=80',
    order_qty: 25000,
    target_ship_date: '2026-08-30',
    status: 'active',
    notes: '100% Cotton 80s 2-ply pinpoint oxford fabric',
  },
  {
    id: 'a2222222-2222-2222-2222-222222222222',
    style_code: 'JK-1090',
    name: 'Denim Utility Jacket',
    buyer_name: 'Nordic Outfitters',
    image_url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=400&auto=format&fit=crop&q=80',
    order_qty: 12000,
    target_ship_date: '2026-09-15',
    status: 'active',
    notes: '12oz Heavyweight Indigo Ring Denim',
  },
  {
    id: 'a3333333-3333-3333-3333-333333333333',
    style_code: 'BL-402',
    name: "Women's Silk Blouse",
    buyer_name: 'Zara Fashion Group',
    image_url: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=400&auto=format&fit=crop&q=80',
    order_qty: 8000,
    target_ship_date: '2026-08-18',
    status: 'upcoming',
    notes: 'Pure Mulberry Silk 16 momme',
  },
  {
    id: 'a4444444-4444-4444-4444-444444444444',
    style_code: 'POLO-88',
    name: 'Pique Cotton Polo',
    buyer_name: 'H&M Sourcing',
    image_url: 'https://images.unsplash.com/photo-1625910513413-5fc28122d4f2?w=400&auto=format&fit=crop&q=80',
    order_qty: 5000,
    target_ship_date: '2026-08-10',
    status: 'active',
    notes: '220 GSM Organic Combed Pique',
  }
];

export const INITIAL_PROCESSES: GarmentProcess[] = [
  { id: 'p-01', style_id: 'a1111111-1111-1111-1111-111111111111', seq_no: 1, name: 'Collar Make & Topstitch', machine_type: 'Single Needle Lockstitch', smv: 1.8, rate: 4.5, is_active: true },
  { id: 'p-02', style_id: 'a1111111-1111-1111-1111-111111111111', seq_no: 2, name: 'Cuff Preparation & Fuse', machine_type: 'Automated Fusing Press', smv: 1.2, rate: 3.2, is_active: true },
  { id: 'p-03', style_id: 'a1111111-1111-1111-1111-111111111111', seq_no: 3, name: 'Front Placket Attach', machine_type: 'Twin Needle Folder', smv: 2.1, rate: 5.0, is_active: true },
  { id: 'p-04', style_id: 'a1111111-1111-1111-1111-111111111111', seq_no: 4, name: 'Pocket Attach', machine_type: 'Pattern Sewer Auto', smv: 1.5, rate: 4.0, is_active: true },
  { id: 'p-05', style_id: 'a1111111-1111-1111-1111-111111111111', seq_no: 5, name: 'Shoulder Seam Join', machine_type: '4-Thread Overlock', smv: 1.1, rate: 2.8, is_active: true },
  { id: 'p-06', style_id: 'a1111111-1111-1111-1111-111111111111', seq_no: 6, name: 'Collar Attach to Neck', machine_type: 'Single Needle Lockstitch', smv: 2.4, rate: 6.0, is_active: true },
  { id: 'p-07', style_id: 'a1111111-1111-1111-1111-111111111111', seq_no: 7, name: 'Sleeve Set & Overlock', machine_type: '4-Thread Overlock', smv: 2.2, rate: 5.5, is_active: true },
  { id: 'p-08', style_id: 'a1111111-1111-1111-1111-111111111111', seq_no: 8, name: 'Side Seam & Gusset', machine_type: 'Feed off the Arm', smv: 2.0, rate: 5.2, is_active: true },
  { id: 'p-09', style_id: 'a1111111-1111-1111-1111-111111111111', seq_no: 9, name: 'Cuff Attach to Sleeve', machine_type: 'Single Needle Lockstitch', smv: 1.9, rate: 4.8, is_active: true },
  { id: 'p-10', style_id: 'a1111111-1111-1111-1111-111111111111', seq_no: 10, name: 'Bottom Hemming', machine_type: 'Single Needle Folder', smv: 1.3, rate: 3.0, is_active: true },
  { id: 'p-11', style_id: 'a1111111-1111-1111-1111-111111111111', seq_no: 11, name: 'Buttonhole Auto', machine_type: 'Automatic Buttonhole', smv: 0.9, rate: 2.2, is_active: true },
  { id: 'p-12', style_id: 'a1111111-1111-1111-1111-111111111111', seq_no: 12, name: 'Button Attach & QC', machine_type: 'Automatic Button Attacher', smv: 1.0, rate: 2.5, is_active: true },

  // Denim Jacket processes
  { id: 'pj-01', style_id: 'a2222222-2222-2222-2222-222222222222', seq_no: 1, name: 'Front Flap Pocket Stitch', machine_type: 'Double Needle Heavy', smv: 3.0, rate: 8.5, is_active: true },
  { id: 'pj-02', style_id: 'a2222222-2222-2222-2222-222222222222', seq_no: 2, name: 'Back Yoke Join', machine_type: 'Feed off Arm', smv: 2.5, rate: 7.0, is_active: true },
  { id: 'pj-03', style_id: 'a2222222-2222-2222-2222-222222222222', seq_no: 3, name: 'Collar & Band Attach', machine_type: 'Heavy Lockstitch', smv: 3.2, rate: 9.0, is_active: true },
  { id: 'pj-04', style_id: 'a2222222-2222-2222-2222-222222222222', seq_no: 4, name: 'Metal Button Tack', machine_type: 'Riveter / Tack Auto', smv: 1.5, rate: 4.0, is_active: true },
];

export const INITIAL_PAYROLL_PERIOD: PayrollPeriod = {
  id: 'c1111111-1111-1111-1111-111111111111',
  name: 'July 2026 Monthly Payroll',
  start_date: '2026-07-01',
  end_date: '2026-07-31',
  status: 'open',
};

// Generate 5 days of realistic production entries
const todayStr = '2026-07-31';

export const INITIAL_PRODUCTION_ENTRIES: ProductionEntry[] = [
  // Today's entries
  { id: 'e-101', entry_date: todayStr, worker_id: 'b1111111-1111-1111-1111-111111111101', style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-01', qty_ok: 120, qty_rework: 2, qty_reject: 0, rate_snapshot: 4.5, amount: 540.9, shift: 'day' },
  { id: 'e-102', entry_date: todayStr, worker_id: 'b1111111-1111-1111-1111-111111111102', style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-02', qty_ok: 140, qty_rework: 0, qty_reject: 1, rate_snapshot: 3.2, amount: 448.0, shift: 'day' },
  { id: 'e-103', entry_date: todayStr, worker_id: 'b1111111-1111-1111-1111-111111111103', style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-03', qty_ok: 95, qty_rework: 3, qty_reject: 0, rate_snapshot: 5.0, amount: 476.5, shift: 'day' },
  { id: 'e-104', entry_date: todayStr, worker_id: 'b1111111-1111-1111-1111-111111111104', style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-06', qty_ok: 85, qty_rework: 1, qty_reject: 0, rate_snapshot: 6.0, amount: 510.6, shift: 'day' },
  { id: 'e-105', entry_date: todayStr, worker_id: 'b1111111-1111-1111-1111-111111111105', style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-07', qty_ok: 90, qty_rework: 0, qty_reject: 0, rate_snapshot: 5.5, amount: 495.0, shift: 'day' },
  { id: 'e-106', entry_date: todayStr, worker_id: 'b1111111-1111-1111-1111-111111111106', style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-08', qty_ok: 100, qty_rework: 2, qty_reject: 1, rate_snapshot: 5.2, amount: 521.0, shift: 'day' },
  { id: 'e-107', entry_date: todayStr, worker_id: 'b1111111-1111-1111-1111-111111111107', style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-10', qty_ok: 150, qty_rework: 0, qty_reject: 0, rate_snapshot: 3.0, amount: 450.0, shift: 'day' },
  { id: 'e-108', entry_date: todayStr, worker_id: 'b1111111-1111-1111-1111-111111111108', style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-12', qty_ok: 180, qty_rework: 1, qty_reject: 0, rate_snapshot: 2.5, amount: 450.25, shift: 'day' },

  // Yesterday
  { id: 'e-201', entry_date: '2026-07-30', worker_id: 'b1111111-1111-1111-1111-111111111101', style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-01', qty_ok: 115, qty_rework: 0, qty_reject: 0, rate_snapshot: 4.5, amount: 517.5, shift: 'day' },
  { id: 'e-202', entry_date: '2026-07-30', worker_id: 'b1111111-1111-1111-1111-111111111102', style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-02', qty_ok: 135, qty_rework: 1, qty_reject: 0, rate_snapshot: 3.2, amount: 432.32, shift: 'day' },
  { id: 'e-203', entry_date: '2026-07-29', worker_id: 'b1111111-1111-1111-1111-111111111103', style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-03', qty_ok: 110, qty_rework: 0, qty_reject: 0, rate_snapshot: 5.0, amount: 550.0, shift: 'day' },
  { id: 'e-204', entry_date: '2026-07-28', worker_id: 'b1111111-1111-1111-1111-111111111104', style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-06', qty_ok: 80, qty_rework: 0, qty_reject: 0, rate_snapshot: 6.0, amount: 480.0, shift: 'day' },
  { id: 'e-205', entry_date: '2026-07-27', worker_id: 'b1111111-1111-1111-1111-111111111105', style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-07', qty_ok: 95, qty_rework: 0, qty_reject: 0, rate_snapshot: 5.5, amount: 522.5, shift: 'day' },
];

export const INITIAL_ADJUSTMENTS: Adjustment[] = [
  { id: 'adj-1', worker_id: 'b1111111-1111-1111-1111-111111111101', date: '2026-07-10', type: 'advance', amount: 2000, note: 'Emergency medical advance' },
  { id: 'adj-2', worker_id: 'b1111111-1111-1111-1111-111111111101', date: '2026-07-25', type: 'advance_repay', amount: 500, note: 'Mid-month repayment' },
  { id: 'adj-3', worker_id: 'b1111111-1111-1111-1111-111111111103', date: '2026-07-12', type: 'advance', amount: 1500, note: 'Festive advance' },
  { id: 'adj-4', worker_id: 'b1111111-1111-1111-1111-111111111106', date: '2026-07-20', type: 'bonus', amount: 300, note: 'High accuracy performance bonus' },
];

export const INITIAL_ATTENDANCE: AttendanceRecord[] = INITIAL_WORKERS.map((w, idx) => ({
  id: `att-${w.id}`,
  worker_id: w.id,
  date: todayStr,
  status: idx === 3 ? 'half_day' : idx === 8 ? 'absent' : 'present',
  ot_hours: idx === 0 || idx === 2 ? 2 : 0,
}));

export const INITIAL_DAILY_ASSIGNMENTS: any[] = [
  { id: 'da-101', work_date: todayStr, style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-01', worker_id: 'b1111111-1111-1111-1111-111111111101', target_qty: 250, agreed_rate: 4.8, status: 'active', note: 'Approved higher rate bid' },
  { id: 'da-102', work_date: todayStr, style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-02', worker_id: 'b1111111-1111-1111-1111-111111111102', target_qty: 300, agreed_rate: 3.2, status: 'active' },
  { id: 'da-103', work_date: todayStr, style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-03', worker_id: 'b1111111-1111-1111-1111-111111111103', target_qty: 200, agreed_rate: 5.0, status: 'active' },
  { id: 'da-104', work_date: todayStr, style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-04', worker_id: 'b1111111-1111-1111-1111-111111111103', target_qty: 180, agreed_rate: 4.0, status: 'active' },
  { id: 'da-105', work_date: todayStr, style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-06', worker_id: 'b1111111-1111-1111-1111-111111111104', target_qty: 150, agreed_rate: 6.0, status: 'active' },
  { id: 'da-106', work_date: todayStr, style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-07', worker_id: 'b1111111-1111-1111-1111-111111111105', target_qty: 200, agreed_rate: 5.5, status: 'active' },
  { id: 'da-107', work_date: todayStr, style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-08', worker_id: 'b1111111-1111-1111-1111-111111111106', target_qty: 220, agreed_rate: 5.2, status: 'active' },
  { id: 'da-108', work_date: todayStr, style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-10', worker_id: 'b1111111-1111-1111-1111-111111111107', target_qty: 300, agreed_rate: 3.0, status: 'active' },
  { id: 'da-109', work_date: todayStr, style_id: 'a1111111-1111-1111-1111-111111111111', process_id: 'p-12', worker_id: 'b1111111-1111-1111-1111-111111111108', target_qty: 350, agreed_rate: 2.5, status: 'active' },
];

export const INITIAL_RATE_BIDS: any[] = [
  {
    id: 'rb-01',
    process_id: 'p-01',
    worker_id: 'b1111111-1111-1111-1111-111111111101',
    current_rate: 4.5,
    proposed_rate: 4.8,
    counter_rate: null,
    reason: 'Complex fabric thickness requires slower machine speed and extra care',
    status: 'approved',
    submitted_at: '2026-07-28T10:00:00Z',
    reviewed_at: '2026-07-28T14:30:00Z',
    review_note: 'Approved due to high skill requirement for 80s 2-ply cotton',
  },
  {
    id: 'rb-02',
    process_id: 'p-06',
    worker_id: 'b1111111-1111-1111-1111-111111111104',
    current_rate: 6.0,
    proposed_rate: 6.8,
    counter_rate: 6.4,
    reason: 'Collar attach alignment accuracy takes more SMV than estimated',
    status: 'pending',
    submitted_at: '2026-07-31T08:15:00Z',
  },
  {
    id: 'rb-03',
    process_id: 'pj-01',
    worker_id: 'b1111111-1111-1111-1111-111111111105',
    current_rate: 8.5,
    proposed_rate: 9.5,
    counter_rate: null,
    reason: 'Heavy 12oz Denim thread breaks frequently on double needle folder',
    status: 'pending',
    submitted_at: '2026-07-31T09:00:00Z',
  },
];

export const INITIAL_USER_ACCOUNTS: any[] = [
  {
    id: 'u-admin-1',
    email_or_phone: 'parvezmohammed2024@gmail.com',
    full_name: 'Parvez Mohammed (Master Admin)',
    role: 'admin',
    worker_id: null,
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'u-worker-101',
    email_or_phone: '+8801711001122',
    full_name: 'Rahim Uddin',
    role: 'worker',
    worker_id: 'b1111111-1111-1111-1111-111111111101',
    status: 'active',
    created_at: '2026-07-01T00:00:00Z',
  },
  {
    id: 'u-worker-102',
    email_or_phone: '+8801811001123',
    full_name: 'Fatema Begum',
    role: 'worker',
    worker_id: 'b1111111-1111-1111-1111-111111111102',
    status: 'active',
    created_at: '2026-07-01T00:00:00Z',
  },
  {
    id: 'u-super-1',
    email_or_phone: 'supervisor@stitchpay.com',
    full_name: 'Floor Supervisor',
    role: 'supervisor',
    worker_id: null,
    status: 'active',
    created_at: '2026-07-01T00:00:00Z',
  },
];

export const INITIAL_DELIVERIES: any[] = [
  {
    id: 'del-101',
    delivery_date: '2026-07-29',
    style_id: 'a1111111-1111-1111-1111-111111111111',
    delivered_qty: 1500,
    vehicle_no: 'DHAKA-METRO-TA-1122',
    driver_name: 'Mohammad Ali',
    destination: 'Chittagong Port Depot (Apex Buyer)',
    notes: 'Batch 1 export packing inspection cleared',
    created_at: '2026-07-29T16:00:00Z',
  },
  {
    id: 'del-102',
    delivery_date: '2026-07-30',
    style_id: 'a1111111-1111-1111-1111-111111111111',
    delivered_qty: 2000,
    vehicle_no: 'DHAKA-METRO-TA-4455',
    driver_name: 'Kabir Hossain',
    destination: 'Gazipur Central Warehouse',
    notes: 'Batch 2 second dispatch',
    created_at: '2026-07-30T17:30:00Z',
  },
  {
    id: 'del-103',
    delivery_date: '2026-07-31',
    style_id: 'a2222222-2222-2222-2222-222222222222',
    delivered_qty: 800,
    vehicle_no: 'DHAKA-METRO-HA-8899',
    driver_name: 'Faruk Ahmed',
    destination: 'Nordic Logistics Hub Dhaka',
    notes: 'Initial sample batch dispatch for Denim Jacket',
    created_at: '2026-07-31T12:00:00Z',
  },
];

export const INITIAL_CUTTING_ENTRIES: CuttingEntry[] = [];

export const INITIAL_SAMPLES: GarmentSample[] = [];


