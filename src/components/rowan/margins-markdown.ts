type Entry = {
  book: { title: string };
  kind: string;
  locator: string | null;
  createdAt: string;
  updatedAt: string;
  body: string;
};
const escape = (value: string) =>
  value.replace(/[\\`*_{}\[\]()<>#+.!|~-]/g, "\\$&").replace(/[\r\n]/g, " ");
export function marginsMarkdown(items: Entry[]) {
  return (
    "# Rowan margins\n\n" +
    items
      .map((item) => {
        // Longer fences preserve text containing Markdown fences without interpreting it.
        const fence = "`".repeat(
          Math.max(3, ...Array.from(item.body.matchAll(/`+/g), (m) => m[0].length + 1)),
        );
        return `## ${escape(item.book.title)}\n\nType: ${escape(item.kind)}  \nLocation: ${escape(item.locator ?? "Not recorded")}  \nCreated: ${item.createdAt}  \nUpdated: ${item.updatedAt}\n\n${fence}text\n${item.body}\n${fence}\n`;
      })
      .join("\n")
  );
}
