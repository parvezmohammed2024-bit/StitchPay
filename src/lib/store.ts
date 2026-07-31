import { 
  Worker, GarmentStyle, GarmentProcess, ProductionEntry, 
  AttendanceRecord, Adjustment, PayrollPeriod, PayrollLine, 
  FactorySettings, UserRole, ProcessRateHistory 
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
    photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
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
    photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
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
    photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
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
    photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
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
    photo_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
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
    photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
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
    photo_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
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
    photo_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
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
    photo_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
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
    photo_url: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80',
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
    image_url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80',
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
    image_url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600&auto=format&fit=crop&q=80',
    order_qty: 12000,
    target_ship_date: '2026-09-15',
    status: 'active',
    notes: '12oz Heavyweight Indigo Ring Denim',
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
