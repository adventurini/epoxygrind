/**
 * One real, verified, on-topic YouTube video per DIY guide slug (BUILD-diy-
 * guides-complete_1.md's YouTube section). Verified via the oEmbed endpoint
 * (https://www.youtube.com/oembed?url=...) at add-time — confirms the video
 * exists and is embeddable and captures the real title/channel (never
 * hand-typed). If a video ever 404s, re-verify via the same oEmbed check
 * before swapping the id — never ship a dead embed.
 *
 * `thumbQuality`: 'maxres' (1280x720) if YouTube actually generated one for
 * this video, else 'hq' (480x360, always available) — verified by fetching
 * maxresdefault.jpg and checking it's a real photo, not the small gray
 * placeholder YouTube serves when no maxres exists (2026-07-03). Re-check
 * before reusing this data if a video ID ever changes.
 */
export const GUIDE_VIDEOS = {
  'how-to-epoxy-garage-floor': {
    videoId: 'SMMf1kcqr7M',
    title: 'HOW TO EPOXY GARAGE FLOOR // DIY Epoxy Flooring Tutorial',
    channel: 'BYOT',
    thumbQuality: 'maxres',
  },
  'how-to-grind-concrete-floor': {
    videoId: 'dokxQ8NgEBk',
    title: 'Garage Epoxy Floor Prep - DIY Concrete Grinding',
    channel: 'Everyday Home Repairs',
    thumbQuality: 'maxres',
  },
  'how-to-prep-concrete-for-epoxy': {
    videoId: 'zDAeASTTFC8',
    title: 'How to Repair and Prep Concrete Before Epoxy - Watch Before Applying Epoxy Coatings!',
    channel: 'Shopfix',
    thumbQuality: 'maxres',
  },
  'how-to-apply-flake-broadcast': {
    videoId: 'RLE518XEEqk',
    title: 'How To: 100% Solids Epoxy and Vinyl Flake Broadcast',
    channel: 'Josh Jones',
    thumbQuality: 'maxres',
  },
  'how-to-apply-metallic-epoxy': {
    videoId: 'F3bf1wntG_8',
    title: 'How to Install Metallic Epoxy Flooring Like a Pro | DIY Tutorial',
    channel: 'PerformanceDIY',
    thumbQuality: 'maxres',
  },
  'how-to-fix-peeling-epoxy': {
    videoId: 'vE8S7pz613M',
    title: 'How to Fix a Peeling Epoxy Floor',
    channel: 'LearnCoatings - Epoxy Flooring Training',
    thumbQuality: 'maxres',
  },
  'how-to-fix-hot-tire-pickup': {
    videoId: 'kawzp6c1dvE',
    title: 'Hot Tyre Pick Up Explained: Stop Epoxy Lifting',
    channel: 'All Purpose Coatings',
    thumbQuality: 'maxres',
  },
  'how-to-repair-concrete-cracks-before-coating': {
    videoId: 'C3VLFdxLy8c',
    title: 'How to repair cracks and spalls in concrete floors before applying epoxy coatings.',
    channel: 'Concrete Floor Solutions Inc.',
    thumbQuality: 'maxres',
  },
  'how-to-test-concrete-for-moisture': {
    videoId: 'uAIjz9IoP1Q',
    title: 'Concrete Moisture Test Using Plastic Sheet Method – What Could Go Wrong?',
    channel: 'Wagner Meters',
    thumbQuality: 'hq',
  },
  'how-to-remove-old-epoxy': {
    videoId: 'z8FG78m3WGM',
    title: 'How Do I Remove an Old Epoxy Coating and Prep for a New One? | Problem Solving 101',
    channel: 'National Flooring Equipment',
    thumbQuality: 'maxres',
  },
  'how-to-epoxy-basement-floor': {
    videoId: 'GvQKa5QZT6c',
    title: 'DIY Epoxy Basement Floor - Step By Step',
    channel: 'Joey Contino',
    thumbQuality: 'maxres',
  },
  'epoxy-bubbles-fisheyes-troubleshooting': {
    videoId: 'pGiccC5-UUU',
    title: "STOP! Don't Epoxy Your Garage Floor Until You Watch This (Top 5 Mistakes)",
    channel: 'Mike Day Concrete (Everything About Concrete)',
    thumbQuality: 'maxres',
  },

  // DIY-vs-Pro cluster (BUILD-diy-vs-pro-cluster.md). Keyed by page slug, not
  // video — several pages legitimately reuse the same on-topic video.
  'diy-kit-vs-professional-epoxy': {
    videoId: 'kYYj0GgSiJE',
    title: 'Epoxy Flooring Disasters that could happen to you! - Learn about our top 10 incidents',
    channel: 'LearnCoatings - Epoxy Flooring Training',
    thumbQuality: 'maxres',
  },
  'epoxy-garage-floor-cost-diy-vs-hiring': {
    videoId: 'GvKKqeUFJsI',
    title: 'How to Epoxy a Garage Floor',
    channel: "Lowe's Home Improvement",
    thumbQuality: 'maxres',
  },
  'how-hard-is-it-to-epoxy-a-garage-floor-yourself': {
    videoId: '84lKSzznxkE',
    title: "I Epoxied My Garage Floor for the FIRST TIME    Here's What Happened",
    channel: 'kustom instinct',
    thumbQuality: 'maxres',
  },
  'how-long-does-diy-epoxy-last-vs-professional': {
    videoId: 'vE8S7pz613M',
    title: 'How to Fix a Peeling Epoxy Floor',
    channel: 'LearnCoatings - Epoxy Flooring Training',
    thumbQuality: 'maxres',
  },
  'diy-epoxy-floor-mistakes': {
    videoId: '962XcILdzTY',
    title: 'DIY Epoxy Floor Pouring Mistakes (And How To Avoid Them!)',
    channel: 'DENEIKA BUILDS',
    thumbQuality: 'maxres',
  },
  'is-diy-epoxy-worth-it': {
    videoId: 'wBeUWXvK0nU',
    title: 'How to Epoxy Coat a Garage Floor',
    channel: 'This Old House',
    thumbQuality: 'maxres',
  },
  'time-to-epoxy-garage-floor-yourself': {
    videoId: 'SMMf1kcqr7M',
    title: 'HOW TO EPOXY GARAGE FLOOR // DIY Epoxy Flooring Tutorial',
    channel: 'BYOT',
    thumbQuality: 'maxres',
  },
  'what-does-a-pro-epoxy-job-include': {
    videoId: '7XFRjgEqfOk',
    title: 'A CONTRACTOR TELLS ALL! - EPOXY FLOORS FOR BEGINNERS',
    channel: 'Leggari Products',
    thumbQuality: 'maxres',
  },
  'can-you-epoxy-over-old-epoxy-diy-or-pro': {
    videoId: 'z8FG78m3WGM',
    title: 'How Do I Remove an Old Epoxy Coating and Prep for a New One? | Problem Solving 101',
    channel: 'National Flooring Equipment',
    thumbQuality: 'maxres',
  },
  'hiring-an-epoxy-contractor-checklist': {
    videoId: '7XFRjgEqfOk',
    title: 'A CONTRACTOR TELLS ALL! - EPOXY FLOORS FOR BEGINNERS',
    channel: 'Leggari Products',
    thumbQuality: 'maxres',
  },

  // /compare/ cluster (content/data/compare-hub.js). Keyed by compare page
  // slug, same verification method as above.
  'epoxy-vs-polyaspartic': {
    videoId: 'NwPg2I5T-uM',
    title: 'Epoxy vs Polyaspartic Garage Flooring Explained by Donald Sanderson!',
    channel: 'Houston Garage Floors',
    thumbQuality: 'maxres',
  },
  'polyurea-vs-polyaspartic': {
    videoId: '-q8YUWBxk3E',
    title: 'Epoxy, Polyurea or Polyaspartic : Which is the BEST garage floor coating?',
    channel: 'Tim Seay (@TimDCVA)',
    thumbQuality: 'maxres',
  },
  'epoxy-vs-garage-floor-tiles': {
    videoId: 'xCnGH3bs5QE',
    title: 'Epoxy Garage Flooring vs. Swisstrax (Benefits of Garage Floor Tiles)',
    channel: 'Swisstrax Modular Flooring',
    thumbQuality: 'maxres',
  },
  'epoxy-vs-concrete-stain': {
    videoId: '7GSWW44H2n0',
    title: 'CONCRETE STAIN OR EPOXY for Garage Floors?  Best product for concrete floors.',
    channel: 'Paint Life TV',
    thumbQuality: 'hq',
  },
  'epoxy-vs-garage-floor-paint': {
    videoId: '4OlcFzuZJKk',
    title: 'Garage Floor Paint Vs Epoxy: What is the Difference? (2026)',
    channel: 'Paintoont',
    thumbQuality: 'maxres',
  },
  'diy-kit-vs-professional': {
    videoId: 'SsklODZl9vU',
    title: 'PRO vs. DIY Epoxy Garage Floor Kits :: Whats the difference?',
    channel: 'Tim Seay (@TimDCVA)',
    thumbQuality: 'maxres',
  },
  'grind-vs-acid-etch': {
    videoId: 'a-jVlZXRUv4',
    title: 'Acid Etching/Washing Concrete Versus Grinding',
    channel: 'Epoxy Flooring Co',
    thumbQuality: 'maxres',
  },
  'water-based-vs-100-solids-epoxy': {
    videoId: 'k5VClNppjPo',
    title: 'How To: Water Based and 100% Solids Epoxy Comparison',
    channel: 'Josh Jones',
    thumbQuality: 'maxres',
  },
};

/** Pillar-only: the paired "what a real pro install involves" video shown
 * alongside the primary (disaster) video already in GUIDE_VIDEOS above. */
export const PILLAR_SECOND_VIDEO = {
  videoId: '7XFRjgEqfOk',
  title: 'A CONTRACTOR TELLS ALL! - EPOXY FLOORS FOR BEGINNERS',
  channel: 'Leggari Products',
};

export function getGuideVideo(slug) {
  return GUIDE_VIDEOS[slug] || null;
}

/** @returns {{hero:string, thumb:string, title:string, channel:string}|null} */
export function getGuideImages(slug) {
  const video = GUIDE_VIDEOS[slug];
  if (!video) return null;
  const heroFile = video.thumbQuality === 'maxres' ? 'maxresdefault' : 'hqdefault';
  return {
    hero: `https://i.ytimg.com/vi/${video.videoId}/${heroFile}.jpg`,
    thumb: `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
    title: video.title,
    channel: video.channel,
  };
}
