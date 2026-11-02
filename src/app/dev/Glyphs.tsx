/* Dev-only glyph coverage page for both fonts (Cyrillic + Turkish). */
const lines = [
  'ё Ё й Й щ Щ ъ ы э ю я — Съешь же ещё этих мягких французских булок.',
  'ı İ ş Ş ğ Ğ ç Ç ö Ö ü Ü — Pijamalı hasta yağız şoföre çabucak güvendi.',
  'The quick brown fox jumps over the lazy dog. 0123456789',
];
const upper = [
  ['tr', 'istanbul ılık iğne'],
  ['ru', 'ёлка и ёж'],
  ['en', 'istanbul'],
] as const;

export default function Glyphs() {
  return (
    <main className="screen-pad" style={{ display: 'grid', gap: 24, paddingBottom: 96 }}>
      <h1 className="t-h1 upper">Glyphs</h1>
      <section style={{ display: 'grid', gap: 12 }}>
        <p className="t-eyebrow">Inter Tight</p>
        {lines.map((l) => <p key={l}>{l}</p>)}
        {lines.map((l) => <p key={`b${l}`} style={{ fontWeight: 650 }}>{l}</p>)}
      </section>
      <section style={{ display: 'grid', gap: 12 }}>
        <p className="t-eyebrow">Cormorant Garamond 500 / 600</p>
        {lines.map((l) => <p key={l} className="quote quote--md">{l}</p>)}
        {lines.map((l) => <p key={`b${l}`} className="quote quote--md" style={{ fontWeight: 600 }}>{l}</p>)}
      </section>
      <section style={{ display: 'grid', gap: 8 }}>
        <p className="t-eyebrow">toLocaleUpperCase</p>
        {upper.map(([lang, s]) => <p key={lang} lang={lang}>{lang}: {s} → {s.toLocaleUpperCase(lang)}</p>)}
      </section>
    </main>
  );
}
