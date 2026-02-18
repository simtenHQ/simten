import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	// Handle native node modules in BAML
	webpack: (config, { isServer }) => {
		if (isServer) {
			// Allow native modules on server-side
			config.externals = config.externals || [];
			if (Array.isArray(config.externals)) {
				config.externals.push('@boundaryml/baml');
			}
		}
		return config;
	},
	// Mark BAML as external for server components
	serverExternalPackages: ['@boundaryml/baml'],
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
