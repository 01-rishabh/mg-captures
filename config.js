// Studio details used across the landing page. Edit these, nothing else needs changing.
window.STUDIO = {
  name: 'MG Captures',
  city: 'Hisar & Chandigarh',
  // Owner's WhatsApp number with country code, digits only. Used for the click-to-chat buttons.
  whatsapp: '919034707212',
  // Shown as the call link in the footer.
  phone: '+91 90347 07212',
  // Empty hides the email link.
  email: '',
  instagram: '_mg_captures',
  founderInstagram: 'gillmukul',
  address: 'DSS 50, Old Court Complex, Hisar, Haryana 125001',
  // Google Apps Script web app URL (README step 3). Empty = demo mode, nothing is sent.
  endpoint: 'https://script.google.com/macros/s/AKfycbwPDKYfq0iVQIMgmHSQ6CeV8-e-VwoXaxcSm8xPRqCNB4dw0Bwxf9nkH0RVilFdjzHm/exec',
  // Optional Cal.com booking link, e.g. 'https://cal.com/mgcaptures/consultation'. Empty hides the button.
  calLink: '',

  // Silent background loops. Use a file in the videos/ folder ('videos/hero.mp4') or a full URL.
  // Empty keeps the photo. The sample clips are CC0 videos from MDN; replace them with the studio's own.
  heroVideo: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  bandVideo: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',

  // Films section. Each film needs either `src` (an .mp4 file or URL) or `youtube` (the video ID
  // after "watch?v=" in a YouTube link). An empty list hides the section.
  films: [
    {
      title: 'Wedding teaser',
      caption: 'Sample clip, replace with an MG Captures wedding film',
      src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      poster: 'https://picsum.photos/seed/studio-film-garden/1280/720',
    },
    {
      title: 'Pre-wedding story',
      caption: 'Sample clip, replace with an MG Captures pre-wedding film',
      src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
      poster: 'https://picsum.photos/seed/studio-film-evening/1280/720',
    },
  ],
}
