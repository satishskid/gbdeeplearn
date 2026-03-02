import { useState } from 'react';
import { apiUrl } from '../lib/api';

const API_ENDPOINT = apiUrl('/api/chat/counselor');

export default function CounselorChat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || isSending) return;

    setMessage('');
    setIsSending(true);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Counselor service unavailable.');
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: payload?.reply || 'Please try again.' }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: error instanceof Error ? error.message : 'Request failed.', error: true }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="mb-8 overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-white/80 p-5 shadow-xl backdrop-blur-sm md:p-8">
      <header className="mb-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Pre-Enrollment</p>
        <h2 className="text-2xl font-extrabold text-slate-900">AI Counselor</h2>
        <p className="mt-1 text-sm text-slate-600">Ask about schedule, fees, prerequisites, and cohort logistics.</p>
      </header>

      <div className="mb-4 max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">Example: Which path is best for a clinician starting from scratch?</p>
        ) : (
          messages.map((item, idx) => (
            <article
              key={`${item.role}-${idx}`}
              className={`rounded-xl px-3 py-2 text-sm ${
                item.role === 'user' ? 'bg-emerald-100 text-emerald-950' : 'bg-white text-slate-800'
              }`}
            >
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{item.role}</p>
              <p>{item.content}</p>
            </article>
          ))
        )}
      </div>

      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onSubmit}>
        <input
          className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
          type="text"
          placeholder="Ask the counselor a question"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button
          className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSending}
        >
          {isSending ? 'Sending...' : 'Ask Counselor'}
        </button>
      </form>
    </section>
  );
}
