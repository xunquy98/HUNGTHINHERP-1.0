
import React from 'react';
import { formatCurrency, readMoney } from '../../utils/helpers';
import { AppSettings } from '../../types';

const THEME_COLOR = '#1e3a8a'; // Navy Blue

const TemplateHeader: React.FC<{ settings: AppSettings, title: string, code?: string, date: string }> = ({ settings, title, code, date }) => (
    <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-400">
        <div className="flex gap-3 items-center">
            {settings.general.logo && (
                <img src={settings.general.logo} alt="Logo" className="h-14 w-auto object-contain max-w-[100px]" />
            )}
            <div>
                <h1 className="text-sm font-black uppercase tracking-tight leading-none mb-1">{settings.general.name}</h1>
                <div className="text-[10px] text-slate-600 leading-snug">
                    <p className="font-medium">{settings.general.address}</p>
                    <p>SĐT: {settings.general.phone}</p>
                </div>
            </div>
        </div>
        <div className="text-right">
            <h2 className="text-lg font-black uppercase" style={{ color: THEME_COLOR }}>{title}</h2>
            {code && <p className="text-xs font-bold text-slate-600 mt-0.5">{code}</p>}
            <p className="text-[10px] italic text-slate-500">Ngày in: {date}</p>
        </div>
    </div>
);

// --- STOCK CARD TEMPLATE ---

export const StockCardTemplate: React.FC<{ data: any, settings: AppSettings }> = ({ data, settings }) => (
    <div className="flex flex-col min-h-full bg-white text-slate-900 font-sans p-6">
        <TemplateHeader 
            settings={settings} 
            title="THẺ KHO"
            code=""
            date={new Date().toLocaleDateString('vi-VN')}
        />

        {/* Product Info - Compact & Clean */}
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded flex justify-between items-start text-[11px]">
            <div className="space-y-1">
                <div><span className="font-bold text-slate-500 uppercase w-20 inline-block">Sản phẩm:</span> <span className="font-bold text-sm text-slate-900">{data.productName}</span></div>
                <div><span className="font-bold text-slate-500 uppercase w-20 inline-block">Mã SKU:</span> <span className="font-mono font-bold text-slate-700">{data.sku}</span></div>
            </div>
            <div className="text-right space-y-1">
                <div><span className="font-bold text-slate-500 uppercase">Đơn vị:</span> <span className="font-medium ml-2">{data.unit || 'Cái'}</span></div>
                <div><span className="font-bold text-slate-500 uppercase">Kho:</span> <span className="font-medium ml-2">{data.location || 'Kho chung'}</span></div>
                <div><span className="font-bold text-slate-500 uppercase">Kỳ báo cáo:</span> <span className="font-medium ml-2 italic">{data.period}</span></div>
            </div>
        </div>

        {/* Table - High Density */}
        <table className="w-full text-[10px] border-collapse mb-6 border border-slate-300">
            <thead>
                <tr className="text-white" style={{ backgroundColor: THEME_COLOR }}>
                    <th rowSpan={2} className="p-1 border border-slate-400 text-center w-20">Ngày</th>
                    <th rowSpan={2} className="p-1 border border-slate-400 text-center w-20">Số CT</th>
                    <th rowSpan={2} className="p-1 border border-slate-400 text-left">Diễn giải</th>
                    <th colSpan={3} className="p-1 border border-slate-400 text-center">Số lượng</th>
                </tr>
                <tr className="text-white bg-slate-700">
                    <th className="p-1 border border-slate-500 text-center w-14">Nhập</th>
                    <th className="p-1 border border-slate-500 text-center w-14">Xuất</th>
                    <th className="p-1 border border-slate-500 text-center w-14">Tồn</th>
                </tr>
            </thead>
            <tbody className="text-slate-800">
                {/* Opening Balance */}
                <tr className="bg-slate-100 font-bold">
                    <td className="p-1 border border-slate-300 text-center"></td>
                    <td className="p-1 border border-slate-300 text-center"></td>
                    <td className="p-1 border border-slate-300">Số dư đầu kỳ</td>
                    <td className="p-1 border border-slate-300 text-center"></td>
                    <td className="p-1 border border-slate-300 text-center"></td>
                    <td className="p-1 border border-slate-300 text-center">{data.openingStock}</td>
                </tr>

                {/* Rows */}
                {data.rows.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50">
                        <td className="p-1 border border-slate-300 text-center text-slate-600">{row.date}</td>
                        <td className="p-1 border border-slate-300 text-center font-mono text-[9px]">{row.ref || '-'}</td>
                        <td className="p-1 border border-slate-300">{row.note}</td>
                        <td className="p-1 border border-slate-300 text-center font-bold text-slate-700">{row.in > 0 ? row.in : ''}</td>
                        <td className="p-1 border border-slate-300 text-center font-bold text-slate-700">{row.out > 0 ? row.out : ''}</td>
                        <td className="p-1 border border-slate-300 text-center font-bold bg-slate-50">{row.balance}</td>
                    </tr>
                ))}

                {/* Totals */}
                <tr className="font-bold bg-slate-200">
                    <td colSpan={3} className="p-1 border border-slate-300 text-right uppercase text-[9px] tracking-wider text-slate-600">Tổng cộng phát sinh</td>
                    <td className="p-1 border border-slate-300 text-center text-slate-900">{data.totalIn}</td>
                    <td className="p-1 border border-slate-300 text-center text-slate-900">{data.totalOut}</td>
                    <td className="p-1 border border-slate-300 text-center bg-slate-300">{data.closingStock}</td>
                </tr>
            </tbody>
        </table>

        <div className="grid grid-cols-3 gap-8 mt-auto text-center pt-6">
            <div>
                <p className="font-bold uppercase text-[10px] mb-12 text-slate-500">Thủ kho</p>
                <div className="border-t border-slate-400 w-20 mx-auto"></div>
            </div>
            <div>
                <p className="font-bold uppercase text-[10px] mb-12 text-slate-500">Kế toán</p>
                <div className="border-t border-slate-400 w-20 mx-auto"></div>
            </div>
            <div>
                <p className="font-bold uppercase text-[10px] mb-12 text-slate-500">Giám đốc</p>
                <div className="border-t border-slate-400 w-20 mx-auto"></div>
            </div>
        </div>
    </div>
);

// --- REPORT TEMPLATE ---

export const ReportTemplate: React.FC<{ data: any, settings: AppSettings }> = ({ data, settings }) => (
    <div className="flex flex-col min-h-full bg-white text-slate-900 font-sans p-6">
        <TemplateHeader 
            settings={settings}
            title="BÁO CÁO QUẢN TRỊ"
            date={new Date().toLocaleDateString('vi-VN')}
        />
        
        <div className="text-center mb-6 -mt-2">
            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-[10px] uppercase tracking-wider border border-slate-200">
                Kỳ báo cáo: {data.period}
            </span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="p-3 border border-slate-200 rounded text-center">
                <p className="text-[9px] font-bold uppercase text-slate-500 mb-1">Doanh thu thuần</p>
                <p className="text-lg font-black text-slate-900">{formatCurrency(data.stats.revenue)}</p>
            </div>
            <div className="p-3 border border-slate-200 rounded text-center">
                <p className="text-[9px] font-bold uppercase text-slate-500 mb-1">Lợi nhuận gộp</p>
                <p className="text-lg font-black text-emerald-600">{formatCurrency(data.stats.profit)}</p>
            </div>
            <div className="p-3 border border-slate-200 rounded text-center">
                <p className="text-[9px] font-bold uppercase text-slate-500 mb-1">Tổng đơn hàng</p>
                <p className="text-lg font-black text-blue-600">{data.stats.orderCount}</p>
            </div>
            <div className="p-3 border border-slate-200 rounded text-center">
                <p className="text-[9px] font-bold uppercase text-slate-500 mb-1">Dòng tiền ròng</p>
                <p className={`text-lg font-black ${data.stats.netCash >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                    {formatCurrency(data.stats.netCash)}
                </p>
            </div>
        </div>

        {/* Content Grid */}
        <div className="flex gap-6">
            {/* Top Products */}
            <div className="flex-1">
                <h3 className="text-[11px] font-bold uppercase text-slate-900 border-b-2 border-slate-800 pb-1 mb-2">Sản phẩm tiêu biểu</h3>
                <table className="w-full text-[10px] border-collapse">
                    <thead>
                        <tr className="bg-slate-100 text-slate-500 uppercase font-bold">
                            <th className="p-1 text-left w-8">#</th>
                            <th className="p-1 text-left">Tên sản phẩm</th>
                            <th className="p-1 text-center w-12">SL</th>
                            <th className="p-1 text-right w-20">Doanh số</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.topProducts.map((p: any, i: number) => (
                            <tr key={i} className="border-b border-slate-100">
                                <td className="p-1 text-center text-slate-500">{i + 1}</td>
                                <td className="p-1 font-medium truncate max-w-[180px]">{p.name}</td>
                                <td className="p-1 text-center font-bold text-slate-700">{p.qty}</td>
                                <td className="p-1 text-right font-bold text-slate-900">{formatCurrency(p.total)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Debts & Analysis */}
            <div className="w-1/3 flex flex-col gap-4">
                <div>
                    <h3 className="text-[11px] font-bold uppercase text-slate-900 border-b-2 border-slate-800 pb-1 mb-2">Công Nợ</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-blue-50 border border-blue-100 rounded">
                            <span className="font-medium text-blue-800 text-[10px]">Phải thu (KH)</span>
                            <span className="font-black text-blue-800 text-xs">{formatCurrency(data.debtStats.ar)}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-orange-50 border border-orange-100 rounded">
                            <span className="font-medium text-orange-800 text-[10px]">Phải trả (NCC)</span>
                            <span className="font-black text-orange-800 text-xs">{formatCurrency(data.debtStats.ap)}</span>
                        </div>
                    </div>
                </div>

                {data.aiInsight && (
                    <div className="flex-1 bg-slate-50 p-3 rounded border border-slate-200">
                        <h4 className="font-bold uppercase text-[9px] text-slate-500 mb-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">psychology</span> AI Insight
                        </h4>
                        <p className="text-[10px] text-slate-700 leading-relaxed whitespace-pre-line text-justify">
                            {data.aiInsight}
                        </p>
                    </div>
                )}
            </div>
        </div>

        <div className="mt-auto pt-6 border-t border-slate-200 text-[9px] text-slate-400 text-center uppercase tracking-widest">
            Báo cáo được tạo tự động bởi hệ thống ERP Hưng Thịnh
        </div>
    </div>
);
