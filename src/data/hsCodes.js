export const HS_CODES = [
  { description: 'Advanced formulation designed to improve overall wellbeing to a healthy appearance in aesthetic applications', code: '4901990070' },
  { description: 'Advanced formulation designed to improve overall wellbeing and facial areas. Not tested on animals. Paraben-free. Used for skin hydrating purposes', code: '3304991000' },
  { description: 'Glow facial moisturizer, non-animal origin, non-colorant, personal & single use only, EN packaging', code: '3304991000' },
  { description: 'Advanced formulation designed to improve overall wellbeing and facial areas. Not tested on animals. Paraben-free. Used for skin hydrating purposes', code: '3304910010' },
  { description: 'All about that base makeup prep squad life-proof primer, non-animal origin, non-colorant, personal & single use only, EN packaging', code: '3304991000' },
  { description: 'Lash & brow volumizing serum, non-animal origin, non-colorant, personal & single use only, EN packaging', code: '3304200000' },
  { description: 'Generation happy skin on-the-go blush longwear cream blush, non-animal origin, non-colorant, personal & single use only, EN packaging', code: '3304991000' },
  { description: 'Cosmetics intense cover concealer, non-animal origin, non-colorant, personal & single use only, EN packaging', code: '3304991000' },
  { description: 'Facial powder for complexion finish, non-animal origin, non-colorant, personal & single use only, EN packaging', code: '3304910010' },
  { description: 'Moisturising lip balm with natural ingredients, non-colorant, non-animal origin, personal & single use only, EN packaging', code: '3304100000' },
  { description: 'Bodyography blurset perfect loose finishing powder, non-animal origin, non-colorant, personal & single use only, EN packaging', code: '3304910010' },
  { description: 'Cosmetics second base everyday concealer, non-animal origin, non-colorant, personal & single use only, EN packaging', code: '3304991000' },
  { description: 'Intense hydrating facial moisturizer cream, non-animal origin, non-colorant, personal & single use only, EN packaging', code: '3304991000' },
];

// Seed rows for the D1 HS-code list (the rotating cosmetic descriptions).
export function builtinSeedHsCodes() {
  return HS_CODES.map((h, i) => ({ description: h.description, code: h.code, status: 'active', position: i }));
}

// Active rotating list from D1 rows (ordered by position); falls back to the
// built-in list when nothing usable is provided.
export function activeHsList(dbRows) {
  const rows = (dbRows || []).filter((r) => r && (!r.status || r.status === 'active') && (r.description || r.code));
  if (!rows.length) return HS_CODES;
  return rows.slice()
    .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
    .map((r) => ({ description: r.description || '', code: r.code || '' }));
}
