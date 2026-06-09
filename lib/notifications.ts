import nodemailer from "nodemailer";

const getTransporter = () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.error("Email configuration missing (EMAIL_USER or EMAIL_PASS)");
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
};

const baseThemeHtml = (content: string) => `
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px 20px; background-color: #fafafa; color: #111;">
  <div style="max-w-[600px] margin: 0 auto; background: #fff; padding: 40px; border-radius: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #eaeaea;">
    ${content}
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eaeaea; text-align: center; color: #888; font-size: 12px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase;">
      Dainiki App
    </div>
  </div>
</div>
`;

/**
 * Sends a "Duolingo-style" aggressive/funny reminder email.
 */
export async function sendEmailReminder(email: string, username: string) {
  const transporter = getTransporter();
  if (!transporter) return;

  const templates = [
    {
      subject: "Your diary is crying... 😭",
      text: `Hi ${username}, your thoughts are lonely. Don't let them vanish into the void. Write them down before they haunt you.`,
      html: `
        <h2 style="color: #ef4444; font-size: 24px; margin-top: 0;">Your diary is lonely.</h2>
        <p style="font-size: 16px; line-height: 1.6;">Hi ${username},</p>
        <p style="font-size: 16px; line-height: 1.6;">It's been a while. Your thoughts are starting to pile up in your head, and quite frankly, they're getting loud.</p>
        <p style="font-size: 16px; line-height: 1.6;">Don't let them vanish into the void. Write them down before they haunt you.</p>
        <div style="margin: 30px 0;">
          <a href="https://dainiki.vercel.app" style="display: inline-block; padding: 14px 28px; background: #111; color: #fff; text-decoration: none; border-radius: 12px; font-weight: 600;">Open Dainiki</a>
        </div>
        <p style="font-size: 12px; color: #888; font-style: italic;">"I'm not mad, just disappointed." — Your Journal</p>
      `
    },
    {
      subject: "Did you forget how to write? ✍️",
      text: `Hey ${username}, it's been 24 hours. Just checking if you still remember how to express human emotions.`,
      html: `
        <h2 style="color: #f59e0b; font-size: 24px; margin-top: 0;">Lost your spark?</h2>
        <p style="font-size: 16px; line-height: 1.6;">Hey ${username},</p>
        <p style="font-size: 16px; line-height: 1.6;">It's been 24 hours. Just checking if you still remember how to express human emotions or if you've finally become a robot.</p>
        <p style="font-size: 16px; line-height: 1.6;">Come back and prove your humanity.</p>
        <div style="margin: 30px 0;">
          <a href="https://dainiki.vercel.app" style="display: inline-block; padding: 14px 28px; background: #111; color: #fff; text-decoration: none; border-radius: 12px; font-weight: 600;">Write Now</a>
        </div>
        <p style="font-size: 12px; color: #888; font-style: italic;">*Passive-aggressive silence*</p>
      `
    },
    {
      subject: "Quick, before you forget! 🧠",
      text: `Something happened today, ${username}. I know it. You know it. But the database doesn't. Tell me.`,
      html: `
        <h2 style="color: #3b82f6; font-size: 24px; margin-top: 0;">The Database is Hungry.</h2>
        <p style="font-size: 16px; line-height: 1.6;">Something happened today, ${username}. I know it. You know it. But the database doesn't.</p>
        <p style="font-size: 16px; line-height: 1.6;">Don't let the memory fade. Secure it in the vault.</p>
        <div style="margin: 30px 0;">
          <a href="https://dainiki.vercel.app" style="display: inline-block; padding: 14px 28px; background: #111; color: #fff; text-decoration: none; border-radius: 12px; font-weight: 600;">Secure the Memory</a>
        </div>
        <p style="font-size: 12px; color: #888; font-style: italic;">It takes 2 minutes. Your future self will thank you.</p>
      `
    }
  ];

  const template = templates[Math.floor(Math.random() * templates.length)];

  try {
    const info = await transporter.sendMail({
      from: `"Dainiki Reminders" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: template.subject,
      text: template.text,
      html: baseThemeHtml(template.html),
    });

    console.log(`[Reminders] Email sent successfully to ${email}: ${info.messageId}`);
    return info;
  } catch (e) {
    console.error("[Reminders] Email send error:", e);
  }
}

/**
 * Sends a broadcast email to multiple users from the admin.
 */
export async function sendBroadcastEmail(emails: string[], subject: string, htmlContent: string) {
  const transporter = getTransporter();
  if (!transporter) return;

  const content = `
    <h2 style="color: #111; font-size: 24px; margin-top: 0;">${subject}</h2>
    <div style="font-size: 16px; line-height: 1.6; color: #333;">
      ${htmlContent}
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"Dainiki Admin" <${process.env.EMAIL_USER}>`,
      bcc: emails, // Use BCC to protect privacy
      subject: subject,
      html: baseThemeHtml(content),
    });

    console.log(`[Broadcast] Sent to ${emails.length} users: ${info.messageId}`);
    return info;
  } catch (e) {
    console.error("[Broadcast] Email send error:", e);
  }
}

/**
 * Sends a secure invite link to a new user.
 */
export async function sendInviteEmail(email: string, name: string, token: string) {
  const transporter = getTransporter();
  if (!transporter) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dainiki.vercel.app";
  const inviteLink = `${appUrl}/invite/${token}`;

  const htmlContent = `
    <h2 style="color: #111; font-size: 24px; margin-top: 0;">You've been invited! ✨</h2>
    <p style="font-size: 16px; line-height: 1.6;">Hi ${name},</p>
    <p style="font-size: 16px; line-height: 1.6;">You have been exclusively invited to join Dainiki, a secure, end-to-end encrypted personal journal.</p>
    <p style="font-size: 16px; line-height: 1.6;">Click the button below to claim your account and generate your private encryption keys.</p>
    <div style="margin: 30px 0;">
      <a href="${inviteLink}" style="display: inline-block; padding: 14px 28px; background: #111; color: #fff; text-decoration: none; border-radius: 12px; font-weight: 600;">Accept Invitation</a>
    </div>
    <p style="font-size: 14px; color: #888;">This link will expire in 48 hours.</p>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"Dainiki Invites" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "You've been invited to Dainiki",
      html: baseThemeHtml(htmlContent),
    });

    console.log(`[Invite] Sent to ${email}: ${info.messageId}`);
    return info;
  } catch (e) {
    console.error("[Invite] Email send error:", e);
  }
}
