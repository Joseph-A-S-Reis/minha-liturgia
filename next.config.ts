import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";

function createCspDirectives() {
	const directives = [
		"base-uri 'self'",
		"object-src 'none'",
		"frame-ancestors 'self'",
		"frame-src 'self' https://drive.google.com https://docs.google.com https://*.googleusercontent.com",
		"worker-src 'self' blob:",
		"media-src 'self' https: blob: data:",
		"img-src 'self' https: data: blob:",
		"font-src 'self' data: https:",
		isDevelopment
			? "connect-src 'self' https: http://localhost:* ws://localhost:*"
			: "connect-src 'self' https:",
	];

	if (!isDevelopment) {
		directives.push("block-all-mixed-content");
		directives.push("upgrade-insecure-requests");
	}

	return directives.join("; ");
}

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
	async headers() {
		const cspDirectives = createCspDirectives();

		return [
			{
				source: "/:path*",
				headers: [
					{
						key: "Content-Security-Policy",
						value: cspDirectives,
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "Permissions-Policy",
						value: "camera=(), microphone=(), geolocation=()",
					},
				],
			},
		];
	},
};

export default nextConfig;
