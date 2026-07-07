export default {
  title: 'Contractor Learning Center',
  metaTitle: 'Contractor Learning Center — What Your Audit Findings Mean | EpoxyGrind',
  metaDescription: 'Plain-language explanations of every metric in your EpoxyGrind website audit — why it affects leads, what the research says, and how to fix it.',
  dek: 'Every finding in your free audit links back here. Real research, not opinions, on why each metric affects whether a homeowner actually calls.',
  groups: [
    {
      title: 'Performance',
      items: [
        { slug: 'lighthouse-performance-score', title: 'Why Your Website Speed Score Is Costing You Jobs', description: 'Real data on how load time affects whether homeowners stick around.' },
        { slug: 'largest-contentful-paint', title: 'Largest Contentful Paint: The Clock Homeowners Are Actually Watching', description: 'The specific moment a visitor is actually waiting on, not the averaged score.' },
        { slug: 'total-page-weight', title: 'Total Page Weight: Why Your Site Feels Heavier Than It Looks', description: 'A simple-looking page can still be enormous behind the scenes.' },
      ],
    },
    {
      title: 'Mobile experience',
      items: [
        { slug: 'viewport-meta-tag', title: 'Why the Viewport Meta Tag Is the First Thing Your Audit Checks', description: 'One missing line of HTML tells a phone to render your site like a shrunk-down desktop.' },
        { slug: 'tap-target-size', title: 'Why Small Buttons Are Quietly Losing You Mobile Leads', description: 'A button too small to comfortably tap measurably costs conversions.' },
        { slug: 'click-to-call-link', title: 'Why Your Phone Number Needs to Be a Real Tappable Link', description: 'Plain text instead of a tel: link means an extra, unnecessary step to call.' },
        { slug: 'cta-reachable-while-scrolling', title: 'Why Your Call-to-Action Needs to Follow the Visitor Down the Page', description: 'A homeowner who finishes reading shouldn’t have to scroll back up to act.' },
        { slug: 'no-horizontal-scroll', title: 'Why a Page That Scrolls Sideways Is Costing You Trust, Not Just Looks', description: 'Sideways scroll on a phone reads as a broken site, not a minor bug.' },
      ],
    },
    {
      title: 'Lead funnel & conversion',
      items: [
        { slug: 'lead-form', title: 'Why a Visible Lead Form Wins You More Jobs', description: 'Form placement and field count, backed by real conversion research.' },
        { slug: 'primary-cta-above-the-fold', title: 'Why Your Call-to-Action Can’t Wait Until After the Scroll', description: 'Visitors decide whether your site is worth their time before they ever scroll.' },
        { slug: 'phone-number-above-the-fold', title: 'Why Your Phone Number Can’t Be Buried in the Footer', description: 'For a job homeowners want to talk through, a hidden number is a lost call.' },
        { slug: 'click-to-call', title: 'Why Phone Calls Convert So Much Better Than Forms for Your Trade', description: 'A call and a form submission are not the same lead — the data shows why.' },
        { slug: 'chat-widget', title: 'Why a Chat Widget Catches Leads a Phone Number and Form Both Miss', description: 'Some homeowners won’t call and won’t fill out a form — but will type a question.' },
        { slug: 'response-time-expectation-set', title: 'Why Telling Homeowners When You’ll Reply Changes Whether They Wait', description: 'A form with zero reply-time signal gives them zero reason not to move on.' },
        { slug: 'trust-signals-near-the-cta', title: 'Why Trust Signals Belong Right Next to Your Quote Button', description: 'The moment they hover over your button is the moment they need reassurance.' },
      ],
    },
    {
      title: 'Search visibility',
      items: [
        { slug: 'title-tag', title: 'Why Your Page Title Decides Whether Google Sends You Anyone', description: 'The blue link text in search results — and one of the strongest ranking signals you control.' },
        { slug: 'meta-description', title: 'Why the Two Lines Under Your Title Tag Are Worth Fixing', description: 'Homeowners read this snippet before anything else about your business.' },
        { slug: 'single-h1', title: 'Why Your Page Should Have Exactly One Main Heading', description: 'The one heading meant to tell anyone — human or search engine — what the page is about.' },
        { slug: 'image-alt-text-coverage', title: 'Why Missing Alt Text Quietly Costs You Both Search Traffic and Real Customers', description: 'Alt text tells Google what a photo shows — and tells screen-reader users too.' },
        { slug: 'localbusiness-schema', title: 'Why a Block of Invisible Code Can Change Whether You Show Up as a Rich Result', description: 'Schema markup doesn’t change how your page looks — it changes how Google reads it.' },
        { slug: 'sitemap-robots-txt', title: 'Why Two Files You’ll Never See Decide How Much of Your Site Google Actually Finds', description: 'A direct list of every page you want indexed — skip it and Google has to guess.' },
        { slug: 'city-service-landing-pages', title: 'Why One Homepage Can’t Rank for Every City You Actually Serve', description: 'Listing five cities in a paragraph isn’t the same as ranking in five cities.' },
      ],
    },
    {
      title: 'Local presence & reputation',
      items: [
        { slug: 'google-rating', title: 'Why Your Google Rating Directly Affects Whether They Call', description: 'What star rating and review count actually do to your call volume.' },
        { slug: 'google-business-profile-photos', title: 'Why Photos on Your Google Business Profile Drive Calls', description: 'A profile with no photos reads as unclaimed or out of business.' },
        { slug: 'review-count-vs-local-median', title: 'Why Your Review Count Is Judged Against Local Competitors, Not a Fixed Number', description: 'The real question homeowners ask is relative, not absolute.' },
        { slug: 'nap-consistency-phone', title: 'Why a Mismatched Phone Number Quietly Costs You Rankings and Trust', description: 'Two different numbers for the same business confuses Google and homeowners alike.' },
        { slug: 'reviews-displayed-on-site', title: 'Why Reviews Need to Live on Your Website, Not Just Google', description: 'Sending visitors away to check reviews is a chance for them not to come back.' },
      ],
    },
    {
      title: 'Photos & image quality',
      items: [
        { slug: 'real-project-photos', title: 'Why Stock Photos Are Quietly Costing You the Job', description: 'A generic stock photo tells a homeowner nothing about your actual work.' },
        { slug: 'before-after-photo', title: 'Why a Before/After Photo Is the Highest-Converting Image You Can Post', description: 'It answers the one question every homeowner actually has.' },
        { slug: 'image-technical-quality', title: 'Why a Blurry Photo Undoes Good Work Before Anyone Reads a Word', description: 'A small file forced to display big — an easy, overlooked fix.' },
      ],
    },
    {
      title: 'Security & technical',
      items: [
        { slug: 'valid-ssl-https', title: 'Why "Not Secure" in the Address Bar Is Costing You Calls', description: 'What a homeowner sees before they see anything else about your business.' },
        { slug: 'no-mixed-content', title: 'Why "Mixed Content" Quietly Breaks Parts of Your Site', description: 'No warning shown — the broken piece just silently fails to load.' },
        { slug: 'custom-domain', title: 'Why "yourbusiness.wixsite.com" Reads as Unfinished', description: 'A free subdomain tells a homeowner you’re still in the setup phase.' },
        { slug: 'console-errors-on-load', title: 'Console Errors: The Invisible Sign of a Neglected Site', description: 'Nobody sees these unless they go looking — which is exactly the point.' },
        { slug: 'favicon-present', title: 'The Missing Browser Tab Icon Nobody Notices — Except It Adds Up', description: 'A genuinely minor check, worth fixing because it costs nothing.' },
      ],
    },
    {
      title: 'Site structure',
      items: [
        { slug: 'broken-links', title: 'Why Broken Links Are Costing You Jobs You Never Hear About', description: 'A homeowner who hits a dead page doesn’t email you — they just leave.' },
        { slug: 'unique-title-tags-across-pages', title: 'Why Every Page on Your Site Needs Its Own Title Tag', description: 'Duplicate titles tell Google your pages aren’t distinct — even when they are.' },
        { slug: 'unique-meta-descriptions-across-pages', title: 'Why a Missing Meta Description Costs You Clicks on Every Page', description: 'It doesn’t change your ranking — it changes whether they click.' },
        { slug: 'open-graph-tags-across-pages', title: 'Why a Blank Preview Card Kills a Shared Link Before It’s Even Opened', description: 'What a text or Facebook share of your page actually looks like.' },
        { slug: 'phone-number-consistency-across-pages', title: 'Why Two Different Phone Numbers on Your Site Cost You Calls', description: 'Seeing two numbers on your own site, a homeowner often calls neither.' },
        { slug: 'contact-cta-presence-across-pages', title: 'Why Every Page Needs a Way to Reach You, Not Just the Homepage', description: 'Google can land someone on any page — it needs a way to convert too.' },
        { slug: 'image-alt-text-coverage-sitewide', title: 'Why Missing Alt Text Sitewide Is an Easy, Overlooked Fix', description: 'Zero downside, real (if quiet) upside — across every page, not just one.' },
      ],
    },
  ],
};
