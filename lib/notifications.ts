export async function sendOneSignalNotification(heading: string, content: string, targetUsernames?: string[]) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;

  if (!appId || !apiKey) {
    console.error("OneSignal configuration missing");
    return;
  }

  const payload: any = {
    app_id: appId,
    headings: { en: heading },
    contents: { en: content },
    target_channel: "push"
  };

  if (targetUsernames && targetUsernames.length > 0) {
    payload.include_aliases = { external_id: targetUsernames };
  } else {
    payload.included_segments = ["Subscribed Users"];
  }

  try {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OneSignal API error:", error);
    }
  } catch (e) {
    console.error("OneSignal fetch error:", e);
  }
}
