# CONTENT REVIEW — for the owner

**Status: not reviewed by a native speaker, coach or physiotherapist.** Everything below was
written by the AI developer. Automated checks prove structure only (all three languages present,
lengths, punctuation, no clichés from a blocklist, no attributions, Cyrillic only in RU) — they do
**not** prove that the Russian and Turkish read naturally. Please have a native speaker read the
items marked below before a public release.

How to fix a text: edit `src/data/thoughts.ts` (thoughts), `src/data/i18n/{ru,tr}.ts` (UI) or
`src/data/exercises/text.{ru,tr}.ts` (exercise cues), then run `npm test` — the validation test
(`src/data/thoughts.test.ts`) keeps the format rules (short ≤ 7 words and ≤ 48 characters;
reflection 2–4 sentences and ≤ 200 characters). Keep thought **ids** unchanged: favorites,
"recently viewed" and the pinned thought of the day refer to them.

## 1. Thoughts — PULLUP PRO ORIGINALS (90 × EN/RU/TR)

Each language was written as its own text (same idea, not a word-for-word translation).
Russian avoids gendered past-tense forms for "you" (present/future tense, impersonal phrasing),
so it reads the same for every user. Lower-confidence lines:

| id | Language | Text | Concern / possible alternative |
|---|---|---|---|
| sport-2 | TR | Tutun. Çek. Nefes al. Tekrarla. | Was "Asıl." (hang) — ambiguous with *asıl* = "actual". Is "Tutun." natural for gripping a bar? |
| patience-3 | TR | Önce kökler, sonra boy. | Plant metaphor ("boy atmak"). Natural, or is "Önce kök, sonra gövde." better? |
| loneliness-3 | TR | Kendine iyi bir yoldaş ol. | "yoldaş" may sound literary/political to some readers; alternative "Kendine iyi bir arkadaş ol." |
| success-4 | TR | Günü kazan, interneti değil. | Idiom transfer from English ("win the internet"). Does it land in Turkish? |
| failure-1 | TR | Tekrar kaçtı mı? Bu sadece bir veri. | "Tekrar kaçtı" for a failed rep — alternative "Tekrar olmadı mı?" |
| innerStrength-3 | TR / RU | Bahaneden güçlü. / Сильнее отговорки. | Very elliptical (no subject). Fine as a poster line? |
| time-6 | TR | … Önemli olan, geride ne bıraktıklarıdır. … | Check the whole reflection's rhythm. |
| sport-5 | TR | … bir sonraki antrenman da olacağı için. … | Rewritten once; check it reads naturally. |
| newBeginnings-6 | TR | … Tutuş garip gelir … | "Tutuş" for "grip" (was "Kavrayış"). |
| loneliness-6 | TR | … izin vermek de demektir. | Check word order. |
| loneliness-1 | RU | Одиночество — ещё не потерянность. | "потерянность" is correct but rare. Alternative: «Быть одному — не значит потеряться.» |
| consistency-1 | RU / TR | «Ещё раз» — красивые слова. / “Tekrar” güzel bir kelime. | Quotation-mark style (« » / “ ”) is intentional; check it reads well. |
| patience-2 | RU | Ещё один повтор. В следующем месяце. | Meaning ("one more rep — next month") relies on context; is it clear? |
| discipline-4 | RU / TR | Тихая работа — снова и снова. / Sessiz emek, tekrar tekrar. | Fragment style; acceptable? |

## 2. UI dictionary (`src/data/i18n/ru.ts`, `tr.ts`)

- **Russian:** informal "ты" everywhere; gender-neutral constructions on purpose (e.g. «Здесь появятся
  мысли, которые ты откроешь», not «…которые ты открывал»). Check plural forms in context
  (`plural.*` keys: one / few / many / other).
- **Turkish:** informal "sen". Loanwords kept on purpose because Turkish calisthenics communities use
  them: *core*, *set*, *muscle-up*, *dead bug*, *hollow hold*, *false grip*. Please confirm or
  replace (e.g. *core* → *karın ve gövde*). "Barfiks" is used for pull-up; "bar" for the pull-up bar.
- Labels written in English in every language by design: `PULLUP PRO`, `PULLUP PRO ORIGINALS`,
  `YOU VS. YOU.`

## 3. Exercise texts (`src/data/exercises/text.{en,ru,tr}.ts`) — DECISIONS D15

44 exercises × 3 languages: name, 3 technique cues, one common mistake, safety notes for demanding or
optional exercises. Written from general calisthenics knowledge — **not** by a certified coach or
physiotherapist; the app shows them as general guidance with no medical claims. To review:

- TR names: *Skapula çekişi* (scapular pull), *Dead bug*, *Hollow hold*, *Muscle-up* — natural, or
  should they be translated?
- Safety wording on bench dips and shoulder dislocates (both optional; the notes say to switch to an
  alternative if anything pinches and to stay in a pain-free range) in all three languages.
- Muscle-up progression cues (false grip, transition) — technical accuracy.
