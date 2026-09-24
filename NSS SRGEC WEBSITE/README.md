# SRGEC-NSS-WEBSITE

## Content updates

The MongoDB `site_data` record is the source of truth for content changed in
the admin panel. `data/site.json` is only the initial default data for a new
database and a fallback when the server is unavailable.

From the `server` folder:

- `npm run seed` safely seeds an empty database or adds new default fields. It
  preserves content already saved through the admin panel.
- `npm run reset-content` deliberately replaces all saved content with
  `data/site.json`. Use this only when a full reset is intended.

For normal website design or code changes, deploy/restart the server only; do
not run a content import. For editorial changes, use the admin panel.
