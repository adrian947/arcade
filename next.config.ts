import type { NextConfig } from "next";

// Headers de seguridad para todas las rutas (ver security/checklist.md).
// CSP y HSTS quedan para un spec propio.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  headers: async () => [{ source: "/(.*)", headers: securityHeaders }],
};

export default nextConfig;
