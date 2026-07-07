#!/usr/bin/env node
/**
 * One-off: rewrites all 25 contractor topic closers to tie back to a
 * happy customer payoff (Anthony: "captions for the contractors should
 * finish and tie back to a happy customer" — slide 6 now shows Grinder
 * Dad reframed as a delighted customer, not a marketing/ops scene).
 * Verifies each old string is found exactly once before replacing.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'lib/carousel/topic-seed-data.js';

const REPLACEMENTS = [
  ['Fix it or keep blaming the algorithm. epoxygrind.com', 'Fix it, and that slow lead becomes a happy customer instead of a bounce.'],
  ['A slow site is a closed sign you never noticed you hung.', 'Speed it up and that visitor becomes a happy customer bragging to the neighbors.'],
  ['Mobile isn’t the future anymore. It’s just most of your traffic.', 'Fix it for mobile and that’s one more happy customer who found you without trying.'],
  ['The exit is easier to find than the button. That’s the problem.', 'Put the button where they can reach it and that’s a happy customer, not a bounce.'],
  ['A hidden number is a call that goes to your competitor instead.', 'Make it findable and that call becomes a happy customer telling their friends who to hire.'],
  ['Make it easy to call you, not just easy to fill out a form.', 'Answer the phone and that homeowner becomes a happy repeat customer for the next job too.'],
  ['Invisible to Google is invisible to the customer searching for you.', 'Fix it and the next search ends with a happy customer on your schedule, not a rival’s.'],
  ['Listing a city isn’t the same as ranking in it.', 'Rank in the cities you actually serve and watch happy customers show up from all of them.'],
  ['A picture’s worth nothing if the algorithm can’t read it.', 'Tag it right and that photo of a happy customer’s floor actually gets found.'],
  ['If they have to leave your site to trust you, they might not come back.', 'Put your happy customers on your homepage where the next one can see them.'],
  ['A homeowner doesn’t debug your site. They just leave.', 'Fix the lock icon and that visitor sticks around long enough to become a happy customer.'],
  ['Every page should be able to close the job. Most of yours can’t.', 'Every page should turn a stranger into a happy customer. Right now, most of yours can’t.'],
  ['Speed is a feature. Right now you don’t have it.', 'Speed up the quote and that homeowner becomes a happy customer before the competitor even replies.'],
  ['One good homepage can’t cover for ten neglected ones.', 'Fix every page and every one of them can turn a visitor into a happy customer.'],
  ['Cheap to fix. Expensive to ignore. Pick one.', 'Clean it up — happy customers notice the details even when they can’t name them.'],
  ['Claimed and neglected reads the same as never claimed at all.', 'A real profile with real photos turns a skeptical searcher into a happy customer.'],
  ['If they can’t see the proof, they can’t trust the price.', 'Put a happy customer’s floor where people actually look, and the next quote gets easier.'],
  ['You can’t rank for what you never told Google you do.', 'Tell Google clearly, and the next happy customer finds you instead of guessing wrong.'],
  ['You don’t get a second two seconds.', 'Win those two seconds and the rest is just turning a visitor into a happy customer.'],
  ['Different is a choice. Right now you haven’t made it.', 'Stand out for two seconds longer and that tab closes with a happy customer, not a bounce.'],
  ['The fastest, most trustworthy-looking tab wins. Be that tab.', 'Win that moment and the call goes to you — and ends with one more happy customer.'],
  ['Neglect is visible even when you’re not looking for it.', 'A little upkeep, and that visitor becomes a happy customer instead of noticing the neglect first.'],
  ['Good work that nobody can see might as well not exist.', 'Show the work, close the gap, and that visitor becomes your next happy customer.'],
  ['Don’t pay to send people somewhere that loses them for free.', 'Fix the landing page and that ad spend turns into a happy customer, not a bounce you paid for.'],
  ['This isn’t hypothetical. Someone’s already ahead of you on this.', 'Fix it now, and their next happy customer could’ve been yours.'],
];

let content = readFileSync(FILE, 'utf8');
let applied = 0;

for (const [oldText, newText] of REPLACEMENTS) {
  const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = content.match(new RegExp(escaped, 'g'));
  if (!matches) {
    console.error(`NOT FOUND: "${oldText.slice(0, 50)}..."`);
    continue;
  }
  if (matches.length > 1) {
    console.error(`AMBIGUOUS (${matches.length}x): "${oldText.slice(0, 50)}..."`);
    continue;
  }
  content = content.replace(oldText, newText);
  applied++;
}

console.log(`Applied ${applied}/${REPLACEMENTS.length} replacements.`);
if (applied === REPLACEMENTS.length) {
  writeFileSync(FILE, content);
  console.log('Wrote file.');
} else {
  console.log('NOT writing file — fix mismatches first.');
}
