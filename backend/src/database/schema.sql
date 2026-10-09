-- ========================================================
-- Smart Lunchbox Delivery System (MSU Area) - MySQL Schema
-- Designed for Aiven Cloud MySQL / Local MySQL
-- ========================================================

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  address TEXT NOT NULL,
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Riders Table
CREATE TABLE IF NOT EXISTS riders (
  id VARCHAR(50) PRIMARY KEY,
  rider_number INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  color VARCHAR(20) NOT NULL
);

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(100) PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL,
  customer_id VARCHAR(50) NOT NULL,
  box_count INT NOT NULL DEFAULT 1,
  price_per_box DECIMAL(10, 2) DEFAULT 65.00,
  cost_per_box DECIMAL(10, 2) DEFAULT 40.00,
  status VARCHAR(30) DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- 4. Delivery Plans Table (Stores Overall VRP Calculation & Financial Summary)
CREATE TABLE IF NOT EXISTS delivery_plans (
  id VARCHAR(100) PRIMARY KEY,
  departure_time VARCHAR(20) DEFAULT '11:30',
  deadline_time VARCHAR(20) DEFAULT '12:30',
  optimization_strategy VARCHAR(50) NOT NULL,
  total_orders INT NOT NULL DEFAULT 0,
  total_boxes INT NOT NULL DEFAULT 0,
  total_riders_used INT NOT NULL DEFAULT 0,
  total_distance_km DECIMAL(10, 2) NOT NULL DEFAULT 0,
  max_trip_duration_minutes INT NOT NULL DEFAULT 0,
  is_all_within_deadline BOOLEAN DEFAULT TRUE,
  total_revenue DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_food_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_rider_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  net_profit DECIMAL(10, 2) NOT NULL DEFAULT 0,
  profit_margin_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
  plan_json LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Delivery Jobs Table (Matches Friend 2 ERDPlus Model: Delivery_Job for Each Rider)
CREATE TABLE IF NOT EXISTS delivery_jobs (
  id VARCHAR(100) PRIMARY KEY,
  job_code VARCHAR(50) NOT NULL,
  rider_id VARCHAR(50) NOT NULL,
  plan_id VARCHAR(100) NOT NULL,
  total_boxes INT NOT NULL DEFAULT 0,
  total_distance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  delivery_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  departure_time VARCHAR(20) DEFAULT '11:30',
  completion_time VARCHAR(20) DEFAULT '12:30',
  status VARCHAR(30) DEFAULT 'ASSIGNED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES delivery_plans(id) ON DELETE CASCADE
);

-- 6. Delivery Routes Table (Matches Friend 2 ERDPlus Model: Delivery_Route for Waypoint Stops)
CREATE TABLE IF NOT EXISTS delivery_routes (
  id VARCHAR(100) PRIMARY KEY,
  job_id VARCHAR(100) NOT NULL,
  order_id VARCHAR(100) NOT NULL,
  sequence_number INT NOT NULL,
  distance_from_prev DECIMAL(10, 2) NOT NULL DEFAULT 0,
  estimated_arrival_minutes INT NOT NULL DEFAULT 0,
  google_maps_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES delivery_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ========================================================
-- Initial Seed: 30 Realistic Customers around MSU (3km radius)
-- ========================================================
INSERT IGNORE INTO customers (id, name, phone, address, lat, lng) VALUES
('CUST-01', 'น้องมายด์ (คณะวิทย์ฯ)', '089-111-2233', 'หอพักสุขสบาย ห้อง 302 ซอยหน้า ม.ใหม่ มมส.', 16.2475000, 103.2512000),
('CUST-02', 'พี่กอล์ฟ (วิศวะคอมฯ)', '088-222-3344', 'คอนโดโมเดิร์นวิลล์ ขามเรียง ชั้น 5', 16.2421000, 103.2530000),
('CUST-03', 'อาจารย์สมชาย', '081-333-4455', 'คณะวิทยาการสารสนเทศ (IT) ชั้น 3 ห้อง 308 มมส.', 16.2440000, 103.2492000),
('CUST-04', 'น้องแพรวา (การตลาด)', '090-444-5566', 'หอพักเคียงมอ มมส. ตึก A ซอยวัวข้อง', 16.2489000, 103.2485000),
('CUST-05', 'น้องบอย (เภสัชฯ)', '087-555-6677', 'หอพักเสริมไทยคอมเพล็กซ์ขามเรียง ห้อง 415', 16.2415000, 103.2560000),
('CUST-06', 'น้องพลอย (มนุษยศาสตร์)', '095-666-7788', 'หอพักหญิงมารวย ซอยวัวข้อง ตึก 2', 16.2510000, 103.2535000),
('CUST-07', 'พี่เต๋า (สถาปัตย์)', '084-777-8899', 'หอพักตักศิลาแกรนด์ ห้อง 210 ฝั่งตะวันตก', 16.2390000, 103.2450000),
('CUST-08', 'พี่แนน (การบัญชีและการจัดการ)', '086-888-9900', 'คณะการบัญชีและการจัดการ (MBS) ตึก B ชั้น 2', 16.2462000, 103.2470000),
('CUST-09', 'น้องออย (นิติศาสตร์)', '092-999-0011', 'หอพักบ้านสวนชวนชม ซอยเกิบ', 16.2532000, 103.2490000),
('CUST-10', 'พี่วิน (เจ้าหน้าที่กองกิจการนิสิต)', '083-000-1122', 'อาคารบรมราชกุมารี (ตึกอธิการบดี มมส.) ชั้น 1', 16.2435000, 103.2505000),
('CUST-11', 'น้องเก้า (ศึกษาศาสตร์)', '091-123-4567', 'หอพักทรัพย์ทวี คลองถมท่าขอนยาง', 16.2385000, 103.2620000),
('CUST-12', 'พี่ต้น (สาธารณสุข)', '085-234-5678', 'หอพักร่มเย็นวิลล่า ท่าขอนยาง ซอย 4', 16.2350000, 103.2650000),
('CUST-13', 'น้องเบลล์ (นิเทศศาสตร์)', '098-345-6789', 'คอนโดเดอะเกรท มมส. ตึก 1 ห้อง 604', 16.2495000, 103.2550000),
('CUST-14', 'น้องเจมส์ (วิทยาศาสตร์การกีฬา)', '082-456-7890', 'หอพักธนภัทร ซอยเกิบ ขามเรียง', 16.2460000, 103.2545000),
('CUST-15', 'ครูฝึกซ้อมบาสฯ มมส.', '094-567-8901', 'อาคารพลศึกษา มหาวิทยาลัยมหาสารคาม', 16.2410000, 103.2480000),
('CUST-16', 'น้องนิว (การท่องเที่ยว)', '089-678-9012', 'หอพักดารารัตน์ มอมะกอก ซอย 2', 16.2550000, 103.2460000),
('CUST-17', 'ห้องแล็บภาควิชาวิศวกรรมเครื่องกล', '088-789-0123', 'คณะวิศวกรรมศาสตร์ มมส. ตึก EN2 ชั้น 1', 16.2455000, 103.2458000),
('CUST-18', 'น้องบีม (ศิลปกรรมศาสตร์)', '081-890-1234', 'หอพักสิริเพลส ขามเรียง ห้อง 312', 16.2370000, 103.2520000),
('CUST-19', 'พี่ดา (ร้านสหกรณ์ มมส.)', '090-901-2345', 'อาคารศูนย์อาหารและบริการสวัสดิการ มมส. หนองขาม', 16.2448000, 103.2510000),
('CUST-20', 'น้องบอส (เศรษฐศาสตร์)', '087-012-3456', 'หอพักพงษ์เพชร ซอย 7 ขามเรียง', 16.2502000, 103.2575000),
('CUST-21', 'น้องฟ้า (เทคโนโลยีการเกษตร)', '095-123-9876', 'หอพักศรีสุนทร ท่าขอนยาง ซอยประปา', 16.2340000, 103.2590000),
('CUST-22', 'พี่เอ็ม (สำนักวิทยบริการ/หอสมุด)', '084-234-8765', 'อาคารบริการวิชาการและหอสมุด มมส. ชั้น 1', 16.2425000, 103.2515000),
('CUST-23', 'น้องมุก (สิ่งแวดล้อม)', '086-345-7654', 'หอพักกุลนิดา ขามเรียง ฝั่งทุ่งนา', 16.2480000, 103.2430000),
('CUST-24', 'พี่แบงค์ (บัณฑิตวิทยาลัย)', '092-456-6543', 'หอพักชัยเจริญ ถนนหน้าป้าย มมส.', 16.2465000, 103.2562000),
('CUST-25', 'อาจารย์วรรณา (สาธิต มมส.)', '083-567-5432', 'โรงเรียนสาธิตมหาวิทยาลัยมหาสารคาม (ฝ่ายมัธยม)', 16.2520000, 103.2410000),
('CUST-26', 'พี่นก (พยาบาลศาสตร์)', '091-678-4321', 'คณะพยาบาลศาสตร์ มมส. ห้องพักอาจารย์ 201', 16.2405000, 103.2498000),
('CUST-27', 'น้องเต้ (วิทยาลัยการเมืองการปกครอง)', '085-789-3210', 'หอพักสุขใจ ซอยเสริมไทยขามเรียง', 16.2430000, 103.2580000),
('CUST-28', 'น้องจอย (ดุริยางคศิลป์)', '098-890-2109', 'หอพักชมพูนุช ท่าขอนยาง ซอย 9', 16.2365000, 103.2680000),
('CUST-29', 'พี่เอก (สถาบันวิจัยวลัยรุกขเวช)', '082-901-1098', 'อาคารเฉลิมพระเกียรติฯ มมส. ชั้น 2', 16.2472000, 103.2499000),
('CUST-30', 'น้องโฟกัส (สัตวแพทยศาสตร์)', '094-012-0987', 'หอพักพวงคราม ซอยแสงเจริญ ขามเรียง', 16.2540000, 103.2515000);

-- ========================================================
-- Initial Seed: 15 Riders with Palette Colors
-- ========================================================
INSERT IGNORE INTO riders (id, rider_number, name, phone, color) VALUES
('RIDER-01', 1, 'ไรเดอร์ 1', '0801-999-8888', '#EF4444'),
('RIDER-02', 2, 'ไรเดอร์ 2', '0802-999-8888', '#10B981'),
('RIDER-03', 3, 'ไรเดอร์ 3', '0803-999-8888', '#3B82F6'),
('RIDER-04', 4, 'ไรเดอร์ 4', '0804-999-8888', '#F59E0B'),
('RIDER-05', 5, 'ไรเดอร์ 5', '0805-999-8888', '#8B5CF6'),
('RIDER-06', 6, 'ไรเดอร์ 6', '0806-999-8888', '#EC4899'),
('RIDER-07', 7, 'ไรเดอร์ 7', '0807-999-8888', '#06B6D4'),
('RIDER-08', 8, 'ไรเดอร์ 8', '0808-999-8888', '#84CC16'),
('RIDER-09', 9, 'ไรเดอร์ 9', '0809-999-8888', '#F97316'),
('RIDER-10', 10, 'ไรเดอร์ 10', '0810-999-8888', '#6366F1'),
('RIDER-11', 11, 'ไรเดอร์ 11', '0811-999-8888', '#14B8A6'),
('RIDER-12', 12, 'ไรเดอร์ 12', '0812-999-8888', '#D946EF'),
('RIDER-13', 13, 'ไรเดอร์ 13', '0813-999-8888', '#0EA5E9'),
('RIDER-14', 14, 'ไรเดอร์ 14', '0814-999-8888', '#E11D48'),
('RIDER-15', 15, 'ไรเดอร์ 15', '0815-999-8888', '#4F46E5');
