import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCrm } from '../../store/CrmContext';
import { animateCards, gsap, isReducedMotion } from '../../utils/motion';
import { AnimatedTitle } from '../Motion';
import { IconChevronDown, IconSearch } from '../Icons';

const FAQS = [
  {
    q: 'How do I move a deal to another stage?',
    a: 'On the Pipeline Board, drag any deal card onto another stage column, or focus a card and press the Left or Right arrow keys. You can also click any deal to open its drawer and pick a step along the stage bar. Every move shows an Undo toast.',
  },
  {
    q: 'What is the weighted forecast?',
    a: 'Each open stage multiplies the deal value by its probability: Lead 10%, Qualified 25%, Proposal 50%, and Negotiation 75%. Won deals count at 100% and Lost deals count at 0%.',
  },
  {
    q: 'What happens when a quote is accepted?',
    a: 'Marking a sent quote as Accepted automatically moves the linked deal to Won, sets its close date to today, and aligns the deal value to the quote subtotal — with an Undo toast if you clicked by mistake.',
  },
  {
    q: 'Can I fold the sidebar?',
    a: 'Yes — press ⌘B (or Ctrl+B) at any time, or click the sidebar button in the top-left of the rail. When folded, your three spaces fly neatly into the top-left stack pill.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Everything stays right in your browser using localStorage. You can export a full JSON snapshot or reset the sample workspaces at any time under Settings → Data.',
  },
  {
    q: 'Which keyboard shortcuts are there?',
    a: 'Press ? anywhere to view all shortcuts: ⌘K or / for Search, ⌘B to fold the sidebar, N for a new deal, and G followed by O, P, C, A, Q, T, or R to jump directly to any page.',
  },
];

const TOPICS = ['Pipeline', 'Contacts', 'Quotes', 'Reports', 'Billing', 'Something else'];

export const HelpPage: React.FC = () => {
  const { space, pushToast } = useCrm();
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState(TOPICS[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el || isReducedMotion()) return;
    const ctx = gsap.context(() => {
      animateCards(el.querySelectorAll('.card'));
    }, el);
    return () => ctx.revert();
  }, [space.id]);

  const filteredFaqs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter(
      (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
    );
  }, [search]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      pushToast('Add a subject and message before sending');
      return;
    }
    pushToast(`Support note sent (${topic})`);
    setSubject('');
    setMessage('');
  };

  return (
    <div>
      <div className="phead">
        <div>
          <AnimatedTitle text="Help" mark="lime" animKey={`${space.id}-hlp`} />
          <p className="phead__sub">Answers first. If they don&apos;t cover it, write to us.</p>
        </div>
      </div>

      <div ref={gridRef} className="help-grid">
        <section className="card">
          <h2 className="card__title" style={{ marginBottom: 14 }}>
            Questions
          </h2>

          <div className="search-box" style={{ maxWidth: '100%', marginBottom: 10 }}>
            <span className="search-box__icon">
              <IconSearch size={15} />
            </span>
            <input
              className="search-box__input"
              placeholder="Search the help"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filteredFaqs.length === 0 ? (
            <div style={{ padding: '18px 0', color: 'var(--faint)', fontSize: 13.5 }}>
              No answers match &ldquo;{search}&rdquo;. Write to support on the right.
            </div>
          ) : (
            filteredFaqs.map((item) => (
              <details key={item.q} className="faq-item">
                <summary>
                  <span>{item.q}</span>
                  <span className="faq-item__chev">
                    <IconChevronDown size={16} />
                  </span>
                </summary>
                <div className="faq-item__body">{item.a}</div>
              </details>
            ))
          )}
        </section>

        <section className="card">
          <h2 className="card__title" style={{ marginBottom: 16 }}>
            Write to support
          </h2>

          <form className="form-stack" onSubmit={handleSubmit}>
            <label className="field">
              <span className="field__label">Topic</span>
              <select className="select" value={topic} onChange={(e) => setTopic(e.target.value)}>
                {TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Subject</span>
              <input
                className="input"
                placeholder="Short summary"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">What happened?</span>
              <textarea
                className="textarea"
                placeholder="Tell us what you were doing and what you expected..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn--primary">
                Send
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};
