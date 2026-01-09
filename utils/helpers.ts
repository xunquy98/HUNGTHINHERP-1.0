
// Helper: Remove Vietnamese Tones for Search
export const removeVietnameseTones = (str: string) => {
    if (!str) return '';
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,"a"); 
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g,"e"); 
    str = str.replace(/ì|í|ị|ỉ|ĩ/g,"i"); 
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,"o"); 
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g,"u"); 
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g,"y"); 
    str = str.replace(/đ/g,"d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); 
    return str.toLowerCase();
}

// Helper: Normalize string for search (lowercase + trim + remove tones)
export const normalizeText = (str: string) => removeVietnameseTones(str || '').toLowerCase().trim();

// Helper: Safe Rounding for Currency
export const safeRound = (num: number) => Math.round(num);

// Helper: Parse DD/MM/YYYY to Date object
export const parseDate = (dateStr: string) => {
    if (!dateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        return new Date('invalid');
    }
    const [day, month, year] = dateStr.split('/');
    // Month is 0-indexed in JS Date
    return new Date(Number(year), Number(month) - 1, Number(day));
};

// Helper: Parse ISO Date (YYYY-MM-DD) to Date object safely
export const parseISOToDate = (str: string | undefined | null) => {
    if(!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
};

// Helper: Format Date to DD/MM/YYYY with padding
export const formatDateDDMMYYYY = (date: Date) => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
};

// Helper: Format Date to YYYY-MM-DD (ISO date part) for Input fields
export const formatDateISO = (date: Date) => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${y}-${m}-${d}`;
};

// Helper: Format Relative Time (e.g. "2 hours ago")
export const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    // Seconds
    if (diff < 60000) return 'Vừa xong';
    
    // Minutes
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} phút trước`;
    
    // Hours
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    
    // Days
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} ngày trước`;
    
    // Date string fallback
    return new Date(timestamp).toLocaleDateString('vi-VN');
};

// Helper: Add Days to a date
export const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

// Helper: Get Start of Month
export const getStartOfMonth = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
};

// Helper: Get End of Month
export const getEndOfMonth = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

// Helper: Get Current Date as "DD/MM/YYYY" safely
export const getCurrentDate = () => {
    return formatDateDDMMYYYY(new Date());
};

// Helper: Get Days Difference between dates (Target - Base). Positive = Overdue.
export const getDaysDiff = (targetDate: Date, baseDate: Date = new Date()) => {
    const d1 = new Date(targetDate); d1.setHours(0,0,0,0);
    const d2 = new Date(baseDate); d2.setHours(0,0,0,0);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Helper: Convert Input Date "YYYY-MM-DD" to Display Date "DD/MM/YYYY"
// Avoids using new Date() to prevent timezone off-by-one errors
export const formatInputDate = (inputDate: string) => {
    if (!inputDate) return getCurrentDate();
    const [year, month, day] = inputDate.split('-');
    return `${day}/${month}/${year}`;
};

// Helper: Standard Currency Format (xx.xxx.xxx VND)
export const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '0 VND';
    // Intl.NumberFormat with 'vi-VN' automatically uses dots for thousands separators.
    return new Intl.NumberFormat('vi-VN').format(value) + ' VND';
};

// Helper: Generate UUID with optional prefix
export const generateUUID = (prefix: string = 'id') => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Helper: Export Data to CSV (Legacy, simple key-value dump)
export const exportToCSV = (data: any[], fileName: string) => {
  if (!data || !data.length) return;

  // Extract headers
  const headers = Object.keys(data[0]);
  
  // Convert data to CSV format
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header] === null || row[header] === undefined ? '' : row[header];
        const stringValue = String(value);
        // Escape quotes and wrap in quotes if contains comma
        return `"${stringValue.replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  // Add BOM for UTF-8 compatibility
  downloadTextFile(`${fileName}.csv`, `\uFEFF${csvContent}`);
};

// Helper: Custom CSV generation with specified headers
export const toCSV = (rows: Record<string, any>[], headers: { key: string; label: string }[]) => {
  const headerRow = headers.map(h => h.label).join(',');
  
  const body = rows.map(row => {
    return headers.map(header => {
      let val = row[header.key];
      if (val === null || val === undefined) val = '';
      val = String(val).replace(/"/g, '""'); // Escape double quotes
      
      // Wrap in quotes if contains comma, quote or newline
      if (val.search(/("|,|\n)/g) >= 0) {
        val = `"${val}"`;
      }
      return val;
    }).join(',');
  }).join('\n');

  // Add BOM for UTF-8 compatibility in Excel
  return `\uFEFF${headerRow}\n${body}`;
};

// Helper: Trigger file download
export const downloadTextFile = (filename: string, content: string, mime = 'text/csv;charset=utf-8') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Helper: Read Money to Vietnamese Text
const CHU_SO = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const TEN_LOP = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

const doc3So = (baso: string) => {
    const tram = parseInt(baso[0]);
    const chuc = parseInt(baso[1]);
    const donvi = parseInt(baso[2]);
    let ketQua = "";

    if (tram === 0 && chuc === 0 && donvi === 0) return "";

    if (tram !== 0) {
        ketQua += CHU_SO[tram] + " trăm";
        if (chuc === 0 && donvi !== 0) ketQua += " linh";
    }

    if (chuc !== 0 && chuc !== 1) {
        ketQua += " " + CHU_SO[chuc] + " mươi";
        if (chuc === 0 && donvi !== 0) ketQua += " linh";
    }

    if (chuc === 1) ketQua += " mười";

    if (donvi === 1) {
        if (chuc !== 0 && chuc !== 1) ketQua += " mốt";
        else ketQua += " " + CHU_SO[donvi];
    } else if (donvi === 5) {
        if (chuc !== 0) ketQua += " lăm";
        else ketQua += " " + CHU_SO[donvi];
    } else if (donvi !== 0) {
        ketQua += " " + CHU_SO[donvi];
    }

    return ketQua;
};

export const readMoney = (number: number) => {
    if (number === 0) return "Không đồng";
    const str = Math.abs(number).toString();
    
    let i = str.length;
    const groups = [];
    while (i > 0) {
        const start = Math.max(0, i - 3);
        const group = str.slice(start, i);
        groups.push(group.padStart(3, '0'));
        i -= 3;
    }

    let result = "";
    for (let j = groups.length - 1; j >= 0; j--) {
        const so = groups[j];
        const doc = doc3So(so);
        if (doc) {
            result += " " + doc + " " + TEN_LOP[j];
        }
    }

    result = result.trim();
    // Capitalize first letter
    return result.charAt(0).toUpperCase() + result.slice(1) + " đồng";
};

// Helper: Calculate Available Stock
export const calcAvailableStock = (stock: number, reserved?: number) => {
    return Math.max(0, stock - (reserved || 0));
};

// Helper: Copy to Clipboard
export const copyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy: ', err);
        return false;
    }
};

// Helper: Mask sensitive strings (Email, Phone)
export const maskString = (str: string | undefined): string => {
    if (!str) return '';
    if (str.includes('@')) {
        // Mask Email: j***@domain.com
        const [local, domain] = str.split('@');
        if (local.length <= 2) return `${local[0]}***@${domain}`;
        return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
    }
    // Mask Phone: 09***123
    if (/^\d+$/.test(str.replace(/\s/g, ''))) {
        if (str.length < 6) return '***';
        return `${str.slice(0, 2)}***${str.slice(-3)}`;
    }
    return str;
};

// Helper: Replace Placeholders in Template Strings
export const replacePlaceholders = (template: string, data: any): string => {
    if (!template) return '';
    return template.replace(/{{(\w+)}}/g, (_, key) => {
        // Handle nested or simple data
        const val = data[key];
        return val !== undefined && val !== null ? String(val) : '';
    });
};
