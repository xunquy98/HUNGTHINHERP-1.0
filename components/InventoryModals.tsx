
import React, { useState } from 'react';
import { Product } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { enrichProductInfo } from '../services/ai';
import { Button } from './ui/Primitives';
import { Modal } from './ui/Modal';
import { FormField, FormInput, FormSelect } from './ui/Form';
import { db } from '../services/db';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  data: Partial<Product>;
  setData: (data: Partial<Product>) => void;
  mode?: 'create' | 'edit';
}

export const CreateProductModal: React.FC<CreateModalProps> = ({ isOpen, onClose, onSubmit, data, setData, mode = 'create' }) => {
  const { showNotification } = useAppContext();
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleNumberChange = (field: keyof Product, val: string) => {
      const num = Number(val);
      if (num < 0) return;
      setData({ ...data, [field]: val === '' ? 0 : num });
  };

  const handleMagicFill = async () => {
      if (!data.name || data.name.trim().length < 3) {
          showNotification('Vui lòng nhập tên sơ bộ để AI phân tích.', 'warning');
          return;
      }
      
      setIsAiLoading(true);
      try {
          const enriched = await enrichProductInfo(data.name);
          setData({
              ...data,
              ...enriched,
              name: enriched.name || data.name,
              sku: enriched.sku || data.sku,
              brand: enriched.brand || data.brand,
              dimensions: enriched.dimensions || data.dimensions,
              location: enriched.location || data.location
          });
          showNotification('Đã tự động điền thông tin!', 'success');
      } catch (err: any) {
          showNotification(err.message || 'Không thể phân tích sản phẩm này.', 'error');
      } finally {
          setIsAiLoading(false);
      }
  };

  const validate = async () => {
      const newErrors: Record<string, string> = {};
      if (!data.name) newErrors.name = 'Bắt buộc';
      if (!data.sku) newErrors.sku = 'Bắt buộc';
      if (!data.brand) newErrors.brand = 'Bắt buộc';
      
      if (mode === 'create' && data.sku) {
          // Async check for duplicate SKU
          const isDuplicate = await db.products.where('sku').equals(data.sku).first();
          if (isDuplicate) newErrors.sku = 'Mã SKU đã tồn tại';
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
      if (isSubmitting) return;
      
      if (await validate()) {
          setIsSubmitting(true);
          try {
              await onSubmit();
              // onSubmit typically calls an async function from context but might not be awaited here depending on implementation
              // Ideally, pass the promise or handle close inside parent. 
              // Assuming parent handles close, we just set submitting.
          } catch (e) {
              console.error(e);
          } finally {
              setIsSubmitting(false);
          }
      }
  };

  const displayVal = (val: number | undefined) => (val === 0 || val === undefined ? '' : val);

  return (
    <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={mode === 'create' ? 'Thêm sản phẩm mới' : 'Cập nhật sản phẩm'}
        subtitle="Quản lý thông tin chi tiết hàng hóa."
        size="lg"
        footer={
            <>
                <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Hủy bỏ</Button>
                <Button variant="primary" onClick={handleSubmit} loading={isSubmitting} icon="save">{mode === 'create' ? 'Tạo mới' : 'Lưu thay đổi'}</Button>
            </>
        }
    >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <FormField label="Tên sản phẩm" required error={errors.name} className="col-span-1 md:col-span-2">
                <div className="relative">
                    <FormInput 
                        value={data.name || ''} 
                        onChange={e => setData({...data, name: e.target.value})} 
                        placeholder="Nhập tên sản phẩm..." 
                        autoFocus
                        error={!!errors.name}
                        className="pr-12"
                    />
                    <button onClick={handleMagicFill} disabled={isAiLoading} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="AI Magic Fill">
                        <span className={`material-symbols-outlined text-[20px] ${isAiLoading ? 'animate-spin' : ''}`}>{isAiLoading ? 'sync' : 'auto_awesome'}</span>
                    </button>
                </div>
            </FormField>

            <FormField label="Mã SKU" required error={errors.sku} className="col-span-1">
                <FormInput 
                    value={data.sku || ''} 
                    onChange={e => setData({...data, sku: e.target.value})} 
                    placeholder="SKF-6205" 
                    className="font-mono font-bold"
                    disabled={mode === 'edit'}
                    error={!!errors.sku}
                />
            </FormField>
            
            <FormField label="Hãng SX" required error={errors.brand} className="col-span-1">
                <FormInput 
                    value={data.brand || ''} 
                    onChange={e => setData({...data, brand: e.target.value})} 
                    placeholder="SKF, NSK..." 
                    error={!!errors.brand}
                />
            </FormField>

            <FormField label="Kích thước / Quy cách" className="col-span-1">
                <FormInput 
                    value={data.dimensions || ''} 
                    onChange={e => setData({...data, dimensions: e.target.value})} 
                    placeholder="25x52x15mm" 
                />
            </FormField>

            <FormField label="Link Ảnh (URL)" className="col-span-1">
                <FormInput 
                    value={data.image || ''} 
                    onChange={e => setData({...data, image: e.target.value})} 
                    placeholder="https://example.com/image.png" 
                />
            </FormField>

            <div className="col-span-1 grid grid-cols-2 gap-4">
                <FormField label="Vị trí kho">
                    <FormSelect value={data.location || 'bearing'} onChange={e => setData({...data, location: e.target.value})}>
                        <option value="bearing">Bạc Đạn</option>
                        <option value="belt">Curoa</option>
                        <option value="seal">Sin - Phớt</option>
                        <option value="hydraulic">Ống Thủy Lực</option>
                        <option value="pneumatic">Khí nén</option>
                        <option value="lubricant">Dầu Mỡ</option>
                    </FormSelect>
                </FormField>
                <FormField label="Min Stock">
                    <FormInput 
                        type="number" 
                        value={displayVal(data.minStock)} 
                        onChange={e => handleNumberChange('minStock', e.target.value)} 
                        className="text-center text-orange-600 font-bold"
                        placeholder="10" 
                    />
                </FormField>
            </div>

            {mode === 'create' && (
                <FormField label="Tồn đầu kỳ" className="col-span-2">
                    <FormInput 
                        type="number" 
                        value={displayVal(data.stock)} 
                        onChange={e => handleNumberChange('stock', e.target.value)} 
                        placeholder="0" 
                    />
                </FormField>
            )}

            <div className="col-span-2 pt-5 border-t border-dashed border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-2 gap-6">
                    <FormField label="Giá vốn (Import)">
                        <FormInput 
                            type="number" 
                            value={displayVal(data.importPrice)} 
                            onChange={e => handleNumberChange('importPrice', e.target.value)} 
                            placeholder="0" 
                        />
                    </FormField>
                    <FormField label="Giá bán lẻ (Retail)">
                        <FormInput 
                            type="number" 
                            value={displayVal(data.retailPrice)} 
                            onChange={e => handleNumberChange('retailPrice', e.target.value)} 
                            className="border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400 font-black"
                            placeholder="0" 
                        />
                    </FormField>
                </div>
            </div>
        </div>
    </Modal>
  );
};

interface AdjustModalProps {
    product: Product | null;
    onClose: () => void;
    onSave: (qty: number, minStock: number) => void;
    initialQty: number;
    initialMin: number;
}

export const AdjustStockModal: React.FC<AdjustModalProps> = ({ product, onClose, onSave, initialQty, initialMin }) => {
    const [qty, setQty] = useState<number>(initialQty);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    React.useEffect(() => { setQty(initialQty); }, [initialQty]);

    if (!product) return null;

    const handleSave = async () => {
        if(isSubmitting) return;
        setIsSubmitting(true);
        try {
            await onSave(qty, initialMin);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={!!product}
            onClose={onClose}
            title="Kiểm kê nhanh"
            subtitle={product.name}
            size="sm"
            footer={
                <>
                    <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isSubmitting}>Hủy</Button>
                    <Button variant="primary" className="flex-1" onClick={handleSave} loading={isSubmitting}>Cập nhật</Button>
                </>
            }
        >
            <div className="py-4 text-center">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 block">Số lượng thực tế</label>
                <div className="flex items-center gap-4 justify-center">
                    <button onClick={() => setQty(Math.max(0, qty - 1))} className="size-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><span className="material-symbols-outlined">remove</span></button>
                    <input type="number" value={qty} onChange={e => setQty(Math.max(0, Number(e.target.value)))} className="w-24 text-center text-4xl font-black bg-transparent border-none focus:ring-0 p-0 text-slate-900 dark:text-white" />
                    <button onClick={() => setQty(qty + 1)} className="size-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors"><span className="material-symbols-outlined">add</span></button>
                </div>
            </div>
        </Modal>
    );
};
