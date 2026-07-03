/**
 * One real, verified, on-topic YouTube video per DIY guide slug (BUILD-diy-
 * guides-complete_1.md's YouTube section). Verified via the oEmbed endpoint
 * (https://www.youtube.com/oembed?url=...) at add-time — confirms the video
 * exists and is embeddable and captures the real title/channel (never
 * hand-typed). If a video ever 404s, re-verify via the same oEmbed check
 * before swapping the id — never ship a dead embed.
 */
export const GUIDE_VIDEOS = {
  'how-to-epoxy-garage-floor': {
    videoId: 'SMMf1kcqr7M',
    title: 'HOW TO EPOXY GARAGE FLOOR // DIY Epoxy Flooring Tutorial',
    channel: 'BYOT',
  },
  'how-to-grind-concrete-floor': {
    videoId: 'dokxQ8NgEBk',
    title: 'Garage Epoxy Floor Prep - DIY Concrete Grinding',
    channel: 'Everyday Home Repairs',
  },
  'how-to-prep-concrete-for-epoxy': {
    videoId: 'zDAeASTTFC8',
    title: 'How to Repair and Prep Concrete Before Epoxy - Watch Before Applying Epoxy Coatings!',
    channel: 'Shopfix',
  },
  'how-to-apply-flake-broadcast': {
    videoId: 'RLE518XEEqk',
    title: 'How To: 100% Solids Epoxy and Vinyl Flake Broadcast',
    channel: 'Josh Jones',
  },
  'how-to-apply-metallic-epoxy': {
    videoId: 'F3bf1wntG_8',
    title: 'How to Install Metallic Epoxy Flooring Like a Pro | DIY Tutorial',
    channel: 'PerformanceDIY',
  },
  'how-to-fix-peeling-epoxy': {
    videoId: 'vE8S7pz613M',
    title: 'How to Fix a Peeling Epoxy Floor',
    channel: 'LearnCoatings - Epoxy Flooring Training',
  },
  'how-to-fix-hot-tire-pickup': {
    videoId: 'kawzp6c1dvE',
    title: 'Hot Tyre Pick Up Explained: Stop Epoxy Lifting',
    channel: 'All Purpose Coatings',
  },
  'how-to-repair-concrete-cracks-before-coating': {
    videoId: 'C3VLFdxLy8c',
    title: 'How to repair cracks and spalls in concrete floors before applying epoxy coatings.',
    channel: 'Concrete Floor Solutions Inc.',
  },
  'how-to-test-concrete-for-moisture': {
    videoId: 'uAIjz9IoP1Q',
    title: 'Concrete Moisture Test Using Plastic Sheet Method – What Could Go Wrong?',
    channel: 'Wagner Meters',
  },
  'how-to-remove-old-epoxy': {
    videoId: 'z8FG78m3WGM',
    title: 'How Do I Remove an Old Epoxy Coating and Prep for a New One? | Problem Solving 101',
    channel: 'National Flooring Equipment',
  },
  'how-to-epoxy-basement-floor': {
    videoId: 'GvQKa5QZT6c',
    title: 'DIY Epoxy Basement Floor - Step By Step',
    channel: 'Joey Contino',
  },
  'epoxy-bubbles-fisheyes-troubleshooting': {
    videoId: 'pGiccC5-UUU',
    title: "STOP! Don't Epoxy Your Garage Floor Until You Watch This (Top 5 Mistakes)",
    channel: 'Mike Day Concrete (Everything About Concrete)',
  },
};

export function getGuideVideo(slug) {
  return GUIDE_VIDEOS[slug] || null;
}
