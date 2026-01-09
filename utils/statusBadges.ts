
import { BadgeProps } from '../components/ui/Primitives';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusDefinition {
    variant: Variant;
    label: string;
    icon?: string;
}

const STATUS_MAP: Record<string, Record<string, StatusDefinition>> = {
    // Fallback/Generic
    'default': {
        'completed': { variant: 'success', label: 'Hoàn thành', icon: 'check_circle' },
        'paid': { variant: 'success', label: 'Đã thanh toán', icon: 'paid' },
        'success': { variant: 'success', label: 'Thành công', icon: 'check' },
        
        'pending': { variant: 'neutral', label: 'Chờ xử lý', icon: 'hourglass_empty' },
        'draft': { variant: 'neutral', label: 'Nháp', icon: 'edit' },
        
        'processing': { variant: 'info', label: 'Đang xử lý', icon: 'sync' },
        'shipping': { variant: 'info', label: 'Đang giao', icon: 'local_shipping' },
        
        'warning': { variant: 'warning', label: 'Cảnh báo', icon: 'warning' },
        'partial': { variant: 'warning', label: 'Thanh toán 1 phần', icon: 'pie_chart' },
        
        'error': { variant: 'danger', label: 'Lỗi', icon: 'error' },
        'cancelled': { variant: 'danger', label: 'Đã hủy', icon: 'cancel' },
        'void': { variant: 'neutral', label: 'Đã hủy', icon: 'block' },
    },
    'Order': {
        'PendingPayment': { variant: 'warning', label: 'Chờ thanh toán', icon: 'payments' },
        'Processing': { variant: 'info', label: 'Đang xử lý', icon: 'settings' },
        'Shipping': { variant: 'info', label: 'Vận chuyển', icon: 'local_shipping' },
        'Completed': { variant: 'success', label: 'Hoàn thành', icon: 'check_circle' },
        'Cancelled': { variant: 'danger', label: 'Đã hủy', icon: 'cancel' },
    },
    'Payment': { // For Order Payment Status
        'Paid': { variant: 'success', label: 'Đã thanh toán', icon: 'check' },
        'Unpaid': { variant: 'danger', label: 'Chưa thanh toán', icon: 'money_off' },
        'Partial': { variant: 'warning', label: 'Đặt cọc / 1 Phần', icon: 'pie_chart' },
    },
    'Fulfillment': { // For Order Fulfillment
        'NotShipped': { variant: 'neutral', label: 'Chưa giao', icon: 'inventory' },
        'Shipped': { variant: 'info', label: 'Đang giao', icon: 'local_shipping' },
        'Delivered': { variant: 'success', label: 'Đã giao', icon: 'done_all' },
        'Returned': { variant: 'danger', label: 'Trả hàng', icon: 'assignment_return' },
    },
    'Quote': {
        'Draft': { variant: 'neutral', label: 'Nháp', icon: 'edit_note' },
        'Sent': { variant: 'info', label: 'Đã gửi', icon: 'send' },
        'Accepted': { variant: 'success', label: 'Đã chốt', icon: 'thumb_up' },
        'Rejected': { variant: 'danger', label: 'Từ chối', icon: 'thumb_down' },
        'Expired': { variant: 'danger', label: 'Hết hạn', icon: 'event_busy' },
        'Cancelled': { variant: 'neutral', label: 'Hủy bỏ', icon: 'close' },
    },
    'Import': {
        'Pending': { variant: 'neutral', label: 'Lưu nháp', icon: 'save' },
        'Receiving': { variant: 'warning', label: 'Đang nhập', icon: 'input' },
        'Received': { variant: 'success', label: 'Đã nhập kho', icon: 'check' },
        'Completed': { variant: 'success', label: 'Hoàn tất', icon: 'done_all' },
        'Cancelled': { variant: 'danger', label: 'Đã hủy', icon: 'block' },
    },
    'Debt': {
        'Pending': { variant: 'info', label: 'Trong hạn', icon: 'schedule' },
        'Partial': { variant: 'warning', label: 'Thanh toán 1 phần', icon: 'pie_chart' },
        'Paid': { variant: 'success', label: 'Đã thanh toán', icon: 'check_circle' },
        'Overdue': { variant: 'danger', label: 'Quá hạn', icon: 'warning' },
        'DueSoon': { variant: 'warning', label: 'Sắp đến hạn', icon: 'alarm' },
        'Void': { variant: 'neutral', label: 'Đã hủy', icon: 'block' },
        'Normal': { variant: 'success', label: 'Bình thường', icon: 'check' },
    },
    'Delivery': {
        'Pending': { variant: 'neutral', label: 'Chờ giao', icon: 'hourglass_top' },
        'Shipping': { variant: 'info', label: 'Đang giao', icon: 'local_shipping' },
        'Delivered': { variant: 'success', label: 'Giao thành công', icon: 'check_circle' },
        'Cancelled': { variant: 'danger', label: 'Hủy giao', icon: 'cancel' },
    }
};

export const getStatusBadgeProps = (status: string, entityType: string = 'default'): StatusDefinition => {
    const map = STATUS_MAP[entityType] || STATUS_MAP['default'];
    // Try exact match first
    if (map[status]) return map[status];
    
    // Try lowercase generic fallback
    const lowerKey = status?.toLowerCase();
    const generic = STATUS_MAP['default'];
    if (generic && generic[lowerKey]) return generic[lowerKey];

    // Default Fallback
    return { variant: 'neutral', label: status || 'Unknown', icon: 'circle' };
};
