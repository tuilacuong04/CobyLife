import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { GmailInboxItem, TxType } from '../../types';
import { WalletDriftInfo } from '../../utils/financeEngine';
import { formatMoney, parseSmartAmount } from '../../utils/format';
import {
  IconAlert,
  IconCheck,
  IconClose,
  IconMail,
  IconPlus,
  IconRefresh,
  IconRepeat,
  IconSettings,
  IconSparkles,
  IconSplit,
} from '../Icons';

interface Props {
  walletDrifts: Record<string, WalletDriftInfo>;
}

function formatInboxTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);
  const datePart = iso.slice(0, 10);
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return datePart === todayStr ? `Today ${timeStr}` : `${datePart.slice(5)} ${timeStr}`;
}

const GmailReviewCard: React.FC<{
  item: GmailInboxItem;
  drift?: WalletDriftInfo;
}> = ({ item, drift }) => {
  const {
    state,
    openModal,
    updateInboxItem,
    approveInboxItem,
    ignoreInboxItem,
  } = useApp();

  const { currency } = state.settings;
  const [splitOpen, setSplitOpen] = useState(false);
  const [myShareInput, setMyShareInput] = useState(() => String(Math.round(item.amount / 2)));
  const [counterparty, setCounterparty] = useState('');
  const [saveRule, setSaveRule] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const filteredCats = state.finance.categories.filter((c) =>
    item.suggestedType === 'income' ? c.kind === 'income' : c.kind === 'expense'
  );

  const handleToggleTransfer = () => {
    if (item.suggestedType === 'transfer') {
      updateInboxItem(item.id, {
        suggestedType: item.direction === 'in' ? 'income' : 'expense',
      });
    } else {
      const otherWallet = state.finance.wallets.find((w) => w.id !== item.suggestedWalletId);
      updateInboxItem(item.id, {
        suggestedType: 'transfer',
        suggestedToWalletId: item.suggestedToWalletId || otherWallet?.id,
      });
      setSplitOpen(false);
    }
  };

  const handleApprove = () => {
    if (splitOpen && item.suggestedType === 'expense') {
      const parsedShare = parseSmartAmount(myShareInput);
      approveInboxItem(item.id, {
        splitMyShare: Math.min(item.amount, Math.max(0, parsedShare)),
        splitCounterparty: counterparty,
        saveRule,
      });
    } else {
      approveInboxItem(item.id, { saveRule });
    }
  };

  const matchedBill = item.matchedBillId
    ? state.finance.recurringBills.find((b) => b.id === item.matchedBillId)
    : undefined;

  return (
    <div className="gmail-card">
      <div className="gmail-card__top">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <span className="pill pill--sky">{item.bankBadge}</span>
            {item.matchedRuleId && (
              <span className="pill pill--lime" title="Matched by your Auto-Rule">
                <IconSparkles size={11} />
                Auto-Rule
              </span>
            )}
            {matchedBill && (
              <span className="pill pill--sand">Bill: {matchedBill.name}</span>
            )}
            {item.enrichedLedgerTxId && (
              <span className="pill pill--lime">Enriches existing card debit (0 dup)</span>
            )}
            {item.matchedSplitTxId && (
              <span className="pill pill--lime">Matches open split repayment</span>
            )}
            {item.originalCurrency === 'USD' && item.originalAmount && (
              <span className="pill pill--muted">${item.originalAmount.toFixed(2)} USD</span>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)' }}>
            {item.cleanMerchant}
          </div>
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              textAlign: 'left',
              marginTop: 2,
              display: 'block',
            }}
            title="Tap to inspect Gmail snippet"
          >
            {item.cleanMemo} · <span style={{ color: 'var(--faint)' }}>{formatInboxTime(item.receivedAt)}</span>
          </button>
        </div>

        <div
          className="gmail-card__amt"
          style={{
            color:
              item.suggestedType === 'transfer'
                ? 'var(--sky)'
                : item.direction === 'in'
                  ? 'var(--good)'
                  : 'var(--coral)',
          }}
        >
          {item.suggestedType === 'transfer' ? '⇄ ' : item.direction === 'in' ? '+' : '-'}
          {formatMoney(item.amount, currency)}
        </div>
      </div>

      {showRaw && (
        <pre
          style={{
            margin: 0,
            padding: '8px 10px',
            borderRadius: 10,
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            fontSize: 11.5,
            whiteSpace: 'pre-wrap',
            color: 'var(--muted)',
          }}
        >
          From: {item.sender}
          {'\n'}Subject: {item.subject}
          {'\n\n'}
          {item.rawSnippet}
        </pre>
      )}

      {!item.enrichedLedgerTxId && (
        <div className="gmail-card__selectors">
          <select
            className="select"
            style={{ height: 34, width: 'auto', minWidth: 132, padding: '0 10px', fontSize: 12.5 }}
            value={item.suggestedWalletId}
            aria-label="Wallet"
            onChange={(e) => updateInboxItem(item.id, { suggestedWalletId: e.target.value })}
          >
            {state.finance.wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <span style={{ color: 'var(--faint)', fontSize: 12 }}>→</span>

          {item.suggestedType === 'transfer' ? (
            <select
              className="select"
              style={{ height: 34, width: 'auto', minWidth: 140, padding: '0 10px', fontSize: 12.5 }}
              value={item.suggestedToWalletId || ''}
              aria-label="Destination wallet"
              onChange={(e) => updateInboxItem(item.id, { suggestedToWalletId: e.target.value })}
            >
              {state.finance.wallets
                .filter((w) => w.id !== item.suggestedWalletId)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    To: {w.name}
                  </option>
                ))}
            </select>
          ) : (
            <select
              className="select"
              style={{ height: 34, width: 'auto', minWidth: 150, padding: '0 10px', fontSize: 12.5 }}
              value={item.suggestedCategoryId}
              aria-label="Category"
              onChange={(e) => {
                updateInboxItem(item.id, { suggestedCategoryId: e.target.value });
                setSaveRule(true);
              }}
            >
              {filteredCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {typeof item.reportedBalanceAfter === 'number' && !drift && (
            <span style={{ fontSize: 11.5, color: 'var(--faint)', marginLeft: 'auto' }}>
              Email bal: {formatMoney(item.reportedBalanceAfter, currency)}
            </span>
          )}
        </div>
      )}

      {drift && drift.sourceInboxId === item.id && (
        <div className="drift-alert">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconAlert size={14} style={{ color: 'var(--coral)', flexShrink: 0 }} />
            <span>
              Gmail balance: <strong>{formatMoney(drift.reportedBalance, currency)}</strong> · Unlogged gap:{' '}
              <strong style={{ color: 'var(--coral)' }}>
                {drift.drift > 0 ? '+' : ''}
                {formatMoney(drift.drift, currency)}
              </strong>
            </span>
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() =>
              openModal({
                kind: 'reconcile-wallet',
                walletId: drift.walletId,
                targetBalance: drift.reportedBalance,
                inboxItemId: item.id,
              })
            }
          >
            Resolve gap
          </button>
        </div>
      )}

      {splitOpen && item.suggestedType === 'expense' && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              Split bill (only your share counts in Budget)
            </span>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {[
                { label: '50%', val: Math.round(item.amount / 2) },
                { label: '1/3', val: Math.round(item.amount / 3) },
                { label: '1/4', val: Math.round(item.amount / 4) },
                { label: '0 (Fronted)', val: 0 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="chip"
                  style={{ height: 25, fontSize: 11.5 }}
                  onClick={() => setMyShareInput(String(p.val))}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span className="field__label">My share (personal expense)</span>
              <input
                className="input"
                value={myShareInput}
                onChange={(e) => setMyShareInput(e.target.value)}
                placeholder="e.g. 300k"
              />
            </label>
            <label className="field">
              <span className="field__label">Friends / Group note (optional)</span>
              <input
                className="input"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="e.g. Minh, Lan (owed back)"
              />
            </label>
          </div>
        </div>
      )}

      {!item.matchedRuleId && item.cleanMerchant !== 'Transaction' && !item.enrichedLedgerTxId && (
        <label className="signin__check" style={{ fontSize: 12 }}>
          <input
            type="checkbox"
            checked={saveRule}
            onChange={(e) => setSaveRule(e.target.checked)}
          />
          <span>
            Remember rule: always map <strong>{item.cleanMerchant}</strong> to selected category
          </span>
        </label>
      )}

      <div className="gmail-card__actions">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          style={{ flex: 1.2, justifyContent: 'center' }}
          onClick={handleApprove}
        >
          <IconCheck size={14} />
          {item.enrichedLedgerTxId ? 'Merge Receipt' : 'Approve'}
        </button>

        {!item.enrichedLedgerTxId && (
          <button
            type="button"
            className={`btn btn--sm ${item.suggestedType === 'transfer' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={handleToggleTransfer}
            title="Convert between Expense/Income and Wallet Transfer"
          >
            <IconRepeat size={13} />
            Transfer
          </button>
        )}

        {item.direction === 'out' && item.suggestedType !== 'transfer' && !item.enrichedLedgerTxId && (
          <button
            type="button"
            className={`btn btn--sm ${splitOpen ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setSplitOpen((v) => !v)}
            title="Split group bill / track friend reimbursement"
          >
            <IconSplit size={13} />
            Split
          </button>
        )}

        <button
          type="button"
          className="icon-btn"
          style={{ width: 32, height: 32, marginLeft: 'auto' }}
          aria-label="Ignore Gmail alert"
          title="Ignore alert"
          onClick={() => ignoreInboxItem(item.id)}
        >
          <IconClose size={14} />
        </button>
      </div>
    </div>
  );
};

export const GmailInboxView: React.FC<Props> = ({ walletDrifts }) => {
  const {
    state,
    cloudConfig,
    gmailSyncing,
    lastGmailSyncAt,
    openModal,
    syncGmailInbox,
    importRawGmailText,
    loadSampleGmailDemo,
    approveAllMatchedInbox,
  } = useApp();

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteRaw, setPasteRaw] = useState('');

  const pendingItems = state.finance.inbox.filter((it) => it.status === 'pending');
  const isGmailConfigured = Boolean(
    cloudConfig.gmailIngestKey?.trim() || cloudConfig.gmailGasExecUrl?.trim()
  );

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (importRawGmailText(pasteRaw)) {
      setPasteRaw('');
      setPasteOpen(false);
    }
  };

  return (
    <div className="stack-list" style={{ gap: 14 }}>
      {/* Gmail Connection & Batch Toolbar */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 className="card__title">Gmail Transaction Inbox ({pendingItems.length})</h2>
              <span className={`pill ${isGmailConfigured ? 'pill--lime' : 'pill--sand'}`}>
                {isGmailConfigured ? 'Gmail Sync Active' : 'Setup Ready'}
              </span>
            </div>
            <p className="card__sub">
              {lastGmailSyncAt
                ? `Last checked ${new Date(lastGmailSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Auto-deduplicates transfers & merchant receipts`
                : 'Review incoming bank, card, and e-receipt emails in 1 tap before they hit your ledger'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={gmailSyncing}
              onClick={() => void syncGmailInbox({ triggerGas: true })}
            >
              <IconRefresh size={14} />
              {gmailSyncing ? 'Syncing...' : 'Sync Gmail'}
            </button>

            {pendingItems.length > 1 && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={approveAllMatchedInbox}
              >
                <IconCheck size={14} />
                Approve All ({pendingItems.length})
              </button>
            )}

            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setPasteOpen((v) => !v)}
            >
              <IconPlus size={14} />
              Paste Email
            </button>

            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => openModal({ kind: 'manage-rules' })}
            >
              <IconSparkles size={14} />
              Rules ({state.finance.rules.length})
            </button>

            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => openModal({ kind: 'gmail-setup' })}
            >
              <IconSettings size={14} />
              Setup
            </button>
          </div>
        </div>

        {pasteOpen && (
          <form
            onSubmit={handlePasteSubmit}
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid var(--line)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <textarea
              className="textarea"
              rows={3}
              placeholder="Paste any Vietnamese bank email, HTML receipt, or card alert (Timo, ACB, VCB, VIB, TPBank, Grab, MoMo, Visa USD)..."
              value={pasteRaw}
              onChange={(e) => setPasteRaw(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPasteOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary btn--sm" disabled={!pasteRaw.trim()}>
                Parse into Inbox
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Pending Review Cards */}
      {pendingItems.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '34px 18px' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'var(--well)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 12px',
              color: 'var(--accent)',
            }}
          >
            <IconMail size={20} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Inbox Zero</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 440, margin: '0 auto 16px' }}>
            {isGmailConfigured
              ? 'All synced Gmail bank & receipt alerts have been reviewed.'
              : 'Connect your 2-minute Google Apps Script to automatically capture bank & receipt emails 24/7 — or load sample Vietnamese alerts to preview.'}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {!isGmailConfigured && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => openModal({ kind: 'gmail-setup' })}
              >
                <IconMail size={14} />
                Connect Gmail Sync (2 min)
              </button>
            )}
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={loadSampleGmailDemo}
            >
              <IconSparkles size={14} />
              Load 5 Sample VN Bank Emails
            </button>
          </div>
        </div>
      ) : (
        <div className="stack-list" style={{ gap: 10 }}>
          {pendingItems.map((item) => (
            <GmailReviewCard
              key={item.id}
              item={item}
              drift={walletDrifts[item.suggestedWalletId]}
            />
          ))}
        </div>
      )}
    </div>
  );
};
