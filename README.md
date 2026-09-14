# AZTEC IT Institute — Demo Booking System

## Local setup

1. Copy `.env.example` to `.env` and fill in your Supabase values.
2. Run the SQL in `supabase/migrations/001_initial.sql` in Supabase SQL Editor.
3. Install dependencies:

```bash
npm install
```

4. Create the admin account:

```bash
node --env-file=.env scripts/create-admin.mjs
```

5. For the normal frontend only:

```bash
npm run dev
```

6. For a full local Netlify environment, including Netlify Functions and instructor email notifications:

```bash
npm run dev:netlify
```

Then open the URL printed by Netlify (normally `http://localhost:8888`).

### Local booking behavior

- With `npm run dev`, bookings are created directly through the Supabase RPC. The ticket is generated after a successful booking. Netlify Functions are not available in plain Vite mode, so instructor email cannot be sent locally.
- With `npm run dev:netlify`, the Netlify function is available. Configure Gmail SMTP (`GMAIL_USER` and `GMAIL_APP_PASSWORD`) and the server-side Supabase key in `.env` to test instructor email locally.

## Production

Netlify uses:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

Production bookings call `/.netlify/functions/create-booking`. The function creates the booking through the protected Supabase RPC and then attempts the instructor email through Gmail SMTP. A failed email does not cancel a successful booking.

Required Netlify environment variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GMAIL_USER=aztecitinstitute@gmail.com
GMAIL_APP_PASSWORD=YOUR_GMAIL_APP_PASSWORD
GMAIL_SMTP_HOST=smtp.gmail.com
GMAIL_SMTP_PORT=465
GMAIL_FROM=AZTEC IT INSTITUTE <aztecitinstitute@gmail.com>
SITE_URL=https://YOUR-SITE.netlify.app
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` with a `VITE_` prefix and never commit `.env`.

## Gmail instructor notifications

The booking notification functions use Gmail SMTP. Configure these server-side environment variables in Netlify (and in `.env` for local Netlify Dev):

```env
GMAIL_USER=aztecitinstitute@gmail.com
GMAIL_APP_PASSWORD=your-16-character-google-app-password
GMAIL_SMTP_HOST=smtp.gmail.com
GMAIL_SMTP_PORT=465
GMAIL_FROM=AZTEC IT INSTITUTE <aztecitinstitute@gmail.com>
```

Use a Google App Password, not the normal Gmail password. Keep `GMAIL_APP_PASSWORD` server-side and never prefix it with `VITE_`.

When a demo is booked, the server creates the booking first and then emails the assigned instructor at the instructor's saved email address. Email failure does not undo the booking; the failure is recorded in `email_notifications`.

For local email testing, use `npm run dev:netlify` rather than plain `npm run dev`.
