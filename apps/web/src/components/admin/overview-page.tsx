import Link from "next/link";

const cards = [
  { title: "Users", description: "Manage accounts and roles", href: "/admin/users" },
  { title: "Orders", description: "Review purchases and payments", href: "/admin/orders" },
  { title: "Subscriptions", description: "Monitor active plans and renewals", href: "/admin/subscriptions" },
  { title: "System Status", description: "Realtime infrastructure health", href: "/admin/system" },
];

export function AdminOverviewPage() {
  return (
    <div className="text-slate-900">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        <p className="mt-2 text-slate-600">Quick access to core SaaS controls.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-300 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
