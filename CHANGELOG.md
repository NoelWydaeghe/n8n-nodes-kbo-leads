# Changelog

## 1.1.0 (2026-10-25)

Brings the node in line with the KBO Leads API as of 24-10-2026 (engine-v2, all companies visible, server-side masking on the free plan).

### Breaking

- Base URL is now `https://api.lokalegroei.be` (configurable in the credential).
- The search fields changed: the API no longer knows `nace_main` and `city`, which 1.0.x sent and the API silently ignored (so searches returned unfiltered results). Use *Sectors* / *Extra NACE Codes* and *Provinces* / *Municipalities* / *Postcodes* instead. *Has Email* and *Has Phone* moved into *Filters*.
- The *NACE Codes* operation moved to *Reference Data → List NACE Codes*.

### Added

- Resources *Company*, *Reference Data* and *Account*.
- *Search*: one item per company (was one item with the whole response), *Return All* with pagination, sort order, and filters for starters, founding date, number of establishments, legal form, legal entities or sole traders, language, trade name, website, only with contact details, inactive companies and head office only.
- Sector picker with NACE-BEL 2025 codes, searchable by name, with live company counts; municipality picker by postcode; provinces.
- *Get* accepts `0403.170.701`, `0403170701`, `BE0403170701` and the `lg_…` IDs of the free plan.
- *Export CSV* operation (binary output).
- *Reference Data*: list NACE codes (plain-language search such as "kapper"), provinces and municipalities with company counts.
- *Account → Get Usage*: plan and monthly views and exports.
- Clear error messages for an invalid key (401), the monthly limit of the free plan, filters that are not available yet, invalid parameters and unknown companies.
- Automatic retry after a 429 (60 requests per minute per key), using `Retry-After`.
- Credential test on `GET /api-keys/me` (no quota used), node icons in the package, codex file, README in English and Dutch, MIT license file.

### Changed

- Build and lint with the `n8n-node` CLI in strict mode (n8n Cloud rules).

## 1.0.8 (2026-05-21)

- Initial operations: search, statistics, company detail, NACE codes.
