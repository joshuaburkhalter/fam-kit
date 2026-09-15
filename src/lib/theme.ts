// Dynamic User Theme System
// Allows the active user's chosen profile color to seamlessly theme all interactive UI elements across pages

export interface ThemePalette {
  hex: string;
  rgb: string; // "r g b" format for Tailwind alpha channel compatibility
  hoverHex: string;
  hoverRgb: string;
  gradientStart: string;
  gradientEnd: string;
  textColor: string; // High-contrast readable text: '#020617' (dark) or '#ffffff' (white)
}

export const THEME_PRESETS: Record<string, ThemePalette> = {
  // Emerald (Default)
  '#10b981': {
    hex: '#10b981',
    rgb: '16 185 129',
    hoverHex: '#34d399',
    hoverRgb: '52 211 153',
    gradientStart: '#10b981',
    gradientEnd: '#2dd4bf',
    textColor: '#020617',
  },
  // Blue
  '#3b82f6': {
    hex: '#3b82f6',
    rgb: '59 130 246',
    hoverHex: '#60a5fa',
    hoverRgb: '96 165 250',
    gradientStart: '#3b82f6',
    gradientEnd: '#38bdf8',
    textColor: '#ffffff',
  },
  // Pink
  '#ec4899': {
    hex: '#ec4899',
    rgb: '236 72 153',
    hoverHex: '#f472b6',
    hoverRgb: '244 114 182',
    gradientStart: '#ec4899',
    gradientEnd: '#fb7185',
    textColor: '#ffffff',
  },
  // Amber
  '#f59e0b': {
    hex: '#f59e0b',
    rgb: '245 158 11',
    hoverHex: '#fbbf24',
    hoverRgb: '251 191 36',
    gradientStart: '#f59e0b',
    gradientEnd: '#fb923c',
    textColor: '#020617',
  },
  // Purple
  '#8b5cf6': {
    hex: '#8b5cf6',
    rgb: '139 92 246',
    hoverHex: '#a78bfa',
    hoverRgb: '167 139 250',
    gradientStart: '#8b5cf6',
    gradientEnd: '#c084fc',
    textColor: '#ffffff',
  },
  // Cyan
  '#06b6d4': {
    hex: '#06b6d4',
    rgb: '6 182 212',
    hoverHex: '#22d3ee',
    hoverRgb: '34 211 238',
    gradientStart: '#06b6d4',
    gradientEnd: '#38bdf8',
    textColor: '#020617',
  },
  // Red
  '#ef4444': {
    hex: '#ef4444',
    rgb: '239 68 68',
    hoverHex: '#f87171',
    hoverRgb: '248 113 113',
    gradientStart: '#ef4444',
    gradientEnd: '#fb7185',
    textColor: '#ffffff',
  },
};

// Compute palette dynamically for any arbitrary custom hex color
export function getPaletteForColor(color?: string | null): ThemePalette {
  const normalized = (color || '#10b981').trim().toLowerCase();

  // Return preset if matched
  if (THEME_PRESETS[normalized]) {
    return THEME_PRESETS[normalized];
  }

  // Parse custom hex (e.g. #rgb or #rrggbb)
  let cleanHex = normalized.replace(/^#/, '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  if (!/^[0-9a-f]{6}$/.test(cleanHex)) {
    return THEME_PRESETS['#10b981'];
  }

  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);

  // Compute luminance: standard perceived brightness formula
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const textColor = luminance > 150 ? '#020617' : '#ffffff';

  // Lighten slightly for hover
  const hoverR = Math.min(255, Math.round(r + (255 - r) * 0.2));
  const hoverG = Math.min(255, Math.round(g + (255 - g) * 0.2));
  const hoverB = Math.min(255, Math.round(b + (255 - b) * 0.2));

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  const hoverHex = `#${toHex(hoverR)}${toHex(hoverG)}${toHex(hoverB)}`;

  return {
    hex: `#${cleanHex}`,
    rgb: `${r} ${g} ${b}`,
    hoverHex,
    hoverRgb: `${hoverR} ${hoverG} ${hoverB}`,
    gradientStart: `#${cleanHex}`,
    gradientEnd: hoverHex,
    textColor,
  };
}

// Inject CSS custom properties onto document element
export function applyUserTheme(color?: string | null): ThemePalette {
  const palette = getPaletteForColor(color);

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--theme-rgb', palette.rgb);
    root.style.setProperty('--theme-hover-rgb', palette.hoverRgb);
    root.style.setProperty('--theme-color', palette.hex);
    root.style.setProperty('--theme-hover', palette.hoverHex);
    root.style.setProperty('--theme-text', palette.textColor);
    root.style.setProperty('--theme-gradient-start', palette.gradientStart);
    root.style.setProperty('--theme-gradient-end', palette.gradientEnd);
  }

  return palette;
}
