import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCrm } from '../store/CrmContext';
import { ActivityType, DealSource, DealStage, ModalState } from '../types';
import { dur, gsap, isMobileViewport } from '../utils/motion';
import { SlidingSeg } from './Motion';
import {
  addDays,
  formatKrCompact,
  formatKrExact,
  formatNumber,
  OPEN_STAGES,
  quoteSubtotal,
  quoteTotalWithVat,
  quoteVat,
  STAGE_META,
  TODAY_ISO,
} from '../utils/format';
import {
  IconActivityKind,
  IconBuilding,
  IconChevronRight,
  IconClose,
  IconContacts,
  IconPipeline,
  IconPlus,
  IconQuotes,
  IconSearch,
} from './Icons';

const SOURCES: DealSource[] = ['Website', 'Referral', 'Trade show', 'Cold call', 'Partner'];
const TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

export const Modals: React.FC = () => {
  const { modal, closeModal } = useCrm();
  const [rendered, setRendered] = useState<ModalState>(modal);
  const scrimRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (modal) setRendered(modal);
  }, [modal]);

  useLayoutEffect(() => {
    const scrim = scrimRef.current;
    const panel = wrapRef.current?.firstElementChild as HTMLElement | null;
    if (!rendered || !scrim || !panel) return;
    const mobile = isMobileViewport();

    if (modal) {
      gsap.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: dur(0.3), overwrite: true });
      if (mobile) {
        gsap.fromTo(
          panel,
          { yPercent: 100 },
          { yPercent: 0, duration: dur(0.55), ease: 'expo.out', overwrite: true }
        );
      } else {
        gsap.fromTo(
          panel,
          { opacity: 0, y: 14, scale: 0.92 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: dur(0.5),
            ease: 'expo.out',
            overwrite: true,
            clearProps: 'transform',
          }
        );
      }
    } else {
      gsap.to(scrim, { opacity: 0, duration: dur(0.22), overwrite: true });
      if (mobile) {
        gsap.to(panel, {
          yPercent: 100,
          duration: dur(0.3),
          ease: 'power3.in',
          overwrite: true,
          onComplete: () => setRendered(null),
        });
      } else {
        gsap.to(panel, {
          opacity: 0,
          y: -8,
          scale: 0.97,
          duration: dur(0.2),
          ease: 'power2.in',
          overwrite: true,
          onComplete: () => setRendered(null),
        });
      }
    }
  }, [modal, rendered]);

  if (!rendered || typeof document === 'undefined') return null;

  return createPortal(
    <div className="layer layer--modal" role="dialog" aria-modal="true">
      <div ref={scrimRef} className="scrim-bg" onMouseDown={closeModal} />
      <div ref={wrapRef} className="modal-wrap">
        {rendered.kind === 'search' && <SearchModal />}
        {rendered.kind === 'shortcuts' && <ShortcutsModal />}
        {rendered.kind === 'new-deal' && (
          <NewDealModal
            defaultCompanyId={rendered.defaultCompanyId}
            defaultContactId={rendered.defaultContactId}
          />
        )}
        {rendered.kind === 'new-contact' && (
          <NewContactModal defaultCompanyName={rendered.defaultCompanyName} />
        )}
        {rendered.kind === 'new-activity' && (
          <NewActivityModal
            defaultDealId={rendered.defaultDealId}
            defaultContactId={rendered.defaultContactId}
            defaultType={rendered.defaultType}
          />
        )}
        {rendered.kind === 'new-quote' && <NewQuoteModal defaultDealId={rendered.defaultDealId} />}
      </div>
    </div>,
    document.body
  );
};

interface SearchEntry {
  id: string;
  kind: 'deal' | 'contact' | 'company' | 'quote';
  title: string;
  meta: string;
  haystack: string;
  onSelect: () => void;
}

const SearchModal: React.FC = () => {
  const { space, closeModal, navigate, openDrawer } = useCrm();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allEntries = useMemo<SearchEntry[]>(() => {
    const companyMap = new Map(space.companies.map((c) => [c.id, c]));
    const dealMap = new Map(space.deals.map((d) => [d.id, d]));

    const deals: SearchEntry[] = space.deals.map((d) => {
      const comp = companyMap.get(d.companyId)?.name || '';
      return {
        id: `d-${d.id}`,
        kind: 'deal',
        title: d.title,
        meta: `${comp} · ${formatKrCompact(d.value)} · ${STAGE_META[d.stage].label}`,
        haystack: `${d.title} ${comp} ${STAGE_META[d.stage].label} ${d.source}`.toLowerCase(),
        onSelect: () => {
          closeModal();
          navigate('pipeline', 'board');
          openDrawer({ kind: 'deal', id: d.id });
        },
      };
    });

    const contacts: SearchEntry[] = space.contacts.map((c) => {
      const comp = companyMap.get(c.companyId)?.name || '';
      return {
        id: `p-${c.id}`,
        kind: 'contact',
        title: c.name,
        meta: `${c.role} · ${comp} · ${c.status}`,
        haystack: `${c.name} ${c.role} ${comp} ${c.email}`.toLowerCase(),
        onSelect: () => {
          closeModal();
          navigate('contacts', 'people');
          openDrawer({ kind: 'contact', id: c.id });
        },
      };
    });

    const companies: SearchEntry[] = space.companies.map((c) => ({
      id: `c-${c.id}`,
      kind: 'company',
      title: c.name,
      meta: `${c.industry} · ${c.city} · ${c.staff} staff`,
      haystack: `${c.name} ${c.industry} ${c.city}`.toLowerCase(),
      onSelect: () => {
        closeModal();
        navigate('contacts', 'companies', { q: c.name });
      },
    }));

    const quotes: SearchEntry[] = space.quotes.map((q) => {
      const deal = dealMap.get(q.dealId);
      const comp = companyMap.get(q.companyId)?.name || '';
      return {
        id: `q-${q.id}`,
        kind: 'quote',
        title: q.number,
        meta: `${deal?.title || 'Quote'} · ${comp} · ${formatKrCompact(quoteSubtotal(q.lines))}`,
        haystack: `${q.number} ${deal?.title || ''} ${comp} ${q.status}`.toLowerCase(),
        onSelect: () => {
          closeModal();
          navigate('quotes', 'all');
          openDrawer({ kind: 'quote', id: q.id });
        },
      };
    });

    return [...deals, ...contacts, ...companies, ...quotes];
  }, [space, closeModal, navigate, openDrawer]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allEntries.slice(0, 12);
    return allEntries.filter((e) => e.haystack.includes(q)).slice(0, 18);
  }, [allEntries, query]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      e.preventDefault();
      filtered[selectedIdx].onSelect();
    }
  };

  return (
    <div className="modal" onKeyDown={onKeyDown}>
      <div className="modal__head">
        <h2 className="modal__title">Search</h2>
        <button type="button" className="icon-circle" onClick={closeModal} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>

      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--faint)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <IconSearch size={16} />
        </span>
        <input
          ref={inputRef}
          className="input"
          style={{ paddingLeft: 42 }}
          placeholder="Search deals, people, companies, quotes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="search-results">
        {filtered.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--faint)' }}>
            No matching records for &ldquo;{query}&rdquo;.
          </div>
        ) : (
          filtered.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className={`search-row ${idx === selectedIdx ? 'is-selected' : ''}`}
              onMouseEnter={() => setSelectedIdx(idx)}
              onClick={item.onSelect}
            >
              <span style={{ color: 'var(--muted)', display: 'grid', placeItems: 'center' }}>
                {item.kind === 'deal' && <IconPipeline size={17} />}
                {item.kind === 'contact' && <IconContacts size={17} />}
                {item.kind === 'company' && <IconBuilding size={17} />}
                {item.kind === 'quote' && <IconQuotes size={17} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: 'var(--faint)' }}>{item.meta}</div>
              </div>
              <IconChevronRight size={15} />
            </button>
          ))
        )}
      </div>

      <div className="search-modal__foot">
        <span className="kbd">↑</span>
        <span className="kbd">↓</span>
        <span>to move</span>
        <span>·</span>
        <span className="kbd">Enter</span>
        <span>to open</span>
        <span>·</span>
        <span className="kbd">Esc</span>
        <span>to close</span>
        <span>·</span>
        <span>{allEntries.length} records</span>
      </div>
    </div>
  );
};

const ShortcutsModal: React.FC = () => {
  const { closeModal } = useCrm();
  const shortcuts = [
    { label: 'Search everything', keys: ['⌘', 'K'] },
    { label: 'Quick search', keys: ['/'] },
    { label: 'Fold or expand the sidebar', keys: ['⌘', 'B'] },
    { label: 'New deal', keys: ['N'] },
    { label: 'Go to Overview / Pipeline / Contacts', keys: ['G', 'then', 'O / P / C'] },
    { label: 'Go to Activities / Quotes / Team / Reports', keys: ['G', 'then', 'A / Q / T / R'] },
    { label: 'Move focused deal card between stages', keys: ['←', '→'] },
    { label: 'This list', keys: ['?'] },
  ];

  return (
    <div className="modal">
      <div className="modal__head">
        <h2 className="modal__title">Keyboard shortcuts</h2>
        <button type="button" className="icon-circle" onClick={closeModal} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>

      <div className="shortcut-list">
        {shortcuts.map((s) => (
          <div key={s.label} className="shortcut-row">
            <span>{s.label}</span>
            <span className="shortcut-keys">
              {s.keys.map((k, i) =>
                k === 'then' ? (
                  <span key={i} style={{ fontSize: 11.5, color: 'var(--faint)' }}>
                    then
                  </span>
                ) : (
                  <span key={i} className="kbd">
                    {k}
                  </span>
                )
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const NewDealModal: React.FC<{ defaultCompanyId?: string; defaultContactId?: string }> = ({
  defaultCompanyId,
  defaultContactId,
}) => {
  const { space, closeModal, createDeal, openDrawer } = useCrm();
  const [title, setTitle] = useState('');
  const [companyId, setCompanyId] = useState(defaultCompanyId || space.companies[0]?.id || '');
  const [value, setValue] = useState('145000');
  const [stage, setStage] = useState<DealStage>('lead');
  const [closeDate, setCloseDate] = useState(addDays(TODAY_ISO, 28));
  const [ownerId, setOwnerId] = useState(space.reps[0]?.id || '');
  const [source, setSource] = useState<DealSource>('Website');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Enter a deal name.');
      return;
    }
    const companyContact =
      defaultContactId || space.contacts.find((c) => c.companyId === companyId)?.id;
    const created = createDeal({
      title: title.trim(),
      companyId,
      contactId: companyContact,
      ownerId,
      stage,
      value: Math.max(0, Number(value) || 0),
      closeDate,
      source,
      notes: '',
    });
    closeModal();
    openDrawer({ kind: 'deal', id: created.id });
  };

  return (
    <div className="modal">
      <div className="modal__head">
        <h2 className="modal__title">New deal</h2>
        <button type="button" className="icon-circle" onClick={closeModal} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Deal name</span>
          <input
            className="input"
            placeholder="e.g. Roof array expansion"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError('');
            }}
            autoFocus
          />
          {error && <span className="field__error">{error}</span>}
        </label>

        <div className="form-grid">
          <label className="field">
            <span className="field__label">Company</span>
            <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {space.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Value (kr)</span>
            <input
              className="input"
              type="number"
              min="0"
              step="1000"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
        </div>

        <div className="form-grid">
          <label className="field">
            <span className="field__label">Stage</span>
            <select
              className="select"
              value={stage}
              onChange={(e) => setStage(e.target.value as DealStage)}
            >
              {OPEN_STAGES.map((st) => (
                <option key={st} value={st}>
                  {STAGE_META[st].label} ({Math.round(STAGE_META[st].prob * 100)}%)
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Expected close</span>
            <input
              className="input"
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
            />
          </label>
        </div>

        <div className="form-grid">
          <label className="field">
            <span className="field__label">Owner</span>
            <select className="select" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {space.reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Source</span>
            <select
              className="select"
              value={source}
              onChange={(e) => setSource(e.target.value as DealSource)}
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={closeModal}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Create deal
          </button>
        </div>
      </form>
    </div>
  );
};

const NewContactModal: React.FC<{ defaultCompanyName?: string }> = ({ defaultCompanyName }) => {
  const { space, closeModal, createContact, openDrawer } = useCrm();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [companyName, setCompanyName] = useState(defaultCompanyName || '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter a full name.');
      return;
    }
    const created = createContact({ name, role, companyName, email, phone });
    closeModal();
    openDrawer({ kind: 'contact', id: created.id });
  };

  return (
    <div className="modal">
      <div className="modal__head">
        <h2 className="modal__title">New contact</h2>
        <button type="button" className="icon-circle" onClick={closeModal} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Full name</span>
            <input
              className="input"
              placeholder="e.g. Astrid Lindholm"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              autoFocus
            />
            {error && <span className="field__error">{error}</span>}
          </label>

          <label className="field">
            <span className="field__label">Job title</span>
            <input
              className="input"
              placeholder="e.g. Operations manager"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span className="field__label">Company</span>
          <input
            className="input"
            list="sylva-company-list"
            placeholder="Pick existing or type a new company"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          <datalist id="sylva-company-list">
            {space.companies.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          <span className="field__hint">A new name creates the company too.</span>
        </label>

        <div className="form-grid">
          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="input"
              type="email"
              placeholder="name@company.no"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">Phone</span>
            <input
              className="input"
              type="tel"
              placeholder="+47 900 00 000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={closeModal}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Add contact
          </button>
        </div>
      </form>
    </div>
  );
};

const NewActivityModal: React.FC<{
  defaultDealId?: string;
  defaultContactId?: string;
  defaultType?: ActivityType;
}> = ({ defaultDealId, defaultContactId, defaultType }) => {
  const { space, closeModal, createActivity } = useCrm();
  const [type, setType] = useState<ActivityType>(defaultType || 'call');
  const [title, setTitle] = useState('');
  const [dealId, setDealId] = useState(defaultDealId || '');
  const [date, setDate] = useState(TODAY_ISO);
  const [time, setTime] = useState('11:00');
  const [ownerId, setOwnerId] = useState(space.reps[0]?.id || '');
  const [error, setError] = useState('');

  const openDeals = space.deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const companyMap = new Map(space.companies.map((c) => [c.id, c.name]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Describe what you want to do.');
      return;
    }
    createActivity({
      type,
      title: title.trim(),
      dealId: dealId || undefined,
      contactId: defaultContactId,
      ownerId,
      date,
      time,
      durationHours: type === 'meeting' ? 2 : 1,
    });
    closeModal();
  };

  return (
    <div className="modal">
      <div className="modal__head">
        <h2 className="modal__title">Plan activity</h2>
        <button type="button" className="icon-circle" onClick={closeModal} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="field">
          <span className="field__label">Type</span>
          <SlidingSeg<ActivityType>
            ariaLabel="Activity type"
            activeId={type}
            onChange={setType}
            items={(['call', 'meeting', 'email', 'task'] as ActivityType[]).map((t) => ({
              id: t,
              label: t.charAt(0).toUpperCase() + t.slice(1),
              icon: <IconActivityKind type={t} size={13} />,
            }))}
          />
        </div>

        <label className="field">
          <span className="field__label">What</span>
          <input
            className="input"
            placeholder="e.g. Walk through financing proposal"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError('');
            }}
            autoFocus
          />
          {error && <span className="field__error">{error}</span>}
        </label>

        <label className="field">
          <span className="field__label">Deal</span>
          <select className="select" value={dealId} onChange={(e) => setDealId(e.target.value)}>
            <option value="">No deal</option>
            {openDeals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} — {companyMap.get(d.companyId)}
              </option>
            ))}
          </select>
        </label>

        <div className="form-grid">
          <label className="field">
            <span className="field__label">Day</span>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">Time</span>
            <select className="select" value={time} onChange={(e) => setTime(e.target.value)}>
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field__label">Who</span>
          <select className="select" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {space.reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={closeModal}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Plan it
          </button>
        </div>
      </form>
    </div>
  );
};

const NewQuoteModal: React.FC<{ defaultDealId?: string }> = ({ defaultDealId }) => {
  const { space, closeModal, createQuote, openDrawer } = useCrm();
  const openDeals = space.deals.filter((d) => d.stage !== 'lost');
  const [dealId, setDealId] = useState(defaultDealId || openDeals[0]?.id || '');
  const [lines, setLines] = useState([
    { id: 'nql-1', item: 'Panel 430 W', qty: 24, unitPrice: 3290 },
    { id: 'nql-2', item: 'Installation day', qty: 2, unitPrice: 11800 },
  ]);

  const companyMap = new Map(space.companies.map((c) => [c.id, c.name]));
  const sub = quoteSubtotal(lines);
  const vat = quoteVat(lines);
  const total = quoteTotalWithVat(lines);

  const updateLine = (idx: number, patch: Partial<{ item: string; qty: number; unitPrice: number }>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: `nql-${Date.now()}`, item: '', qty: 1, unitPrice: 10000 },
    ]);
  };

  const removeLine = (idx: number) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = lines
      .filter((l) => l.item.trim())
      .map((l) => ({
        item: l.item.trim(),
        qty: Math.max(1, Number(l.qty) || 1),
        unitPrice: Math.max(0, Number(l.unitPrice) || 0),
      }));
    if (!dealId || cleaned.length === 0) return;
    const created = createQuote(dealId, cleaned);
    closeModal();
    openDrawer({ kind: 'quote', id: created.id });
  };

  return (
    <div className="modal" style={{ maxWidth: 620 }}>
      <div className="modal__head">
        <h2 className="modal__title">New quote</h2>
        <button type="button" className="icon-circle" onClick={closeModal} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Deal</span>
          <select className="select" value={dealId} onChange={(e) => setDealId(e.target.value)}>
            {openDeals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} — {companyMap.get(d.companyId)} ({formatKrCompact(d.value)})
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <div className="drawer-section__head" style={{ marginBottom: 4 }}>
            <span className="field__label">Quote lines</span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={addLine}>
              <IconPlus size={13} />
              Add a line
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lines.map((line, idx) => (
              <div
                key={line.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 74px 124px 34px',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <input
                  className="input"
                  placeholder="Item description"
                  value={line.item}
                  onChange={(e) => updateLine(idx, { item: e.target.value })}
                />
                <input
                  className="input"
                  type="number"
                  min="1"
                  aria-label="Qty"
                  value={line.qty}
                  onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })}
                />
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="100"
                  aria-label="Unit price"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) })}
                />
                <button
                  type="button"
                  className="icon-circle"
                  onClick={() => removeLine(idx)}
                  aria-label="Remove line"
                  disabled={lines.length <= 1}
                  style={{ opacity: lines.length <= 1 ? 0.35 : 1 }}
                >
                  <IconClose size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            padding: '14px 16px',
            borderRadius: 16,
            background: 'var(--well)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)' }}>
            <span>Subtotal</span>
            <span>{formatNumber(sub)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)' }}>
            <span>VAT 25%</span>
            <span>{formatNumber(vat)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 16,
              fontWeight: 700,
              paddingTop: 6,
              borderTop: '1px solid var(--line)',
            }}
          >
            <span>Total</span>
            <span>{formatKrExact(total)}</span>
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={closeModal}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Save draft
          </button>
        </div>
      </form>
    </div>
  );
};
