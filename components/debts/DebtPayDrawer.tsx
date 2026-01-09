
import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { useAppContext } from '../../contexts/AppContext';
import { Drawer, DrawerSection } from '../ui/Drawer';
import { Button } from '../ui/Primitives';
import { FormField, FormInput, FormSelect, FormTextarea } from '../ui/Form';
import { formatCurrency } from '../../utils/helpers';

interface DebtPayDrawerProps {
    debtId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

export const DebtPayDrawer: React.FC<DebtPayDrawerProps> = ({ debtId, isOpen, onClose }) => {
    const { addPaymentToDebt, showNotification } = useAppContext();
    
    // Use useLiveQuery to get the specific debt record directly from Dexie
    const debt = useLiveQuery(() => debtId ? db.debtRecords.get(debtId) : undefined, [debtId]);

    const [amount, setAmount] = useState<number>(0);
    const [method, setMethod] = useState('transfer');
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && debt) {
            setAmount(debt.remainingAmount);
            setMethod('transfer');
            setNotes(`Thanh toán ${debt.orderCode}`);
            setDate(new Date().toISOString().slice(0, 10));
        }
    }, [isOpen, debt]);

    const handleSubmit = async () => {
        if (!debt) return;
        if (amount <= 0) {
            showNotification('Số tiền phải lớn hơn 0', 'error');
            return;
        }
        if (amount > debt.remainingAmount) {
            showNotification('Số tiền vượt quá dư nợ còn lại', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            await addPaymentToDebt(debt.id, {
                amount,
                method,
                notes,
                date: new Date(date).toLocaleDateString('en-GB') // Format DD/MM/YYYY for consistency
            });
            onClose();
        } catch (error) {
            showNotification('Có lỗi xảy ra', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!debt) return null;

    const payments = debt.payments || [];

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={debt.type === 'Receivable' ? 'Thu Nợ Khách Hàng' : 'Thanh Toán Nhà Cung Cấp'}
            subtitle={debt.partnerName}
            footer={
                <Button 
                    variant="primary" 
                    className="w-full justify-center" 
                    onClick={handleSubmit} 
                    loading={isSubmitting}
                    disabled={debt.remainingAmount <= 0}
                    icon="check_circle"
                >
                    Xác nhận thanh toán
                </Button>
            }
        >
            {/* Summary Card */}
            <div className={`p-5 rounded-2xl border mb-6 ${debt.type === 'Receivable' ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30' : 'bg-orange-50 border-orange-100 dark:bg-orange-900/10 dark:border-orange-900/30'}`}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider opacity-60">Mã chứng từ</p>
                        <p className="font-mono font-bold text-sm">{debt.orderCode}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold uppercase tracking-wider opacity-60">Hạn thanh toán</p>
                        <p className="font-bold text-sm">{debt.dueDate}</p>
                    </div>
                </div>
                
                <div className="flex justify-between items-end pt-4 border-t border-dashed border-slate-300/50">
                    <div>
                        <p className="text-xs text-slate-500 mb-1">Tổng giá trị</p>
                        <p className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(debt.totalAmount)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-500 mb-1">Còn lại phải {debt.type === 'Receivable' ? 'thu' : 'trả'}</p>
                        <p className={`text-2xl font-black ${debt.type === 'Receivable' ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(debt.remainingAmount)}</p>
                    </div>
                </div>
            </div>

            {/* Payment Form */}
            {debt.remainingAmount > 0 ? (
                <DrawerSection title="Nhập thanh toán">
                    <div className="space-y-4">
                        <FormField label="Số tiền">
                            <div className="relative">
                                <FormInput 
                                    type="number" 
                                    value={amount === 0 ? '' : amount} 
                                    onChange={e => setAmount(Number(e.target.value))} 
                                    className="pl-4 pr-16 font-black text-lg text-emerald-600"
                                    autoFocus
                                />
                                <button 
                                    onClick={() => setAmount(debt.remainingAmount)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-500 uppercase transition-colors"
                                >
                                    Tất cả
                                </button>
                            </div>
                        </FormField>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="Ngày">
                                <FormInput type="date" value={date} onChange={e => setDate(e.target.value)} />
                            </FormField>
                            <FormField label="Hình thức">
                                <FormSelect value={method} onChange={e => setMethod(e.target.value)}>
                                    <option value="transfer">Chuyển khoản</option>
                                    <option value="cash">Tiền mặt</option>
                                    <option value="card">Thẻ tín dụng</option>
                                </FormSelect>
                            </FormField>
                        </div>

                        <FormField label="Ghi chú">
                            <FormTextarea 
                                value={notes} 
                                onChange={e => setNotes(e.target.value)} 
                                rows={2}
                                placeholder="Ghi chú giao dịch..."
                            />
                        </FormField>
                    </div>
                </DrawerSection>
            ) : (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold mb-6">
                    <span className="material-symbols-outlined">check_circle</span>
                    Đã thanh toán hoàn tất
                </div>
            )}

            {/* History */}
            {payments.length > 0 && (
                <DrawerSection title="Lịch sử thanh toán">
                    <div className="relative pl-4 border-l-2 border-slate-100 dark:border-slate-700 space-y-4">
                        {payments.map((p, idx) => (
                            <div key={idx} className="relative group">
                                <div className="absolute -left-[21px] top-1 size-3 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500"></div>
                                <div className="flex justify-between items-start bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                                    <div>
                                        <p className="text-xs font-bold text-slate-900 dark:text-white">{p.date}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">{p.notes || 'Không có ghi chú'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-emerald-600">+{formatCurrency(p.amount)}</p>
                                        <p className="text-xs text-slate-400 uppercase font-medium">{p.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </DrawerSection>
            )}
        </Drawer>
    );
};
