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

import { GoogleGenerativeAI } from "@google/generative-ai";

async function generateCockyReminderWithAi(username: string, streak: number) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: "You are the passive-aggressive, hilariously cocky, and guilt-inducing AI reminder assistant for Dainiki, a secure journal app. Your style is heavily inspired by Duolingo's aggressive reminders (like the owl showing up at your door or crying). You want the user to write their daily entry. You must make fun of their streak, tease them, or use extreme passive-aggressive guilt, but keep it funny and engaging."
    });

    const prompt = `Write a daily reminder email for user "${username}".
Current writing streak: ${streak} days.

If the streak is 0, tease them for having no consistency and forgetting to write.
If the streak is high, guilt them that their streak is about to die and they are about to lose all their progress.

Respond in STRICT JSON format with exactly three fields (and NO markdown block wrapper, just raw JSON):
{
  "subject": "A short, catchy, passive-aggressive subject line with emojis",
  "bodyText": "A short plain-text email body (2-3 sentences)",
  "bodyHtml": "A short HTML email body using only <p>, <strong>, <em> tags. Do not include styling in these tags. Keep it to 2-3 paragraphs."
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    // Clean JSON wrapper if any
    const jsonStr = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    const data = JSON.parse(jsonStr);
    if (data.subject && (data.bodyHtml || data.bodyText)) {
      return {
        subject: data.subject,
        html: data.bodyHtml || data.bodyText,
        text: data.bodyText || data.bodyHtml
      };
    }
  } catch (e) {
    console.error("[Reminders AI] Failed to generate AI reminder:", e);
  }
  return null;
}

/**
 * Sends a "Duolingo-style" aggressive/funny reminder email.
 */
export async function sendEmailReminder(email: string, username: string, streak: number = 0) {
  const transporter = getTransporter();
  if (!transporter) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dainiki.vercel.app";

  let template = await generateCockyReminderWithAi(username, streak);

  if (!template) {
    const templates = [
      {
        subject: "Your diary is crying... 😭",
        text: `Hi ${username}, your thoughts are lonely. You are on a ${streak}-day streak. Don't let it die today.`,
        html: `
          <h2 style="color: #ef4444; font-size: 24px; margin-top: 0;">Your diary is lonely.</h2>
          <p style="font-size: 16px; line-height: 1.6;">Hi ${username},</p>
          <p style="font-size: 16px; line-height: 1.6;">It's been a while. Your thoughts are starting to pile up in your head, and quite frankly, they're getting loud.</p>
          <p style="font-size: 16px; line-height: 1.6;">You're on a <strong>${streak}-day streak</strong>. Don't let it vanish into the void. Write it down before they haunt you.</p>
        `
      },
      {
        subject: "Did you forget how to write? ✍️",
        text: `Hey ${username}, it's been 24 hours. Just checking if you still remember how to express human emotions.`,
        html: `
          <h2 style="color: #f59e0b; font-size: 24px; margin-top: 0;">Lost your spark?</h2>
          <p style="font-size: 16px; line-height: 1.6;">Hey ${username},</p>
          <p style="font-size: 16px; line-height: 1.6;">It's been 24 hours. Just checking if you still remember how to express human emotions or if you've finally become a robot.</p>
          ${streak > 0 ? `<p style="font-size: 16px; line-height: 1.6;">Come back and save your ${streak}-day streak. Prove your humanity.</p>` : `<p style="font-size: 16px; line-height: 1.6;">Your streak is currently 0. Sad. Prove your humanity.</p>`}
        `
      },
      {
        subject: "Quick, before you forget! 🧠",
        text: `Something happened today, ${username}. I know it. You know it. But the database doesn't. Tell me.`,
        html: `
          <h2 style="color: #3b82f6; font-size: 24px; margin-top: 0;">The Database is Hungry.</h2>
          <p style="font-size: 16px; line-height: 1.6;">Something happened today, ${username}. I know it. You know it. But the database doesn't.</p>
          <p style="font-size: 16px; line-height: 1.6;">Don't let the memory fade. Secure it in the vault and keep your <strong>${streak}-day streak</strong> alive.</p>
        `
      }
    ];
    template = templates[Math.floor(Math.random() * templates.length)];
  }

  const finalHtml = `
    ${template.html}
    <div style="margin: 30px 0;">
      <a href="${appUrl}" style="display: inline-block; padding: 14px 28px; background: #111; color: #fff; text-decoration: none; border-radius: 12px; font-weight: 600;">Write Today's Entry</a>
    </div>
    <p style="font-size: 12px; color: #888; font-style: italic;">"I'm not mad, just disappointed." — Your Journal</p>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"Dainiki Reminders" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: template.subject,
      text: template.text,
      html: baseThemeHtml(finalHtml),
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
