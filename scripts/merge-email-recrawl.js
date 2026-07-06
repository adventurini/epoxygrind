#!/usr/bin/env node
/**
 * Merges scripts/enrich-contractors.py's deeper re-crawl output (content/
 * data/no-email-recrawl.json — a wider/deeper crawl targeted at the ~1499
 * contractors with no email) back into content/data/enriched.json. Only
 * sets `emails` on contractors that currently have none, matched by
 * place_id — every other field is untouched.
 *
 * The recrawl's broader link-following (staff/team/footer keywords) picked
 * up some wrong-page scrapes: association/conference staff directories and
 * a couple of placeholder-domain templates. Those are hand-excluded below
 * (verified by comparing each recovered email's domain against the
 * contractor's own website domain) rather than merged blindly. Where a
 * contractor's site turned up several real on-domain staff emails, only
 * one representative address is kept (contractor-templates.js only ever
 * renders `emails[0]`).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENRICHED_PATH = join(ROOT, 'content', 'data', 'enriched.json');
const RECRAWL_PATH = join(ROOT, 'content', 'data', 'no-email-recrawl.json');

// place_id -> chosen email. Omitted place_ids (present in the recrawl output
// with emails, but not listed here) were reviewed and rejected: emails
// scraped from an unrelated organization's domain (association/conference
// staff directories, hotel/law-firm contacts) or an obvious placeholder
// template domain, not the contractor's own site.
const APPROVED = {
  'ChIJ5ad761_9DogRmMeDwyYAI6g': 'info@shopxps.com',
  'ChIJRXTakjqvK4cRUuPDz0XZIcI': 'info@evfloorcoatings.com',
  'ChIJ2-l_OCNdK4cRwS47SoMVFws': 'sales@yourgaragecave.com',
  'ChIJvzhACMU5s1IR2t1rRx-EEFI': 'sales@actrestoration.com',
  'ChIJXXvGaE0F9ocRumfzEKw6h5c': 'jamesb@advantagecoating.com',
  'ChIJxXKdmsNnXIYRdMy3A-nTo6A': 'info@epoxyco.us',
  'ChIJVfxplGT7a4gR-zg9vdpLvlg': 'salesteam@sullivanscoating.com',
  'ChIJ_2S_4HN8PIgRUYy7eL2BAwQ': 'sales@gfcgreatlakes.com',
  'ChIJR6BsRzu25YgRNe2IXLMY1sI': 'info@aicoat.com',
  'ChIJdyiaAJTrToYRZD2IkqqGROo': 'info@customepoxysurfacing.com',
  'ChIJMX3rgXPnQIgR_O7RYZsbvwY': 'ramconcretecoatings@gmail.com',
  'ChIJKaKOpx4FaRQRE6Q0SPzb4qc': 'mike@ameri-floors.com',
  'ChIJoxnZv40N04kR8DHDiTpFYzk': 'bpapero@heritagefloor.com',
  'ChIJy51u7bl-sIkRUdx3LxtV4Y8': 's.peachy@aol.com',
  'ChIJhUr2AtB9VIcR3sPYDn_DaTw': 'kaylor.chew@gmail.com',
  'ChIJhYEWcK2x54kRjtyU50lSeEs': 'info@edisoncoatings.com',
  'ChIJrT5nYmsT9YgRkz85HGhb-jw': 'robertamedei@bellsouth.net',
  'ChIJ64MxaCZfYIgRDgtSR8Halh8': 'info@cromcorp.com',
  'ChIJCzPJ02AasYkR4tULKjC_XrQ': 'info@dmafloors.com',
  'ChIJX32QwQcRsYkR0CjFcEhPX0s': 'proposals@wjrapp.com',
  'ChIJKSBCHL55mFQRE1Ww4AFN2-U': 'office@murleysfloorcovering.com',
  'ChIJqbXCxu4tKIYRX8kDZ4Uci4c': 'debbie.cook@byrdandcook.com',
  'ChIJh_71oPAfU4YR9nT7uDv02A8': 'order_support@sutherlands.com',
  'ChIJnZwJwOYerYcRWs6VQXYNS5c': 'inquiry@daleypaving.com',
  'ChIJP4P4TgBl24ARjnQNREEOmes': 'info@hemetconcretecontractors.top',
  'ChIJXXe1IbE4NoYR9Lr6epP4ovo': 'contact@phillipsflooring.com',
  'ChIJJxp0JrCiwiwReaw_9S4bLUo': 'info@thepaintinggroup.net',
  'ChIJb_C-LlNG2YkRtJNqgRWR4r0': 'dcall@mateflex.com',
  'ChIJ0Vbltrc3QlMRZvkhG7Xi23U': 'pmahoney@pierce.biz',
  'ChIJcao41b2GxlIRKQZWfiKWpUQ': 'dakotamudjack@hotmail.com',
  'ChIJsWpzKPJlyIcRgKNIFUH8UCA': 'webmaster@grcconstructionmo.com',
  'ChIJi9GlOMuTwIcRFrE1Zpo3ZuY': 'burtonsconstruction2019@gmail.com',
  'ChIJw9A3AIzs2okRQhF8pjr_zM0': 'admin@starkrete.com',
  'ChIJ3WPBrR48PIcRPEmK_tiL3ms': 'brent@durangoflooring.com',
};

const enriched = JSON.parse(readFileSync(ENRICHED_PATH, 'utf8'));
const recrawl = JSON.parse(readFileSync(RECRAWL_PATH, 'utf8'));
const recrawlByPlaceId = new Map(recrawl.filter((c) => c.place_id).map((c) => [c.place_id, c]));

let merged = 0;
const rejectedButFound = [];
for (const c of enriched) {
  if (!c.place_id || (c.emails && c.emails.length)) continue;
  const match = recrawlByPlaceId.get(c.place_id);
  if (!match?.emails?.length) continue;
  if (APPROVED[c.place_id]) {
    c.emails = [APPROVED[c.place_id]];
    merged++;
  } else {
    rejectedButFound.push({ name: c.name, place_id: c.place_id, found: match.emails });
  }
}

writeFileSync(ENRICHED_PATH, JSON.stringify(enriched, null, 2));
console.log(`Merged ${merged} recovered emails into enriched.json.`);
if (rejectedButFound.length) {
  console.log(`Rejected ${rejectedButFound.length} (wrong-page / placeholder-domain scrapes, not merged):`);
  rejectedButFound.forEach((r) => console.log(`  ${r.name} (${r.place_id}): ${r.found.join(', ')}`));
}
