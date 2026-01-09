
import { useState, useCallback, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ViewState } from '../types';

interface VoiceAction {
    type: 'NAVIGATE' | 'SEARCH' | 'CREATE' | 'UNKNOWN';
    target?: string; // ViewState or Search Query
    params?: any;
}

export const useVoiceAssistant = (
    onNavigate: (view: ViewState, params?: any) => void, 
    onSearch: (query: string) => void
) => {
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [feedback, setFeedback] = useState('');

    // Web Speech API - Persist instance across renders
    const recognition = useMemo(() => {
        if (typeof window !== 'undefined' && (window as any).webkitSpeechRecognition) {
            return new (window as any).webkitSpeechRecognition();
        }
        return null;
    }, []);

    const speak = (text: string) => {
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'vi-VN';
            window.speechSynthesis.speak(utterance);
        }
    };

    const processIntentWithGemini = async (text: string) => {
        if (!text) return;
        
        setIsProcessing(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // Define the prompt to classify intent
            const prompt = `
                Bạn là trợ lý điều khiển giọng nói cho phần mềm ERP. 
                Người dùng vừa nói: "${text}".
                
                Hãy phân tích và trả về JSON duy nhất (không markdown) với cấu trúc:
                {
                    "type": "NAVIGATE" | "SEARCH" | "CREATE" | "UNKNOWN",
                    "target": string (Mã màn hình hoặc từ khóa tìm kiếm),
                    "reply": string (Câu trả lời ngắn gọn tiếng Việt để nói lại với người dùng)
                }

                Quy tắc Mapping:
                1. NAVIGATE (Đi tới màn hình):
                   - Dashboard/Tổng quan -> "DASHBOARD"
                   - Bán hàng/POS -> "POS"
                   - Đơn hàng/Hóa đơn -> "ORDERS"
                   - Kho/Tồn kho/Sản phẩm -> "INVENTORY"
                   - Nhập hàng/Phiếu nhập -> "IMPORTS"
                   - Đối tác/Khách hàng -> "PARTNERS"
                   - Công nợ -> "DEBTS"
                   - Báo cáo/Doanh thu -> "REPORTS"
                   - Cài đặt -> "SETTINGS"
                
                2. SEARCH (Tìm kiếm):
                   - Nếu người dùng nói "Tìm...", "Tra cứu...", "Xem đơn của...", "Kiểm tra mã..." -> target là từ khóa.
                
                3. CREATE (Tạo mới):
                   - "Tạo đơn mới", "Bán hàng" -> NAVIGATE to POS
                   - "Nhập hàng mới" -> NAVIGATE to IMPORTS
                
                Ví dụ: 
                - "Cho tôi xem kho hàng" -> {"type": "NAVIGATE", "target": "INVENTORY", "reply": "Đang mở kho hàng"}
                - "Tìm đơn hàng của anh Nam" -> {"type": "SEARCH", "target": "anh Nam", "reply": "Đang tìm đơn của anh Nam"}
                - "Mở báo cáo doanh thu" -> {"type": "NAVIGATE", "target": "REPORTS", "reply": "Đang mở báo cáo"}
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });

            const result = JSON.parse(response.text || '{}');
            console.log("Voice Intent:", result);

            setFeedback(result.reply || "Đã rõ.");
            speak(result.reply || "Đã rõ.");

            // Execute Action
            if (result.type === 'NAVIGATE') {
                onNavigate(result.target as ViewState);
            } else if (result.type === 'SEARCH') {
                onSearch(result.target);
            } else if (result.type === 'CREATE') {
                 // Map CREATE intents to navigation for now
                 if (text.toLowerCase().includes('nhập')) onNavigate('IMPORTS');
                 else onNavigate('POS');
            }

        } catch (error) {
            console.error("Voice Processing Error:", error);
            setFeedback("Xin lỗi, tôi chưa hiểu ý bạn.");
            speak("Xin lỗi, tôi chưa hiểu ý bạn.");
        } finally {
            setIsProcessing(false);
            setTimeout(() => setFeedback(''), 3000);
        }
    };

    const startListening = useCallback(() => {
        if (!recognition) {
            alert("Trình duyệt của bạn không hỗ trợ nhận dạng giọng nói.");
            return;
        }

        // Setup event handlers
        recognition.lang = 'vi-VN';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            setIsListening(true);
            setTranscript('');
            setFeedback('Đang nghe...');
        };

        recognition.onresult = (event: any) => {
            const lastResult = event.results[event.results.length - 1];
            if (lastResult.isFinal) {
                const text = lastResult[0].transcript;
                setTranscript(text);
                processIntentWithGemini(text);
            }
        };

        recognition.onerror = (event: any) => {
            setIsListening(false);
            // Handle common errors gracefully
            if (event.error === 'no-speech') {
                setFeedback('Không nghe rõ.');
                // Don't log as console error to avoid "Uncaught" noise
            } else if (event.error === 'not-allowed') {
                setFeedback('Cần quyền Micro.');
                console.warn("Speech recognition not allowed");
            } else {
                console.error("Speech Error:", event.error);
                setFeedback('Lỗi mic.');
            }
            
            // Clear feedback after delay
            setTimeout(() => setFeedback(''), 2000);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        try {
            recognition.start();
        } catch (e) {
            // Check if already started
            console.warn("Recognition already started or failed to start", e);
        }
    }, [recognition]);

    return {
        isListening,
        isProcessing,
        transcript,
        feedback,
        startListening
    };
};
