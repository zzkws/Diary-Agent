import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/settings", label: "Settings" },
  { href: "/topics", label: "Topics" },
  { href: "/today", label: "Today" },
  { href: "/archive", label: "Daily Archive" },
];

export function Nav() {
  return (
    <nav className="flex flex-wrap gap-3">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
