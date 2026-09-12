import assert from "node:assert/strict";
import test from "node:test";
import { marginsMarkdown } from "./margins-markdown.ts";
test("exports literal Unicode and fenced text without interpreting book metadata", () => {
  const body = "  雪\n```\n<script>hi</script>\n\n";
  const output = marginsMarkdown([
    {
      book: { title: "[Book](https://example.test)" },
      kind: "quote",
      locator: "Chapter *2*",
      createdAt: "2026-09-12T00:00:00Z",
      updatedAt: "2026-09-12T00:00:00Z",
      body,
    },
  ]);
  assert.ok(output.includes("\\[Book\\]"));
  assert.ok(output.includes("Chapter \\*2\\*"));
  assert.ok(output.includes("````text\n" + body + "\n````"));
});
