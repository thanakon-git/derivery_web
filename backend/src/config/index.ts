export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  SHOP: {
    id: 'SHOP-01',
    name: 'ร้านข้าวกล่องเดลิเวอรี ส่งด่วนมื้อเที่ยง (มมส.)',
    address: 'หน้าป้าย มมส. ใหม่ (ขามเรียง) ต.ขามเรียง อ.กันทรวิชัย จ.มหาสารคาม',
    phone: '081-234-5678',
    lat: 16.2452,
    lng: 103.2501
  },
  BUSINESS: {
    PRICE_PER_BOX: 65, // THB
    FOOD_COST_PER_BOX: 40, // THB
    RIDER_BASE_FEE: 15, // THB per trip
    RIDER_KM_BOX_RATE: 2, // THB per km per box
    MAX_ORDERS_PER_RIDER: 3, // Rider constraint: max 3 orders
    MAX_BOXES_PER_ORDER: 3,
    RIDER_SPEED_KMH: 30, // 30 km/h
    SERVICE_TIME_PER_STOP_MIN: 3, // 3 minutes for parking & handing over
    MAX_ALLOWED_MINUTES: 60, // 1 hour strict deadline (11:30 - 12:30)
    DEPARTURE_TIME: '11:30',
    DEADLINE_TIME: '12:30',
    CIRCUITY_FACTOR: 1.35 // Road network circuity vs straight-line distance
  },
  RIDER_PALETTE: [
    '#EF4444', // Red (Rider 1)
    '#10B981', // Green (Rider 2)
    '#3B82F6', // Blue (Rider 3)
    '#F59E0B', // Amber (Rider 4)
    '#8B5CF6', // Purple (Rider 5)
    '#EC4899', // Pink (Rider 6)
    '#06B6D4', // Cyan (Rider 7)
    '#84CC16', // Lime (Rider 8)
    '#F97316', // Orange (Rider 9)
    '#6366F1', // Indigo (Rider 10)
    '#14B8A6', // Teal (Rider 11)
    '#D946EF', // Fuchsia (Rider 12)
    '#0EA5E9', // Sky (Rider 13)
    '#E11D48', // Rose (Rider 14)
    '#4F46E5', // Slate Indigo (Rider 15)
  ]
};
