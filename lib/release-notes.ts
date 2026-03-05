import { z } from "zod";
import releasesFile from "@/data/releases/releases.json";

const releaseChangeSchema = z.object({
  category: z.enum(["feature", "fix", "improvement", "security", "breaking"]),
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().min(1).max(500),
});

const releaseSchema = z.object({
  version: z.string().trim().regex(/^\d+\.\d+\.\d+$/, "Versão deve seguir SemVer (x.y.z)."),
  releasedAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(180),
  highlights: z.array(z.string().trim().min(1).max(220)).max(8),
  changes: z.array(releaseChangeSchema).max(80),
});

const releasesManifestSchema = z.object({
  latest: z.string().trim().regex(/^\d+\.\d+\.\d+$/),
  releases: z.array(releaseSchema).min(1),
});

export type ReleaseChange = z.infer<typeof releaseChangeSchema>;
export type ReleaseNotes = z.infer<typeof releaseSchema>;

type ReleasesManifest = z.infer<typeof releasesManifestSchema>;

const releasesManifest = releasesManifestSchema.parse(releasesFile) as ReleasesManifest;

function compareSemver(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = a.split(".").map(Number);
  const [bMajor, bMinor, bPatch] = b.split(".").map(Number);

  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}

const releasesSortedDesc = [...releasesManifest.releases].sort((left, right) =>
  compareSemver(right.version, left.version),
);

function ensureLatestExists(manifest: ReleasesManifest): void {
  const latestExists = manifest.releases.some((release) => release.version === manifest.latest);

  if (!latestExists) {
    throw new Error(`Manifest de releases inválido: versão latest (${manifest.latest}) não encontrada.`);
  }
}

ensureLatestExists(releasesManifest);

export function getLatestRelease(): ReleaseNotes {
  const release = releasesSortedDesc.find((entry) => entry.version === releasesManifest.latest);

  if (!release) {
    throw new Error("Versão latest não encontrada no manifest de releases.");
  }

  return release;
}

export function getReleaseByVersion(version: string): ReleaseNotes | null {
  return releasesSortedDesc.find((entry) => entry.version === version) ?? null;
}

export function listRecentReleases(limit = 5): ReleaseNotes[] {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 10) : 5;
  return releasesSortedDesc.slice(0, safeLimit);
}
