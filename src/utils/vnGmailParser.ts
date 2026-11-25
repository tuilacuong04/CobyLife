import { CurrencyCode, GmailEventRole } from '../types';

export interface RawGmailPayloadItem {
  message_id: string;
  gmail_id?: string;
  sender: string;
  subject: string;
  received_at: string;
  snippet: string;
  parsed?: {
    amount?: number;
    currency?: string;
    direction?: string;
    bankDomain?: string;
    accountLast4?: string;
    description?: string;
  };
}

export interface ParsedGmailAlert {
  messageId: string;
  gmailId?: string;
  receivedAt: string;
  sender: string;
  subject: string;
  bankCode: string;
  bankBadge: string;
  eventRole: GmailEventRole;
  direction: 'in' | 'out';
  amount: number;
  currency: CurrencyCode;
  originalAmount?: number;
  originalCurrency?: CurrencyCode;
  reportedBalanceAfter?: number;
  isCreditCard: boolean;
  accountLast4?: string;
  paymentMethodHint?: string;
  rawSnippet: string;
  cleanMerchant: string;
  cleanMemo: string;
}

/**
 * Linearizes HTML table emails (VCB, ACB, BIDV, TPBank, Grab, Apple) into clean key-value lines
 * and normalizes decomposed Vietnamese Unicode (NFD -> NFC).
 */
export function linearizeEmailBody(raw: string): string {
  if (!raw) return '';
  let text = raw.normalize('NFC');

  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = text
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(head|style|script|noscript|svg|title)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<(br|hr)\b[^>]*\/?>/gi, '\n')
      .replace(/<\/t[dh]>\s*(?=<t[dh]\b)/gi, ' | ')
      .replace(/<\/t[dh]>/gi, ' ')
      .replace(/<\/(tr|p|div|li|ul|ol|table|section|article|header|footer|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#8363;/g, '₫')
      .replace(/&#39;|&apos;/gi, "'");
  }

  return text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').replace(/^(\|\s*)+|(\s*\|)+$/g, '').trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !/không trả lời email này|do not reply to this email|đây là email tự động|unsubscribe/i.test(line)
    )
    .join('\n');
}

/**
 * Rejects OTP, login alerts, and marketing newsletters early.
 */
export function isNoiseOrOtpText(subject: string, body: string): boolean {
  const combined = `${subject}\n${body}`.normalize('NFC');
  if (
    /\b(OTP|Smart\s*OTP|Digital\s*OTP|mã\s*xác\s*thực|ma\s*xac\s*thuc|verification\s*code|one-time\s*password|cảnh\s*báo\s*đăng\s*nhập)\b/i.test(
      combined
    )
  ) {
    return true;
  }
  // Shopee/Lazada COD order placed (not yet delivered/paid) -> skip until delivered
  if (
    /\b(xác\s*nhận\s*đơn\s*hàng|order\s*confirmation)\b/i.test(subject) &&
    /\b(thanh\s*toán\s*khi\s*nhận\s*hàng|COD)\b/i.test(combined) &&
    !/\b(giao\s*hàng\s*thành\s*công|đã\s*giao|delivered)\b/i.test(combined)
  ) {
    return true;
  }
  return false;
}

/**
 * Bulletproof Vietnamese VND vs USD amount parser:
 * - VND ("200,000 VND", "200.000 đ", "200,000.00 VND", "₫ 145,000") -> integer VND
 * - USD ("$20.00", "19.99 USD") -> float USD
 */
export function parseMoneyNumber(numStr: string, currency: CurrencyCode): number {
  const clean = numStr.trim().replace(/\s+/g, '');
  if (!clean) return 0;

  if (currency === 'USD') {
    const normalized = clean.replace(/,(?=\d{3}\b)/g, '').replace(',', '.');
    const v = parseFloat(normalized);
    return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
  }

  // VND has zero minor subunits in retail banking
  let vnd = clean;
  if (/^\d{1,3}([.,]\d{3})+[.,]\d{2}$/.test(vnd)) {
    vnd = vnd.slice(0, -3);
  }
  const digits = vnd.replace(/[.,]/g, '').replace(/[^\d]/g, '');
  const val = parseInt(digits, 10);
  return Number.isFinite(val) ? val : 0;
}

function detectBankAndRole(sender: string, text: string): {
  bankCode: string;
  label: string;
  role: GmailEventRole;
} {
  const s = sender.toLowerCase();
  const t = text;

  if (s.includes('grab.com') || /\bGrab\s*E-Receipt|Biên nhận điện tử Grab\b/i.test(t)) {
    return { bankCode: 'GRAB', label: 'Grab', role: 'merchant_receipt' };
  }
  if (s.includes('xanhsm') || s.includes('gsm-einvoice') || /\bXanh\s*SM\b/i.test(t)) {
    return { bankCode: 'XANHSM', label: 'Xanh SM', role: 'merchant_receipt' };
  }
  if (s.includes('be.com.vn') || /\bchuyến đi Be\b/i.test(t)) {
    return { bankCode: 'BE', label: 'Be', role: 'merchant_receipt' };
  }
  if (s.includes('apple.com') || /\breceipt from Apple|Hóa đơn của bạn từ Apple\b/i.test(t)) {
    return { bankCode: 'APPLE', label: 'Apple', role: 'merchant_receipt' };
  }
  if (s.includes('google.com') && /\bGoogle Play\b/i.test(t)) {
    return { bankCode: 'GPLAY', label: 'Google Play', role: 'merchant_receipt' };
  }
  if (s.includes('shopee.vn') && !s.includes('shopeepay')) {
    return { bankCode: 'SHOPEE', label: 'Shopee', role: 'merchant_receipt' };
  }
  if (s.includes('lazada')) {
    return { bankCode: 'LAZADA', label: 'Lazada', role: 'merchant_receipt' };
  }
  if (s.includes('openai.com') || s.includes('stripe.com') || s.includes('netflix.com') || s.includes('spotify.com')) {
    return { bankCode: 'SAAS', label: 'SaaS Receipt', role: 'merchant_receipt' };
  }

  if (s.includes('timo.vn') || /\bTimo\b|\bSpend Account\b/i.test(t)) {
    return { bankCode: 'TIMO', label: 'Timo', role: 'ledger' };
  }
  if (s.includes('acb.com.vn') || /\bACB\b|\bACB ONE\b/i.test(t)) {
    return { bankCode: 'ACB', label: 'ACB', role: 'ledger' };
  }
  if (s.includes('sacombank') || /\bSacombank\b/i.test(t)) {
    return { bankCode: 'STB', label: 'Sacombank', role: 'ledger' };
  }
  if (s.includes('hsbc') || /\bHSBC\b/i.test(t)) {
    return { bankCode: 'HSBC', label: 'HSBC', role: 'ledger' };
  }
  if (s.includes('vietcombank') || /\bVietcombank|\bVCB\b|\bVCBDigibank\b/i.test(t)) {
    return { bankCode: 'VCB', label: 'VCB', role: 'ledger' };
  }
  if (s.includes('tpb.com.vn') || /\bTPBank\b/i.test(t)) {
    return { bankCode: 'TPB', label: 'TPBank', role: 'ledger' };
  }
  if (s.includes('vib.com.vn') || /\bVIB\b|\bMyVIB\b/i.test(t)) {
    return { bankCode: 'VIB', label: 'VIB', role: 'ledger' };
  }
  if (s.includes('cake.vn') || /\bCake by VPBank|\bThẻ Cake\b/i.test(t)) {
    return { bankCode: 'CAKE', label: 'Cake', role: 'ledger' };
  }
  if (s.includes('vpbank') || s.includes('vpb.com.vn') || /\bVPBank|\bVPB\b/i.test(t)) {
    return { bankCode: 'VPB', label: 'VPBank', role: 'ledger' };
  }
  if (s.includes('bidv.com.vn') || /\bBIDV\b/i.test(t)) {
    return { bankCode: 'BIDV', label: 'BIDV', role: 'ledger' };
  }
  if (s.includes('uobgroup') || /\bUOB\b|\bUniAlerts\b/i.test(t)) {
    return { bankCode: 'UOB', label: 'UOB', role: 'ledger' };
  }
  if (s.includes('shinhan') || /\bShinhan\b/i.test(t)) {
    return { bankCode: 'SHINHAN', label: 'Shinhan', role: 'ledger' };
  }
  if (s.includes('techcombank') || /\bTechcombank|\bTCB\b/i.test(t)) {
    return { bankCode: 'TCB', label: 'TCB', role: 'ledger' };
  }
  if (s.includes('mbbank') || /\bMBBank|\bMB Bank\b/i.test(t)) {
    return { bankCode: 'MB', label: 'MB Bank', role: 'ledger' };
  }
  if (s.includes('momo.vn') || (/\bVí MoMo\b/i.test(t) && !/NAP\s*(?:TIEN\s*)?VI\s*MOMO/i.test(t))) {
    return { bankCode: 'MOMO', label: 'MoMo', role: 'ledger' };
  }
  if (s.includes('zalopay') || /\bZaloPay\b/i.test(t)) {
    return { bankCode: 'ZALOPAY', label: 'ZaloPay', role: 'ledger' };
  }
  if (s.includes('shopeepay')) {
    return { bankCode: 'SHOPEEPAY', label: 'ShopeePay', role: 'ledger' };
  }
  if (s.includes('vnpay')) {
    return { bankCode: 'VNPAY', label: 'VNPAY', role: 'merchant_receipt' };
  }

  return { bankCode: 'BANK', label: 'Bank Alert', role: 'ledger' };
}

function cleanVietnameseBankMemo(raw: string): { cleanMerchant: string; cleanMemo: string } {
  const cleaned = raw
    .replace(/^(?:MBVCB|IBVCB|VCB|FT|NAPAS)\.[0-9A-Z.]+\./i, '')
    .replace(/\b(?:MBVCB|IBVCB)\.\d+\.\d+\.?/gi, '')
    .replace(/\bFT\d{8,}\b/g, '')
    .replace(/\bMa\s*GD\s*[:=]?\s*[A-Z0-9]+\b/gi, '')
    .replace(/\bMã\s*(?:giao\s*dịch|đơn\s*hàng|hóa\s*đơn)\s*[:=]?\s*[A-Z0-9-]+\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Derive a clean human merchant / payee label
  let merchant = cleaned;
  const knownBrands: Array<[RegExp, string]> = [
    [/highlands\s*coffee|highlands/i, 'Highlands Coffee'],
    [/phuc\s*long|phúc\s*long/i, 'Phuc Long'],
    [/katinat/i, 'Katinat'],
    [/starbucks/i, 'Starbucks'],
    [/grab\s*food|grabfood/i, 'GrabFood'],
    [/\bgrab\b/i, 'Grab'],
    [/xanh\s*sm/i, 'Xanh SM'],
    [/\bbe\b.*(?:chuyến|food|bike|car)/i, 'Be'],
    [/circle\s*k/i, 'Circle K'],
    [/bach\s*hoa\s*xanh|bách\s*hóa\s*xanh/i, 'Bach Hoa Xanh'],
    [/winmart/i, 'WinMart'],
    [/shopee\s*food/i, 'ShopeeFood'],
    [/\bshopee\b/i, 'Shopee'],
    [/\blazada\b/i, 'Lazada'],
    [/apple\.com\/bill|\bapple\b/i, 'Apple Services'],
    [/google\s*play|\bgoogle\*/i, 'Google Play'],
    [/cursor/i, 'Cursor AI'],
    [/openai|chatgpt/i, 'OpenAI ChatGPT'],
    [/anthropic|claude/i, 'Claude AI'],
    [/spotify/i, 'Spotify'],
    [/netflix/i, 'Netflix'],
    [/evn|tiền\s*điện|hoa\s*don\s*dien/i, 'EVN Electricity'],
    [/fpt\s*telecom|viettel|vnpt/i, 'Internet & Telecom'],
    [/nap\s*(?:tien\s*)?vi\s*momo/i, 'Top-up MoMo'],
    [/nap\s*(?:tien\s*)?vi\s*zalopay/i, 'Top-up ZaloPay'],
    [/nap\s*(?:tien\s*)?vi\s*shopeepay/i, 'Top-up ShopeePay'],
    [/luong|salary/i, 'Salary Payout'],
  ];

  for (const [rx, brand] of knownBrands) {
    if (rx.test(cleaned)) {
      merchant = brand;
      break;
    }
  }

  if (merchant === cleaned && merchant.length > 34) {
    merchant = merchant.slice(0, 32).trim() + '…';
  }

  return {
    cleanMerchant: merchant || 'Transaction',
    cleanMemo: cleaned || 'Gmail financial notification',
  };
}

/**
 * Parses either a structured RawGmailPayloadItem (from Google Apps Script / Supabase)
 * OR a raw pasted email/SMS string into a normalized ParsedGmailAlert.
 */
export function parseVietnameseGmailAlert(
  input: RawGmailPayloadItem | string,
  usdVndRate = 25500
): ParsedGmailAlert | null {
  const isRawString = typeof input === 'string';
  const rawSubject = isRawString ? '' : input.subject || '';
  const rawSender = isRawString ? 'manual-paste@gmail.com' : input.sender || '';
  const rawBody = isRawString ? input : input.snippet || '';
  const receivedAt = isRawString
    ? new Date().toISOString()
    : input.received_at || new Date().toISOString();

  const linear = linearizeEmailBody(rawBody);
  const subject = rawSubject.normalize('NFC').trim();
  if (isNoiseOrOtpText(subject, linear)) return null;

  const combined = `${subject}\n${linear}`;
  const { bankCode, label, role: baseRole } = detectBankAndRole(rawSender, combined);

  const isCreditCard =
    /\b(thẻ\s*tín\s*dụng|credit\s*card|hạn\s*mức\s*khả\s*dụng|han\s*muc\s*con\s*lai|visa\s*\d{4}|mastercard|unialerts.*card|card\s*ending\s*in)\b/i.test(
      combined
    );

  // Extract amount + currency
  let currency: CurrencyCode = 'VND';
  let rawAmount = 0;
  let explicitSign: '+' | '-' | '' = '';

  const usdLabeled =
    combined.match(/(?:amount\s*paid|total|số\s*tiền|giao\s*dịch)[^\n\d$+-]{0,24}([+-])?\s*\$\s*(\d+(?:[.,]\d{1,2})?)/i) ||
    combined.match(/([+-])?\s*(\d+(?:[.,]\d{1,2})?)\s*USD\b/i) ||
    combined.match(/\$\s*(\d+\.\d{2})\b/);

  const vndLabeled =
    combined.match(
      /(?:số\s*tiền(?:\s*trích\s*nợ|\s*giao\s*dịch)?|debit\s*amount|total\s*paid|tổng\s*(?:cộng|tiền(?:\s*thanh\s*toán)?)|amount|vừa\s*(?:tăng|giảm)|thanh\s*toán|nhận\s*(?:được\s*)?tiền|PS|GD)[^\n\d+-]{0,28}([+-])?\s*(?:₫|VND\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{4,12})\s*(?:VND|VNĐ|₫|đ|d)?/i
    ) ||
    combined.match(/([+-])\s*(\d{1,3}(?:[.,]\d{3})+|\d{4,12})\s*(?:VND|VNĐ|₫|đ)\b/i) ||
    combined.match(/₫\s*(\d{1,3}(?:[.,]\d{3})+|\d{4,12})\b/i);

  if (usdLabeled) {
    currency = 'USD';
    if (usdLabeled[1] === '+' || usdLabeled[1] === '-') {
      explicitSign = usdLabeled[1];
    }
    rawAmount = parseMoneyNumber(usdLabeled[2] || usdLabeled[1], 'USD');
  } else if (vndLabeled) {
    currency = 'VND';
    if (vndLabeled[1] === '+' || vndLabeled[1] === '-') {
      explicitSign = vndLabeled[1];
    }
    rawAmount = parseMoneyNumber(vndLabeled[2], 'VND');
  } else if (!isRawString && input.parsed?.amount && input.parsed.amount > 0) {
    currency = input.parsed.currency === 'USD' ? 'USD' : 'VND';
    rawAmount = input.parsed.amount;
  }

  if (!rawAmount || rawAmount <= 0) return null;

  // Determine direction ('in' vs 'out')
  let direction: 'in' | 'out' = 'out';
  if (explicitSign === '+') {
    direction = 'in';
  } else if (explicitSign === '-') {
    direction = 'out';
  } else if (
    /\b(vừa\s*tăng|ghi\s*có|nhận\s*tiền|nhận\s*được|hoàn\s*tiền|refund|credited|cộng\s*tiền)\b/i.test(
      combined
    ) &&
    !/\b(trích\s*nợ|ghi\s*nợ|vừa\s*giảm|biên\s*lai\s*chuyển\s*tiền|thanh\s*toán\s*thành\s*công)\b/i.test(
      combined
    )
  ) {
    direction = 'in';
  } else if (!isRawString && input.parsed?.direction === 'income') {
    direction = 'in';
  }

  // Extract account / card last 4 digits
  const accMatch =
    combined.match(
      /(?:tài\s*khoản(?:\s*nguồn|\s*trích\s*nợ|\s*thanh\s*toán)?|spend\s*account|số\s*tk|tk|thẻ[^\n\d]{0,16}|card\s*ending\s*in|visa|mastercard)[^\n\d]{0,14}(?:[\d*x•.\s]{2,16})?(\d{4})\b/i
    ) || (!isRawString && input.parsed?.accountLast4 ? [null, input.parsed.accountLast4] : null);
  const accountLast4 = accMatch?.[1] || undefined;

  // Extract reported deposit balance after (STRICTLY skip credit card available limit!)
  let reportedBalanceAfter: number | undefined;
  if (!isCreditCard && baseRole !== 'merchant_receipt') {
    const balMatch = combined.match(
      /(?:số\s*dư(?:\s*hiện\s*tại|\s*khả\s*dụng|\s*cuối|\s*ví)?|available\s*balance|\bSD\b)\s*[:=|]?\s*(?:VND\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{4,12})\s*(?:VND|VNĐ|₫|đ)?/i
    );
    if (balMatch) {
      const parsedBal = parseMoneyNumber(balMatch[1], 'VND');
      if (parsedBal >= 0) reportedBalanceAfter = parsedBal;
    }
  }

  // Extract payment method hint on merchant receipts (Grab, Be, Apple, Shopee)
  let paymentMethodHint: string | undefined;
  const pmMatch = combined.match(
    /(?:paid\s*by|phương\s*thức\s*thanh\s*toán|thanh\s*toán\s*bằng|hình\s*thức\s*thanh\s*toán|nguồn\s*tiền)\s*[:|]?\s*([^\n|]{2,45})/i
  );
  if (pmMatch) {
    paymentMethodHint = pmMatch[1].trim();
  }

  // Extract memo / merchant description
  let rawMemo = '';
  const kvMemoMatch =
    combined.match(
      /(?:nội\s*dung(?:\s*chuyển\s*tiền|\s*giao\s*dịch)?|details\s*of\s*payment|mô\s*tả|diễn\s*giải|lời\s*nhắn|tại\s*\/\s*merchant|merchant|dịch\s*vụ|\bND\b|\bRef\b)\s*[:|]?\s*([^\n]{2,160})/i
    ) ||
    combined.match(
      /(?:giao\s*dịch|thanh\s*toán|chi\s*tiêu)[^\n]{0,40}?\btại\s+([^\n.]{2,80})/i
    );
  if (kvMemoMatch) {
    rawMemo = kvMemoMatch[1].trim();
  } else if (baseRole === 'merchant_receipt') {
    const itemLines = linear
      .split('\n')
      .filter((l) => /\b\d+x\b|chuyến|trip|subscription|plan|gói/i.test(l))
      .slice(0, 2);
    rawMemo = itemLines.length > 0 ? `${label}: ${itemLines.join(', ')}` : subject || label;
  } else {
    rawMemo = (!isRawString && input.parsed?.description) || subject || linear.split('\n')[0] || label;
  }

  const { cleanMerchant, cleanMemo } = cleanVietnameseBankMemo(rawMemo);

  // Detect internal wallet top-up / credit card bill payment
  const isPassThrough =
    /\b(nap\s*(?:tien\s*)?(?:vi\s*)?(momo|zalopay|shopeepay|vnpay)|topup\s*(momo|zalopay)|thanh\s*toan\s*(?:du\s*no|sao\s*ke)\s*the|rut\s*tien\s*(?:mat\s*)?atm)\b/i.test(
      combined
    );

  const eventRole: GmailEventRole = isPassThrough ? 'transfer_hint' : baseRole;
  const bankBadge = accountLast4 ? `${label} *${accountLast4}` : label;

  let normalizedAmount = rawAmount;
  let originalAmount: number | undefined;
  let originalCurrency: CurrencyCode | undefined;

  if (currency === 'USD') {
    originalAmount = rawAmount;
    originalCurrency = 'USD';
    // Convert to VND integer for unified VND ledger while keeping exact USD original metadata
    normalizedAmount = Math.round(rawAmount * usdVndRate);
    currency = 'VND';
  }

  const msgId = isRawString
    ? `paste-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    : input.message_id || `gmail-${Date.now().toString(36)}`;

  return {
    messageId: msgId,
    gmailId: isRawString ? undefined : input.gmail_id,
    receivedAt,
    sender: rawSender,
    subject: subject || `${label} notification`,
    bankCode,
    bankBadge,
    eventRole,
    direction,
    amount: normalizedAmount,
    currency,
    originalAmount,
    originalCurrency,
    reportedBalanceAfter,
    isCreditCard,
    accountLast4,
    paymentMethodHint,
    rawSnippet: linear.slice(0, 520),
    cleanMerchant: baseRole === 'merchant_receipt' && cleanMerchant === 'Transaction' ? label : cleanMerchant,
    cleanMemo,
  };
}

/**
 * Realistic Vietnamese Gmail notification batch so users can test the full
 * Gmail Inbox workflow (Auto-Rules, Self-Transfer pairing, Grab Receipt enrichment,
 * Balance-After Drift Catcher, and USD SaaS conversion) immediately on Mobile Web!
 */
export function createSampleGmailDemoPayloads(): RawGmailPayloadItem[] {
  const now = Date.now();
  const isoAt = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();

  return [
    {
      message_id: 'demo-timo-coffee-01',
      sender: 'support@timo.vn',
      subject: 'Timo - Thông báo biến động số dư Spend Account',
      received_at: isoAt(18),
      snippet:
        'Tài khoản Spend Account **9012 của bạn vừa giảm 55.000 VND vào hôm nay. Số dư hiện tại: 16.925.000 VND. Mô tả: HIGHLANDS COFFEE NGUYEN HUE.',
    },
    {
      message_id: 'demo-vcb-momo-topup-02',
      sender: 'VCBDigibank@info.vietcombank.com.vn',
      subject: 'Biên lai chuyển tiền qua tài khoản',
      received_at: isoAt(45),
      snippet:
        '<table><tr><td>Tài khoản nguồn</td><td>1029389012</td></tr><tr><td>Số tiền trích nợ</td><td>500,000 VND</td></tr><tr><td>Nội dung chuyển tiền</td><td>MBVCB.8829102.NAP TIEN VI MOMO 0909123456</td></tr></table>',
    },
    {
      message_id: 'demo-vib-card-cursor-03',
      sender: 'info@card.vib.com.vn',
      subject: 'Thông báo giao dịch thẻ VIB',
      received_at: isoAt(120),
      snippet:
        'Thẻ Tín Dụng Quốc Tế VIB 5128 **** **** 4410 vừa giao dịch 20.00 USD tại CURSOR AI IDE. Hạn mức khả dụng còn lại: 42,500,000 VND.',
    },
    {
      message_id: 'demo-grab-cash-04',
      sender: 'no-reply@grab.com',
      subject: 'Your Grab E-Receipt',
      received_at: isoAt(190),
      snippet:
        '<table><tr><td>Booking ID</td><td>A-78291044</td></tr><tr><td>Total Paid</td><td>₫ 145,000</td></tr><tr><td>Paid by</td><td>Cash</td></tr><tr><td>1x Cơm tấm sườn bì chả + Trà tắc</td><td>₫ 145,000</td></tr></table>',
    },
    {
      message_id: 'demo-acb-group-dinner-05',
      sender: 'mailalert@acb.com.vn',
      subject: 'ACB - Thông báo biến động số dư',
      received_at: isoAt(310),
      snippet:
        '<table><tr><td>Số tài khoản</td><td>12889012</td></tr><tr><td>Số tiền giao dịch</td><td>-1,200,000 VND</td></tr><tr><td>Số dư khả dụng</td><td>15,725,000 VND</td></tr><tr><td>Nội dung giao dịch</td><td>Thanh toan lau nuong nhom 4 nguoi</td></tr></table>',
    },
  ];
}
