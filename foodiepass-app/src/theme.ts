// LocalScout brand tokens (same as the website and brand kit).
export const C = {
  linen: '#F6F4EF',
  sand: '#EDE8DE',
  card: '#FFFDF8',
  bayou: '#172A2A',
  bayou2: '#21393A',
  chili: '#E2552B',
  mustard: '#F2B134',
  brick: '#B5401C',
  ink2: '#4A5857',
  muted: '#5C6968',
  line: '#E2DDD2',
  mint: '#BFD3CF',
  ok: '#2F6B4C',
  okBg: '#DDEFE3',
  errBg: '#FCE7DF',
  err: '#8F3215',
};

export const T = {
  display: { fontWeight: '800' as const, letterSpacing: -0.5, color: C.bayou },
  eyebrow: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 1.6, textTransform: 'uppercase' as const, color: C.brick },
  body: { fontSize: 17, lineHeight: 24, color: C.ink2 },
  small: { fontSize: 14, lineHeight: 20, color: C.muted },
};
