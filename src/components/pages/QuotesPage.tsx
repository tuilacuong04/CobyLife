import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCrm } from '../../store/CrmContext';
import { formatKrCompact, formatKrExact, formatShortDate, quoteSubtotal } from '../../utils/format';
import { animateCards, animateRows, gsap, isReducedMotion } from '../../utils/motion';
import { AnimatedTitle, MagneticButton, SlidingTabs, SwapView } from '../Motion';
import { IconCheck, IconPlus, IconSearch, IconSend } from '../Icons';

export const QuotesPage: React.FC = () => {
  const { space, route, navigate, openDrawer, openModal, updateQuoteStatus } = useCrm();
  const activeTab = (route.sub === 'open' ? 'open' : 'all') as 'all' | 'open';
  const [tabDir, setTabDir] = useState(1);
  const [search, setSearch] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || isReducedMotion()) return;
    const ctx = gsap.context(() => {
      animateCards(el.querySelectorAll('.card'));
      animateRows(el.querySelectorAll('.quote-row'), { stagger: 0.03, delay: 0.2 });
    }, el);
    return () => ctx.revert();
  }, [activeTab, space.id]);

  const dealMap = useMemo(() => new Map(space.deals.map((d) => [d.id, d])), [space.deals]);
  const companyMap = useMemo(
    () => new Map(space.companies.map((c) => [c.id, c.name])),
    [space.companies]
  );

  const awaitingList = space.quotes.filter((q) => q.status === 'sent');
  const acceptedTotal = space.quotes
    .filter((q) => q.status === 'accepted')
    .reduce((s, q) => s + quoteSubtotal(q.lines), 0);

  const visibleQuotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return space.quotes.filter((qt) => {
      if (activeTab === 'open' && qt.status !== 'sent') return false;
      if (q) {
        const dealName = (dealMap.get(qt.dealId)?.title || '').toLowerCase();
        const compName = (companyMap.get(qt.companyId) || '').toLowerCase();
        if (
          !qt.number.toLowerCase().includes(q) &&
          !dealName.includes(q) &&
          !compName.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [space.quotes, activeTab, search, dealMap, companyMap]);

  return (
    <div>
      <div className="phead">
        <div>
          <AnimatedTitle text="Quotes" mark="lime" animKey={`${space.id}-qt`} />
          <p className="phead__sub">
            {formatKrCompact(acceptedTotal)} accepted · {awaitingList.length} awaiting a reply
          </p>
        </div>

        <div className="phead__actions">
          <MagneticButton
            type="button"
            className="btn btn--primary"
            onClick={() => openModal({ kind: 'new-quote' })}
          >
            <IconPlus size={16} />
            <span>New quote</span>
          </MagneticButton>
        </div>
      </div>

      <SlidingTabs
        activeId={activeTab}
        onChange={(id) => {
          setTabDir(id === 'open' ? 1 : -1);
          navigate('quotes', id);
        }}
        items={[
          { id: 'all', label: 'All quotes', count: space.quotes.length },
          { id: 'open', label: 'Awaiting reply', count: awaitingList.length },
        ]}
      />

      <div className="filter-bar">
        <div className="search-box">
          <span className="search-box__icon">
            <IconSearch size={15} />
          </span>
          <input
            className="search-box__input"
            placeholder="Number, deal or company"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div ref={contentRef}>
        <SwapView swapKey={activeTab} direction={tabDir}>
          <div className="card table-card">
            {visibleQuotes.length === 0 ? (
              <div style={{ padding: 28, color: 'var(--faint)', textAlign: 'center' }}>
                No quotes match your filter.
              </div>
            ) : (
              visibleQuotes.map((qt) => {
                const deal = dealMap.get(qt.dealId);
                const comp = companyMap.get(qt.companyId);
                const sub = quoteSubtotal(qt.lines);
                const tone =
                  qt.status === 'accepted'
                    ? 'pill--lime'
                    : qt.status === 'sent'
                      ? 'pill--sky'
                      : qt.status === 'declined'
                        ? 'pill--coral'
                        : 'pill--muted';

                return (
                  <div
                    key={qt.id}
                    className="quote-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => openDrawer({ kind: 'quote', id: qt.id })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDrawer({ kind: 'quote', id: qt.id });
                      }
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{qt.number}</div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {deal?.title || 'Deal quote'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--faint)' }}>{comp}</div>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      <div>Issued {formatShortDate(qt.issuedDate)}</div>
                      <div style={{ color: 'var(--faint)' }}>
                        Valid until {formatShortDate(qt.validUntil)}
                      </div>
                    </div>

                    <div>
                      <span className={`pill ${tone}`} style={{ textTransform: 'capitalize' }}>
                        {qt.status}
                      </span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 14, textAlign: 'right' }}>
                      {formatKrExact(sub)}
                    </div>

                    <div
                      style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {qt.status === 'draft' && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => updateQuoteStatus(qt.id, 'sent')}
                        >
                          <IconSend size={13} />
                          Send
                        </button>
                      )}
                      {qt.status === 'sent' && (
                        <>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => updateQuoteStatus(qt.id, 'declined')}
                          >
                            Declined
                          </button>
                          <button
                            type="button"
                            className="btn btn--primary btn--sm"
                            onClick={(e) =>
                              updateQuoteStatus(
                                qt.id,
                                'accepted',
                                e.currentTarget.getBoundingClientRect()
                              )
                            }
                          >
                            <IconCheck size={13} />
                            Accepted
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SwapView>
      </div>
    </div>
  );
};
