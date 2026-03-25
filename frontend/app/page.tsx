import Link from "next/link";

const cards = [
  {
    href: "/settings",
    title: "Tracked Items",
    description: "Define the fixed questions Diary should ask every day.",
  },
  {
    href: "/check-in",
    title: "Daily Check-in",
    description: "Run today's question sequence and save the results locally.",
  },
  {
    href: "/archive",
    title: "Daily Archive",
    description: "Open a saved day and view what was recorded.",
  },
];

export default function HomePage() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="group rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 transition hover:-translate-y-1 hover:border-[var(--accent)]"
        >
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">Open</p>
          <h2 className="mt-3 text-2xl font-semibold">{card.title}</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{card.description}</p>
        </Link>
      ))}
    </div>
  );
}
