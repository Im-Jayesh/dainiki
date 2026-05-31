import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dainiki | The Majestic Aesthetic Journal",
  description: "Dainiki is a private, intelligent, and aesthetic journaling space. Featuring End-to-End Encryption, AI summaries, and a beautifully animated Mind Palace.",
  keywords: ["journal", "diary", "aesthetic", "privacy", "encryption", "AI", "gemini", "minimalist"],
  openGraph: {
    title: "Dainiki | Your Private Sanctuary",
    description: "The most aesthetic and secure way to preserve your inner voice.",
    type: "website",
    images: ["/link-image.png"],
  }
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
