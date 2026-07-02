/**
 * Map a stored estimate payload to queryable database columns.
 * @param {object} payload
 */
export function estimateColumnsFromPayload(payload = {}) {
  const pricing = payload.pricing || {};
  const design = payload.design || pricing.design || {};
  const analysis = payload.analysis || {};
  const meta = payload.meta || {};

  return {
    project_name: payload.projectName || meta.projectName || null,
    finish: design.finish || pricing.finish || meta.finish || null,
    finish_label: pricing.finishLabel || null,
    pattern: design.pattern || null,
    pattern_label: design.patternLabel || null,
    base_color: design.baseColor || null,
    base_color_label: design.baseColorLabel || null,
    base_color_hex: design.baseColorHex || null,
    flake_color: design.flakeColor || null,
    flake_color_label: design.flakeColorLabel || null,
    flake_color_hex: design.flakeColorHex || null,
    color_label: design.colorLabel || design.summary || null,
    sq_ft: pricing.sqFt ?? analysis.estimatedSqFt ?? null,
    total_low: pricing.totalLow ?? null,
    total_high: pricing.totalHigh ?? null,
    space_type: analysis.spaceType || null,
    original_image_path: payload.originalImagePath || null,
  };
}

/**
 * @param {object} row
 * @param {object} [payload]
 */
export function estimateSummaryFromRow(row = {}, payload = {}) {
  const pricing = payload.pricing || {};
  const analysis = payload.analysis || {};

  return {
    totalLow: row.total_low ?? pricing.totalLow ?? null,
    totalHigh: row.total_high ?? pricing.totalHigh ?? null,
    finishLabel: row.finish_label ?? pricing.finishLabel ?? null,
    finish: row.finish ?? pricing.finish ?? null,
    patternLabel: row.pattern_label ?? payload.design?.patternLabel ?? null,
    baseColorHex: row.base_color_hex ?? payload.design?.baseColorHex ?? null,
    flakeColorHex: row.flake_color_hex ?? payload.design?.flakeColorHex ?? null,
    colorLabel: row.color_label ?? payload.design?.colorLabel ?? null,
    sqFt: row.sq_ft ?? pricing.sqFt ?? analysis.estimatedSqFt ?? null,
    spaceType: row.space_type ?? analysis.spaceType ?? null,
  };
}
