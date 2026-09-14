# Google Books lookup

On the Railway **staging application service**, configure:

```text
GOOGLE_BOOKS_API_KEY=<your Google Books API key>
```

Enable the Books API for the key's Google Cloud project. Keep the key in server variables; do not use a `VITE_` prefix or commit it. Deploy the updated branch after configuring these variables.

Rowan defaults catalog search and book-detail matching to Google Books. “Search more on Open Library” explicitly searches the secondary source. Readers choose a match before updating book details; saved page/audio length and reading history are preserved. Imported books do not need an existing provider link.

Google results are volumes (editions), not confirmed canonical works. Saving creates an internal work UUID and an edition with a `googlebooks` / `volume` external mapping. Repeated saves of the same volume converge. Different volume IDs and Open Library records are not automatically merged by title. ISBN-backed reconciliation and cross-provider enrichment remain future work.

Requests have a 15-second timeout, a bounded 15-minute public-response cache, concurrent request deduplication, and a cooldown for quota errors. API-key request URLs are never returned in errors. Source-specific errors leave the Open Library fallback button available.

Rowan no longer uses `GOOGLE_BOOKS_ENABLED`. Google lookup requires the API key; saved books remain available if the key is absent.

The related appearance update requires migration `0009_black_background.sql` before deployment. The preference is stored only in Rowan's account state; no legacy database schema change is needed.

Reference: https://developers.google.com/books/docs/v1/using
