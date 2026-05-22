import type { NextConfig } from "next";
// @ts-ignore
import withPWA from "next-pwa";

const config: NextConfig = {
  /* config options here */
  turbopack: {}, // Moved to root as suggested by error message
} as any;

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})(config);
