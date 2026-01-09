
import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Partner, PartnerType } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { Button } from './ui/Primitives';
import { Modal } from './ui/Modal';
import { FormField, FormInput, FormSelect } from './ui/Form';
import { formatCurrency } from '../utils/helpers';
import { useFormValidation } from '../hooks/useFormValidation';

interface CreatePartnerModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Partner;
    mode: 'create' | 'edit';
}

const DEFAULT_PARTNER: Partial<Partner> = {
    name: '', phone: '', address: '', type: PartnerType.Customer, taxId: '', email: '', debtLimit: 0, code: ''
};

export const CreatePartnerModal: React.FC<CreatePartnerModalProps> = ({ isOpen, onClose, initialData, mode }) => {
    const { addPartner, updatePartner, showNotification } = useAppContext();
    const [formData, setFormData] = useState<Partial<Partner>>(DEFAULT_PARTNER);
    const { errors, setErrors, register, focusFirstError, clearErrors } = useFormValidation<Partner>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(initialData ? { ...initialData } : { ...DEFAULT_PARTNER });
            clearErrors();
        }
    }, [isOpen, initialData]);

    // Fetch related debts only if editing
    const relatedDebts = useLiveQuery(async () => {
        if (mode !== 'edit' || !initialData) return [];
        return db.debtRecords.where('partnerId').equals(initialData.id).toArray();
    }, [mode, initialData]);

    const financialStats = useMemo(() => {
        if (!relatedDebts) return null;
        
        let receivable = 0;
        let payable = 0;

        relatedDebts.forEach(d => {
            if (d.status !== 'Void') {
                if (d.type === 'Receivable') receivable += d.remainingAmount;
                else if (d.type === 'Payable') payable += d.remainingAmount;
            }
        });

        return { receivable, payable };
    }, [relatedDebts]);

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.name?.trim()) newErrors.name = 'Vui lòng nhập tên đối tác';
        if (!formData.phone?.trim()) newErrors.phone = 'Vui lòng nhập số điện thoại';
        // Basic phone format check
        if (formData.phone && !/^[0-9\s+.-]+$/.test(formData.phone)) {
            newErrors.phone = 'Số điện thoại không hợp lệ';
        }
        
        setErrors(newErrors);
        
        if (Object.keys(newErrors).length > 0) {
            focusFirstError(newErrors);
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validate() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            if (mode === 'create') {
                const codePrefix = formData.type === PartnerType.Customer ? 'KH' : 'NCC';
                const code = formData.code || `${codePrefix}-${Date.now().toString().slice(-6)}`;
                await addPartner({ ...formData, code } as any);
            } else {
                await updatePartner(formData as Partner);
                showNotification('Cập nhật thành công', 'success');
            }
            onClose();
        } catch (error) {
            showNotification('Có lỗi xảy ra', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'create' ? 'Thêm đối tác mới' : 'Cập nhật thông tin'}
            subtitle="Quản lý hồ sơ khách hàng & nhà cung cấp."
            size="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Hủy bỏ</Button>
                    <Button variant="primary" onClick={handleSubmit} icon="save" loading={isSubmitting}>Lưu đối tác</Button>
                </>
            }
        >
            <div className="space-y-6">
                {mode === 'edit' && financialStats && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-blue-600 text-[18px]">arrow_downward</span>
                                <p className="text-[10px] font-bold text-blue-600 uppercase">Phải thu (KH)</p>
                            </div>
                            <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{formatCurrency(financialStats.receivable)}</p>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-orange-600 text-[18px]">arrow_upward</span>
                                <p className="text-[10px] font-bold text-orange-600 uppercase">Phải trả (NCC)</p>
                            </div>
                            <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{formatCurrency(financialStats.payable)}</p>
                        </div>
                    </div>
                )}

                {/* Type Selector */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    {[PartnerType.Customer, PartnerType.Supplier].map(type => (
                        <button 
                            key={type}
                            onClick={() => setFormData({...formData, type})} 
                            className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                formData.type === type 
                                ? 'bg-white text-blue-600 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {type === PartnerType.Customer ? 'Khách hàng' : 'Nhà cung cấp'}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormField label="Tên đối tác" required error={errors.name} className="md:col-span-1">
                        <FormInput 
                            ref={register('name')}
                            value={formData.name || ''} 
                            onChange={e => setFormData({...formData, name: e.target.value})} 
                            placeholder="Nhập tên..." 
                            autoFocus
                            error={!!errors.name}
                        />
                    </FormField>
                    <FormField label="Số điện thoại" required error={errors.phone} className="md:col-span-1">
                        <FormInput 
                            ref={register('phone')}
                            value={formData.phone || ''} 
                            onChange={e => setFormData({...formData, phone: e.target.value})} 
                            placeholder="VD: 090..." 
                            error={!!errors.phone}
                        />
                    </FormField>
                    
                    <FormField label="Địa chỉ" className="md:col-span-2">
                        <FormInput 
                            value={formData.address || ''} 
                            onChange={e => setFormData({...formData, address: e.target.value})} 
                            placeholder="Số nhà, đường, quận/huyện..." 
                        />
                    </FormField>

                    <FormField label="Mã số thuế" className="md:col-span-1">
                        <FormInput 
                            value={formData.taxId || ''} 
                            onChange={e => setFormData({...formData, taxId: e.target.value})} 
                            className="font-mono"
                        />
                    </FormField>
                    <FormField label="Mã quản lý" className="md:col-span-1">
                        <FormInput 
                            value={formData.code || ''} 
                            onChange={e => setFormData({...formData, code: e.target.value})} 
                            placeholder="Tự động nếu trống" 
                            className="font-mono"
                            disabled={mode === 'edit'}
                        />
                    </FormField>

                    <div className="col-span-2 border-t border-dashed border-slate-200 dark:border-slate-700 pt-4 mt-2">
                        <div className="grid grid-cols-2 gap-5">
                            <FormField label="Email">
                                <FormInput 
                                    type="email"
                                    value={formData.email || ''} 
                                    onChange={e => setFormData({...formData, email: e.target.value})} 
                                    placeholder="email@example.com" 
                                />
                            </FormField>
                            <FormField label="Hạn mức nợ">
                                <FormInput 
                                    type="number"
                                    value={formData.debtLimit || ''} 
                                    onChange={e => setFormData({...formData, debtLimit: Number(e.target.value)})} 
                                    placeholder="0" 
                                />
                            </FormField>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
