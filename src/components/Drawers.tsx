import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCrm } from '../store/CrmContext';
import { DealStage, DrawerState } from '../types';
import {
  dealWeightedValue,
  formatKrCompact,
  formatKrExact,
  formatNumber,
  formatRelativeActivityDay,
  formatRelativeTouch,
  formatShortDate,
  quoteSubtotal,
  quoteTotalWithVat,
  quoteVat,
  STAGE_META,
  triggerDownload,
} from '../utils/format';
import {
  animateIconBounce,
  animateStampSlam,
  dur,
  gsap,
  isMobileViewport,
  isReducedMotion,
} from '../utils/motion';
import { ContactAvatar, RepAvatar } from './Avatar';
import { IconCheck, IconClose, IconDownload, IconPlus, IconSend } from './Icons';

const STEPPER_STAGES: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'won'];

export const Drawers: React.FC = () => {
  const { drawer, closeDrawer } = useCrm();
  const [rendered, setRendered] = useState<DrawerState>(drawer);
  const scrimRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (drawer) setRendered(drawer);
  }, [drawer]);

  useLayoutEffect(() => {
    const scrim = scrimRef.current;
    const panel = panelRef.current;
    if (!rendered || !scrim || !panel) return;
    const mobile = isMobileViewport();

    if (drawer) {
      gsap.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: dur(0.3), overwrite: true });
      gsap.fromTo(
        panel,
        mobile ? { yPercent: 100, xPercent: 0 } : { xPercent: 104, yPercent: 0 },
        {
          xPercent: 0,
          yPercent: 0,
          duration: dur(0.6),
          ease: 'expo.out',
          overwrite: true,
        }
      );
      if (!isReducedMotion()) {
        const children = panel.querySelectorAll('.drawer__body > *');
        if (children.length > 0) {
          gsap.fromTo(
            children,
            { opacity: 0, y: 14 },
            {
              opacity: 1,
              y: 0,
              duration: 0.5,
              delay: 0.12,
              stagger: 0.04,
              ease: 'power3.out',
              clearProps: 'transform,opacity',
            }
          );
        }
      }
    } else {
      gsap.to(scrim, { opacity: 0, duration: dur(0.25), overwrite: true });
      gsap.to(panel, {
        ...(mobile ? { yPercent: 100 } : { xPercent: 104 }),
        duration: dur(0.32),
        ease: 'power3.in',
        overwrite: true,
        onComplete: () => setRendered(null),
      });
    }
  }, [drawer, rendered]);

  if (!rendered || typeof document === 'undefined') return null;

  return createPortal(
    <div className="layer layer--drawer" role="dialog" aria-modal="true">
      <div ref={scrimRef} className="scrim-bg" onMouseDown={closeDrawer} />
      <div ref={panelRef} className="drawer">
        {rendered.kind === 'deal' && <DealDrawer dealId={rendered.id} />}
        {rendered.kind === 'contact' && <ContactDrawer contactId={rendered.id} />}
        {rendered.kind === 'quote' && <QuoteDrawer quoteId={rendered.id} />}
      </div>
    </div>,
    document.body
  );
};

const DealDrawer: React.FC<{ dealId: string }> = ({ dealId }) => {
  const {
    space,
    closeDrawer,
    openDrawer,
    openModal,
    moveDealStage,
    updateDeal,
    deleteDeal,
    toggleActivityDone,
  } = useCrm();

  const deal = space.deals.find((d) => d.id === dealId);
  if (!deal) return null;

  const company = space.companies.find((c) => c.id === deal.companyId);
  const contact =
    space.contacts.find((c) => c.id === deal.contactId) ||
    space.contacts.find((c) => c.companyId === deal.companyId);
  const owner = space.reps.find((r) => r.id === deal.ownerId) || space.reps[0];
  const dealActivities = space.activities.filter((a) => a.dealId === deal.id);
  const linkedQuote = space.quotes.find((q) => q.dealId === deal.id);

  const stageIdx = STEPPER_STAGES.indexOf(deal.stage);
  const stageMeta = STAGE_META[deal.stage];

  const pillTone =
    stageMeta.tone === 'lime'
      ? 'pill--lime'
      : stageMeta.tone === 'sky'
        ? 'pill--sky'
        : stageMeta.tone === 'sand'
          ? 'pill--sand'
          : stageMeta.tone === 'coral'
            ? 'pill--coral'
            : 'pill--muted';

  return (
    <>
      <div className="drawer__head">
        <div>
          <h2 className="drawer__title">{deal.title}</h2>
          <p className="drawer__sub">{company?.name}</p>
        </div>
        <button type="button" className="icon-circle" onClick={closeDrawer} aria-label="Close">
          <IconClose size={17} />
        </button>
      </div>

      <div className="drawer__body">
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>
              {formatKrExact(deal.value)}
            </div>
            <span className={`pill ${pillTone}`}>{stageMeta.label}</span>
          </div>

          <div className="stepper" role="group" aria-label="Deal stage">
            {STEPPER_STAGES.map((st, idx) => {
              const passed = deal.stage !== 'lost' && stageIdx >= idx;
              const isWon = deal.stage === 'won';
              return (
                <button
                  key={st}
                  type="button"
                  className={`step-btn ${passed ? 'is-passed' : ''} ${isWon ? 'is-won' : ''} ${
                    deal.stage === st ? 'is-current' : ''
                  }`}
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    moveDealStage(deal.id, st);
                  }}
                >
                  <span className="step-btn__bar" />
                  <span className="step-btn__label">{STAGE_META[st].label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="facts-box">
          <div>
            <div className="fact__label">Close</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="fact__val">{formatShortDate(deal.closeDate)}</span>
              <input
                type="date"
                aria-label="Edit close date"
                value={deal.closeDate}
                onChange={(e) => {
                  if (e.target.value)
                    updateDeal(deal.id, { closeDate: e.target.value }, 'Close date updated');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--faint)',
                  fontSize: 12,
                  width: 112,
                  cursor: 'pointer',
                }}
              />
            </div>
          </div>
          <div>
            <div className="fact__label">Probability</div>
            <div className="fact__val">{Math.round(stageMeta.prob * 100)}%</div>
          </div>
          <div>
            <div className="fact__label">Weighted</div>
            <div className="fact__val">{formatKrCompact(dealWeightedValue(deal))}</div>
          </div>
          <div>
            <div className="fact__label">Source</div>
            <div className="fact__val">{deal.source}</div>
          </div>
        </div>

        <div>
          <div className="drawer-section__head">
            <span className="drawer-section__title">People</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {contact && (
              <button
                type="button"
                className="act-row"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => openDrawer({ kind: 'contact', id: contact.id })}
              >
                <ContactAvatar name={contact.name} tone={contact.tone} size={36} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{contact.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)' }}>
                    {contact.role} · {company?.name}
                  </div>
                </div>
              </button>
            )}
            {owner && (
              <div className="act-row">
                <RepAvatar src={owner.avatar} name={owner.name} size={36} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{owner.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)' }}>Owner · {owner.role}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="drawer-section__head">
            <span className="drawer-section__title">Activities</span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => openModal({ kind: 'new-activity', defaultDealId: deal.id })}
            >
              <IconPlus size={13} />
              Plan
            </button>
          </div>
          {dealActivities.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--faint)' }}>No activities planned yet.</div>
          ) : (
            <div className="act-list">
              {dealActivities.map((act) => (
                <div key={act.id} className={`act-row ${act.done ? 'is-done' : ''}`}>
                  <button
                    type="button"
                    className={`check-btn ${act.done ? 'is-done' : ''}`}
                    onClick={() => toggleActivityDone(act.id)}
                    aria-label={act.done ? 'Mark incomplete' : 'Mark complete'}
                  >
                    <IconCheck size={13} />
                  </button>
                  <div className="act-row__body">
                    <div className="act-row__title">{act.title}</div>
                    <div className="act-row__sub">
                      {formatRelativeActivityDay(act.date)} · {act.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="drawer-section__head">
            <span className="drawer-section__title">Quote</span>
            {!linkedQuote && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => openModal({ kind: 'new-quote', defaultDealId: deal.id })}
              >
                <IconPlus size={13} />
                Create
              </button>
            )}
          </div>
          {linkedQuote ? (
            <button
              type="button"
              className="closing-item"
              style={{ width: '100%' }}
              onClick={() => openDrawer({ kind: 'quote', id: linkedQuote.id })}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{linkedQuote.number}</div>
                <div style={{ fontSize: 12, color: 'var(--faint)' }}>
                  Valid until {formatShortDate(linkedQuote.validUntil)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="pill" style={{ textTransform: 'capitalize' }}>
                  {linkedQuote.status}
                </span>
                <span style={{ fontWeight: 700 }}>
                  {formatKrExact(quoteSubtotal(linkedQuote.lines))}
                </span>
              </div>
            </button>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--faint)' }}>No quote yet.</div>
          )}
        </div>

        <label className="field">
          <span className="drawer-section__title">Notes</span>
          <textarea
            className="textarea"
            placeholder="Add context from calls or site visits..."
            value={deal.notes}
            onChange={(e) => updateDeal(deal.id, { notes: e.target.value })}
          />
        </label>
      </div>

      <div className="drawer__foot">
        <button type="button" className="btn btn--danger btn--sm" onClick={() => deleteDeal(deal.id)}>
          Delete
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {deal.stage !== 'lost' && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => moveDealStage(deal.id, 'lost')}
            >
              Mark lost
            </button>
          )}
          {deal.stage !== 'won' && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => moveDealStage(deal.id, 'won')}
            >
              Mark won
            </button>
          )}
        </div>
      </div>
    </>
  );
};

const ContactDrawer: React.FC<{ contactId: string }> = ({ contactId }) => {
  const { space, closeDrawer, openDrawer, openModal } = useCrm();
  const contact = space.contacts.find((c) => c.id === contactId);
  if (!contact) return null;

  const company = space.companies.find((c) => c.id === contact.companyId);
  const owner = space.reps.find((r) => r.id === contact.ownerId);
  const deals = space.deals.filter(
    (d) => d.contactId === contact.id || d.companyId === contact.companyId
  );
  const dealIds = new Set(deals.map((d) => d.id));
  const recentActs = space.activities
    .filter((a) => a.contactId === contact.id || (a.dealId && dealIds.has(a.dealId)))
    .slice(0, 5);

  return (
    <>
      <div className="drawer__head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <ContactAvatar name={contact.name} tone={contact.tone} size={46} />
          <div>
            <h2 className="drawer__title">{contact.name}</h2>
            <p className="drawer__sub">
              {contact.role} · {company?.name}
            </p>
          </div>
        </div>
        <button type="button" className="icon-circle" onClick={closeDrawer} aria-label="Close">
          <IconClose size={17} />
        </button>
      </div>

      <div className="drawer__body">
        <div className="facts-box">
          <div>
            <div className="fact__label">Email</div>
            <a
              href={`mailto:${contact.email}`}
              className="fact__val"
              style={{ color: 'var(--sky)', fontSize: 13 }}
            >
              {contact.email}
            </a>
          </div>
          <div>
            <div className="fact__label">Phone</div>
            <a href={`tel:${contact.phone}`} className="fact__val" style={{ fontSize: 13.5 }}>
              {contact.phone}
            </a>
          </div>
          <div>
            <div className="fact__label">Owner</div>
            <div className="fact__val">{owner?.name || '—'}</div>
          </div>
          <div>
            <div className="fact__label">Last touch</div>
            <div className="fact__val">{formatRelativeTouch(contact.lastTouch)}</div>
          </div>
        </div>

        <div>
          <div className="drawer-section__head">
            <span className="drawer-section__title">Deals ({deals.length})</span>
          </div>
          {deals.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--faint)' }}>No deals yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {deals.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="closing-item"
                  style={{ width: '100%' }}
                  onClick={() => openDrawer({ kind: 'deal', id: d.id })}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{d.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--faint)' }}>
                      {STAGE_META[d.stage].label} · closes {formatShortDate(d.closeDate)}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700 }}>{formatKrCompact(d.value)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="drawer-section__head">
            <span className="drawer-section__title">Recent activity</span>
          </div>
          {recentActs.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--faint)' }}>No logged activity yet.</div>
          ) : (
            <div className="act-list">
              {recentActs.map((a) => (
                <div key={a.id} className="act-row">
                  <div className="act-row__body">
                    <div className="act-row__title">{a.title}</div>
                    <div className="act-row__sub">
                      {formatRelativeActivityDay(a.date)} · {a.time} · {a.type}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="drawer__foot">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() =>
            openModal({
              kind: 'new-activity',
              defaultContactId: contact.id,
              defaultDealId: deals[0]?.id,
              defaultType: 'call',
            })
          }
        >
          Plan a call
        </button>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() =>
            openModal({
              kind: 'new-deal',
              defaultCompanyId: contact.companyId,
              defaultContactId: contact.id,
            })
          }
        >
          New deal
        </button>
      </div>
    </>
  );
};

const QuoteDrawer: React.FC<{ quoteId: string }> = ({ quoteId }) => {
  const { space, closeDrawer, openDrawer, updateQuoteStatus, pushToast } = useCrm();
  const quote = space.quotes.find((q) => q.id === quoteId);
  const stampRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (quote?.status === 'accepted') {
      animateStampSlam(stampRef.current);
    }
  }, [quote?.status]);

  if (!quote) return null;

  const deal = space.deals.find((d) => d.id === quote.dealId);
  const company = space.companies.find((c) => c.id === quote.companyId);
  const subtotal = quoteSubtotal(quote.lines);
  const vat = quoteVat(quote.lines);
  const total = quoteTotalWithVat(quote.lines);

  const statusTone =
    quote.status === 'accepted'
      ? 'pill--lime'
      : quote.status === 'sent'
        ? 'pill--sky'
        : quote.status === 'declined'
          ? 'pill--coral'
          : 'pill--muted';

  const handleDownload = () => {
    const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Quote ${quote.number}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;color:#13171a;padding:0 24px}
table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}
.r{text-align:right}.tot{font-size:20px;font-weight:700}</style></head>
<body>
<h1>${space.name} — Quote ${quote.number}</h1>
<p><strong>Client:</strong> ${company?.name || ''} · <strong>Deal:</strong> ${deal?.title || ''}</p>
<p><strong>Issued:</strong> ${formatShortDate(quote.issuedDate)} · <strong>Valid until:</strong> ${formatShortDate(quote.validUntil)} · <strong>Status:</strong> ${quote.status.toUpperCase()}</p>
<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead>
<tbody>${quote.lines
      .map(
        (l) =>
          `<tr><td>${l.item}</td><td class="r">${l.qty}</td><td class="r">${formatNumber(l.unitPrice)}</td><td class="r">${formatNumber(l.qty * l.unitPrice)}</td></tr>`
      )
      .join('')}</tbody></table>
<p class="r">Subtotal: ${formatNumber(subtotal)} kr</p>
<p class="r">VAT 25%: ${formatNumber(vat)} kr</p>
<p class="r tot">Total: ${formatKrExact(total)}</p>
</body></html>`;
    triggerDownload(`${quote.number}.html`, html, 'text/html;charset=utf-8');
    pushToast(`Downloaded ${quote.number}`);
  };

  return (
    <>
      <div className="drawer__head">
        <div>
          <h2 className="drawer__title">Quote {quote.number}</h2>
          <p className="drawer__sub">{deal?.title}</p>
        </div>
        <button type="button" className="icon-circle" onClick={closeDrawer} aria-label="Close">
          <IconClose size={17} />
        </button>
      </div>

      <div className="drawer__body">
        <div className="facts-box" style={{ position: 'relative' }}>
          <div>
            <div className="fact__label">Company</div>
            <div className="fact__val">{company?.name}</div>
          </div>
          <div>
            <div className="fact__label">Status</div>
            <span className={`pill ${statusTone}`} style={{ textTransform: 'capitalize' }}>
              {quote.status}
            </span>
          </div>
          <div>
            <div className="fact__label">Issued</div>
            <div className="fact__val">{formatShortDate(quote.issuedDate)}</div>
          </div>
          <div>
            <div className="fact__label">Valid</div>
            <div className="fact__val">{formatShortDate(quote.validUntil)}</div>
          </div>
          {quote.status === 'accepted' && (
            <div style={{ position: 'absolute', right: 16, bottom: 14 }}>
              <span ref={stampRef} className="quote-stamp">
                ACCEPTED
              </span>
            </div>
          )}
        </div>

        <table className="data-table" style={{ fontSize: 13.5 }}>
          <thead>
            <tr>
              <th style={{ paddingLeft: 0 }}>Item</th>
              <th className="is-right">Qty</th>
              <th className="is-right">Price</th>
              <th className="is-right" style={{ paddingRight: 0 }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((l) => (
              <tr key={l.id} style={{ cursor: 'default' }}>
                <td data-label="Item" style={{ paddingLeft: 0, fontWeight: 600 }}>
                  {l.item}
                </td>
                <td data-label="Qty" className="is-right">
                  {l.qty}
                </td>
                <td data-label="Price" className="is-right">
                  {formatNumber(l.unitPrice)}
                </td>
                <td
                  data-label="Amount"
                  className="is-right"
                  style={{ paddingRight: 0, fontWeight: 600 }}
                >
                  {formatNumber(l.qty * l.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
            <span>Subtotal</span>
            <span>{formatNumber(subtotal)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: 'var(--muted)',
              paddingBottom: 10,
              borderBottom: '1px solid var(--line)',
            }}
          >
            <span>VAT 25%</span>
            <span>{formatNumber(vat)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            <span>Total</span>
            <span>{formatKrExact(total)}</span>
          </div>
        </div>
      </div>

      <div className="drawer__foot" style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleDownload}>
            <IconDownload size={14} />
            Download
          </button>
          {deal && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => openDrawer({ kind: 'deal', id: deal.id })}
            >
              Open deal
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {quote.status === 'draft' && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => updateQuoteStatus(quote.id, 'sent')}
            >
              <IconSend size={13} />
              Send
            </button>
          )}
          {quote.status === 'sent' && (
            <>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => updateQuoteStatus(quote.id, 'declined')}
              >
                Declined
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={(e) =>
                  updateQuoteStatus(quote.id, 'accepted', e.currentTarget.getBoundingClientRect())
                }
              >
                <IconCheck size={13} />
                Accepted
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};
