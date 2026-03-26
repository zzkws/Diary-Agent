import Link from "next/link";

const cards = [
  {
    href: "/settings",
    title: "Settings",
    description: "Save your Gemini API key and model locally for the Diary Agent.",
  },
  {
    href: "/topics",
    title: "Topics",
    description: "Manage the ongoing topics Diary keeps in rotation over time.",
  },
  {
    href: "/today",
    title: "Today",
    description: "Run today's topic-based conversation and save it locally.",
  },
  {
    href: "/archive",
    title: "Daily Archive",
    description: "Open a saved day and review topics, transcript, and extracted updates.",
  },
];

export default function HomePage() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
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
