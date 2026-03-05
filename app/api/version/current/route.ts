import { getLatestRelease, listRecentReleases } from "@/lib/release-notes";

export const runtime = "nodejs";

export async function GET() {
  const latest = getLatestRelease();

  return Response.json(
    {
      latest: {
        version: latest.version,
        releasedAt: latest.releasedAt,
        title: latest.title,
        highlights: latest.highlights,
      },
      recentVersions: listRecentReleases(3).map((release) => ({
        version: release.version,
        releasedAt: release.releasedAt,
        title: release.title,
      })),
    },
    {
      headers: {
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
