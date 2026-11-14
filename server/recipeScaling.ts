/**
 * Server-side recipe scaling utilities for batch multiplication.
 */

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 0.25,
  '¾': 0.75,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

export function parseNumericAmount(amountStr?: string | null): number | null {
  if (!amountStr) return null;
  const s = amountStr.trim();
  if (!s) return null;

  for (const [char, val] of Object.entries(UNICODE_FRACTIONS)) {
    if (s.includes(char)) {
      const remainder = s.replace(char, '').trim();
      const whole = remainder ? parseFloat(remainder) : 0;
      return (isNaN(whole) ? 0 : whole) + val;
    }
  }

  const parts = s.split(/\s+/);
  if (parts.length === 2 && parts[1].includes('/')) {
    const whole = parseFloat(parts[0]);
    const [num, den] = parts[1].split('/').map(Number);
    if (!isNaN(whole) && !isNaN(num) && !isNaN(den) && den !== 0) {
      return whole + num / den;
    }
  } else if (parts.length === 1 && parts[0].includes('/')) {
    const [num, den] = parts[0].split('/').map(Number);
    if (!isNaN(num) && !isNaN(den) && den !== 0) {
      return num / den;
    }
  }

  const floatVal = parseFloat(s);
  return isNaN(floatVal) ? null : floatVal;
}

export function formatCookQuantity(val: number): string {
  if (val <= 0) return '';
  const rounded = Math.round(val * 1000) / 1000;
  const whole = Math.floor(rounded);
  const frac = Math.round((rounded - whole) * 1000) / 1000;

  const fractionMap = [
    { dec: 0.125, str: '1/8' },
    { dec: 0.25,  str: '1/4' },
    { dec: 0.333, str: '1/3' },
    { dec: 0.375, str: '3/8' },
    { dec: 0.5,   str: '1/2' },
    { dec: 0.625, str: '5/8' },
    { dec: 0.667, str: '2/3' },
    { dec: 0.75,  str: '3/4' },
    { dec: 0.875, str: '7/8' },
  ];

  let fracStr = '';
  for (const f of fractionMap) {
    if (Math.abs(frac - f.dec) < 0.038) {
      fracStr = f.str;
      break;
    }
  }

  if (frac > 0.038 && !fracStr) {
    const decimalRemainder = (Math.round(frac * 100) / 100).toString().replace(/^0/, '');
    fracStr = decimalRemainder;
  }

  if (whole === 0 && fracStr) return fracStr;
  if (whole > 0 && fracStr) return `${whole} ${fracStr}`;
  return String(whole);
}

export function scaleAmountString(amountStr?: string | null, multiplier: number = 1): string {
  if (!amountStr || multiplier === 1 || multiplier <= 0) return amountStr || '';
  const s = amountStr.trim();
  if (!s) return '';

  const rangeMatch = s.match(/^(\d+(?:\.\d+)?|\d+\/\d+|\d+\s+\d+\/\d+)\s*(-|–|to)\s*(\d+(?:\.\d+)?|\d+\/\d+|\d+\s+\d+\/\d+)$/i);
  if (rangeMatch) {
    const [, start, sep, end] = rangeMatch;
    const startNum = parseNumericAmount(start);
    const endNum = parseNumericAmount(end);
    if (startNum !== null && endNum !== null) {
      return `${formatCookQuantity(startNum * multiplier)} ${sep} ${formatCookQuantity(endNum * multiplier)}`;
    }
  }

  const attachedUnitMatch = s.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/);
  if (attachedUnitMatch) {
    const num = parseFloat(attachedUnitMatch[1]) * multiplier;
    return `${Math.round(num * 100) / 100}${attachedUnitMatch[2]}`;
  }

  const parsed = parseNumericAmount(s);
  if (parsed !== null) {
    return formatCookQuantity(parsed * multiplier);
  }

  return s;
}

export function formatRecipeBatchNote(recipeTitle: string, multiplier: number = 1): string {
  const trimmed = recipeTitle.trim();
  const multDisplay = multiplier === 0.5 ? '½' : multiplier;
  if (multiplier !== 1 && multiplier > 0) {
    return `For: ${trimmed} (${multDisplay}x batch)`;
  }
  return `For: ${trimmed} (1x batch)`;
}

export function detectBatchMultiplierFromNote(note?: string | null): number | null {
  if (!note) return null;
  const s = note.trim();
  if (/\b(?:½|1\/2)x?\s*(?:batch)?\b/i.test(s)) return 0.5;
  const matchParen = s.match(/\((\d+(?:\.\d+)?)x\s*(?:batch)?\)/i);
  if (matchParen) {
    const num = parseFloat(matchParen[1]);
    if (!isNaN(num) && num > 0) return num;
  }
  const matchWord = s.match(/(\d+(?:\.\d+)?)x\s*batch/i);
  if (matchWord) {
    const num = parseFloat(matchWord[1]);
    if (!isNaN(num) && num > 0) return num;
  }
  return null;
}
