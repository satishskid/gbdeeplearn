import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../lib/api';

const API_ENDPOINT = apiUrl('/api/chat/tutor');
const STORAGE_KEY = 'deeplearn_groq_key';
const STORAGE_CONTEXT_KEY = 'deeplearn_context_id';

export default function ChatInterface() {
  const [message, setMessage] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [contextId, setContextId] = useState('');
  const [messages, setMessages] = useState([]);
  const [queuedMessages, setQueuedMessages] = useState([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSending, setIsSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({ groqKey: '', contextId: '' });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedKey = window.localStorage.getItem(STORAGE_KEY) || '';
    const savedContext = window.localStorage.getItem(STORAGE_CONTEXT_KEY) || '';
    setGroqKey(savedKey);
    setContextId(savedContext);
    setSettingsDraft({ groqKey: savedKey, contextId: savedContext });
  }, []);

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
    if (typeof window === 'undefined') return undefined;

    const syncContext = (event) => {
      const nextContext =
        typeof event?.detail?.contextId === 'string'
          ? event.detail.contextId.trim()
          : window.localStorage.getItem(STORAGE_CONTEXT_KEY) || '';
      setContextId(nextContext);
      setSettingsDraft((prev) => ({ ...prev, contextId: nextContext }));
    };

    window.addEventListener('greybrain:tutor-context-updated', syncContext);
    return () => {
      window.removeEventListener('greybrain:tutor-context-updated', syncContext);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncDraft = (event) => {
      const nextMessage = typeof event?.detail?.message === 'string' ? event.detail.message.trim() : '';
      if (nextMessage) setMessage(nextMessage);
    };

    window.addEventListener('greybrain:tutor-draft-updated', syncDraft);
    return () => {
      window.removeEventListener('greybrain:tutor-draft-updated', syncDraft);
    };
  }, []);

  useEffect(() => {
    if (!isOnline || queuedMessages.length === 0 || isSending) {
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
        body: JSON.stringify({ message: text, groq_key: groqKey.trim(), current_context_id: contextId.trim() || null })
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

    await sendMessageToTutor(text);
  };

  const saveSettings = () => {
    const nextKey = settingsDraft.groqKey.trim();
    const nextContext = settingsDraft.contextId.trim();
    setGroqKey(nextKey);
    setContextId(nextContext);
    if (typeof window !== 'undefined') {
      if (nextKey) {
        window.localStorage.setItem(STORAGE_KEY, nextKey);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      if (nextContext) {
        window.localStorage.setItem(STORAGE_CONTEXT_KEY, nextContext);
      } else {
        window.localStorage.removeItem(STORAGE_CONTEXT_KEY);
      }
    }
    setShowSettings(false);
  };

  return (
    <section id="learner-tutor" className="mb-8 overflow-hidden rounded-[1.9rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,250,255,0.96))] p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm md:p-8">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Learner Study Mode</p>
          <h2 className="text-2xl font-extrabold text-slate-900">AI Tutor (BYOK + Server Fallback)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Syllabus-grounded tutoring for enrolled learners. Keep keys and module context in Settings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            type="button"
            onClick={() => setShowSettings(true)}
          >
            Settings
          </button>
          <div
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {isOnline ? 'Online' : `Offline (${queuedCount} queued)`}
          </div>
        </div>
      </header>
      <div className="mb-4 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Current tutor context</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{contextId || 'Auto (all enrolled course context)'}</p>
          <p className="mt-1 text-sm text-slate-600">
            Select a module from the learner workspace to focus the tutor on that specific lesson or assignment.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Access mode</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{groqKey ? 'BYOK active' : 'Server fallback active'}</p>
          <p className="mt-1 text-sm text-slate-600">
            Use BYOK when you want your own Groq quota. Otherwise the tutor falls back to the configured server path.
          </p>
        </article>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          'Explain the current module in simpler doctor language',
          'Turn this lesson into an assignment checklist',
          'Show likely mistakes learners make in this module',
          'Create viva-style questions from this topic'
        ].map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            onClick={() => setMessage(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mb-4 max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">Ask a concept question to start a tutoring session.</p>
        ) : (
          messages.map((item, idx) => (
            <article
              key={`${item.role}-${idx}`}
              className={`rounded-xl px-3 py-2 text-sm ${
                item.role === 'user' ? 'bg-blue-100 text-blue-950' : 'bg-white text-slate-800'
              }`}
            >
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{item.role}</p>
              <p>{item.content}</p>
              {item.state === 'error' && <p className="mt-1 text-xs text-rose-600">Failed to deliver</p>}
            </article>
          ))
        )}
      </div>

      {queuedMessages.length > 0 && (
        <aside className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-700">Queued Messages</p>
          <div className="space-y-1">
            {queuedMessages.map((queued) => (
              <p key={queued.id} className="text-sm text-amber-900">
                {queued.text}
              </p>
            ))}
          </div>
        </aside>
      )}

      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onSubmit}>
        <input
          className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
          type="text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask your tutor a question"
        />
        <button
          className="rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSending}
        >
          Send
        </button>
      </form>

      {showSettings ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900">Tutor Settings</h3>
            <p className="mt-1 text-sm text-slate-600">Set optional BYOK key and module context for better retrieval quality.</p>

            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Groq API Key (optional, stored in this browser)
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
                type="password"
                value={settingsDraft.groqKey}
                onChange={(event) => setSettingsDraft((prev) => ({ ...prev, groqKey: event.target.value }))}
                placeholder="gsk_..."
                autoComplete="off"
              />
            </label>

            <label className="mt-3 block text-sm font-semibold text-slate-700">
              Module/Context ID (optional)
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
                type="text"
                value={settingsDraft.contextId}
                onChange={(event) => setSettingsDraft((prev) => ({ ...prev, contextId: event.target.value }))}
                placeholder="e.g. path2-research-module-1"
              />
            </label>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={() => setShowSettings(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800"
                onClick={saveSettings}
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
