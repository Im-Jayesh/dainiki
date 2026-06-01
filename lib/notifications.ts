import nodemailer from "nodemailer";

/**
 * Sends a "Duolingo-style" aggressive/funny reminder email using the existing Nodemailer setup.
 */
export async function sendEmailReminder(email: string, username: string) {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.error("Email configuration missing (EMAIL_USER or EMAIL_PASS)");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });

  const templates = [
    {
      subject: "Your diary is crying... 😭",
      text: `Hi ${username}, your thoughts are lonely. Don't let them vanish into the void. Write them down before they haunt you.`,
      html: `<div style="font-family: sans-serif; padding: 20px; color: #111;">
        <h2 style="color: #ef4444;">Your diary is lonely.</h2>
        <p>Hi ${username},</p>
        <p>It's been a while. Your thoughts are starting to pile up in your head, and quite frankly, they're getting loud.</p>
        <p>Don't let them vanish into the void. Write them down before they haunt you.</p>
        <a href="https://dainiki.vercel.app" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Open Dainiki</a>
        <p style="font-size: 12px; color: #888; margin-top: 40px;">"I'm not mad, just disappointed." — Your Journal</p>
      </div>`
    },
    {
      subject: "Did you forget how to write? ✍️",
      text: `Hey ${username}, it's been 24 hours. Just checking if you still remember how to express human emotions.`,
      html: `<div style="font-family: sans-serif; padding: 20px; color: #111;">
        <h2 style="color: #f59e0b;">Lost your spark?</h2>
        <p>Hey ${username},</p>
        <p>It's been 24 hours. Just checking if you still remember how to express human emotions or if you've finally become a robot.</p>
        <p>Come back and prove your humanity.</p>
        <a href="https://dainiki.vercel.app" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Write Now</a>
        <p style="font-size: 12px; color: #888; margin-top: 40px;">*Passive-aggressive silence*</p>
      </div>`
    },
    {
      subject: "Quick, before you forget! 🧠",
      text: `Something happened today, ${username}. I know it. You know it. But the database doesn't. Tell me.`,
      html: `<div style="font-family: sans-serif; padding: 20px; color: #111;">
        <h2 style="color: #3b82f6;">The Database is Hungry.</h2>
        <p>Something happened today, ${username}. I know it. You know it. But the database doesn't.</p>
        <p>Don't let the memory fade. Secure it in the vault.</p>
        <a href="https://dainiki.vercel.app" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Secure the Memory</a>
        <p style="font-size: 12px; color: #888; margin-top: 40px;">It takes 2 minutes. Your future self will thank you.</p>
      </div>`
    }
  ];

  const template = templates[Math.floor(Math.random() * templates.length)];

  try {
    const info = await transporter.sendMail({
      from: `"Dainiki" <${emailUser}>`,
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    console.log(`[Reminders] Email sent successfully to ${email}: ${info.messageId}`);
    return info;
  } catch (e) {
    console.error("[Reminders] Email send error:", e);
  }
}
