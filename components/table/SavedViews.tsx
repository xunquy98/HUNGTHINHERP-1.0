
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { copyToClipboard } from '../../utils/helpers';
import { Button } from '../ui/Primitives';
import { Modal } from '../ui/Modal';
import { FormField, FormTextarea } from '../ui/Form';

interface SavedView<T> {
    id: string;
    name: string;
    state: T;
}

interface SavedViewsProps<T> {
    pageKey: string;
    currentState: T;
    onApply: (state: T) => void;
    onClear: () => void;
}

export function SavedViews<T>({ pageKey, currentState, onApply, onClear }: SavedViewsProps<T>) {
    const { currentUser, showNotification, confirm } = useAppContext();
    const [views, setViews] = useState<SavedView<T>[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    
    // Modals
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [viewName, setViewName] = useState('');
    const [importJson, setImportJson] = useState('');

    const storageKey = `erp_views_${pageKey}_${currentUser.id}`;

    // Load views on mount or user change
    useEffect(() => {
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                setViews(JSON.parse(stored));
            } else {
                setViews([]);
            }
        } catch (e) {
            console.error("Failed to load views", e);
            setViews([]);
        }
    }, [storageKey]);

    const saveViewsToStorage = (newViews: SavedView<T>[]) => {
        localStorage.setItem(storageKey, JSON.stringify(newViews));
        setViews(newViews);
    };

    const handleSave = () => {
        if (!viewName.trim()) return;
        const newView: SavedView<T> = {
            id: Date.now().toString(),
            name: viewName,
            state: currentState
        };
        const updated = [...views, newView];
        saveViewsToStorage(updated);
        setIsSaveModalOpen(false);
        setViewName('');
        showNotification('Đã lưu bộ lọc mới', 'success');
    };

    const handleDelete = async (id: string) => {
        const ok = await confirm({ title: 'Xóa bộ lọc?', message: 'Bạn có chắc muốn xóa bộ lọc này không?', type: 'danger' });
        if (ok) {
            const updated = views.filter(v => v.id !== id);
            saveViewsToStorage(updated);
        }
    };

    const handleExport = async (view: SavedView<T>) => {
        const json = JSON.stringify(view, null, 2);
        const success = await copyToClipboard(json);
        if (success) showNotification('Đã copy cấu hình bộ lọc vào clipboard', 'success');
        else showNotification('Không thể copy', 'error');
    };

    const handleImport = () => {
        try {
            const parsed = JSON.parse(importJson);
            if (!parsed.name || !parsed.state) throw new Error('Cấu trúc không hợp lệ');
            
            const newView: SavedView<T> = {
                ...parsed,
                id: Date.now().toString(), // Force new ID
                name: `${parsed.name} (Imported)`
            };
            
            const updated = [...views, newView];
            saveViewsToStorage(updated);
            setImportJson('');
            showNotification('Đã nhập bộ lọc thành công', 'success');
        } catch (e) {
            showNotification('JSON không hợp lệ', 'error');
        }
    };

    return (
        <div className="relative">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isOpen ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'}`}
            >
                <span className="material-symbols-outlined text-[16px]">filter_list</span>
                Bộ lọc
                <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-topbar" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-dropdown overflow-hidden animate-[fadeIn_0.1s_ease-out]">
                        <div className="p-1">
                            <button onClick={() => { onClear(); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                                Mặc định (Reset)
                            </button>
                            {views.map(view => (
                                <button 
                                    key={view.id} 
                                    onClick={() => { onApply(view.state); setIsOpen(false); }}
                                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 rounded-lg truncate"
                                >
                                    {view.name}
                                </button>
                            ))}
                        </div>
                        <div className="border-t border-slate-100 dark:border-slate-800 p-1">
                            <button onClick={() => { setIsSaveModalOpen(true); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg flex items-center gap-2">
                                <span className="material-symbols-outlined text-[14px]">save</span> Lưu bộ lọc hiện tại
                            </button>
                            <button onClick={() => { setIsManageModalOpen(true); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2">
                                <span className="material-symbols-outlined text-[14px]">settings</span> Quản lý & Chia sẻ
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Save Modal */}
            <Modal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} title="Lưu bộ lọc" size="sm">
                <div className="space-y-4 pt-2">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Tên bộ lọc</label>
                        <input 
                            value={viewName} 
                            onChange={e => setViewName(e.target.value)} 
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                            placeholder="VD: Đơn chưa thanh toán..."
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="secondary" size="sm" onClick={() => setIsSaveModalOpen(false)}>Hủy</Button>
                        <Button variant="primary" size="sm" onClick={handleSave}>Lưu</Button>
                    </div>
                </div>
            </Modal>

            {/* Manage Modal */}
            <Modal isOpen={isManageModalOpen} onClose={() => setIsManageModalOpen(false)} title="Quản lý Bộ lọc" size="lg">
                <div className="space-y-6">
                    {/* List */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Danh sách đã lưu</h4>
                        {views.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">Chưa có bộ lọc nào được lưu.</p>
                        ) : (
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                {views.map((view, idx) => (
                                    <div key={view.id} className={`flex items-center justify-between p-3 ${idx !== views.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}>
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{view.name}</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleExport(view)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Copy JSON để chia sẻ">
                                                <span className="material-symbols-outlined text-[18px]">content_copy</span>
                                            </button>
                                            <button onClick={() => handleDelete(view.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa">
                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Import */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Nhập bộ lọc (Import)</h4>
                        <FormField>
                            <FormTextarea 
                                value={importJson} 
                                onChange={e => setImportJson(e.target.value)} 
                                placeholder="Dán mã JSON cấu hình vào đây..." 
                                className="font-mono text-xs h-24"
                            />
                        </FormField>
                        <div className="mt-3 flex justify-end">
                            <Button variant="secondary" onClick={handleImport} disabled={!importJson.trim()} icon="download">Nhập ngay</Button>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
