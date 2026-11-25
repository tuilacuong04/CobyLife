import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { AccentTone, CurrencyCode, TxType } from '../../types';
import {
  encodeCloudConfigCode,
  generateGoogleAppsScriptCode,
  generateRandomSecret,
  isCloudConfigValid,
  registerSupabaseIngestKey,
  SUPABASE_SETUP_SQL,
} from '../../utils/cloudDb';
import { VN_BANK_GMAIL_GUIDE } from '../../utils/financeEngine';
import { formatMoney, localIsoDate, parseSmartAmount } from '../../utils/format';
import { AnimatedModal } from '../Motion';
import {
  IconCheck,
  IconClose,
  IconCopy,
  IconMail,
  IconPlus,
  IconRefresh,
  IconSparkles,
  IconSplit,
  IconTrash,
} from '../Icons';

/* ========================== 1. Zero-Keyboard Mobile Quick-Log Modal ========================== */

export const QuickLogModal: React.FC<{
  defaultWalletId?: string;
  onClose: () => void;
}> = ({ defaultWalletId, onClose }) => {
  const { state, createTransaction, pushToast } = useApp();
  const { currency } = state.settings;

  const cashDefault =
    defaultWalletId ||
    state.finance.wallets.find((w) => w.kind === 'cash')?.id ||
    state.finance.wallets[0]?.id ||
    '';

  const expenseCats = state.finance.categories.filter((c) => c.kind === 'expense');
  const incomeCats = state.finance.categories.filter((c) => c.kind === 'income');

  const [type, setType] = useState<TxType>('expense');
  const [digits, setDigits] = useState('');
  const [walletId, setWalletId] = useState(cashDefault);
  const [toWalletId, setToWalletId] = useState(
    () => state.finance.wallets.find((w) => w.id !== cashDefault)?.id || ''
  );
  const [categoryId, setCategoryId] = useState(() => expenseCats[0]?.id || '');
  const [note, setNote] = useState('');
  const [splitMode, setSplitMode] = useState(false);
  const [myShareRaw, setMyShareRaw] = useState('');

  const amount = Number(digits || '0') || 0;

  const tapKey = (key: string) => {
    if (key === 'DEL') {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    if (key === 'CLR') {
      setDigits('');
      return;
    }
    if (key === '000') {
      if (!digits || digits === '0') return;
      if (digits.length <= 9) setDigits((d) => `${d}000`);
      return;
    }
    if (digits.length >= 11) return;
    setDigits((d) => (d === '0' ? key : `${d}${key}`));
  };

  const handleQuickPreset = (preset: { label: string; amount: number; categoryId: string }) => {
    createTransaction({
      type: 'expense',
      amount: preset.amount,
      categoryId: preset.categoryId,
      walletId: walletId || cashDefault,
      date: localIsoDate(),
      note: preset.label,
      source: 'quick-log',
    });
    onClose();
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      pushToast('Tap an amount or preset chip first');
      return;
    }
    const parsedShare = splitMode ? parseSmartAmount(myShareRaw) : amount;
    const split =
      type === 'expense' && splitMode && parsedShare >= 0 && parsedShare < amount
        ? {
            myShare: parsedShare,
            reimbursable: amount - parsedShare,
            repaidAmount: 0,
            status: 'open' as const,
          }
        : undefined;

    createTransaction({
      type,
      amount,
      categoryId,
      walletId,
      toWalletId: type === 'transfer' ? toWalletId : undefined,
      date: localIsoDate(),
      note: note.trim() || (type === 'transfer' ? 'Wallet transfer' : ''),
      source: 'quick-log',
      split,
    });
    onClose();
  };

  const activeCats = type === 'income' ? incomeCats : expenseCats;

  return (
    <AnimatedModal open onClose={onClose} label="Quick log transaction">
      <div className="modal__head">
        <h2 className="modal__title">Quick Log (Cash &amp; Instant QR)</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>

      <form className="modal__body form-stack" onSubmit={handleSave} style={{ gap: 12 }}>
        {/* 1-Tap Instant Cash Presets */}
        <div>
          <div className="field__label" style={{ marginBottom: 6 }}>
            1-Tap Instant Log (uses selected wallet)
          </div>
          <div className="preset-strip">
            {(state.finance.quickPresets || []).map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip"
                style={{ flexShrink: 0, height: 30, fontSize: 12.5 }}
                onClick={() => handleQuickPreset(p)}
              >
                {p.label} · {formatMoney(p.amount, currency)}
              </button>
            ))}
          </div>
        </div>

        {/* Type Switch */}
        <div className="seg" style={{ width: '100%' }}>
          {(['expense', 'income', 'transfer'] as TxType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`seg__btn ${type === t ? 'is-active' : ''}`}
              style={{ flex: 1, textTransform: 'capitalize' }}
              onClick={() => {
                setType(t);
                const nextList = t === 'income' ? incomeCats : expenseCats;
                if (nextList[0]) setCategoryId(nextList[0].id);
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Big Numeric Readout */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 16,
            background: 'var(--well)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>Amount</span>
          <span
            style={{
              fontSize: 24,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              color: amount > 0 ? 'var(--text)' : 'var(--faint)',
            }}
          >
            {type === 'expense' ? '-' : type === 'income' ? '+' : '⇄ '}
            {formatMoney(amount, currency)}
          </span>
        </div>

        {/* Wallet & Category Compact Selectors */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <select
            className="select"
            value={walletId}
            aria-label="Wallet"
            onChange={(e) => setWalletId(e.target.value)}
          >
            {state.finance.wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          {type === 'transfer' ? (
            <select
              className="select"
              value={toWalletId}
              aria-label="Destination wallet"
              onChange={(e) => setToWalletId(e.target.value)}
            >
              {state.finance.wallets
                .filter((w) => w.id !== walletId)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    To: {w.name}
                  </option>
                ))}
            </select>
          ) : (
            <select
              className="select"
              value={categoryId}
              aria-label="Category"
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {activeCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Zero-Zoom Custom 000 Keypad */}
        <div className="kpad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'DEL'].map((k) => (
            <button
              key={k}
              type="button"
              className="kpad__key"
              onClick={() => tapKey(k)}
            >
              {k === 'DEL' ? '⌫' : k}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Optional note (e.g., Street pho, Parking)..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {type === 'expense' && (
            <button
              type="button"
              className={`btn btn--sm ${splitMode ? 'btn--primary' : 'btn--ghost'}`}
              style={{ height: 40 }}
              onClick={() => {
                setSplitMode((v) => !v);
                if (!myShareRaw && amount > 0) setMyShareRaw(String(Math.round(amount / 2)));
              }}
            >
              <IconSplit size={14} />
              Split
            </button>
          )}
        </div>

        {splitMode && type === 'expense' && (
          <label className="field">
            <span className="field__label">My personal share (rest tracked as Reimbursable)</span>
            <input
              className="input"
              placeholder="e.g. 150k"
              value={myShareRaw}
              onChange={(e) => setMyShareRaw(e.target.value)}
            />
          </label>
        )}

        <div className="modal__foot" style={{ paddingTop: 4 }}>
          <button type="button" className="btn btn--ghost" onClick={() => tapKey('CLR')}>
            Clear
          </button>
          <button type="submit" className="btn btn--primary" style={{ flex: 1, justifyContent: 'center' }}>
            <IconCheck size={15} />
            Save {amount > 0 ? formatMoney(amount, currency) : ''}
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
};

/* ========================== 2. Gmail Sync Setup & Bank Guide Modal ========================== */

export const GmailSetupModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    cloudConfig,
    navigate,
    updateCloudConfigPatch,
    syncGmailInbox,
    pushToast,
  } = useApp();

  const [tab, setTab] = useState<'setup' | 'banks'>('setup');
  const [ingestKey, setIngestKey] = useState(
    () => cloudConfig.gmailIngestKey || generateRandomSecret('coby_ing')
  );
  const [triggerSecret, setTriggerSecret] = useState(
    () => cloudConfig.gmailTriggerSecret || generateRandomSecret('coby_trg')
  );
  const [gasExecUrl, setGasExecUrl] = useState(() => cloudConfig.gmailGasExecUrl || '');
  const [busyKey, setBusyKey] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isSupaReady = cloudConfig.provider === 'supabase' && isCloudConfigValid(cloudConfig);

  const previewConfig = {
    ...cloudConfig,
    gmailIngestKey: ingestKey,
    gmailTriggerSecret: triggerSecret,
    gmailGasExecUrl: gasExecUrl,
  };

  const handleSaveAndRegisterKeys = async () => {
    updateCloudConfigPatch({
      gmailIngestKey: ingestKey.trim(),
      gmailTriggerSecret: triggerSecret.trim(),
      gmailGasExecUrl: gasExecUrl.trim(),
    });

    if (isSupaReady) {
      setBusyKey(true);
      const res = await registerSupabaseIngestKey(previewConfig, ingestKey.trim());
      setBusyKey(false);
      if (!res.ok) {
        setStatusMsg({
          ok: false,
          text: res.error || 'Run the updated Supabase SQL first so coby_finance_inbox exists.',
        });
        return;
      }
      setStatusMsg({
        ok: true,
        text: 'Write-only Ingest Key saved to Supabase! Now copy the Google Apps Script below.',
      });
    } else {
      setStatusMsg({
        ok: true,
        text: 'Saved local Apps Script credentials (Direct Web-App mode active; connect Supabase anytime for 24/7 background queue).',
      });
    }
  };

  const handleCopyScript = async () => {
    updateCloudConfigPatch({
      gmailIngestKey: ingestKey.trim(),
      gmailTriggerSecret: triggerSecret.trim(),
      gmailGasExecUrl: gasExecUrl.trim(),
    });
    try {
      await navigator.clipboard.writeText(generateGoogleAppsScriptCode(previewConfig));
      pushToast('Copied pre-filled Google Apps Script (Code.gs) to clipboard!');
    } catch {
      pushToast('Could not copy automatically');
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
      pushToast('Copied updated Supabase SQL (with coby_finance_inbox)!');
    } catch {
      pushToast('Could not copy SQL');
    }
  };

  const handleCopyPairingCode = async () => {
    updateCloudConfigPatch({
      gmailIngestKey: ingestKey.trim(),
      gmailTriggerSecret: triggerSecret.trim(),
      gmailGasExecUrl: gasExecUrl.trim(),
    });
    try {
      await navigator.clipboard.writeText(encodeCloudConfigCode(previewConfig));
      pushToast('Copied COBYDB: code (includes Supabase + Mobile Sync Gmail button)!');
    } catch {
      pushToast('Could not copy pairing code');
    }
  };

  return (
    <AnimatedModal open onClose={onClose} size="lg" label="Gmail auto-sync setup">
      <div className="modal__head">
        <div>
          <h2 className="modal__title">Gmail Auto-Sync (Mobile Web + 24/7 Cron)</h2>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            Zero OAuth popups · Runs inside your own Google account · Write-only Inbox key
          </div>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>

      <div className="modal__body form-stack" style={{ maxHeight: '76dvh', overflowY: 'auto' }}>
        <div className="seg" style={{ width: '100%' }}>
          <button
            type="button"
            className={`seg__btn ${tab === 'setup' ? 'is-active' : ''}`}
            style={{ flex: 1 }}
            onClick={() => setTab('setup')}
          >
            2-Minute Setup
          </button>
          <button
            type="button"
            className={`seg__btn ${tab === 'banks' ? 'is-active' : ''}`}
            style={{ flex: 1 }}
            onClick={() => setTab('banks')}
          >
            VN Bank Email Guide (13 Banks)
          </button>
        </div>

        {tab === 'setup' ? (
          <div className="stack-list" style={{ gap: 12 }}>
            {/* Step 1: Supabase SQL + Write-only Ingest Key */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                background: 'var(--well)',
                border: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                    Step 1 — Activate Write-Only Inbox Queue
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {isSupaReady
                      ? 'Supabase connected! Copy & run the updated SQL once, then click Activate Key.'
                      : 'Recommended: Connect Supabase in Settings → Cloud DB for 24/7 background queuing (or use Direct Web App URL in Step 3).'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {isSupaReady ? (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => void handleCopySql()}>
                      <IconCopy size={13} />
                      Copy SQL
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => {
                        onClose();
                        navigate('settings', 'database');
                      }}
                    >
                      Open Cloud DB
                    </button>
                  )}
                </div>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span className="field__label">Write-Only Ingest Key (for Apps Script)</span>
                  <input
                    className="input"
                    value={ingestKey}
                    onChange={(e) => setIngestKey(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Mobile Trigger Secret</span>
                  <input
                    className="input"
                    value={triggerSecret}
                    onChange={(e) => setTriggerSecret(e.target.value)}
                  />
                </label>
              </div>

              <div>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={busyKey}
                  onClick={() => void handleSaveAndRegisterKeys()}
                >
                  <IconCheck size={14} />
                  {busyKey ? 'Registering...' : isSupaReady ? 'Save & Activate Key in Supabase' : 'Save Local Keys'}
                </button>
              </div>
            </div>

            {/* Step 2: Copy Pre-filled Google Apps Script */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                background: 'var(--well)',
                border: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                Step 2 — Paste Pre-Filled Script at script.google.com
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                1. Tap <strong>Copy Apps Script</strong> below (already pre-filled with your keys).
                <br />
                2. Open <code>script.google.com</code> → <strong>New project</strong> → paste into <code>Code.gs</code>.
                <br />
                3. Select <code>installCobySync</code> and click <strong>Run</strong> once — Gmail will now sync automatically every 5 minutes 24/7!
              </div>
              <div>
                <button type="button" className="btn btn--primary btn--sm" onClick={() => void handleCopyScript()}>
                  <IconCopy size={14} />
                  Copy Pre-Filled Apps Script (Code.gs)
                </button>
              </div>
            </div>

            {/* Step 3: Optional Web App URL for Instant Mobile Safari/Chrome Button */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                background: 'var(--well)',
                border: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                Step 3 (Optional) — Instant &ldquo;Sync Gmail&rdquo; Button on Mobile Web
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                In Apps Script, click <strong>Deploy → New deployment → Web app</strong> (Execute as: <em>Me</em>, Access: <em>Anyone</em>) and paste the <code>/exec</code> URL here so tapping <strong>Sync Gmail</strong> on Mobile Safari/Chrome pulls new emails in 2 seconds:
              </div>
              <input
                className="input"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={gasExecUrl}
                onChange={(e) => setGasExecUrl(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => {
                    updateCloudConfigPatch({
                      gmailIngestKey: ingestKey.trim(),
                      gmailTriggerSecret: triggerSecret.trim(),
                      gmailGasExecUrl: gasExecUrl.trim(),
                    });
                    void syncGmailInbox({ triggerGas: true });
                  }}
                >
                  <IconRefresh size={14} />
                  Save &amp; Test Sync Now
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => void handleCopyPairingCode()}
                >
                  <IconCopy size={14} />
                  Copy Phone Pairing Code (COBYDB:)
                </button>
              </div>
            </div>

            {statusMsg && (
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: statusMsg.ok ? 'var(--good)' : 'var(--coral)',
                }}
              >
                {statusMsg.text}
              </div>
            )}
          </div>
        ) : (
          <div className="stack-list" style={{ gap: 10 }}>
            {VN_BANK_GMAIL_GUIDE.map((b) => (
              <div
                key={b.name}
                style={{
                  padding: '11px 14px',
                  borderRadius: 14,
                  background: 'var(--well)',
                  border: '1px solid var(--line)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 13.5 }}>{b.name}</strong>
                  <span className={`pill pill--${b.tone}`}>{b.tier}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text)', marginTop: 4 }}>{b.coverage}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                  <strong>How to enable:</strong> {b.howToEnable}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="modal__foot">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
};

/* ========================== 3. Wallet Balance Reconcile / Count Cash Modal ========================== */

export const ReconcileWalletModal: React.FC<{
  walletId: string;
  targetBalance?: number;
  onClose: () => void;
}> = ({ walletId, targetBalance, onClose }) => {
  const { state, walletBalances, reconcileWalletBalance } = useApp();
  const { currency } = state.settings;
  const wallet = state.finance.wallets.find((w) => w.id === walletId);
  const currentBal = walletBalances[walletId] ?? 0;

  const [actualRaw, setActualRaw] = useState(() =>
    targetBalance !== undefined ? String(targetBalance) : String(currentBal)
  );
  const [mode, setMode] = useState<'expense' | 'transfer' | 'silent'>('expense');
  const [categoryId, setCategoryId] = useState(
    () => state.finance.categories.find((c) => c.kind === 'expense')?.id || 'cat-other-exp'
  );
  const [toWalletId, setToWalletId] = useState(
    () => state.finance.wallets.find((w) => w.id !== walletId && w.kind === 'cash')?.id ||
      state.finance.wallets.find((w) => w.id !== walletId)?.id ||
      ''
  );
  const [note, setNote] = useState('');

  if (!wallet) return null;

  const parsedTarget = actualRaw.trim() === '0' ? 0 : parseSmartAmount(actualRaw);
  const diff = Math.round(parsedTarget - currentBal);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    reconcileWalletBalance({
      walletId,
      targetBalance: parsedTarget,
      mode: diff > 0 && mode === 'expense' ? 'income' : mode,
      categoryId,
      toWalletId: mode === 'transfer' ? toWalletId : undefined,
      note,
    });
    onClose();
  };

  return (
    <AnimatedModal open onClose={onClose} label="Reconcile wallet balance">
      <div className="modal__head">
        <h2 className="modal__title">
          {wallet.kind === 'cash' ? `Count Cash · ${wallet.name}` : `Reconcile · ${wallet.name}`}
        </h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>

      <form className="modal__body form-stack" onSubmit={handleSubmit}>
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 14,
            background: 'var(--well)',
            border: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 13,
          }}
        >
          <span style={{ color: 'var(--muted)' }}>Current app balance:</span>
          <strong>{formatMoney(currentBal, currency)}</strong>
        </div>

        <label className="field">
          <span className="field__label">
            Actual real-world / bank balance{' '}
            {diff !== 0 && (
              <strong style={{ color: diff < 0 ? 'var(--coral)' : 'var(--good)', marginLeft: 6 }}>
                ({diff > 0 ? '+' : ''}
                {formatMoney(diff, currency)} gap)
              </strong>
            )}
          </span>
          <input
            className="input"
            value={actualRaw}
            onChange={(e) => setActualRaw(e.target.value)}
            placeholder="e.g. 8.2m, 450k, 0"
          />
        </label>

        {diff !== 0 && (
          <>
            <div className="field">
              <span className="field__label">How should Coby LIFE resolve this difference?</span>
              <div className="seg" style={{ width: '100%' }}>
                <button
                  type="button"
                  className={`seg__btn ${mode === 'expense' ? 'is-active' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setMode('expense')}
                >
                  {diff < 0 ? 'Log Expense' : 'Log Income'}
                </button>
                {diff < 0 && state.finance.wallets.length > 1 && (
                  <button
                    type="button"
                    className={`seg__btn ${mode === 'transfer' ? 'is-active' : ''}`}
                    style={{ flex: 1 }}
                    onClick={() => setMode('transfer')}
                  >
                    Transfer
                  </button>
                )}
                <button
                  type="button"
                  className={`seg__btn ${mode === 'silent' ? 'is-active' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setMode('silent')}
                >
                  Silent Sync
                </button>
              </div>
            </div>

            {mode === 'expense' && diff < 0 && (
              <label className="field">
                <span className="field__label">Category for unlogged spend</span>
                <select
                  className="select"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {state.finance.categories
                    .filter((c) => c.kind === 'expense')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            )}

            {mode === 'transfer' && diff < 0 && (
              <label className="field">
                <span className="field__label">Moved to wallet (e.g. ATM Cash / MoMo)</span>
                <select
                  className="select"
                  value={toWalletId}
                  onChange={(e) => setToWalletId(e.target.value)}
                >
                  {state.finance.wallets
                    .filter((w) => w.id !== walletId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </label>
            )}

            <label className="field">
              <span className="field__label">Note (optional)</span>
              <input
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., Pocket cash coffee & parking"
              />
            </label>
          </>
        )}

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Reconcile Balance
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
};

/* ========================== 4. Custom Categories CRUD Modal ========================== */

export const ManageCategoriesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { state, createCategory, deleteCategory } = useApp();
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [name, setName] = useState('');
  const [tone, setTone] = useState<AccentTone>('coral');

  const list = state.finance.categories.filter((c) => c.kind === kind);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    const badge = clean
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    createCategory({ name: clean, kind, tone, badge: badge || 'CT' });
    setName('');
  };

  return (
    <AnimatedModal open onClose={onClose} label="Manage finance categories">
      <div className="modal__head">
        <h2 className="modal__title">Categories</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>

      <div className="modal__body form-stack">
        <div className="seg" style={{ width: '100%' }}>
          <button
            type="button"
            className={`seg__btn ${kind === 'expense' ? 'is-active' : ''}`}
            style={{ flex: 1 }}
            onClick={() => setKind('expense')}
          >
            Expense ({state.finance.categories.filter((c) => c.kind === 'expense').length})
          </button>
          <button
            type="button"
            className={`seg__btn ${kind === 'income' ? 'is-active' : ''}`}
            style={{ flex: 1 }}
            onClick={() => setKind('income')}
          >
            Income ({state.finance.categories.filter((c) => c.kind === 'income').length})
          </button>
        </div>

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 160 }}
            placeholder="New category name (e.g., Gifts, Family, Pets)..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="select"
            style={{ width: 100 }}
            value={tone}
            onChange={(e) => setTone(e.target.value as AccentTone)}
          >
            <option value="coral">Coral</option>
            <option value="lime">Lime</option>
            <option value="sky">Sky</option>
            <option value="sand">Sand</option>
          </select>
          <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
            <IconPlus size={14} />
            Add
          </button>
        </form>

        <div className="stack-list" style={{ maxHeight: 280, overflowY: 'auto' }}>
          {list.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: 12,
                background: 'var(--well)',
                border: '1px solid var(--line)',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                <span className={`stage-dot stage-dot--${c.tone}`} />
                {c.name}
              </span>
              {list.length > 1 && (
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 28, height: 28 }}
                  onClick={() => deleteCategory(c.id)}
                  aria-label={`Delete ${c.name}`}
                >
                  <IconTrash size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
};

/* ========================== 5. Auto-Rules Engine Modal ========================== */

export const ManageRulesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { state, saveAutoRule, deleteAutoRule } = useApp();
  const [pattern, setPattern] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [categoryId, setCategoryId] = useState(
    () => state.finance.categories.find((c) => c.kind === 'expense')?.id || ''
  );

  const catMap = new Map(state.finance.categories.map((c) => [c.id, c.name]));

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim()) return;
    saveAutoRule({
      pattern: pattern.trim().toUpperCase(),
      categoryId,
      renameMerchantTo: renameTo.trim() || undefined,
    });
    setPattern('');
    setRenameTo('');
  };

  return (
    <AnimatedModal open onClose={onClose} size="lg" label="Gmail auto-categorization rules">
      <div className="modal__head">
        <div>
          <h2 className="modal__title">Auto-Categorization Rules</h2>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Automatically clean cryptic VietQR / Gmail descriptions and assign categories
          </div>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>

      <div className="modal__body form-stack">
        <form onSubmit={handleAdd} className="form-grid" style={{ alignItems: 'end' }}>
          <label className="field">
            <span className="field__label">If Gmail memo/merchant contains</span>
            <input
              className="input"
              placeholder="e.g. NGUYEN THI HOA or KATINAT"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Clean display name (optional)</span>
            <input
              className="input"
              placeholder="e.g. Pho Hoa Pasteur"
              value={renameTo}
              onChange={(e) => setRenameTo(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Assign category</span>
            <select
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {state.finance.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.kind})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn--primary" disabled={!pattern.trim()}>
            <IconSparkles size={14} />
            Save Rule
          </button>
        </form>

        <div className="stack-list" style={{ maxHeight: 280, overflowY: 'auto' }}>
          {state.finance.rules.map((r) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '9px 12px',
                borderRadius: 12,
                background: 'var(--well)',
                border: '1px solid var(--line)',
                fontSize: 13,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <code>{r.pattern}</code>
                {r.renameMerchantTo && <span> → <strong>{r.renameMerchantTo}</strong></span>}
                <span style={{ color: 'var(--muted)' }}>
                  {' '}
                  · {catMap.get(r.categoryId) || 'Category'}
                </span>
              </div>
              <button
                type="button"
                className="icon-btn"
                style={{ width: 28, height: 28 }}
                onClick={() => deleteAutoRule(r.id)}
                aria-label="Delete rule"
              >
                <IconTrash size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
};

/* ========================== 6. Recurring Bill / Subscription Modal ========================== */

export const RecurringBillModal: React.FC<{
  editBillId?: string;
  onClose: () => void;
}> = ({ editBillId, onClose }) => {
  const { state, saveRecurringBill } = useApp();
  const existing = editBillId
    ? state.finance.recurringBills.find((b) => b.id === editBillId)
    : undefined;

  const [name, setName] = useState(existing?.name || '');
  const [amountRaw, setAmountRaw] = useState(existing ? String(existing.amount) : '');
  const [billCurrency, setBillCurrency] = useState<CurrencyCode>(existing?.currency || 'VND');
  const [cadence, setCadence] = useState<'monthly' | 'yearly'>(existing?.cadence || 'monthly');
  const [dueDay, setDueDay] = useState(String(existing?.dueDay || 5));
  const [walletId, setWalletId] = useState(
    existing?.walletId || state.finance.wallets[0]?.id || ''
  );
  const [categoryId, setCategoryId] = useState(
    existing?.categoryId ||
      state.finance.categories.find((c) => c.id === 'cat-home')?.id ||
      state.finance.categories[0]?.id ||
      ''
  );
  const [merchantPattern, setMerchantPattern] = useState(existing?.merchantPattern || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const amt =
      billCurrency === 'USD'
        ? parseFloat(amountRaw.replace(/[^0-9.]/g, '')) || 0
        : parseSmartAmount(amountRaw);
    if (amt <= 0) return;

    saveRecurringBill({
      id: existing?.id,
      name: name.trim(),
      amount: amt,
      currency: billCurrency,
      cadence,
      dueDay: Math.min(28, Math.max(1, parseInt(dueDay, 10) || 1)),
      walletId,
      categoryId,
      merchantPattern: merchantPattern.trim().toUpperCase() || undefined,
      lastPaidCycleKey: existing?.lastPaidCycleKey,
      active: true,
    });
    onClose();
  };

  return (
    <AnimatedModal open onClose={onClose} label="Recurring bill or subscription">
      <div className="modal__head">
        <h2 className="modal__title">
          {existing ? 'Edit Recurring Bill' : 'Add Recurring Bill / Subscription'}
        </h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>

      <form className="modal__body form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Subscription / Bill name</span>
          <input
            className="input"
            placeholder="e.g. Apartment Rent, Cursor Pro, Spotify, iCloud+"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="form-grid">
          <label className="field">
            <span className="field__label">Amount ({billCurrency === 'USD' ? 'e.g. 20' : 'e.g. 260k, 3.8m'})</span>
            <input
              className="input"
              placeholder={billCurrency === 'USD' ? '20' : '260k'}
              value={amountRaw}
              onChange={(e) => setAmountRaw(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Currency</span>
            <select
              className="select"
              value={billCurrency}
              onChange={(e) => setBillCurrency(e.target.value as CurrencyCode)}
            >
              <option value="VND">VND (₫)</option>
              <option value="USD">USD ($)</option>
            </select>
          </label>
        </div>

        <div className="form-grid">
          <label className="field">
            <span className="field__label">Billing frequency</span>
            <select
              className="select"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as 'monthly' | 'yearly')}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Due day of month (1–28)</span>
            <input
              type="number"
              min={1}
              max={28}
              className="input"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
            />
          </label>
        </div>

        <div className="form-grid">
          <label className="field">
            <span className="field__label">Wallet</span>
            <select
              className="select"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
            >
              {state.finance.wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Category</span>
            <select
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {state.finance.categories
                .filter((c) => c.kind === 'expense')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field__label">Gmail auto-match keyword (optional)</span>
          <input
            className="input"
            placeholder="e.g. CURSOR, SPOTIFY, APPLE, FPT"
            value={merchantPattern}
            onChange={(e) => setMerchantPattern(e.target.value)}
          />
        </label>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Save Bill
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
};
