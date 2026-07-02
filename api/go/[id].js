import { resolveProductLink } from '../../lib/product-registry.js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';

/**
 * Outbound product-link redirect (DIY & Product Content Spec §2).
 * Every product link in content points here, never at a raw merchant URL,
 * so a dead link or a monetization flip (url -> affiliate_url) is a
 * one-row registry edit instead of a content-wide find/replace.
 */
export default async function handler(req, res) {
  const id = String(req.query?.id || '');
  const resolved = resolveProductLink(id);

  if (!resolved.ok) {
    console.error(`/go/${id} unresolved: ${resolved.reason}`);
    res.status(404);
    res.setHeader('Content-Type', 'text/plain');
    return res.end('Product link not found.');
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();
      await Promise.race([
        supabase.from('product_clicks').insert({
          product_id: resolved.product.product_id,
          merchant: resolved.product.merchant,
          page: req.headers?.referer || null,
          page_template: String(req.query?.template || ''),
        }),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    } catch (err) {
      console.error('product_clicks insert failed:', err.message);
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(302, { Location: resolved.href });
  res.end();
}
