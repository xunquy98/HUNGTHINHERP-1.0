
import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Primitives';
import { useAppContext } from '../../contexts/AppContext';
import { TemplateEngine } from './TemplateEngine';
import { StockCardTemplate, ReportTemplate } from './Templates';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    filename: string;
    data?: any; // Data for dynamic engine
    children?: React.ReactNode; // For specialized templates (Stock Card, Report)
}

export const PrintPreviewModal: React.FC<Props> = ({ isOpen, onClose, title, filename, data, children }) => {
    const { settings, showNotification } = useAppContext();
    const [isPdfLoading, setIsPdfLoading] = useState(false);

    if (!isOpen) return null;

    const handlePrint = () => {
        document.title = filename; // Set filename for "Save as PDF"
        window.print();
    };

    const handleDownloadPdf = async () => {
        const element = document.getElementById('print-area');
        if (!element) return;

        setIsPdfLoading(true);
        
        try {
            // 1. Capture the DOM element as a high-res image
            const canvas = await html2canvas(element, {
                scale: 2, // 2x scale for sharper text
                useCORS: true, // Enable cross-origin images (like logos)
                logging: false,
                backgroundColor: '#ffffff', // Ensure white background
                windowWidth: 1200 // Force a minimum width to prevent responsiveness issues during capture
            });

            const imgData = canvas.toDataURL('image/png');
            
            // 2. Initialize PDF (A4 size: 210mm x 297mm)
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const pdfHeight = 297;
            
            // 3. Calculate dimensions to fit A4 width
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;

            // 4. Add image to PDF
            // If the content is longer than one page, simple scaling might look small, 
            // but for invoices it's usually preferred to fit-to-width.
            // Advanced multi-page logic can be added here if needed.
            
            // If height exceeds A4, we might want to split, but for now we let it scale or crop if single page logic
            // To be safe for long reports, we simply add the image. If it's too long, it might stretch.
            // For a robust MVP, we fit to width starting at top-left.
            
            if (imgHeight > pdfHeight) {
                // If content is very long, we might need multiple pages.
                // Simple approach: Add image, let user see it. 
                // Better approach for long content:
                let heightLeft = imgHeight;
                let position = 0;

                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;

                while (heightLeft >= 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }
            } else {
                pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            }
            
            // 5. Save
            pdf.save(`${filename}.pdf`);
            showNotification('Đã tải xuống file PDF', 'success');

        } catch (error) {
            console.error("PDF Generation Error", error);
            showNotification('Lỗi khi tạo file PDF. Vui lòng thử in bằng trình duyệt.', 'error');
        } finally {
            setIsPdfLoading(false);
        }
    };

    // Determine content to render
    const content = useMemo(() => {
        if (children) return children;
        
        if (data) {
            // Check data type based on code prefix or structure to choose config
            let type: 'order' | 'quote' | 'import' | 'delivery' = 'order';
            if (data.code?.startsWith('BG') || data.code?.startsWith('QT')) type = 'quote';
            else if (data.code?.startsWith('PN')) type = 'import';
            else if (data.code?.startsWith('PGH')) type = 'delivery';
            
            const config = settings.documents[type];
            return <TemplateEngine data={data} settings={settings} config={config} type={type} />;
        }
        
        return <div className="text-center p-10">Không có dữ liệu in</div>;
    }, [data, children, settings]);

    return (
        <div className="fixed inset-0 bg-slate-900/90 z-print flex flex-col items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
            {/* Toolbar */}
            <div className="w-full max-w-4xl flex justify-between items-center mb-4 print:hidden">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    <span className="material-symbols-outlined">print</span> {title}
                </h3>
                <div className="flex gap-3">
                    <Button variant="secondary" onClick={onClose} className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700">Đóng</Button>
                    <Button 
                        variant="primary" 
                        onClick={handleDownloadPdf}
                        loading={isPdfLoading}
                        className="bg-rose-600 hover:bg-rose-700 border-rose-600 text-white"
                        icon="picture_as_pdf"
                    >
                        {isPdfLoading ? 'Đang tạo PDF...' : 'Lưu PDF'}
                    </Button>
                    <Button 
                        variant="primary" 
                        onClick={handlePrint}
                        className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white"
                        icon="print"
                    >
                        In Ngay
                    </Button>
                </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar w-full flex justify-center bg-slate-800/50 rounded-xl border border-slate-700/50 p-8 print:p-0 print:bg-white print:border-none print:overflow-visible print:absolute print:inset-0 print:z-[210] print:block">
                <div 
                    id="print-area" 
                    className="bg-white text-slate-900 w-[210mm] min-h-[297mm] p-[15mm] shadow-2xl relative print:shadow-none print:w-full print:min-h-0 print:m-0"
                >
                    {/* Print CSS Injection */}
                    <style>{`
                        @media print { 
                            @page { size: A4; margin: 0; }
                            body * { visibility: hidden; } 
                            #print-area, #print-area * { visibility: visible; } 
                            #print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 15mm; } 
                        }
                    `}</style>
                    {content}
                </div>
            </div>
        </div>
    );
};
