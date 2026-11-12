import type { CartItem, MenuItem, ParseResult, UnresolvedItem } from "@/types";

const NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  ek: 1,
  single: 1,
  two: 2,
  do: 2,
  couple: 2,
  three: 3,
  teen: 3,
  four: 4,
  char: 4,
  chaar: 4,
  five: 5,
  paanch: 5,
  panch: 5,
  six: 6,
  che: 6,
  chhe: 6,
  seven: 7,
  saat: 7,
  eight: 8,
  aath: 8,
  nine: 9,
  nau: 9,
  ten: 10,
  das: 10,
};
const FILLER = new Set([
  "and",
  "aur",
  "plus",
  "with",
  "also",
  "please",
  "pls",
  "i",
  "want",
  "need",
  "get",
  "me",
  "give",
  "chahiye",
  "de",
  "do",
  "dena",
  "bhai",
  "ke",
  "ka",
  "ki",
  "of",
  "some",
  "order",
  "ready",
  "by",
  "at",
  "the",
  "have",
  "can",
  "item",
  "items",
  "dish",
  "dishes",
  "plate",
  "plates",
  "glass",
  "glasses",
  "cup",
  "cups",
  "under",
  "below",
  "rs",
  "inr",
]);
const MODIFIERS = [
  "no sugar",
  "less sugar",
  "extra sugar",
  "strong",
  "no onion",
  "less oil",
  "less spicy",
  "extra spicy",
  "extra chutney",
  "extra sambar",
  "extra cheese",
  "no butter",
  "no ice",
  "no garlic chutney",
  "no pickle",
  "sweet",
  "salted",
];
const MOD_ALIASES: Record<string, string> = {
  "bina cheeni": "no sugar",
  "bina chini": "no sugar",
  "kam cheeni": "less sugar",
  "kam chini": "less sugar",
  "kam teekha": "less spicy",
  "zyada teekha": "extra spicy",
  "without sugar": "no sugar",
  "sugar free": "no sugar",
  "without onion": "no onion",
};

function lev(a: string, b: string) {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array<number>(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return dp[a.length]![b.length]!;
}

const close = (a: string, b: string) =>
  a === b || (b.length >= 4 && lev(a, b) <= (b.length > 6 ? 2 : 1));

/** Parse "by 1 pm" / "at 12:30" into today's epoch ms. */
export function parseReadyBy(text: string, now: number): number | undefined {
  const m = text.match(/(?:by|at|before|tak)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/i);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap && h < 8) h += 12; // "by 1" in a canteen means 1 pm
  const d = new Date(now);
  d.setHours(h, min, 0, 0);
  return d.getTime() > now ? d.getTime() : undefined;
}

export function parseOrderText(text: string, menu: MenuItem[], now = Date.now()): ParseResult {
  const available = menu.filter((m) => m.available);
  const readyBy = parseReadyBy(text, now);
  const cleaned = text
    .toLowerCase()
    .replace(/(?:ready\s+)?(?:by|at|before)\s+\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?(?:\s*tak)?/g, " ")
    .replace(/[^a-z0-9\s,&+]/g, " ");
  const segments = cleaned
    .split(/,|&|\+|\band\b|\baur\b|\bplus\b|\bwith\b|\balso\b/)
    .map((s) => s.trim())
    .filter(Boolean);

  const items: CartItem[] = [];
  const unresolved: UnresolvedItem[] = [];
  const notFound: string[] = [];

  for (let seg of segments) {
    let maxBudget: number | undefined;
    const budgetMatch = seg.match(
      /(?:under|below|less than|within|max)\s*(?:rs\.?|inr|₹)?\s*(\d+)/i,
    );
    if (budgetMatch) {
      maxBudget = Number(budgetMatch[1]);
      seg = seg.replace(budgetMatch[0], " ");
    }

    const modifiers: string[] = [];
    for (const [alias, mod] of Object.entries(MOD_ALIASES))
      if (seg.includes(alias)) {
        modifiers.push(mod);
        seg = seg.replace(alias, " ");
      }
    for (const mod of MODIFIERS)
      if (seg.includes(mod)) {
        if (!modifiers.includes(mod)) modifiers.push(mod);
        seg = seg.replace(mod, " ");
      }
    const tokens = seg.split(/\s+/).filter(Boolean);
    let qty = 1;
    const words: string[] = [];
    for (const t of tokens) {
      if (/^\d+$/.test(t) && Number(t) < 30) qty = Number(t);
      else if (NUMBERS[t] !== undefined && words.length === 0) qty = NUMBERS[t];
      else if (!FILLER.has(t)) words.push(t);
    }
    if (!words.length) continue;
    const phrase = words.join(" ");

    const pool =
      maxBudget !== undefined
        ? available.filter((m) => m.price <= maxBudget || m.price * qty <= maxBudget)
        : available;

    // Score items: full alias match beats partial
    let best: { item: MenuItem; score: number }[] = [];
    for (const m of pool.length ? pool : available) {
      let score = 0;
      for (const alias of m.aliases) {
        const aw = alias.split(" ");
        const hits = aw.filter((w) => words.some((x) => close(x, w))).length;
        const s = hits === aw.length ? 10 + aw.length : hits > 0 && aw.length > 1 ? hits : 0;
        score = Math.max(score, s);
      }
      if (score > 0) best.push({ item: m, score });
    }
    best.sort((a, b) => b.score - a.score);
    const top = best[0]?.score ?? 0;
    best = best.filter((b) => b.score === top);

    // Family word alone ("dosa", "coffee", "sandwich", "juice") → ask which one
    const familyWord = words.find((w) => available.some((m) => m.family && close(w, m.family)));
    const family = familyWord
      ? available.find((m) => m.family && close(familyWord, m.family))?.family
      : undefined;
    const familyOnly =
      family &&
      words.every(
        (w) =>
          close(w, family) ||
          !available.some((m) =>
            m.aliases.some((a) => a.split(" ").some((aw) => close(w, aw) && aw !== family)),
          ),
      );

    if (
      familyOnly &&
      (top < 11 ||
        best.length > 1 ||
        best[0]?.item.family !== family ||
        !best[0]!.item.aliases.some((a) =>
          a.split(" ").every((aw) => words.some((w) => close(w, aw))),
        ))
    ) {
      const activePool = pool.length ? pool : available;
      const options = activePool.filter((m) => m.family === family).map((m) => m.id);
      if (options.length === 1 && options[0]) {
        const id = options[0];
        const existing = items.find(
          (i) => i.itemId === id && i.modifiers.join() === modifiers.join(),
        );
        if (existing) existing.qty += qty;
        else items.push({ itemId: id, qty, modifiers });
        continue;
      }
      unresolved.push({
        id: `${family}-${unresolved.length}`,
        phrase,
        qty,
        modifiers,
        question: maxBudget ? `Which ${family} (under ₹${maxBudget})?` : `Which ${family}?`,
        options: options.length
          ? options
          : available.filter((m) => m.family === family).map((m) => m.id),
      });
      continue;
    }
    if (top >= 10 && best.length === 1) {
      const id = best[0]!.item.id;
      const existing = items.find(
        (i) => i.itemId === id && i.modifiers.join() === modifiers.join(),
      );
      if (existing) existing.qty += qty;
      else items.push({ itemId: id, qty, modifiers });
    } else if (best.length > 1 || (top > 0 && top < 10)) {
      unresolved.push({
        id: `u-${unresolved.length}`,
        phrase,
        qty,
        modifiers,
        question: `Did you mean?`,
        options: best.slice(0, 4).map((b) => b.item.id),
      });
    } else {
      notFound.push(phrase);
    }
  }
  return readyBy ? { items, unresolved, notFound, readyBy } : { items, unresolved, notFound };
}
