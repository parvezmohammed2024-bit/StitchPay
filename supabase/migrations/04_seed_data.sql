-- MIGRATION 04: DEMO SEED DATA
-- Run this script in Supabase SQL Editor to populate demo style, 12 processes, 10 workers & production logs

-- 1. INITIAL SETTINGS
INSERT INTO settings (
  factory_name, currency_code, currency_symbol, pay_cycle, rework_pay_percent, reject_pay_percent, minimum_wage_per_day, enable_minimum_wage_topup
) VALUES (
  'StitchPay Garments Ltd.', 'BDT', '৳', 'monthly', 10.00, 0.00, 350.00, true
) ON CONFLICT DO NOTHING;

-- 2. DEMO STYLE: Men's Formal Shirt / MS-2401
INSERT INTO styles (id, style_code, name, buyer_name, image_url, order_qty, target_ship_date, status, notes)
VALUES (
  'a1111111-1111-1111-1111-111111111111',
  'MS-2401',
  'Men''s Formal Shirt',
  'Apex Garments Global',
  'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80',
  25000,
  CURRENT_DATE + INTERVAL '30 days',
  'active',
  '100% Cotton 80s 2-ply pinpoint oxford fabric'
) ON CONFLICT DO NOTHING;

-- 3. 12 PROCESSES FOR MS-2401 WITH REALISTIC RATES & SMV
INSERT INTO processes (style_id, seq_no, name, machine_type, smv, rate, is_active) VALUES
('a1111111-1111-1111-1111-111111111111', 1,  'Collar Make & Topstitch', 'Single Needle Lockstitch', 1.80, 4.50, true),
('a1111111-1111-1111-1111-111111111111', 2,  'Cuff Preparation & Fuse', 'Automated Fusing Press', 1.20, 3.20, true),
('a1111111-1111-1111-1111-111111111111', 3,  'Front Placket Attach',    'Twin Needle Folder',      2.10, 5.00, true),
('a1111111-1111-1111-1111-111111111111', 4,  'Pocket Attach',          'Pattern Sewer Auto',      1.50, 4.00, true),
('a1111111-1111-1111-1111-111111111111', 5,  'Shoulder Seam Join',     '4-Thread Overlock',       1.10, 2.80, true),
('a1111111-1111-1111-1111-111111111111', 6,  'Collar Attach to Neck',  'Single Needle Lockstitch', 2.40, 6.00, true),
('a1111111-1111-1111-1111-111111111111', 7,  'Sleeve Set & Overlock',  '4-Thread Overlock',       2.20, 5.50, true),
('a1111111-1111-1111-1111-111111111111', 8,  'Side Seam & Gusset',     'Feed off the Arm',        2.00, 5.20, true),
('a1111111-1111-1111-1111-111111111111', 9,  'Cuff Attach to Sleeve',  'Single Needle Lockstitch', 1.90, 4.80, true),
('a1111111-1111-1111-1111-111111111111', 10, 'Bottom Hemming',         'Single Needle Folder',    1.30, 3.00, true),
('a1111111-1111-1111-1111-111111111111', 11, 'Buttonhole Auto',        'Automatic Buttonhole',    0.90, 2.20, true),
('a1111111-1111-1111-1111-111111111111', 12, 'Button Attach & QC',     'Automatic Button Attacher', 1.00, 2.50, true)
ON CONFLICT DO NOTHING;

-- 4. 10 DEMO WORKERS
INSERT INTO workers (id, worker_code, full_name, phone, photo_url, section, line_no, joined_at, payment_method, payment_details, status) VALUES
('b1111111-1111-1111-1111-111111111101', 'W-101', 'Rahim Uddin',       '+8801711001122', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', 'Sewing', 'Line-01', CURRENT_DATE - 365, 'mobile_wallet', '{"provider": "bKash", "account": "01711001122"}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111102', 'W-102', 'Fatema Begum',      '+8801811001123', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', 'Sewing', 'Line-01', CURRENT_DATE - 200, 'cash',          '{}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111103', 'W-103', 'Abdul Karim',       '+8801911001124', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', 'Sewing', 'Line-01', CURRENT_DATE - 400, 'bank',          '{"bank_name": "DBBL", "account": "110.120.3456"}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111104', 'W-104', 'Nusrat Jahan',      '+8801611001125', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'Sewing', 'Line-02', CURRENT_DATE - 150, 'mobile_wallet', '{"provider": "Nagad", "account": "01611001125"}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111105', 'W-105', 'Tariqul Islam',     '+8801511001126', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80', 'Sewing', 'Line-02', CURRENT_DATE - 500, 'cash',          '{}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111106', 'W-106', 'Salma Akhter',      '+8801711001127', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80', 'Sewing', 'Line-02', CURRENT_DATE - 90,  'mobile_wallet', '{"provider": "bKash", "account": "01711001127"}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111107', 'W-107', 'Kamal Hossain',     '+8801811001128', 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80', 'Finishing', 'Line-03', CURRENT_DATE - 300, 'cash',        '{}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111108', 'W-108', 'Rashida Parvin',    '+8801911001129', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80', 'Finishing', 'Line-03', CURRENT_DATE - 120, 'mobile_wallet', '{"provider": "bKash", "account": "01911001129"}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111109', 'W-109', 'Jahangir Alam',     '+8801611001130', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80', 'Cutting', 'Line-04', CURRENT_DATE - 600, 'bank',          '{"bank_name": "Islami Bank", "account": "205011"}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111110', 'W-110', 'Momena Khatun',     '+8801511001131', 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80', 'Cutting', 'Line-04', CURRENT_DATE - 80,  'cash',          '{}'::jsonb, 'active')
ON CONFLICT DO NOTHING;

-- 5. CURRENT MONTH PAYROLL PERIOD
INSERT INTO payroll_periods (id, name, start_date, end_date, status)
VALUES (
  'c1111111-1111-1111-1111-111111111111',
  'July 2026 Monthly Payroll',
  date_trunc('month', CURRENT_DATE)::date,
  (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date,
  'open'
) ON CONFLICT DO NOTHING;
