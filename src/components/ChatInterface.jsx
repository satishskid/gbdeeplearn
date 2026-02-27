import { useEffect, useMemo, useState } from 'react';

const API_ENDPOINT = '/api/chat/tutor';

export default function ChatInterface() {
  const [message, setMessage] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [messages, setMessages] = useState([]);
  const [queuedMessages, setQueuedMessages] = useState([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOnline || queuedMessages.length === 0 || isSending || !groqKey.trim()) {
      return;
    }

    const flushQueue = async () => {
      setIsSending(true);
      const remaining = [];
      for (const pending of queuedMessages) {
        const sent = await sendMessageToTutor(pending.text);
        if (!sent) {
          remaining.push(pending);
        }
      }
      setQueuedMessages(remaining);
      setIsSending(false);
    };

    void flushQueue();
  }, [groqKey, isOnline, queuedMessages, isSending]);

  const queuedCount = useMemo(() => queuedMessages.length, [queuedMessages.length]);

  const sendMessageToTutor = async (text) => {
    setMessages((prev) => [...prev, { role: 'user', content: text, state: 'sent' }]);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, groq_key: groqKey, current_context_id: null })
      });

      if (!response.ok) {
        throw new Error('Tutor service unavailable.');
      }

      const data = await response.json();
      const tutorMessage = data?.reply ?? 'No tutor response received.';
      setMessages((prev) => [...prev, { role: 'assistant', content: tutorMessage, state: 'sent' }]);
      return true;
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: error instanceof Error ? error.message : 'Request failed.', state: 'error' }
      ]);
      return false;
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    if (!message.trim()) {
      return;
    }

    const text = message.trim();
    setMessage('');

    if (!isOnline) {
      setQueuedMessages((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, text }]);
      return;
    }

    if (!groqKey.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Add your Groq API key to use Tutor mode.',
          state: 'error'
        }
      ]);
      return;
    }

    await sendMessageToTutor(text);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-lg backdrop-blur md:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-ink">AI Tutor (BYOK)</h2>
          <p className="text-sm text-slate-600">Socratic responses grounded in syllabus context.</p>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {isOnline ? 'Online' : `Offline (${queuedCount} queued)`}
        </div>
      </header>

      <label className="mb-3 block text-sm font-medium text-slate-700">
        Groq API Key
        <input
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          type="password"
          value={groqKey}
          onChange={(event) => setGroqKey(event.target.value)}
          placeholder="gsk_..."
          autoComplete="off"
        />
      </label>

      <div className="mb-4 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">Start by asking a question about your module.</p>
        ) : (
          messages.map((item, idx) => (
            <article
              key={`${item.role}-${idx}`}
              className={`rounded-lg px-3 py-2 text-sm ${
                item.role === 'user' ? 'bg-sky-100 text-sky-900' : 'bg-white text-slate-800'
              }`}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{item.role}</p>
              <p>{item.content}</p>
              {item.state === 'error' && <p className="mt-1 text-xs text-rose-600">Failed to deliver</p>}
            </article>
          ))
        )}
      </div>

      {queuedMessages.length > 0 && (
        <aside className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">Queued Messages</p>
          <div className="space-y-1">
            {queuedMessages.map((queued) => (
              <p key={queued.id} className="text-sm text-amber-900">
                {queued.text}
              </p>
            ))}
          </div>
        </aside>
      )}

      <form className="flex gap-2" onSubmit={onSubmit}>
        <input
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          type="text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask your tutor a question"
        />
        <button
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSending}
        >
          Send
        </button>
      </form>
    </section>
  );
}
