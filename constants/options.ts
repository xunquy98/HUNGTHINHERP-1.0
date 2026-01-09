
// --- WAREHOUSE CONFIGURATION ---
export const WAREHOUSE_CONFIG = [
    { id: 'bearing', label: 'Kho Bạc Đạn', icon: 'motion_photos_on', description: 'Vòng bi các loại (Bi cầu, côn, đũa...)' },
    { id: 'belt', label: 'Kho Curoa - Xích', icon: 'link', description: 'Dây đai, xích công nghiệp' },
    { id: 'seal', label: 'Kho Sin - Phớt', icon: 'donut_small', description: 'Phớt chắn dầu, O-ring, Gioăng' },
    { id: 'hydraulic', label: 'Kho Ống Thủy Lực', icon: 'plumbing', description: 'Ống dầu, đầu nối, tuy ô thủy lực' },
    { id: 'pneumatic', label: 'Kho Khí Nén', icon: 'air', description: 'Xilanh, Van điện từ, Bộ lọc' },
    { id: 'lubricant', label: 'Kho Dầu Mỡ', icon: 'oil_barrel', description: 'Dầu thủy lực, Mỡ chịu nhiệt' },
    { id: 'other', label: 'Kho Khác', icon: 'category', description: 'Vật tư tiêu hao, phụ tùng khác' },
];

export const WAREHOUSE_NAMES = WAREHOUSE_CONFIG.map(w => w.label);

// --- POS CATEGORIES ---
export const POS_CATEGORIES = [
    { id: 'all', label: 'Tất cả', icon: 'apps' },
    ...WAREHOUSE_CONFIG.map(w => ({
        id: w.id,
        label: w.label.replace('Kho ', ''), // Shorten label for POS (e.g. "Bạc Đạn")
        icon: w.icon
    }))
];

// --- PRODUCT BRANDS ---
export const PRODUCT_BRANDS = ['SKF', 'NSK', 'FAG', 'KOYO', 'TIMKEN', 'NTN', 'MITSUBOSHI', 'AIRTAC', 'SHELL', 'SINOPEC', 'DONGHUA', 'ASAHI'];

// --- PAYMENT METHODS ---
export const PAYMENT_METHODS = {
    CASH: { value: 'cash', label: 'Tiền mặt', icon: 'payments' },
    TRANSFER: { value: 'transfer', label: 'Chuyển khoản', icon: 'account_balance' },
    CARD: { value: 'card', label: 'Thẻ', icon: 'credit_card' },
    DEBT: { value: 'debt', label: 'Ghi nợ', icon: 'history_edu' }
};

export const PAYMENT_METHOD_OPTIONS = Object.values(PAYMENT_METHODS);
