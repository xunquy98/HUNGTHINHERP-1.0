
import { db } from './db';
import { BackupData } from '../types';

const APP_VERSION = '2.9.0'; // Sync with metadata.json / app version
const CURRENT_SCHEMA_VERSION = 22; // Synced with db.ts

export const exportBackup = async (): Promise<void> => {
  try {
    const backup: BackupData = {
      metadata: {
        appVersion: APP_VERSION,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        exportedAt: Date.now(),
        source: 'ERP_HUNGTHINH'
      },
      data: {
        products: await db.products.toArray(),
        partners: await db.partners.toArray(),
        orders: await db.orders.toArray(),
        quotes: await db.quotes.toArray(),
        importOrders: await db.importOrders.toArray(),
        debtRecords: await db.debtRecords.toArray(),
        transactions: await db.transactions.toArray(),
        inventoryLogs: await db.inventoryLogs.toArray(),
        deliveryNotes: await db.deliveryNotes.toArray(),
        settings: await db.settings.toArray(),
        auditLogs: await db.auditLogs.toArray(),
        returnNotes: await db.returnNotes.toArray(),
        purchaseReturnNotes: await db.purchaseReturnNotes.toArray(),
        receivingNotes: await db.receivingNotes.toArray(),
        aiCache: await db.aiCache.toArray(),
      }
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `erp-backup-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Backup export failed:', error);
    throw new Error('Không thể xuất dữ liệu. Vui lòng thử lại.');
  }
};

interface BackupAnalysis {
    isValid: boolean;
    summary: Record<string, number>;
    warnings: string[];
    correctedData: BackupData;
}

export const validateBackup = (json: any): BackupAnalysis => {
    const summary: Record<string, number> = {};
    const warnings: string[] = [];
    
    // Core tables that must exist for the system to work reasonably well
    const requiredTables = ['products', 'orders', 'partners'];
    
    // All tables supported by the system
    const allTables = [
        'products', 'partners', 'orders', 'quotes', 'importOrders', 
        'debtRecords', 'transactions', 'inventoryLogs', 'deliveryNotes', 
        'settings', 'auditLogs', 'returnNotes', 'purchaseReturnNotes', 'receivingNotes',
        'aiCache'
    ];

    // AUTOMATIC MIGRATION FOR LEGACY FLAT BACKUPS or OLD FORMATS
    let normalizedJson = json;
    
    // Check if 'data' wrapper is missing but root keys look like tables (Legacy Format Detection)
    if (!json.data && (Array.isArray(json.products) || Array.isArray(json.orders) || Array.isArray(json.partners))) {
        normalizedJson = {
            metadata: {
                appVersion: 'Legacy',
                schemaVersion: 0,
                exportedAt: Date.now(),
                source: 'Unknown'
            },
            data: json // The whole json object is basically the data object in old format
        };
        warnings.push('Phát hiện định dạng backup cũ (Legacy). Hệ thống đã tự động chuyển đổi cấu trúc.');
    }

    if (!normalizedJson || !normalizedJson.data) {
        throw new Error('Cấu trúc file backup không hợp lệ: Thiếu object "data" hoặc sai định dạng.');
    }

    // Check schema version compatibility
    if (normalizedJson.metadata?.schemaVersion && normalizedJson.metadata.schemaVersion > CURRENT_SCHEMA_VERSION) {
        warnings.push(`Phiên bản backup (v${normalizedJson.metadata.schemaVersion}) mới hơn hệ thống hiện tại (v${CURRENT_SCHEMA_VERSION}). Có thể xảy ra lỗi không tương thích.`);
    }

    // Normalize data: Ensure all tables exist as arrays to prevent runtime crashes
    const correctedData: any = { ...normalizedJson };
    if (!correctedData.data) correctedData.data = {};

    allTables.forEach(table => {
        if (!Array.isArray(correctedData.data[table])) {
            if (requiredTables.includes(table) && correctedData.data[table] === undefined) {
                // Only warn if it's missing entirely for required tables
                warnings.push(`Thiếu bảng dữ liệu quan trọng: ${table}`);
            }
            // Initialize missing/invalid tables as empty arrays to prevent restore crash
            correctedData.data[table] = [];
        }
        summary[table] = correctedData.data[table].length;
    });

    return {
        isValid: true,
        summary,
        warnings,
        correctedData: correctedData as BackupData
    };
};

export const parseBackupFile = (file: File): Promise<BackupAnalysis> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error('File rỗng');
        
        const json = JSON.parse(text);
        const analysis = validateBackup(json);
        resolve(analysis);
      } catch (err: any) {
        // Enhance error message
        let msg = err.message;
        if (msg.includes('JSON')) msg = 'Định dạng file không phải là JSON hợp lệ.';
        reject(new Error(`Lỗi khi đọc file: ${msg}`));
      }
    };
    reader.onerror = () => reject(new Error('Lỗi khi đọc file'));
    reader.readAsText(file);
  });
};

export const restoreBackup = async (backup: BackupData, mode: 'replace' | 'merge'): Promise<void> => {
  const tables = [
    'products', 'partners', 'orders', 'quotes', 'importOrders', 
    'debtRecords', 'transactions', 'inventoryLogs', 'deliveryNotes', 'settings', 'auditLogs',
    'returnNotes', 'purchaseReturnNotes', 'receivingNotes', 'aiCache'
  ] as const;

  await (db as any).transaction('rw', tables, async () => { 
    if (mode === 'replace') {
      // Clear all tables first
      for (const table of tables) {
        await (db as any).table(table).clear(); 
      }
      
      // Bulk add
      for (const table of tables) {
        if (backup.data[table] && Array.isArray(backup.data[table]) && backup.data[table].length > 0) {
          await (db as any).table(table).bulkAdd(backup.data[table]); 
        }
      }
    } else {
      // Merge (Upsert)
      for (const table of tables) {
        if (backup.data[table] && Array.isArray(backup.data[table]) && backup.data[table].length > 0) {
          await (db as any).table(table).bulkPut(backup.data[table]); 
        }
      }
    }
  });
};
