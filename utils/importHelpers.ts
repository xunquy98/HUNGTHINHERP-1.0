
import { normalizeText } from './helpers';
import * as XLSX from 'xlsx';

export interface ImportRowData {
    [key: string]: string | number;
}

export interface ParsedFile {
    headers: string[];
    rows: any[];
}

export const parseCSV = (content: string): ParsedFile => {
    const lines = content.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return { headers: [], rows: [] };

    // Simple CSV parser (handling basic quotes)
    const parseLine = (text: string) => {
        const result = [];
        let cur = '';
        let inQuote = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                result.push(cur.trim());
                cur = '';
            } else {
                cur += char;
            }
        }
        result.push(cur.trim());
        return result;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(line => {
        const values = parseLine(line);
        const row: any = {};
        headers.forEach((h, i) => {
            row[h] = values[i] || '';
        });
        return row;
    });

    return { headers, rows };
};

export const parseExcel = (buffer: ArrayBuffer): ParsedFile => {
    const workbook = XLSX.read(buffer, { type: 'array' });
    // Lấy sheet đầu tiên
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert sheet thành JSON array (header: 1 trả về mảng các mảng)
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (jsonData.length === 0) return { headers: [], rows: [] };

    // Giả định dòng đầu tiên là header
    const headers = jsonData[0].map(String);
    const dataRows = jsonData.slice(1);

    const rows = dataRows.map(rowArray => {
        const rowObject: any = {};
        headers.forEach((header, index) => {
            // Lấy giá trị, nếu undefined thì gán rỗng
            rowObject[header] = rowArray[index] !== undefined ? rowArray[index] : '';
        });
        return rowObject;
    });

    return { headers, rows };
};

export const generateErrorCSV = (rows: any[], errors: Record<number, string[]>) => {
    if (rows.length === 0) return '';
    
    const headers = Object.keys(rows[0]);
    const csvRows = [
        [...headers, 'ERRORS'].join(','),
        ...rows.map((row, idx) => {
            if (!errors[idx]) return null; // Only export error rows
            const values = headers.map(h => {
                const val = String(row[h] || '').replace(/"/g, '""');
                return `"${val}"`;
            });
            return [...values, `"${errors[idx].join('; ')}"`].join(',');
        }).filter(Boolean)
    ];

    return csvRows.join('\n');
};

// Standard Fields expected by the system
export const SYSTEM_FIELDS = [
    { key: 'sku', label: 'Mã SKU (*)', required: true },
    { key: 'name', label: 'Tên sản phẩm', required: true },
    { key: 'dimensions', label: 'Quy cách / Kích thước' },
    { key: 'quantity', label: 'Số lượng (*)', required: true, type: 'number' },
    { key: 'price', label: 'Giá vốn', type: 'number' },
    { key: 'retailPrice', label: 'Giá bán', type: 'number' },
    { key: 'brand', label: 'Thương hiệu' },
    { key: 'location', label: 'Vị trí kho' },
    { key: 'minStock', label: 'Tồn tối thiểu', type: 'number' }
];
