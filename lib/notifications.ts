export async function sendOneSignalNotification(heading: string, content: string) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;

  if (!appId || !apiKey) {
    console.error("OneSignal configuration missing");
    return;
  }

  try {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: appId,
        headings: { en: heading },
        contents: { en: content },
        included_segments: ["Subscribed Users"],
        // You can add more targeting here, like targeting specific external_id
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OneSignal API error:", error);
    }
  } catch (e) {
    console.error("OneSignal fetch error:", e);
  }
}
