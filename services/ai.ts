
import { GoogleGenAI } from "@google/genai";
import { Product, Order, ImportItem, ViewState } from '../types';
import { formatCurrency } from '../utils/helpers';
import { db } from './db';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Helper to check API Key availability
const getAiClient = () => {
    // Prioritize custom key from settings, then environment variable
    const apiKey = localStorage.getItem('GEMINI_API_KEY') || process.env.API_KEY;
    
    if (!apiKey) {
        throw new Error("Chưa cấu hình API Key");
    }
    return new GoogleGenAI({ apiKey: apiKey });
};

/**
 * 1. AI Smart Restock
 * Analyzes sales history and current stock to suggest import quantities.
 */
export const generateRestockSuggestion = async (
    products: Product[], 
    salesHistory: Order[]
): Promise<ImportItem[]> => {
    try {
        const ai = getAiClient();

        // Prepare context data (simplify to save tokens)
        const productSummary = products.map(p => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            stock: p.stock,
            min: p.minStock || 10,
            cost: p.importPrice
        }));

        const salesSummary = salesHistory.map(o => ({
            date: o.date,
            items: o.items.map(i => ({ sku: i.sku, qty: i.quantity }))
        }));

        const prompt = `
            You are an Inventory Management Expert AI.
            Analyze the following CURRENT STOCK and SALES HISTORY (past 30-90 days).
            Identify items that are low in stock relative to their sales velocity.
            
            Return a JSON object containing a list of suggested items to import.
            Structure: { "suggestions": [ { "sku": "string", "quantity": number, "reason": "string" } ] }
            
            Rules:
            1. Suggest quantities to cover 30 days of sales + safety stock.
            2. Ignore items with high stock and low sales.
            3. "quantity" must be a positive integer.
            
            Data:
            Current Stock: ${JSON.stringify(productSummary.slice(0, 100))} (limited for context)
            Recent Sales: ${JSON.stringify(salesSummary.slice(0, 50))}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        const result = JSON.parse(response.text || '{}');
        const suggestions = result.suggestions || [];

        // Map back to ImportItem type
        return suggestions.map((s: any) => {
            const product = products.find(p => p.sku === s.sku);
            if (!product) return null;
            return {
                id: product.id,
                sku: product.sku,
                productName: product.name,
                unit: 'Cái',
                quantity: s.quantity,
                price: product.importPrice,
                total: s.quantity * product.importPrice
            };
        }).filter(Boolean);

    } catch (error: any) {
        console.error("AI Restock Error:", error);
        throw new Error(error.message || "Lỗi khi phân tích dữ liệu AI.");
    }
};

/**
 * 2. OCR Invoice Scanning
 * Extracts import data from an image file.
 */
export const parseInvoiceImage = async (base64Image: string): Promise<{ supplier: string, items: any[] }> => {
    try {
        const ai = getAiClient();

        const prompt = `
            Extract data from this invoice image into JSON format.
            I need:
            1. "supplierName": The name of the vendor/supplier.
            2. "items": An array of items, each with:
               - "sku": (try to find a code, or leave empty)
               - "productName": Full description
               - "quantity": number
               - "price": unit price (number)
               
            Return strictly JSON.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: [
                {
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "image/jpeg", data: base64Image } }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json",
            }
        });

        const result = JSON.parse(response.text || '{}');
        return {
            supplier: result.supplierName || '',
            items: result.items || []
        };

    } catch (error: any) {
        console.error("AI OCR Error:", error);
        throw new Error(error.message || "Lỗi khi đọc hóa đơn.");
    }
};

/**
 * 3. Smart Product Enrich (Magic Fill)
 * Auto-completes product details from a rough name string.
 */
export const enrichProductInfo = async (rawInput: string): Promise<Partial<Product>> => {
    try {
        const ai = getAiClient();

        const prompt = `
            I have a rough product input: "${rawInput}".
            This is likely an industrial part (Bearing, Belt, Seal, etc.).
            
            Please infer and return a JSON object with:
            - "name": A professional, capitalized full product name (Vietnamese).
            - "sku": The likely part number/SKU (e.g., 6205-2RS, B-52).
            - "brand": The likely brand (SKF, NSK, KOYO, etc.) if inferred, else "Generic".
            - "dimensions": Estimated dimensions if known standard part (e.g. "25x52x15mm"), else empty.
            - "location": Suggest one category ID from ['bearing', 'belt', 'seal', 'pneumatic', 'lubricant'].
            
            Example Input: "bi 6205 skf"
            Example Output: { "name": "Vòng bi cầu SKF 6205-2RS", "sku": "6205-2RS", "brand": "SKF", "dimensions": "25x52x15 mm", "location": "bearing" }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        return JSON.parse(response.text || '{}');
    } catch (error: any) {
        console.error("AI Enrich Error:", error);
        throw new Error(error.message || "Lỗi khi phân tích thông tin sản phẩm.");
    }
};

/**
 * 4. Business Advisor Insight (Cached)
 * Generates executive summary based on report metrics.
 */
export const generateBusinessAdvisorInsight = async (
    data: {
        revenue: number,
        profit: number,
        margin: number,
        orderCount: number,
        topProducts: string[],
        ar: number,
        ap: number,
        lowStockCount: number
    }
): Promise<{ text: string, cached: boolean, generatedAt?: number }> => {
    // Generate a unique cache key based on data content hash (simplified here as date-based)
    // Ideally, cache key should represent the data snapshot.
    // For now, we cache by day. If data changes within the day, user must force regenerate.
    const dateKey = new Date().toISOString().slice(0, 10);
    const cacheKey = `insight-${dateKey}`;

    // 1. Try local cache
    try {
        const cached = await db.aiCache.get(cacheKey);
        if (cached) {
            // Check TTL
            if (Date.now() < cached.expiresAt) {
                return { text: cached.value, cached: true, generatedAt: cached.timestamp };
            } else {
                await db.aiCache.delete(cacheKey);
            }
        }
    } catch (e) {
        console.warn("Cache check failed, proceeding to API");
    }

    // 2. Call API
    try {
        const ai = getAiClient();

        const prompt = `
            Vai trò: Giám đốc Tài chính (CFO) & Vận hành.
            Dữ liệu tuần/tháng này:
            - Doanh thu: ${formatCurrency(data.revenue)}
            - Lợi nhuận gộp: ${formatCurrency(data.profit)} (${data.margin.toFixed(1)}%)
            - Số đơn hàng: ${data.orderCount}
            - Top sản phẩm: ${data.topProducts.join(', ')}
            - Công nợ phải thu: ${formatCurrency(data.ar)}
            - Công nợ phải trả: ${formatCurrency(data.ap)}
            - Cảnh báo kho: ${data.lowStockCount} mã sắp hết.

            Nhiệm vụ:
            Đưa ra nhận định ngắn gọn (tối đa 150 từ) dạng danh sách:
            1. Điểm tích cực nhất.
            2. Rủi ro hoặc điểm cần chú ý (ví dụ: tồn kho, nợ đọng, biên lợi nhuận).
            3. Một hành động khuyến nghị cụ thể cho tuần tới.
            Giọng văn: Chuyên nghiệp, quản trị, đi thẳng vào vấn đề.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });

        const text = response.text || 'Không có dữ liệu phân tích.';

        // 3. Save to cache
        await db.aiCache.put({
            key: cacheKey,
            value: text,
            timestamp: Date.now(),
            expiresAt: Date.now() + CACHE_TTL_MS
        });

        return { text, cached: false, generatedAt: Date.now() };

    } catch (error: any) {
        console.error("AI Advisor Error:", error);
        throw new Error(error.message || "Lỗi kết nối AI (Quota hoặc Mạng).");
    }
};

/**
 * 5. Smart Search (Natural Language to Filter)
 * Translates user query into structured search params.
 */
export const interpretNaturalLanguageQuery = async (query: string): Promise<{ view: ViewState, search?: string, filters?: any }> => {
    try {
        const ai = getAiClient();

        const prompt = `
            Translate the following Vietnamese user query into a JSON object representing search filters for an ERP system.
            
            Query: "${query}"
            
            Target Schema:
            {
                "view": "ORDERS" | "INVENTORY" | "PARTNERS" | "DEBTS" | "REPORTS",
                "search": string | null, (keywords extracted from query)
                "filters": object | null (specific fields like date, status, amount)
            }

            Mappings:
            - "đơn hàng", "bán hàng", "hóa đơn" -> ORDERS
            - "kho", "sản phẩm", "hàng hóa", "tồn" -> INVENTORY
            - "khách", "đối tác", "nhà cung cấp" -> PARTNERS
            - "nợ", "công nợ", "thu", "chi" -> DEBTS
            - "báo cáo", "doanh thu" -> REPORTS

            Date handling:
            If user says "hôm qua", "hôm nay", leave it as string in filters.date (e.g. "today", "yesterday").

            Examples:
            - "Tìm đơn hàng của anh Nam" -> { "view": "ORDERS", "search": "Nam" }
            - "Sản phẩm SKF tồn kho thấp" -> { "view": "INVENTORY", "search": "SKF", "filters": { "stock": "low" } }
            - "Khách nợ trên 10 triệu" -> { "view": "DEBTS", "filters": { "minDebt": 10000000 } }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.warn("Smart Search failed, falling back to basic search.", error);
        // Fallback: simple text search on Dashboard or global
        return { view: 'DASHBOARD', search: query };
    }
};
