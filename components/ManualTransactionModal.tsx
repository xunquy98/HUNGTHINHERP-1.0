
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { TransactionType } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Primitives';
import { FormField, FormInput, FormSelect, FormTextarea } from './ui/Form';

interface ManualTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ManualTransactionModal: React.FC<ManualTransactionModalProps> = ({ isOpen, onClose }) => {
    const { addManualTransaction, showNotification } = useAppContext();
    
    // Form State
    const [type, setType] = useState<TransactionType>('expense');
    const [amount, setAmount] = useState<number>(0);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [method, setMethod] = useState('cash');
    const [description, setDescription] = useState('');
    
    // Reset on Open
    useEffect(() => {
        if (isOpen) {
            setType('expense');
            setAmount(0);
            setDate(new Date().toISOString().slice(0, 10));
            setMethod('cash');
            setDescription('');
        }
    }, [isOpen]);

    const handleSubmit = async () => {
        if (amount <= 0) {
            showNotification('Số tiền phải lớn hơn 0', 'error');
            return;
        }
        if (!description.trim()) {
            showNotification('Vui lòng nhập mô tả giao dịch', 'error');
            return;
        }

        await addManualTransaction({
            type,
            amount,
            date,
            method,
            description
        });
        
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Tạo Giao Dịch Thủ Công"
            subtitle="Ghi nhận các khoản thu/chi ngoài luồng."
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Hủy</Button>
                    <Button variant="primary" icon="save" onClick={handleSubmit}>Lưu giao dịch</Button>
                </>
            }
        >
            <div className="space-y-5">
                {/* Type Switcher */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button 
                        onClick={() => setType('income')} 
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">trending_up</span> Thu Nhập
                    </button>
                    <button 
                        onClick={() => setType('expense')} 
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${type === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">trending_down</span> Chi Phí
                    </button>
                </div>

                {/* Amount */}
                <FormField label="Số tiền" required>
                    <div className="relative">
                        <FormInput 
                            type="number" 
                            value={amount === 0 ? '' : amount} 
                            onChange={e => setAmount(Number(e.target.value))} 
                            placeholder="0" 
                            className={`pl-4 pr-12 text-lg font-black ${type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}
                            autoFocus
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">VND</span>
                    </div>
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                    <FormField label="Ngày giao dịch">
                        <FormInput type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </FormField>
                    <FormField label="Phương thức">
                        <FormSelect value={method} onChange={e => setMethod(e.target.value)}>
                            <option value="cash">Tiền mặt</option>
                            <option value="transfer">Chuyển khoản</option>
                            <option value="card">Thẻ tín dụng</option>
                        </FormSelect>
                    </FormField>
                </div>

                <FormField label="Mô tả / Lý do" required>
                    <FormTextarea 
                        rows={3} 
                        value={description} 
                        onChange={e => setDescription(e.target.value)} 
                        placeholder={type === 'income' ? "VD: Bán phế liệu, Tiền thưởng..." : "VD: Tiền điện, Mua VPP, Tiếp khách..."}
                    />
                </FormField>
            </div>
        </Modal>
    );
};

export default ManualTransactionModal;
