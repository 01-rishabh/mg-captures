# mg-captures

Consultation booking landing page for a photography studio. Every request is saved to a Google Sheet and sent to the owner's phone on WhatsApp and as a push notification. Running cost: ₹0 (domain optional).

```
Landing page form ──► Google Apps Script ──► Google Sheet (row, status, lead ID)
Cal.com booking ───┘          │
                              ├──► WhatsApp to owner (CallMeBot)
                              ├──► Push notification (ntfy app)
                              └──► Email to lead (+ optional backup to owner)
```

All three are linked: the WhatsApp message and push carry the same lead ID and a link that opens that exact row in the Google Sheets app. Status changes made in the Sheet are pushed back to the phone.

## Files
| File | Purpose |
|---|---|
| `index.html`, `styles.css`, `app.js` | Landing page and booking form (no build step) |
| `config.js` | Studio name, WhatsApp number, Apps Script URL, Cal.com link |
| `apps-script/Code.gs` | Backend: Sheet, WhatsApp, push, reminders |
| `serve.mjs` | Local preview: `node serve.mjs` → http://localhost:5190 |

## Setup (about 20 minutes, owner's phone needed)

### 1. Push notifications (ntfy)
1. Install **ntfy** from Play Store / App Store.
2. Tap **+**, subscribe to a long random topic, e.g. `mgcaptures-leads-7k29xq`. Anyone who knows the topic can read it, so keep it random.
3. Android: open the topic's settings and allow it to override Do Not Disturb for urgent messages if wanted.

### 2. WhatsApp alerts (CallMeBot, free)
1. Open callmebot.com → "Free WhatsApp API" page and save the CallMeBot number shown there in the owner's contacts (the number changes occasionally, so always take it from that page).
2. From the owner's WhatsApp, send it: `I allow callmebot to send me messages`
3. The reply contains an **API key**. Note it.

CallMeBot is a free personal-notification service and only sends to the number that activated it. It is not an official WhatsApp API; if it is slow or down, the push notification and Sheet still work, and the script retries once after a minute.

### 3. Google Sheet + backend
1. Create a new Google Sheet with the owner's Google account (e.g. "Studio Leads").
2. **Extensions → Apps Script**, delete the sample code, paste all of `apps-script/Code.gs`.
3. Fill in the settings at the top: `STUDIO_NAME`, `OWNER_WHATSAPP` (`+91…`), `CALLMEBOT_APIKEY`, `NTFY_TOPIC`, optionally `OWNER_EMAIL`. Save.
4. Choose `setup` in the function dropdown → **Run** → allow the permissions. It formats the Sheet, adds the status dropdown, installs the triggers and sends a test WhatsApp + push. The log shows `WhatsApp: OK` / `Push: OK`.
5. **Deploy → New deployment → Web app**, Execute as **Me**, Who has access **Anyone** → Deploy. Copy the URL ending in `/exec`.
6. After any later code change: **Deploy → Manage deployments → Edit → New version**, otherwise the old code keeps running.

### 4. Google Sheets app
1. Install **Google Sheets** on the owner's phone and sign in with the same account.
2. Links in WhatsApp/push open the lead's row directly. Update the **Status** dropdown there: New → Contacted → Consultation → Quote sent → Booked → Delivered / Lost.
3. Each status change sends a push. Leads still **New** after 2 hours get one reminder on WhatsApp and push (not between 10 PM and 8 AM).

The Sheets app does not send its own push notifications for new rows; ntfy and WhatsApp cover that.

### 5. Landing page
1. Edit `config.js`: studio name, city, WhatsApp number (digits with 91), email, Instagram, and paste the `/exec` URL into `endpoint`.
2. Replace the sample photos (`picsum.photos` links in `index.html`) with the studio's own images, and update packages, prices, testimonials and FAQ.
3. Deploy free: push the folder to GitHub → Netlify **Add new site → Import** (no build command, publish directory `.`), or drag the folder onto app.netlify.com/drop.

### Videos
Set in `config.js`:
- `heroVideo` / `bandVideo`: silent background loops behind the hero and the closing band. Put files in a `videos/` folder next to `index.html` (e.g. `'videos/hero.mp4'`). Keep each under ~5 MB: 1080p, 10-20 s, no audio. Empty = the photo stays.
- `films`: the Films section. Each item takes `title`, `caption`, and either `src` (an .mp4) with a `poster` image, or `youtube` (the 11-character ID from the YouTube link). Use YouTube or Vimeo for long films with sound. An empty list hides the section.

The sample clips currently in `config.js` are CC0 videos streamed from MDN; replace them with the studio's own footage.

### 6. Optional: Cal.com live calendar
1. Free Cal.com account → create a "Consultation" event, connect Google Calendar.
2. Add a booking question with identifier `attendeePhoneNumber` (phone) and optionally `shootType`.
3. **Settings → Developer → Webhooks → New**: Subscriber URL = the `/exec` URL (add `?key=...` and set `CAL_WEBHOOK_KEY` in Code.gs for protection), events: Booking created, rescheduled, cancelled.
4. Put the booking link in `config.js` → `calLink`. A button appears next to the form.

## Capturing leads from every channel
Use the same landing page link everywhere with a `utm_source`, so the Sheet's **Source** column shows where each lead came from:
- Instagram bio: `https://yoursite/?utm_source=instagram`
- Facebook page: `?utm_source=facebook`
- Google Business Profile "Book" button / website link: `?utm_source=google`
- WhatsApp Business greeting message: `?utm_source=whatsapp`
- Ads: add `&utm_campaign=diwali-offer`

Phone-call leads: the owner adds a row in the Sheets app directly.

## Testing
- Open the page with `endpoint` empty: the form runs in demo mode and logs the lead in the browser console.
- With the endpoint set: submit a test lead → row appears with `WA Sent` / `Push Sent` = `OK`, WhatsApp and push arrive, tapping **Open sheet** opens that row.
- Change that row's Status in the Sheets app → push arrives.
- Delete test rows afterwards. To restart lead numbering, delete the `lastLeadNo` script property (Project Settings → Script properties).

## Limits (free tiers)
- Apps Script: 20,000 URL fetches/day, 100 emails/day on a Gmail account.
- ntfy.sh: generous free limits; a free ntfy account token (`NTFY_TOKEN`) raises them if alerts start failing.
- CallMeBot: personal use; keep to alert volumes a studio actually gets.
