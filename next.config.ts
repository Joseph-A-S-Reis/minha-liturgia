import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			{ protocol: "http", hostname: "www.vaticannews.va" },
			{ protocol: "https", hostname: "www.vaticannews.va" },
			{ protocol: "http", hostname: "vaticannews.va" },
			{ protocol: "https", hostname: "vaticannews.va" },
			{ protocol: "http", hostname: "www.cnbb.org.br" },
			{ protocol: "https", hostname: "www.cnbb.org.br" },
			{ protocol: "http", hostname: "cnbb.org.br" },
			{ protocol: "https", hostname: "cnbb.org.br" },
			{ protocol: "https", hostname: "drive.google.com" },
			{ protocol: "https", hostname: "lh3.googleusercontent.com" },
		],
	},
};

export default nextConfig;
