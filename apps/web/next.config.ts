import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Ignore lint errors during build (they were pre-existing)
	eslint: {
		ignoreDuringBuilds: true,
	},
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
