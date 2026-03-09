import { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';

const API_ENDPOINT = apiUrl('/api/chat/counselor');
const FAQ_ENDPOINT = apiUrl('/api/counselor/faqs?limit=24');
const FALLBACK_FAQS = [
  {
    id: 'fallback-path-beginner',
    question: 'Which path fits me if I am starting with no AI background?',
    answer:
      'Start with Path 1 if your immediate goal is clinical productivity. Move to Path 2 when your goal is publication and research execution, and Path 3 when your goal is venture-building or innovation.'
  },
  {
    id: 'fallback-path1-outcomes',
    question: 'What does Path 1 include for daily clinical practice?',
    answer:
      'Path 1 focuses on practical doctor workflows: prompting, notes, summaries, patient communication, and department-level implementation habits for safe AI use in daily practice.'
  },
  {
    id: 'fallback-path2-outcomes',
    question: 'What does Path 2 include for publication and research outcomes?',
    answer:
      'Path 2 covers hypothesis framing, evidence synthesis, study design translation, manuscript structuring, and reviewer-response readiness with mentor-guided checkpoints.'
  },
  {
    id: 'fallback-path3-outcomes',
    question: 'What does Path 3 include for venture outcomes?',
    answer:
      'Path 3 covers clinical problem validation, no-code MVP planning, pilot metrics, and capstone investor-readiness workflows.'
  },
  {
    id: 'fallback-usp',
    question: 'What is the core USP of GreyBrain cohorts?',
    answer:
      'Every GreyBrain path is cohort-based and implementation-led. Learners get AI tutor support between sessions, complete assignments, receive mentor review, and progress toward certificate-linked completion.'
  },
  {
    id: 'fallback-flow',
    question: 'How do assignment review and certification work after enrollment?',
    answer:
      'After enrollment, learners complete modules and assignments, receive mentor feedback, and then become eligible for certificate issuance after completion criteria are met.'
  },
  {
    id: 'fallback-format',
    question: 'Is this self-paced or live cohort based?',
    answer:
      'It is cohort-led with guided milestones, supported by AI tutor assistance between mentor sessions.'
  },
  {
    id: 'fallback-refresher',
    question: 'Is there a beginner or refresher course before the full cohorts?',
    answer:
      'Yes. GreyBrain offers an AI Refresher for Doctors as a short interactive orientation. It opens after registration, walks through prompt, context, model behavior, review, and output, and then routes learners into Practice, Publish, or Build based on what they want next.'
  },
  {
    id: 'fallback-certificate',
    question: 'Is certification included?',
    answer:
      'Yes. Eligible GreyBrain cohort completion includes certificate issuance, and GreyBrain Academy programs include IIHMRB certification recognition on the public academy site.'
  }
];

export default function CounselorChat({ mode = 'inline', className = '' }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [faqItems, setFaqItems] = useState(FALLBACK_FAQS);
  const [expandedFaqId, setExpandedFaqId] = useState(FALLBACK_FAQS[0]?.id || '');

  const isFloating = mode === 'floating';
  const isEmbedded = mode === 'embedded';

  useEffect(() => {
    let active = true;

    const loadFaqPrompts = async () => {
      try {
        const response = await fetch(FAQ_ENDPOINT);
        const payload = await response.json();
        if (!response.ok) return;
        const items = (payload?.faqs || [])
          .map((item, index) => {
            const question = String(item?.question || '').trim();
            const answer = String(item?.answer || '').trim();
            if (!question) return null;
            return {
              id: String(item?.id || `faq-${index}`),
              question,
              answer
            };
          })
          .filter(Boolean)
          .slice(0, 24);
        if (active && items.length > 0) {
          setFaqItems(items);
          setExpandedFaqId(String(items[0].id || ''));
        }
      } catch {
        // Keep fallback prompts if fetch fails.
      }
    };

    void loadFaqPrompts();
    return () => {
      active = false;
    };
  }, []);

  const sendQuestion = async (inputText) => {
    const text = String(inputText || '').trim();
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

  const onSubmit = async (event) => {
    event.preventDefault();
    await sendQuestion(message);
  };

  const onFaqToggle = (faq) => {
    const nextId = String(faq?.id || '');
    if (!nextId) return;
    setExpandedFaqId((prev) => (prev === nextId ? '' : nextId));
    setMessage(String(faq?.question || ''));
  };

  const activeFaq = faqItems.find((item) => String(item.id) === expandedFaqId) || null;
  const shellClass = isEmbedded
    ? 'overflow-hidden rounded-[1.2rem] bg-white/58 p-3.5 shadow-[0_10px_24px_rgba(12,22,38,0.03)] ring-1 ring-white/50 backdrop-blur-sm md:rounded-[1.45rem] md:p-6'
    : 'overflow-hidden rounded-[1.35rem] border border-slate-900/10 bg-white/95 p-3.5 shadow-xl backdrop-blur-sm md:rounded-2xl md:p-8';
  const faqTrayClass = isEmbedded
    ? 'flex max-h-56 flex-wrap gap-1.5 overflow-y-auto rounded-[1rem] bg-white/45 p-2.5 ring-1 ring-slate-200/70 md:max-h-64 md:gap-2'
    : 'flex max-h-56 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-2 md:max-h-64 md:gap-2';
  const activeFaqClass = isEmbedded
    ? 'mb-3 rounded-[1rem] bg-emerald-50/65 p-3 ring-1 ring-emerald-200/80'
    : 'mb-3 rounded-[1.1rem] border border-emerald-200 bg-emerald-50/50 p-3 md:rounded-2xl';
  const messagesClass = isEmbedded
    ? 'mb-3 max-h-56 space-y-2 overflow-y-auto rounded-[1rem] bg-white/45 p-3 ring-1 ring-slate-200/70 md:max-h-64'
    : 'mb-3 max-h-56 space-y-2 overflow-y-auto rounded-[1.1rem] border border-slate-200 bg-slate-50/80 p-3 md:max-h-64 md:rounded-2xl';

  const chatPanel = (
    <section className={`${shellClass} ${isFloating ? '' : ''} ${className}`}>
      <header className="mb-3">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Pre-Enrollment</p>
        <h2 className="text-xl font-extrabold text-slate-900">AI Counselor</h2>
        <p className="mt-1 text-sm text-slate-600">AI-mediated logistics help for path, timeline, payment, and onboarding.</p>
      </header>

      <div className="mb-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">FAQ chips (tap to expand)</p>
        <div className={faqTrayClass}>
        {faqItems.map((item) => {
          const expanded = String(item.id) === String(expandedFaqId);
          return (
          <button
            key={item.id}
            type="button"
            className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold leading-4 transition md:px-3 md:text-xs ${
              expanded
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
            onClick={() => onFaqToggle(item)}
          >
            {item.question}
          </button>
          );
        })}
        </div>
      </div>

      {activeFaq ? (
        <article className={activeFaqClass}>
          <p className="text-sm font-semibold text-emerald-900">{activeFaq.question}</p>
          <p className="mt-2 text-sm leading-6 text-emerald-900/90">{activeFaq.answer || 'Use this question in chat to get the most recent answer from counselor.'}</p>
          <button
            type="button"
            className="mt-3 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-emerald-800"
            onClick={() => void sendQuestion(activeFaq.question)}
            disabled={isSending}
          >
            {isSending ? 'Sending...' : 'Use In Chat'}
          </button>
        </article>
      ) : null}

      <div className={messagesClass}>
        {messages.length === 0 ? (
          <p className="text-sm text-slate-600">Expand a FAQ chip above or type your own question.</p>
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
          placeholder="Ask cohort logistics, fee, timeline, or prerequisites"
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

  if (!isFloating) {
    return <div className={isEmbedded ? 'h-full' : 'mb-8'}>{chatPanel}</div>;
  }

  return (
    <aside className="fixed bottom-24 right-3 z-50 w-[min(26rem,calc(100vw-1.5rem))] md:bottom-4 md:right-4">
      {isOpen ? (
        <div className="mb-2">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </div>
          {chatPanel}
        </div>
      ) : null}
      <button
        type="button"
        className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-800"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? 'Hide AI Counselor' : 'Need help choosing a path? Ask AI Counselor'}
      </button>
    </aside>
  );
}
