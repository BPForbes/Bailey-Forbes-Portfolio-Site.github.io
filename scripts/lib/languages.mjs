/**
 * GitHub Linguist byte counts -> displayable percentages.
 *
 * Two properties matter for the rendered bar and legend:
 *
 *  1. The printed numbers must add up to 100.0. Rounding each share
 *     independently does not give you that — four shares that each round down
 *     leave a visible gap at the end of the bar. The largest-remainder method
 *     below distributes the rounding residue so the displayed figures sum to
 *     exactly 100.0 at the chosen precision.
 *
 *  2. A language GitHub reports must never print as "0.0%". A repository with
 *     one 252-byte linker script really does round to 0.0, which reads as a bug.
 *     Such shares are lifted to one step (0.1) and the deficit is taken from the
 *     largest share, which can always afford it.
 *
 * No language whitelist is applied anywhere: whatever Linguist reports is what
 * gets rendered, so a language appearing or disappearing upstream needs no
 * change here.
 */

/** @typedef {import("./types.mjs").RepositoryLanguage} RepositoryLanguage */

/**
 * Round half-up at a fixed number of decimals, avoiding the float drift that
 * makes `(0.615).toFixed(2)` surprising.
 *
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 */
export function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Convert a `{ language: bytes }` map into sorted, rounded shares.
 *
 * @param {Record<string, unknown>} byteMap Raw GitHub /languages response.
 * @param {{ decimals?: number }} [options]
 * @returns {RepositoryLanguage[]} Largest share first; empty when there is
 *   nothing positive to divide, which callers must treat as "no data" rather
 *   than "zero percent".
 */
export function computeLanguageShares(byteMap, options = {}) {
  const decimals = options.decimals ?? 1;
  const step = 1 / 10 ** decimals;

  if (byteMap === null || typeof byteMap !== "object" || Array.isArray(byteMap)) {
    return [];
  }

  /** @type {{ name: string, bytes: number }[]} */
  const entries = [];
  for (const [name, raw] of Object.entries(byteMap)) {
    const bytes = typeof raw === "number" ? raw : Number(raw);
    // A negative or non-finite byte count is malformed, not a language.
    if (!Number.isFinite(bytes) || bytes <= 0 || typeof name !== "string" || name === "") {
      continue;
    }
    entries.push({ name, bytes });
  }

  const total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  if (total <= 0) {
    return [];
  }

  // Largest remainder: floor everything to the target precision, then hand the
  // leftover steps to whoever was cut by the most.
  const scale = 10 ** decimals;
  const targetUnits = 100 * scale;
  const scored = entries.map((entry) => {
    const exact = (entry.bytes / total) * targetUnits;
    const floor = Math.floor(exact);
    return { ...entry, exact, units: floor, remainder: exact - floor };
  });

  let assigned = scored.reduce((sum, entry) => sum + entry.units, 0);
  const leftover = targetUnits - assigned;
  const byRemainder = [...scored].sort(
    (a, b) => b.remainder - a.remainder || b.bytes - a.bytes || a.name.localeCompare(b.name),
  );
  for (let index = 0; index < leftover; index += 1) {
    const target = byRemainder[index % byRemainder.length];
    target.units += 1;
  }

  // Largest first; ties broken by name so repeated runs are byte-identical.
  scored.sort((a, b) => b.units - a.units || b.bytes - a.bytes || a.name.localeCompare(b.name));

  const shares = scored.map((entry) => ({
    name: entry.name,
    bytes: entry.bytes,
    pct: roundTo(entry.units / scale, decimals),
  }));

  return liftZeroShares(shares, step, decimals);
}

/**
 * Give every present language at least one step, paying for it out of the
 * largest share. Guarded so an absurd number of dust languages can never drive
 * the largest share below the floor it is funding.
 *
 * @param {RepositoryLanguage[]} shares Sorted largest-first.
 * @param {number} step
 * @param {number} decimals
 * @returns {RepositoryLanguage[]}
 */
function liftZeroShares(shares, step, decimals) {
  if (shares.length === 0) {
    return shares;
  }
  const zeros = shares.filter((share) => share.pct <= 0);
  if (zeros.length === 0) {
    return shares;
  }

  const largest = shares[0];
  const owed = roundTo(zeros.length * step, decimals);
  if (largest.pct - owed < step) {
    // Pathological input (hundreds of dust languages). Leave the arithmetic
    // alone rather than invent a distribution.
    return shares;
  }

  for (const share of zeros) {
    share.pct = step;
  }
  largest.pct = roundTo(largest.pct - owed, decimals);
  return shares;
}

/**
 * @param {RepositoryLanguage[]} shares
 * @param {number} [tolerance]
 * @returns {boolean} Whether the printed percentages still add up to ~100.
 */
export function sharesSumToWhole(shares, tolerance = 0.05) {
  if (shares.length === 0) {
    return false;
  }
  const sum = shares.reduce((total, share) => total + share.pct, 0);
  return Math.abs(sum - 100) <= tolerance;
}
