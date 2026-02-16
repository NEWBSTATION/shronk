import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function sendInviteEmail(
  email: string,
  token: string,
  inviterName: string
) {
  const acceptUrl = `${APP_URL}/invite/accept?token=${token}`;

  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Shronk <noreply@shronk.com>",
    to: email,
    subject: `${inviterName} invited you to Shronk`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You've been invited to Shronk</h2>
        <p>${inviterName} has invited you to join their team on Shronk.</p>
        <p>
          <a href="${acceptUrl}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px;">
            Accept Invite
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">This invite expires in 7 days.</p>
        <p style="color: #666; font-size: 12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
      </div>
    `,
  });
}
