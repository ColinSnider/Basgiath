# Google Books trial

On the Railway **staging application service**, configure:

```text
GOOGLE_BOOKS_ENABLED=true
GOOGLE_BOOKS_API_KEY=<your Google Books API key>
```

Enable the Books API for the key's Google Cloud project. Keep the key in server variables; do not use a `VITE_` prefix or commit it. Deploy the updated branch after configuring these variables.

Rowan then defaults catalog searches to Google Books and exposes an Open Library / Google Books selector. Public volume search does not require signing readers into Google.

Google results are volumes (editions), not confirmed canonical works. Saving creates an internal work UUID and an edition with a `googlebooks` / `volume` external mapping. Repeated saves of the same volume converge. Different volume IDs and Open Library records are not automatically merged by title. ISBN-backed reconciliation and cross-provider enrichment remain future work.

Requests have a 15-second timeout, a bounded 15-minute public-response cache, concurrent request deduplication, and a cooldown for quota errors. API-key request URLs are never returned in errors. Source-specific errors leave the source selector available so the reader can try Open Library.

Set `GOOGLE_BOOKS_ENABLED=false` to disable new Google lookups. Saved books remain available in the library.

Reference: https://developers.google.com/books/docs/v1/using
