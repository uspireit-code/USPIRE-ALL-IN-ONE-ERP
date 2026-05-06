export const tokens = {
  brandHex: {
    navy: '#0b0b47',
    gold: '#e79e13',
  },

  colors: {
    navy: 'var(--uspire-navy)',
    gold: 'var(--uspire-gold)',
    white: '#FCFCFC',

    text: {
      primary: 'rgba(11,12,30,0.92)',
      secondary: 'rgba(11,12,30,0.62)',
      muted: 'rgba(11,12,30,0.48)',
      inverse: '#FCFCFC',
    },

    border: {
      subtle: 'rgba(11,12,30,0.08)',
      default: 'rgba(11,12,30,0.16)',
      strong: 'rgba(11,12,30,0.22)',
    },

    surface: {
      subtle: 'rgba(11,12,30,0.02)',
      hover: 'rgba(11,12,30,0.04)',
      goldHover: 'rgba(231,158,19,0.08)',
    },

    status: {
      successBg: 'rgba(16,185,129,0.10)',
      successBorder: 'rgba(16,185,129,0.22)',

      warningBg: 'rgba(231,158,19,0.14)',
      warningBorder: 'rgba(231,158,19,0.28)',

      errorBg: 'rgba(239,68,68,0.10)',
      errorBorder: 'rgba(239,68,68,0.22)',

      infoBg: 'rgba(11,12,30,0.03)',
      infoBorder: 'rgba(11,12,30,0.10)',
    },
  },

  radius: {
    sm: 10,
    md: 12,
    lg: 14,
  },

  spacing: {
    x1: 8,
    x2: 16,
    x3: 24,
    x4: 32,
  },

  shadow: {
    card: '0 1px 2px rgba(11,12,30,0.06), 0 14px 30px rgba(11,12,30,0.08)',
    cardHover: '0 2px 4px rgba(11,12,30,0.08), 0 20px 46px rgba(11,12,30,0.12)',
    buttonHover: '0 1px 2px rgba(11,12,30,0.08), 0 10px 22px rgba(11,12,30,0.10)',
  },

  transition: {
    fast: '150ms ease',
    normal: '180ms ease',
  },

  focusRing: {
    ring: '0 0 0 4px rgba(231, 158, 19, 0.18)',
    borderColor: 'rgba(231, 158, 19, 0.55)',
  },
} as const;
