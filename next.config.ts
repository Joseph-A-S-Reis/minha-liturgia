import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "www.vaticannews.va" },
			{ protocol: "https", hostname: "vaticannews.va" },
			{ protocol: "https", hostname: "www.cnbb.org.br" },
			{ protocol: "https", hostname: "cnbb.org.br" },
		],
	},
};

export default nextConfig;
