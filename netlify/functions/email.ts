import nodemailer from 'nodemailer';

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function isGmailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export function createMailer() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  const port = Number(process.env.GMAIL_SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: process.env.GMAIL_SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function bookingEmailHtml(booking: any, site: string) {
  const logoUrl = `${site.replace(/\/$/, '')}/assets/aztec-logo.png`;
  return `<div style="font-family:Arial,sans-serif;background:#f5f7fa;padding:24px">
    <div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
      <div style="background:#102A4A;padding:22px;text-align:center">
        <img src="${esc(logoUrl)}" alt="AZTEC IT INSTITUTE" style="max-width:300px;height:auto;background:#fff;border-radius:10px;padding:6px"/>
      </div>
      <div style="padding:28px">
        <div style="display:inline-block;background:#fff1e8;color:#F47B20;padding:7px 10px;border-radius:8px;font-weight:700;font-size:13px">NEW DEMO BOOKING</div>
        <h2 style="color:#102A4A;margin:14px 0 18px">Demo Booking Confirmed</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#6b7280">Booking ID</td><td style="padding:8px 0;font-weight:700">${esc(booking.booking_code)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Student</td><td style="padding:8px 0;font-weight:700">${esc(booking.student_name)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Phone</td><td style="padding:8px 0">${esc(booking.student_phone)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Course</td><td style="padding:8px 0">${esc(booking.course_name)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Instructor</td><td style="padding:8px 0">${esc(booking.instructor_name)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Mode</td><td style="padding:8px 0">${esc(booking.mode)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Date</td><td style="padding:8px 0">${esc(booking.demo_date)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Time</td><td style="padding:8px 0">${esc(String(booking.start_time || '').slice(0,5))} – ${esc(String(booking.end_time || '').slice(0,5))}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Status</td><td style="padding:8px 0">${esc(booking.status || 'confirmed')}</td></tr>
        </table>
        <div style="margin-top:22px;padding:14px;background:#f5f7fa;border-radius:10px;color:#4b5563;font-size:13px">Please contact the student using the provided phone number if any follow-up is required.</div>
      </div>
    </div>
  </div>`;
}

export async function sendBookingEmail(booking: any) {
  const mailer = createMailer();
  if (!mailer) return { status: 'not_configured' as const };

  const from = process.env.GMAIL_FROM || `AZTEC IT INSTITUTE <${process.env.GMAIL_USER}>`;
  const site = process.env.SITE_URL || 'https://your-site.netlify.app';
  const info = await mailer.sendMail({
    from,
    to: booking.instructor_email,
    subject: `New AZTEC Demo Booking — ${booking.booking_code}`,
    html: bookingEmailHtml(booking, site),
    text: `New AZTEC Demo Booking\n\nBooking ID: ${booking.booking_code}\nStudent: ${booking.student_name}\nPhone: ${booking.student_phone}\nCourse: ${booking.course_name}\nInstructor: ${booking.instructor_name}\nMode: ${booking.mode}\nDate: ${booking.demo_date}\nTime: ${String(booking.start_time || '').slice(0,5)} - ${String(booking.end_time || '').slice(0,5)}\nStatus: ${booking.status || 'confirmed'}`,
  });

  return { status: 'sent' as const, messageId: info.messageId };
}
