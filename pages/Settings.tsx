
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppSettings, BackupData, ReconcileIssue, DocTypeConfig } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { exportBackup, parseBackupFile, restoreBackup } from '../services/backup';
import { PageShell, PageHeader, Button } from '../components/ui/Primitives';
import { FormField, FormInput, FormSelect, FormTextarea } from '../components/ui/Form';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { TemplateEditor } from '../components/print/TemplateEditor';
import { GoogleGenAI } from "@google/genai"; // Import for connection test

// --- UI COMPONENTS ---

const SettingSection: React.FC<{ title: string; description?: string; children: React.ReactNode; className?: string }> = ({ title, description, children, className = '' }) => (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden ${className}`}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-700/50">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
            {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
        </div>
        <div className="p-6">
            {children}
        </div>
    </div>
);

const ToggleSwitch: React.FC<{ label: string; checked: boolean; onChange: (val: boolean) => void; description?: string }> = ({ label, checked, onChange, description }) => (
    <div className="flex items-start justify-between group cursor-pointer" onClick={() => onChange(!checked)}>
        <div className="flex-1 pr-4">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">{label}</label>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
        <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out shrink-0 ${checked ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'}`}>
            <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
        </div>
    </div>
);

const SelectionCard: React.FC<{ 
    selected: boolean; 
    onClick: () => void; 
    icon: string; 
    title: string; 
    description: string;
    color?: string; 
}> = ({ selected, onClick, icon, title, description, color = 'blue' }) => {
    const activeBorder = color === 'blue' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-700';
    const activeBg = color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-slate-800';
    
    return (
        <div 
            onClick={onClick}
            className={`relative p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.99] flex gap-4 items-center ${
                selected ? activeBorder + ' ' + activeBg : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
            }`}
        >
            <div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
            </div>
            <div>
                <h4 className={`text-sm font-bold ${selected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-white'}`}>{title}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            </div>
            {selected && (
                <div className="absolute top-2 right-2 text-blue-600">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                </div>
            )}
        </div>
    );
};

// --- MAIN PAGE ---

const Settings: React.FC = () => {
    const { settings, setSettings, showNotification, reconcileData, toggleTheme, currentUser, setCurrentUser } = useAppContext();
    const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
    const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'finance' | 'documents' | 'system' | 'health'>('general');
    
    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [isDirty, setIsDirty] = useState(false);

    // Backup State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isRestoring, setIsRestoring] = useState(false);
    
    // Backup Analysis State
    const [backupAnalysis, setBackupAnalysis] = useState<{ 
        summary: Record<string, number>; 
        warnings: string[]; 
        correctedData: BackupData; 
    } | null>(null);
    
    const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);

    // Reconcile State
    const [isChecking, setIsChecking] = useState(false);
    const [healthIssues, setHealthIssues] = useState<ReconcileIssue[] | null>(null);

    // Doc Settings State
    const [activeDocType, setActiveDocType] = useState<'order' | 'quote' | 'import' | 'delivery'>('order');
    const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);

    // AI Key State
    const [aiStatus, setAiStatus] = useState<boolean>(false);
    const [isTestingKey, setIsTestingKey] = useState(false);
    
    // Custom API Key Input
    const [customApiKey, setCustomApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);

    // Check dirty state
    useEffect(() => {
        setIsDirty(JSON.stringify(settings) !== JSON.stringify(localSettings));
    }, [localSettings, settings]);

    useEffect(() => {
        checkAiKeyStatus();
        const storedKey = localStorage.getItem('GEMINI_API_KEY');
        if (storedKey) setCustomApiKey(storedKey);
    }, []);

    const checkAiKeyStatus = async () => {
        // 1. Check LocalStorage (Prioritized)
        if (localStorage.getItem('GEMINI_API_KEY')) {
            setAiStatus(true);
            return;
        }

        // 2. Check Environment Variable
        if (process.env.API_KEY && process.env.API_KEY.length > 0) {
            setAiStatus(true);
            return;
        }

        // 3. Check AI Studio (IDX Environment)
        if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            setAiStatus(hasKey);
        } else {
            setAiStatus(false);
        }
    };

    const handleSaveApiKey = () => {
        if (!customApiKey.trim()) return;
        localStorage.setItem('GEMINI_API_KEY', customApiKey);
        showNotification('Đã lưu API Key cá nhân', 'success');
        checkAiKeyStatus();
    };

    const handleRemoveApiKey = () => {
        localStorage.removeItem('GEMINI_API_KEY');
        setCustomApiKey('');
        showNotification('Đã xóa API Key cá nhân', 'info');
        checkAiKeyStatus();
    };

    const handleTestAiConnection = async () => {
        setIsTestingKey(true);
        try {
            // Retrieve key manually to test exactly what will be used
            const key = localStorage.getItem('GEMINI_API_KEY') || process.env.API_KEY;
            
            // If checking window.aistudio, we can't test easily without their SDK call, skipping specific test for that case if no key found
            if (!key && !(window as any).aistudio) throw new Error('Chưa tìm thấy API Key');

            const ai = new GoogleGenAI({ apiKey: key || '' }); // If empty, SDK might throw or window.aistudio might handle injection if configured
            
            // Simple ping model
            await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: "Test connection",
            });
            showNotification('Kết nối Gemini AI thành công!', 'success');
        } catch (e: any) {
            showNotification(`Kết nối thất bại: ${e.message}`, 'error');
        } finally {
            setIsTestingKey(false);
        }
    };

    const handleConfigureAiKey = async () => {
        if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
            try {
                await (window as any).aistudio.openSelectKey();
                await checkAiKeyStatus();
                showNotification('Đã cập nhật API Key thành công', 'success');
            } catch (e) {
                showNotification('Không thể cập nhật API Key', 'error');
            }
        } else {
            // Focus on manual input if environment variable isn't set
            document.getElementById('api-key-input')?.focus();
        }
    };

    const handleSave = async () => {
        await setSettings(localSettings);
        setIsDirty(false);
        showNotification('Đã lưu cài đặt thành công', 'success');
    };

    const handleDiscard = () => {
        setLocalSettings(settings);
        setIsDirty(false);
        showNotification('Đã hủy thay đổi', 'info');
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 1024) {
                showNotification('Kích thước ảnh quá lớn (Max 1MB)', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setLocalSettings(prev => ({
                    ...prev,
                    general: { ...prev.general, logo: reader.result as string }
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleExport = async () => {
        try {
            await exportBackup();
            showNotification('Đã xuất file backup thành công', 'success');
        } catch (error) {
            showNotification('Xuất backup thất bại', 'error');
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const analysis = await parseBackupFile(file);
            setBackupAnalysis({
                summary: analysis.summary,
                warnings: analysis.warnings,
                correctedData: analysis.correctedData
            });
            setIsRestoreConfirmOpen(true);
        } catch (error: any) {
            showNotification(error.message || 'File không hợp lệ', 'error');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRestore = async (mode: 'replace' | 'merge') => {
        if (!backupAnalysis) return;
        setIsRestoring(true);
        try {
            await restoreBackup(backupAnalysis.correctedData, mode);
            showNotification('Khôi phục dữ liệu thành công! Đang tải lại...', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            showNotification('Khôi phục thất bại. Dữ liệu có thể bị lỗi.', 'error');
            setIsRestoring(false);
        }
    };

    const handleRunCheck = async () => {
        setIsChecking(true);
        try {
            const issues = await reconcileData();
            setHealthIssues(issues);
            if (issues.length === 0) {
                showNotification('Hệ thống khỏe mạnh!', 'success');
            } else {
                showNotification(`Phát hiện ${issues.length} vấn đề`, 'warning');
            }
        } catch (e) {
            showNotification('Lỗi khi kiểm tra dữ liệu', 'error');
        } finally {
            setIsChecking(false);
        }
    };

    const handleCopyReport = () => {
        if (!healthIssues) return;
        const text = healthIssues.map(i => `[${i.severity}] [${i.type}] ${i.entityName || i.entityId}: ${i.message}`).join('\n');
        navigator.clipboard.writeText(text);
        showNotification('Đã sao chép báo cáo', 'success');
    };

    const handleDensityChange = async (density: 'comfortable' | 'compact') => {
        const newSettings = { ...localSettings, appearance: { ...localSettings.appearance, density } };
        setLocalSettings(newSettings);
        document.documentElement.setAttribute('data-density', density);
    };

    const handleTemplateSave = (newConfig: DocTypeConfig) => {
        setLocalSettings(prev => ({
            ...prev,
            documents: {
                ...prev.documents,
                [activeDocType]: newConfig
            }
        }));
        setIsTemplateEditorOpen(false);
    };

    const allTabs = [
        { id: 'general', label: 'Thông tin chung', icon: 'storefront', tags: 'tên, logo, sđt, địa chỉ, email' },
        { id: 'appearance', label: 'Giao diện', icon: 'palette', tags: 'sáng, tối, dark mode, compact, mật độ' },
        { id: 'finance', label: 'Tài chính', icon: 'account_balance', tags: 'vat, thuế, tiền tệ, hóa đơn' },
        { id: 'documents', label: 'Mẫu in ấn', icon: 'print', tags: 'in, phiếu, mẫu, template' },
        { id: 'system', label: 'Hệ thống', icon: 'settings_suggest', tags: 'backup, sao lưu, ai, gemini, demo' },
        { id: 'health', label: 'Sức khỏe', icon: 'monitor_heart', tags: 'kiểm tra, lỗi, data' },
    ];

    const filteredTabs = useMemo(() => {
        if (!searchTerm) return allTabs;
        const lower = searchTerm.toLowerCase();
        return allTabs.filter(t => 
            t.label.toLowerCase().includes(lower) || 
            t.tags.includes(lower)
        );
    }, [searchTerm]);

    return (
        <PageShell>
            <PageHeader 
                title="Cài Đặt" 
                subtitle="Quản lý cấu hình hệ thống."
            />

            <div className="flex flex-col md:flex-row h-full overflow-hidden relative">
                {/* Navigation Sidebar */}
                <div className="w-full md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-shrink-0 md:h-full overflow-y-auto custom-scrollbar flex flex-col">
                    {/* Improvement 1: Search Settings */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[18px]">search</span>
                            <input 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/50"
                                placeholder="Tìm cài đặt..."
                            />
                        </div>
                    </div>

                    <div className="p-4 space-y-1 flex-1">
                        {filteredTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold text-left ${
                                    activeTab === tab.id 
                                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <span className={`material-symbols-outlined text-[20px] ${activeTab === tab.id ? 'filled-icon' : ''}`}>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    
                    <div className="p-4 mt-auto border-t border-slate-100 dark:border-slate-800">
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl flex items-center gap-3">
                            <div className="size-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-xs shadow-md">
                                {currentUser.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
                                <p className="text-[10px] text-slate-500">ID: {currentUser.id}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-[#f8fafc] dark:bg-[#0b1121] relative">
                    <div className="max-w-3xl mx-auto space-y-8 animate-[fadeIn_0.3s_ease-out] pb-24">
                        
                        {/* --- GENERAL TAB --- */}
                        {activeTab === 'general' && (
                            <>
                                <SettingSection title="Hồ sơ doanh nghiệp" description="Thông tin này sẽ hiển thị trên các chứng từ.">
                                    <div className="flex flex-col md:flex-row gap-6">
                                        {/* Logo Uploader */}
                                        <div className="shrink-0 flex flex-col items-center">
                                            <div 
                                                className="size-32 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden relative group cursor-pointer hover:border-blue-500 transition-colors"
                                                onClick={() => document.getElementById('logo-upload')?.click()}
                                            >
                                                {localSettings.general.logo ? (
                                                    <img src={localSettings.general.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                                                ) : (
                                                    <div className="text-center p-2">
                                                        <span className="material-symbols-outlined text-slate-400 text-3xl">add_photo_alternate</span>
                                                        <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Upload Logo</p>
                                                    </div>
                                                )}
                                                
                                                {/* Hover Overlay */}
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="material-symbols-outlined text-white">edit</span>
                                                </div>
                                            </div>
                                            <input type="file" id="logo-upload" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                            {localSettings.general.logo && (
                                                <button 
                                                    onClick={() => setLocalSettings(p => ({...p, general: {...p.general, logo: ''}}))}
                                                    className="mt-2 text-xs text-red-500 hover:underline font-bold"
                                                >
                                                    Xóa logo
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField label="Tên cửa hàng / Công ty" className="md:col-span-2">
                                                <FormInput value={localSettings.general.name} onChange={e => setLocalSettings({...localSettings, general: {...localSettings.general, name: e.target.value}})} className="font-bold" />
                                            </FormField>
                                            <FormField label="Số điện thoại">
                                                <FormInput value={localSettings.general.phone} onChange={e => setLocalSettings({...localSettings, general: {...localSettings.general, phone: e.target.value}})} />
                                            </FormField>
                                            <FormField label="Email">
                                                <FormInput value={localSettings.general.email} onChange={e => setLocalSettings({...localSettings, general: {...localSettings.general, email: e.target.value}})} />
                                            </FormField>
                                            <FormField label="Địa chỉ" className="md:col-span-2">
                                                <FormInput value={localSettings.general.address} onChange={e => setLocalSettings({...localSettings, general: {...localSettings.general, address: e.target.value}})} />
                                            </FormField>
                                        </div>
                                    </div>
                                </SettingSection>

                                <SettingSection title="Thông tin pháp lý" description="Sử dụng cho hóa đơn GTGT.">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField label="Mã số thuế">
                                            <FormInput value={localSettings.general.taxId} onChange={e => setLocalSettings({...localSettings, general: {...localSettings.general, taxId: e.target.value}})} className="font-mono" />
                                        </FormField>
                                        <FormField label="Website">
                                            <FormInput value={localSettings.general.website} onChange={e => setLocalSettings({...localSettings, general: {...localSettings.general, website: e.target.value}})} />
                                        </FormField>
                                    </div>
                                </SettingSection>
                            </>
                        )}

                        {/* --- APPEARANCE TAB --- */}
                        {activeTab === 'appearance' && (
                            <SettingSection title="Giao diện & Hiển thị">
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <SelectionCard 
                                            title="Giao diện Sáng" 
                                            description="Trực quan, độ tương phản cao." 
                                            icon="light_mode" 
                                            selected={localSettings.appearance.theme === 'light'} 
                                            onClick={() => {
                                                if(localSettings.appearance.theme !== 'light') toggleTheme();
                                            }}
                                            color="blue"
                                        />
                                        <SelectionCard 
                                            title="Giao diện Tối" 
                                            description="Dễ chịu cho mắt khi làm đêm." 
                                            icon="dark_mode" 
                                            selected={localSettings.appearance.theme === 'dark'} 
                                            onClick={() => {
                                                if(localSettings.appearance.theme !== 'dark') toggleTheme();
                                            }}
                                            color="blue"
                                        />
                                    </div>

                                    <div className="h-px bg-slate-100 dark:bg-slate-700"></div>

                                    <div>
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 block">Mật độ hiển thị</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectionCard 
                                                title="Thoải mái" 
                                                description="Khoảng cách rộng, dễ nhìn." 
                                                icon="table_rows" 
                                                selected={localSettings.appearance.density === 'comfortable'} 
                                                onClick={() => handleDensityChange('comfortable')}
                                            />
                                            <SelectionCard 
                                                title="Nhỏ gọn" 
                                                description="Hiển thị nhiều dữ liệu hơn." 
                                                icon="view_list" 
                                                selected={localSettings.appearance.density === 'compact'} 
                                                onClick={() => handleDensityChange('compact')}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </SettingSection>
                        )}

                        {/* --- FINANCE TAB --- */}
                        {activeTab === 'finance' && (
                            <SettingSection title="Cấu hình Tài chính">
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField label="Đơn vị tiền tệ">
                                            <FormSelect 
                                                value={localSettings.finance.currency} 
                                                onChange={e => setLocalSettings({...localSettings, finance: {...localSettings.finance, currency: e.target.value}})}
                                            >
                                                <option value="VND">VND (₫)</option>
                                                <option value="USD">USD ($)</option>
                                            </FormSelect>
                                        </FormField>
                                        <FormField label="Thuế GTGT mặc định">
                                            <div className="relative">
                                                <FormInput 
                                                    type="number" 
                                                    value={localSettings.finance.vat} 
                                                    onChange={e => setLocalSettings({...localSettings, finance: {...localSettings.finance, vat: Number(e.target.value)}})} 
                                                    className="pr-8 font-bold"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                            </div>
                                        </FormField>
                                    </div>
                                    
                                    <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <ToggleSwitch 
                                            label="Tự động in hóa đơn" 
                                            description="Mở hộp thoại in ngay khi hoàn tất đơn hàng bán lẻ."
                                            checked={localSettings.finance.printInvoice}
                                            onChange={val => setLocalSettings({...localSettings, finance: {...localSettings.finance, printInvoice: val}})}
                                        />
                                    </div>
                                </div>
                            </SettingSection>
                        )}

                        {/* --- DOCUMENTS TAB --- */}
                        {activeTab === 'documents' && (
                            <SettingSection title="Mẫu in ấn" description="Tùy chỉnh nội dung hiển thị trên các phiếu in.">
                                <div className="flex flex-col gap-6">
                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                        {(['order', 'quote', 'import', 'delivery'] as const).map(type => (
                                            <button 
                                                key={type}
                                                onClick={() => setActiveDocType(type)}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeDocType === type ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                            >
                                                {type === 'order' ? 'Hóa đơn' : type === 'quote' ? 'Báo giá' : type === 'import' ? 'Phiếu nhập' : 'Phiếu giao'}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Preview Banner & Edit Button */}
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white">Cấu hình mẫu {activeDocType === 'order' ? 'Hóa đơn' : activeDocType === 'quote' ? 'Báo giá' : activeDocType === 'import' ? 'Phiếu nhập' : 'Phiếu giao hàng'}</h4>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Tùy chỉnh tiêu đề, cột hiển thị, logo và màu sắc.
                                            </p>
                                        </div>
                                        <Button 
                                            variant="secondary" 
                                            icon="edit" 
                                            onClick={() => setIsTemplateEditorOpen(true)}
                                        >
                                            Chỉnh sửa mẫu
                                        </Button>
                                    </div>

                                    {/* Legacy Fields (Fallback) */}
                                    <div className="opacity-70 pointer-events-none grayscale">
                                        <FormField label="Tiêu đề phiếu (Header)">
                                            <FormInput 
                                                value={localSettings.documents[activeDocType].title} 
                                                onChange={() => {}} 
                                                className="font-bold"
                                            />
                                        </FormField>
                                    </div>
                                </div>
                            </SettingSection>
                        )}

                        {/* --- SYSTEM TAB --- */}
                        {activeTab === 'system' && (
                            <div className="space-y-6">
                                {/* Gemini API Configuration */}
                                <SettingSection title="Cấu hình Google Gemini" description="Quản lý kết nối API cho các tính năng AI.">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center gap-4">
                                                <div className={`size-10 rounded-lg flex items-center justify-center ${aiStatus ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    <span className="material-symbols-outlined">smart_toy</span>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">Trạng thái kết nối</h4>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {aiStatus 
                                                            ? (localStorage.getItem('GEMINI_API_KEY') ? 'Đã kích hoạt bằng Key cá nhân' : 'Đã kết nối với Google AI Studio / Env')
                                                            : 'Chưa có API Key. Vui lòng nhập Key hoặc cấu hình biến môi trường.'}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-2">
                                                {/* AI Connection Test */}
                                                <Button 
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={handleTestAiConnection}
                                                    loading={isTestingKey}
                                                    className="border-slate-200"
                                                >
                                                    Kiểm tra
                                                </Button>

                                                {(window as any).aistudio && (
                                                    <Button 
                                                        variant={aiStatus ? 'secondary' : 'primary'} 
                                                        onClick={handleConfigureAiKey}
                                                        icon="key"
                                                        size="sm"
                                                    >
                                                        {aiStatus ? 'Đổi API Key' : 'Kết nối ngay'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* API Key Input Field */}
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <FormField label="API Key Cá Nhân (Tùy chọn)">
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <FormInput 
                                                            id="api-key-input"
                                                            type={showApiKey ? "text" : "password"} 
                                                            value={customApiKey} 
                                                            onChange={e => setCustomApiKey(e.target.value)} 
                                                            placeholder="Dán mã API Key của bạn vào đây..."
                                                            className="pr-10"
                                                        />
                                                        <button 
                                                            onClick={() => setShowApiKey(!showApiKey)}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">{showApiKey ? 'visibility' : 'visibility_off'}</span>
                                                        </button>
                                                    </div>
                                                    {localStorage.getItem('GEMINI_API_KEY') ? (
                                                        <Button variant="danger" size="md" onClick={handleRemoveApiKey} icon="delete">Xóa Key</Button>
                                                    ) : (
                                                        <Button variant="primary" size="md" onClick={handleSaveApiKey} disabled={!customApiKey} icon="save">Lưu Key</Button>
                                                    )}
                                                </div>
                                            </FormField>
                                            <p className="text-[10px] text-slate-500 mt-2">
                                                Lưu ý: API Key sẽ được lưu trữ cục bộ trên trình duyệt của bạn (Local Storage). Hãy bảo mật thiết bị của bạn.
                                                <br/>
                                                Key cá nhân sẽ được ưu tiên sử dụng trước cấu hình mặc định.
                                            </p>
                                        </div>
                                    </div>
                                </SettingSection>

                                <SettingSection title="Thông tin người dùng" description="Thiết lập phiên làm việc hiện tại (Demo context).">
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField label="Tên hiển thị">
                                            <FormInput 
                                                value={currentUser.name} 
                                                onChange={e => setCurrentUser({ ...currentUser, name: e.target.value })} 
                                            />
                                        </FormField>
                                        <FormField label="ID Hệ thống">
                                            <FormInput 
                                                value={currentUser.id} 
                                                disabled
                                                className="bg-slate-100 dark:bg-slate-800 text-slate-500"
                                            />
                                        </FormField>
                                    </div>
                                </SettingSection>

                                {/* Improvement 3: Visual Backup Cards */}
                                <SettingSection title="Sao lưu & Khôi phục">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div 
                                            onClick={handleExport}
                                            className="group cursor-pointer p-6 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden transition-transform hover:scale-[1.02]"
                                        >
                                            <div className="relative z-10">
                                                <div className="size-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                                                    <span className="material-symbols-outlined text-[28px]">cloud_download</span>
                                                </div>
                                                <h3 className="text-lg font-black">Xuất Dữ Liệu (Backup)</h3>
                                                <p className="text-blue-100 text-sm mt-1 opacity-90">Tải xuống file JSON an toàn.</p>
                                            </div>
                                            <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-[120px] opacity-10">download</span>
                                        </div>

                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="group cursor-pointer p-6 rounded-2xl bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors relative overflow-hidden"
                                        >
                                            <div className="relative z-10">
                                                <div className="size-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mb-4 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                                                    <span className="material-symbols-outlined text-[28px]">cloud_upload</span>
                                                </div>
                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Khôi Phục (Restore)</h3>
                                                <p className="text-slate-500 text-sm mt-1">Nhấp để chọn file backup.</p>
                                            </div>
                                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".json" className="hidden" />
                                        </div>
                                    </div>
                                </SettingSection>
                            </div>
                        )}

                        {/* --- HEALTH TAB --- */}
                        {activeTab === 'health' && (
                            <div className="space-y-6">
                                <div className={`rounded-2xl p-8 text-white shadow-lg relative overflow-hidden transition-colors duration-500 ${
                                    healthIssues === null ? 'bg-gradient-to-br from-indigo-600 to-purple-600' :
                                    healthIssues.length === 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' :
                                    'bg-gradient-to-br from-red-500 to-orange-600'
                                }`}>
                                    <div className="relative z-10 text-center">
                                        <div className="size-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-white/30 shadow-inner">
                                            <span className="material-symbols-outlined text-[48px] text-white">
                                                {healthIssues === null ? 'monitor_heart' : healthIssues.length === 0 ? 'check_circle' : 'warning'}
                                            </span>
                                        </div>
                                        <h2 className="text-3xl font-black mb-2">
                                            {healthIssues === null ? 'Kiểm Tra Sức Khỏe' : healthIssues.length === 0 ? 'Hệ Thống Ổn Định' : 'Cần Chú Ý!'}
                                        </h2>
                                        <p className="text-white/80 max-w-md mx-auto mb-8 text-sm font-medium">
                                            {healthIssues === null 
                                                ? 'Quét toàn bộ hệ thống để tìm các lỗi không đồng nhất, sai lệch tồn kho hoặc công nợ.'
                                                : healthIssues.length === 0 
                                                    ? 'Tuyệt vời! Không tìm thấy lỗi dữ liệu nào trong hệ thống.'
                                                    : `Phát hiện ${healthIssues.length} vấn đề cần được xử lý ngay lập tức.`
                                            }
                                        </p>
                                        
                                        {!healthIssues ? (
                                            <Button 
                                                variant="secondary" 
                                                size="lg" 
                                                onClick={handleRunCheck} 
                                                loading={isChecking} 
                                                icon="play_arrow"
                                                className="bg-white text-indigo-600 hover:bg-indigo-50 border-none shadow-xl font-black px-8"
                                            >
                                                Chạy chẩn đoán
                                            </Button>
                                        ) : (
                                            <Button 
                                                variant="secondary" 
                                                onClick={() => setHealthIssues(null)}
                                                icon="refresh"
                                                className="bg-white/20 text-white hover:bg-white/30 border-white/40"
                                            >
                                                Quét lại
                                            </Button>
                                        )}
                                    </div>
                                    <span className="material-symbols-outlined absolute -bottom-10 -right-10 text-[250px] opacity-10 rotate-12">medical_services</span>
                                </div>

                                {healthIssues && healthIssues.length > 0 && (
                                    <div className="animate-[fadeIn_0.3s_ease-out] space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                                <span className="size-2 bg-red-500 rounded-full animate-pulse"></span>
                                                Chi tiết vấn đề
                                            </h4>
                                            <Button variant="ghost" size="sm" onClick={handleCopyReport} icon="content_copy">Copy báo cáo</Button>
                                        </div>
                                        
                                        {healthIssues.map((issue, idx) => (
                                            <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex gap-4 hover:shadow-md transition-shadow">
                                                <div className={`shrink-0 size-10 rounded-lg flex items-center justify-center ${issue.severity === 'High' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                                    <span className="material-symbols-outlined text-[20px]">{issue.severity === 'High' ? 'error' : 'warning'}</span>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <h5 className="font-bold text-slate-900 dark:text-white text-sm">{issue.type}</h5>
                                                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 rounded">{issue.entityId}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{issue.message}</p>
                                                    {issue.suggestedFix && (
                                                        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                                                            <span className="material-symbols-outlined text-[14px] mt-0.5">lightbulb</span>
                                                            <span><span className="font-bold">Gợi ý:</span> {issue.suggestedFix}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Improvement 2: Floating Save Bar */}
                    {isDirty && (
                        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 dark:bg-white/90 backdrop-blur-md text-white dark:text-slate-900 px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 z-50 animate-[slideInUp_0.3s_ease-out]">
                            <span className="text-sm font-bold">Bạn có thay đổi chưa lưu</span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleDiscard}
                                    className="px-4 py-1.5 rounded-full text-xs font-bold bg-white/10 dark:bg-black/10 hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                                >
                                    Hủy bỏ
                                </button>
                                <button 
                                    onClick={handleSave}
                                    className="px-4 py-1.5 rounded-full text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-lg transition-colors"
                                >
                                    Lưu thay đổi
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Template Editor Modal */}
            {isTemplateEditorOpen && (
                <TemplateEditor 
                    isOpen={isTemplateEditorOpen} 
                    onClose={() => setIsTemplateEditorOpen(false)}
                    initialConfig={localSettings.documents[activeDocType]}
                    onSave={handleTemplateSave}
                    settings={localSettings}
                    type={activeDocType}
                />
            )}

            {/* Restore Confirmation Modal */}
            <ConfirmModal 
                isOpen={isRestoreConfirmOpen}
                title="Khôi phục dữ liệu?"
                message={`File backup chứa ${Object.values(backupAnalysis?.summary || {}).reduce((a: number, b: number) => a + b, 0)} bản ghi. Hành động này sẽ thay thế dữ liệu hiện tại.`}
                confirmLabel="Khôi phục (Ghi đè)"
                cancelLabel="Hủy"
                onConfirm={() => { setIsRestoreConfirmOpen(false); handleRestore('replace'); }}
                onCancel={() => setIsRestoreConfirmOpen(false)}
                type="warning"
            />
        </PageShell>
    );
};

export default Settings;
