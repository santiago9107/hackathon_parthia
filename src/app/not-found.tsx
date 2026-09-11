import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="font-serif text-3xl font-semibold text-navy">Page not found</h1>
      <p className="mt-2 text-ink-muted">That link doesn&apos;t go anywhere in this prototype.</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
        Back to dashboard
      </Link>
    </div>
  );
}
