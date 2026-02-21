import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ resourceId?: string; error?: string }>;
};

export default async function BibliotecaUploadPage({ searchParams }: PageProps) {
  const { resourceId, error } = await searchParams;
  if (!resourceId) {
    redirect("/biblioteca/novo");
  }

  const target = `/biblioteca/novo?resourceId=${encodeURIComponent(resourceId)}${
    error ? `&error=${encodeURIComponent(error)}` : ""
  }`;

  redirect(target);
}
