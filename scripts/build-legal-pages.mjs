#!/usr/bin/env node
/**
 * One-off: builds /privacy/ and /terms/ — didn't exist anywhere on the
 * site before. Needed as a real, concrete blocker for Twilio's A2P 10DLC
 * campaign registration (requires a live privacy-policy URL with a mobile-
 * number non-sharing statement, message frequency note, and "message and
 * data rates may apply" disclosure — not something that can be a
 * placeholder, Twilio/carriers can and do check it).
 *
 * Re-run with `node scripts/build-legal-pages.mjs` after editing the
 * bodyHtml below — output is a committed static file, not built on request.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderContentPage } from '../lib/content-shell.js';

const PRIVACY_BODY = `
<p class="content-eyebrow">Legal</p>
<h1 class="content-h1">Privacy Policy</h1>
<p class="content-dek">Last updated July 8, 2026.</p>

<div class="content-prose">
<p>EpoxyGrind ("we," "us," "our") operates epoxygrind.com and provides free website audits, DIY guides, epoxy cost estimates, and a contractor directory. This policy explains what information we collect, how we use it, and your choices — including for SMS text messaging.</p>

<h2>Information we collect</h2>
<ul>
<li><strong>Contact information</strong> you provide directly: name, email address, phone number, and ZIP code — for example when requesting an estimate, submitting a website audit, messaging a contractor, or signing up for an account.</li>
<li><strong>Photos</strong> you upload for a garage/floor estimate, used only to generate your estimate and preview.</li>
<li><strong>Website audit data</strong>: the URL you submit and the resulting technical/SEO findings.</li>
<li><strong>Usage data</strong>: pages visited, referring page, and general analytics (Google Analytics), collected automatically.</li>
<li><strong>Phone number and message content</strong> if you call or text our tracking number — see "SMS/text messaging program" below.</li>
</ul>

<h2>How we use your information</h2>
<ul>
<li>To generate and deliver the estimate, audit, or quote you requested.</li>
<li>To respond to messages you send us, including by text message.</li>
<li>To connect you with a contractor you've chosen to contact through our directory.</li>
<li>To improve our site and services.</li>
</ul>

<h2>SMS/text messaging program</h2>
<p>If you call or text our business phone number, we reply by text to help with your request (for example, to ask what type of project you need a quote for). We only text numbers that contacted us first — we never send text messages from purchased or uploaded contact lists, and text messaging is never used for marketing or promotional campaigns.</p>
<ul>
<li><strong>Message frequency</strong> varies based on your conversation with us — typically a handful of messages while we help with your request.</li>
<li><strong>Message and data rates may apply</strong>, based on your mobile carrier plan.</li>
<li><strong>We do not share or sell your mobile phone number</strong> with third parties for their own marketing purposes. Your number may be shared with the contractor you've asked to be connected with, and with service providers (like Twilio) who help us deliver the message itself.</li>
<li><strong>Opt out anytime</strong> by replying STOP to any message. Reply HELP for help. You can also contact us using the information below.</li>
</ul>

<h2>Third-party service providers</h2>
<p>We use the following providers to operate the site and are subject to their own privacy practices: Supabase (database and file storage), OpenAI and fal.ai (photo analysis and image generation for estimates/audits), Twilio (call and text messaging), Google Maps (location/estimate features), Resend (transactional email), and Google Analytics (site usage analytics).</p>

<h2>Data retention</h2>
<p>We retain your information as long as needed to provide our services and to comply with legal obligations. You can request deletion of your data at any time using the contact information below.</p>

<h2>Contact us</h2>
<p>Questions about this policy or your data? Email us through the contact form on our <a href="/">homepage</a>.</p>
</div>
`.trim();

const TERMS_BODY = `
<p class="content-eyebrow">Legal</p>
<h1 class="content-h1">Terms of Service</h1>
<p class="content-dek">Last updated July 8, 2026.</p>

<div class="content-prose">
<p>By using epoxygrind.com, calling, or texting our business phone number, you agree to these terms.</p>

<h2>Our services</h2>
<p>EpoxyGrind provides free website audits, DIY epoxy flooring guides, cost estimates, and a directory connecting homeowners with epoxy flooring contractors. Estimates are informational only and not a binding quote; actual pricing is determined by the contractor you work with.</p>

<h2>SMS/text messaging</h2>
<p>If you call or text our tracking number, you consent to receive text message replies related to your request, as described in our <a href="/privacy/">Privacy Policy</a>. Message and data rates may apply. Message frequency varies. Reply STOP to opt out at any time, or HELP for help.</p>

<h2>Contractor directory</h2>
<p>EpoxyGrind is a marketing platform, not a contractor and not a party to any agreement between you and a contractor. We do not guarantee the work, pricing, licensing, or insurance status of any listed contractor — verify these directly before hiring.</p>

<h2>Acceptable use</h2>
<p>Don't misuse the site: no scraping, no attempting to disrupt the service, no submitting false information to obtain estimates or audits under false pretenses.</p>

<h2>Changes</h2>
<p>We may update these terms from time to time; continued use of the site after a change means you accept the updated terms.</p>

<h2>Contact us</h2>
<p>Questions? Email us through the contact form on our <a href="/">homepage</a>.</p>
</div>
`.trim();

function writePage(dir, html) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/index.html`, html);
  console.log(`  wrote ${dir}/index.html`);
}

const privacyHtml = renderContentPage({
  title: 'Privacy Policy | EpoxyGrind',
  description: 'How EpoxyGrind collects, uses, and protects your information, including our SMS text messaging program.',
  path: '/privacy/',
  bodyHtml: PRIVACY_BODY,
});

const termsHtml = renderContentPage({
  title: 'Terms of Service | EpoxyGrind',
  description: 'The terms that apply to using epoxygrind.com and our SMS text messaging program.',
  path: '/terms/',
  bodyHtml: TERMS_BODY,
});

writePage('privacy', privacyHtml);
writePage('terms', termsHtml);
console.log('Done.');
