import React, { useState, useRef, useEffect } from 'react';

const AutoRagChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hi! I am the GreyBrain AI assistant. Ask me anything about our courses, content, or AI for healthcare.' }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: messages.slice(1).map(m => ({ role: m.role, content: m.content })) // omit first greeting
        })
      });

      if (!res.ok) throw new Error('Failed to get response');
      const data = await res.json();
      
      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I am having trouble connecting right now.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 flex w-[350px] sm:w-[400px] h-[500px] max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-sm font-bold border border-slate-700">GB</span>
              <div>
                <h3 className="text-sm font-bold leading-tight flex items-center gap-1.5">
                  GreyBrain AI
                  <span className="text-[9px] bg-teal-500/20 text-teal-400 px-1.5 py-0.5 rounded-full border border-teal-500/30 font-medium">RAG-Verified</span>
                </h3>
                <p className="text-[10px] text-slate-400">Clinical Knowledge Retrieval Active</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.role === 'user' ? 'bg-slate-900 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl bg-white border border-slate-200 px-4 py-3 shadow-sm rounded-bl-sm flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3">
            <div className="relative flex items-center">
              <input
                type="text"
                className="w-full rounded-full border border-slate-300 bg-slate-50 py-2.5 pl-4 pr-12 text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="Ask a question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isLoading}
                className="absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
          </form>
        </div>
      )}
      
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="group flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl transition-transform hover:scale-105"
        >
          <svg className="h-6 w-6 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        </button>
      )}
    </div>
  );
};

export default AutoRagChat;
