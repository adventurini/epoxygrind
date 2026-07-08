/**
 * Which reference photo(s) condition a given slide's generation — three
 * characters total (see generate-scenes.js's file-level comment for the
 * full roster/rationale):
 * - consumer 1-5: Grinder Dad only.
 * - consumer 6 (dual): Grinder Dad + the Pro.
 * - contractor 1-5: the contractor protagonist only (falls back to
 *   Grinder Dad if that reference hasn't been configured yet).
 * - contractor 6 (dual): the contractor protagonist + Grinder Dad
 *   (reframed as his happy customer).
 * @param {{ audience: 'consumer'|'contractor', position: number, masters: { default: string, pro?: string, contractorProtagonist?: string } }} opts
 * @returns {{ masterUrls: string[], dualCharacter: boolean }}
 */
export function selectMasters({ audience, position, masters }) {
  if (audience === 'consumer') {
    if (position === 6 && masters.pro) {
      return { masterUrls: [masters.default, masters.pro], dualCharacter: true };
    }
    return { masterUrls: [masters.default], dualCharacter: false };
  }

  const protagonist = masters.contractorProtagonist || masters.default;
  if (position === 6) {
    // Only actually dual if there's a distinct protagonist reference —
    // otherwise this would pass the same Grinder Dad photo twice, which
    // doesn't give the model two people to render.
    if (masters.contractorProtagonist) return { masterUrls: [protagonist, masters.default], dualCharacter: true };
    return { masterUrls: [masters.default], dualCharacter: false };
  }
  return { masterUrls: [protagonist], dualCharacter: false };
}
