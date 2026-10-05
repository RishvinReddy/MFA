import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, X, Send, AlertTriangle, RefreshCw, Activity } from 'lucide-react';
import { chatWithAssistant, checkAssistantHealth, AssistantMessage } from '../services/assistantApi';

export const GlobalSecurityAssistant: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<AssistantMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isAvailable, setIsAvailable] = useState(true);
    const [isPollingHealth, setIsPollingHealth] = useState(false);
    const [failedRequest, setFailedRequest] = useState<{text: string, history: AssistantMessage[]} | null>(null);

    const location = useLocation();
    const scrollRef = useRef<HTMLDivElement>(null);

    const checkHealth = async () => {
        setIsPollingHealth(true);
        const health = await checkAssistantHealth();
        setIsAvailable(health.status === 'AVAILABLE');
        setIsPollingHealth(false);
    };

    useEffect(() => {
        checkHealth();
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const sendRequest = async (userMsgText: string, currentHistory: AssistantMessage[]) => {
        setIsLoading(true);
        setFailedRequest(null);
        try {
            const pageContext = {
                page: location.pathname,
                stage: 'UNKNOWN'
            };

            const historyWithoutLatest = currentHistory.slice(0, currentHistory.length - 1);

            const res = await chatWithAssistant(userMsgText, historyWithoutLatest, pageContext);
            setMessages(prev => [...prev, { sender: 'AI', text: res.message, timestamp: Date.now() }]);
        } catch (err: any) {
            let errorText = 'An error occurred while communicating with the assistant.';
            const status = err.response?.status;

            if (status === 401 || status === 403) {
                errorText = 'Insufficient security context to process this request.';
            } else if (status === 429) {
                errorText = 'Rate limited. Please try again later.';
            } else if (status === 503) {
                setIsAvailable(false);
                errorText = 'Local AI service is offline.';
            } else if (status === 500) {
                errorText = 'Internal system failure.';
            }

            setMessages(prev => [...prev, { sender: 'AI', text: errorText, timestamp: Date.now() }]);
            setFailedRequest({ text: userMsgText, history: currentHistory });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || !isAvailable || isLoading) return;

        const userMsg: AssistantMessage = { sender: 'USER', text: input.trim(), timestamp: Date.now() };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInput('');

        await sendRequest(userMsg.text, newHistory);
    };

    const retryLastMessage = async () => {
        if (isLoading || !failedRequest) return;

        setIsPollingHealth(true);
        const health = await checkAssistantHealth();
        const isNowAvailable = health.status === 'AVAILABLE';
        setIsAvailable(isNowAvailable);
        setIsPollingHealth(false);

        if (!isNowAvailable) return;

        setMessages(failedRequest.history);
        await sendRequest(failedRequest.text, failedRequest.history);
    };

    return (
        <>
            {/* Launcher */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
                >
                    <Bot size={24} />
                    <span className="font-semibold tracking-wider">AI Assistant</span>
                    {!isAvailable && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>}
                    {isAvailable && <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900"></span>}
                </button>
            )}

            {/* Assistant Drawer */}
            <div className={`fixed top-0 right-0 h-[100dvh] w-[400px] bg-slate-900/95 backdrop-blur-md border-l border-slate-800 shadow-2xl transition-transform duration-300 z-50 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800/50 bg-slate-900">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <Bot className="text-blue-500" size={20} />
                            <h2 className="text-white font-bold tracking-wider text-sm">ZERO-TRUST AI ASSISTANT</h2>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                            {isAvailable ? (
                                <><Activity size={12} className="text-emerald-500"/><span className="text-[10px] text-emerald-500 font-mono tracking-widest">LOCAL AI READY</span></>
                            ) : (
                                <><AlertTriangle size={12} className="text-red-500"/><span className="text-[10px] text-red-500 font-mono tracking-widest">LOCAL AI OFFLINE</span></>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={checkHealth} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors" title="Check Health">
                            <RefreshCw size={18} className={isPollingHealth ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm">
                    {messages.length === 0 && (
                        <div className="text-center text-slate-500 mt-10">
                            <Bot size={48} className="mx-auto mb-4 opacity-20" />
                            <p>BioShield AI is available locally. Security context adapts to your current authentication state.</p>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.sender === 'USER' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-xl p-3 ${msg.sender === 'USER' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700/50'} shadow-sm`}>
                                <div className="text-[10px] opacity-50 mb-1 tracking-wider uppercase flex justify-between">
                                    <span>{msg.sender === 'USER' ? 'You' : 'BioShield AI'}</span>
                                </div>
                                <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="max-w-[85%] rounded-xl p-3 bg-slate-800 text-slate-300 border border-slate-700/50 flex items-center gap-2">
                                <Activity size={14} className="animate-pulse text-blue-500" />
                                <span className="text-xs opacity-70">Analyzing security context...</span>
                            </div>
                        </div>
                    )}

                    {!isAvailable && failedRequest && (
                        <div className="flex justify-center mt-4">
                             <button onClick={retryLastMessage} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs font-semibold text-slate-300 flex items-center gap-2 transition-colors">
                                 <RefreshCw size={14} className={isPollingHealth ? 'animate-spin' : ''} /> Retry
                             </button>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-slate-800/50 bg-slate-900/90">
                    <div className="flex gap-2">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            disabled={!isAvailable || isLoading}
                            placeholder={isAvailable ? "Ask security assistant..." : "Assistant offline..."}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none h-[46px] min-h-[46px] max-h-[120px] disabled:opacity-50 font-mono"
                            rows={1}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || !isAvailable || isLoading}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl w-[46px] h-[46px] flex items-center justify-center transition-colors flex-shrink-0"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
