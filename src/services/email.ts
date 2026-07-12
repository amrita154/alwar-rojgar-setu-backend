import nodemailer from 'nodemailer';
import { config } from '../config';

function createTransport() {
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
}

type OtpPurpose = 'registration' | 'password_reset';

const COPY: Record<OtpPurpose, { subtitle: string; heading: string; subject: string; textSuffix: string }> = {
  registration: {
    subject: `${'{otp}'} — Alwar Rojgar Setu Verification Code`,
    subtitle: 'अलवर रोज़गार सेतु — Email Verification',
    heading: 'Your verification code is:',
    textSuffix: 'If you did not create an account, you can safely ignore this email.',
  },
  password_reset: {
    subject: `${'{otp}'} — Alwar Rojgar Setu Password Reset`,
    subtitle: 'अलवर रोज़गार सेतु — Password Reset',
    heading: 'Your password reset code is:',
    textSuffix: 'If you did not request a password reset, please ignore this email. Your password has not been changed.',
  },
};

export async function sendOtpEmail(to: string, otp: string, purpose: OtpPurpose = 'registration'): Promise<void> {
  const transporter = createTransport();
  const copy = COPY[purpose];

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${copy.subtitle}</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="520" cellpadding="0" cellspacing="0"
              style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
              <tr>
                <td style="background:#1d4ed8;padding:24px 32px;">
                  <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;">
                    Alwar Rojgar Setu
                  </p>
                  <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">
                    ${copy.subtitle}
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 16px;font-size:16px;color:#111827;">
                    ${copy.heading}
                  </p>
                  <div style="background:#f0f9ff;border:2px dashed #1d4ed8;border-radius:8px;
                              padding:20px;text-align:center;margin:0 0 24px;">
                    <span style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#1d4ed8;">
                      ${otp}
                    </span>
                  </div>
                  <p style="margin:0 0 8px;font-size:14px;color:#374151;">
                    This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
                  </p>
                  <p style="margin:0;font-size:14px;color:#374151;">
                    यह कोड <strong>10 मिनट</strong> में समाप्त हो जाएगा। इसे किसी के साथ साझा न करें।
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;font-size:12px;color:#9ca3af;">${copy.textSuffix}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject: copy.subject.replace('{otp}', otp),
    html,
    text: `${copy.heading.replace(':', '')} ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.\n\n${copy.textSuffix}`,
  });
}
