import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { useStore } from "@/lib/basgiath-store";

export const Route = createFileRoute("/margin/$id")({ component: MarginDetail });
function MarginDetail() {
  const { id } = Route.useParams();
  const { margins, books } = useStore();
  const margin = margins.find((m) => m.id === id);
  if (!margin) return <div className="p-6"><Link to="/margins">Back</Link></div>;
  const b = books.find((x) => x.id === margin.bookId);
  return <><AppHeader title="Margin Detail" subtitle="Expanded entry view."/><section className="px-5 md:px-8"><div className="bg-card border border-border rounded-md p-4"><p className="text-sm uppercase text-gold">{margin.type}</p><p className="text-lg mt-2">{margin.text}</p><p className="text-sm mt-3 text-muted-foreground">{b?.title} {margin.page ? `· page ${margin.page}` : ""}</p></div></section></>;
}
