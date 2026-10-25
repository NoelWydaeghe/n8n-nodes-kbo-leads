# n8n-nodes-kbo-leads

n8n community node for the **[KBO Leads API](https://leads.lokalegroei.be/api)** by [Lokale Groei](https://leads.lokalegroei.be): search 1.8 million Belgian companies from the official KBO/BCE register (Crossroads Bank for Enterprises), enriched with email, phone and website where known.

Find every hairdresser in Kortrijk, every new plumber in Oost-Vlaanderen, or enrich a list of enterprise numbers with sector, address and contact details — straight from your n8n workflows or as a tool for an n8n AI Agent.

🇳🇱 [Nederlandstalige uitleg onderaan](#nederlands).

- Website and plans: https://leads.lokalegroei.be
- API documentation: https://leads.lokalegroei.be/api

## Installation

Self-hosted n8n: **Settings → Community Nodes → Install**, enter `n8n-nodes-kbo-leads` and confirm. See the [n8n community nodes guide](https://docs.n8n.io/integrations/community-nodes/installation/).

Docker / manual install: `npm install n8n-nodes-kbo-leads` in your n8n custom nodes folder (`~/.n8n/nodes`) and restart n8n.

## Credentials

1. Create a free account at [leads.lokalegroei.be](https://leads.lokalegroei.be).
2. Open your [dashboard](https://leads.lokalegroei.be/dashboard) and create an API key (it starts with `kbo_`). You see it only once.
3. In n8n, add a **KBO Leads API** credential and paste the key. Leave *Base URL* as `https://api.lokalegroei.be`.

The credential test calls `GET /api-keys/me`, which uses no quota.

**Plans.** On the free plan the API hides the enterprise number, street and contact details (`_masked: true`, the company gets an `lg_…` ID instead) and shows 50 companies per month. Paid plans see everything. Every key is limited to 60 requests per minute; the node waits and retries automatically when it hits that limit.

## Operations

### Company

| Operation | What it does |
|---|---|
| **Search** | Search companies by sector, region and filters. One item per company. *Return All* pages through the results 1,000 at a time. |
| **Count** | Number of companies matching a filter, and how many have contact details, email, phone or a website. Uses no view quota. |
| **Get** | One company by enterprise number (`0403.170.701`, `0403170701` or `BE0403170701`) or by the `lg_…` ID from the free plan. |
| **Export CSV** | The same filter as a CSV file in a binary field (uses one export credit). |

Search, Count and Export share these fields:

- **Sectors** — NACE-BEL 2025 codes, searchable by name (type "kapper", "loodgieter", "boekhouder"). A 2-digit division or 4-digit class includes all its subclasses. *Extra NACE Codes* takes codes as text; old NACE 2008 codes are mapped to 2025.
- **Provinces**, **Municipalities** and **Postcodes** (4 digits). A company matches when its head office *or* one of its branches is in the region; combine with *Head Office Only* to match the head office only.
- **Filters** — name contains, only with contact details, has email / phone / website / trade name (yes, no, any), starters only, founded after/before, minimum and maximum number of establishments, legal form (BV, NV, VZW, sole trader, …), legal entities or sole traders only, language, include inactive (bankrupt, dissolved) companies.
- **Sort** — relevance (companies with email and phone first), newest, oldest, alphabetical.

### Reference Data

| Operation | What it does |
|---|---|
| **List NACE Codes** | Without a search term: all NACE-BEL 2025 divisions, classes and subclasses. With a term ("kapper"): the matching sectors, with company counts and the codes to search with. |
| **List Provinces** | The 11 provinces with their postcode ranges and company counts. |
| **List Municipalities** | Postcodes and municipality names, with company counts when you give a search term ("Kortrijk", "85"). |

### Account

| Operation | What it does |
|---|---|
| **Get Usage** | Your plan, and the views and exports used this month. |

## Example workflows

**1. New starters every Monday → Google Sheets.**
Schedule Trigger (Mondays 8:00) → KBO Leads *Search* (Sectors: `4322 Loodgieterswerk`, Provinces: `Oost-Vlaanderen`, Filters: *Starters Only*, *Only With Contact Details*, Sort: *Newest First*, Return All) → Google Sheets *Append or Update* on `enterprise_number`.

**2. Enrich a list of enterprise numbers.**
Google Sheets *Get Rows* (a column with enterprise numbers) → KBO Leads *Get* (Enterprise Number: `{{ $json.ondernemingsnummer }}`) → Set (keep `company_name`, `nace_main_label`, `address.city`, `email`, `phone`, `website`) → back to the sheet or your CRM.

**3. AI Agent that finds prospects.**
Chat Trigger → AI Agent with the KBO Leads node as a tool (operation *Search*, let the model fill Sectors, Postcodes and Limit with `$fromAI()`), plus *List NACE Codes* as a second tool so the agent can translate "hairdressers" into a NACE code. Ask: *"Find 20 hairdressers in Gent with a phone number."*

A monthly *Count* per sector and province, sent to Slack, is a quick way to follow how a market grows.

## Compatibility

Tested with n8n 2.44 (self-hosted). The node has no runtime dependencies besides `n8n-workflow`.

## Development

```bash
npm install
npm run build    # n8n-node build
npm run lint     # n8n-node lint (strict, n8n Cloud rules)
npm run dev      # n8n with this node and live rebuild
```

The NACE list (`nodes/KboLeads/data/naceCodes.ts`) and the postcode list (`data/gemeenten.ts`) are generated from the KBO Leads database and work offline; when the API answers, the sector list also shows live company counts.

## Resources

- [KBO Leads API documentation](https://leads.lokalegroei.be/api) · [OpenAPI](https://api.lokalegroei.be/openapi.json)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Changelog](CHANGELOG.md)

---

## Nederlands

**n8n-nodes-kbo-leads** koppelt n8n aan de Belgische bedrijvendatabase van [Lokale Groei](https://leads.lokalegroei.be): 1,8 miljoen ondernemingen uit de KBO (Kruispuntbank van Ondernemingen), aangevuld met e-mail, telefoon en website waar die bekend zijn.

**Installeren.** In een self-hosted n8n: *Settings → Community Nodes → Install* en typ `n8n-nodes-kbo-leads`.

**API-key.** Maak een (gratis) account op [leads.lokalegroei.be](https://leads.lokalegroei.be), maak in je [dashboard](https://leads.lokalegroei.be/dashboard) een API-key aan (begint met `kbo_`) en plak die in n8n in een credential **KBO Leads API**.

**Wat kan de node?**

- **Search** — bedrijven zoeken op sector (zoek in gewone taal: "kapper", "loodgieter"), provincie, gemeente of postcode, met filters: alleen met contactgegevens, starters, opgericht na/voor, aantal vestigingen, rechtsvorm (BV, NV, VZW, eenmanszaak …), enkel rechtspersonen of eenmanszaken, taal, ook inactieve bedrijven. Eén item per bedrijf; *Return All* haalt alles op.
- **Count** — hoeveel bedrijven er aan een filter voldoen, en hoeveel daarvan met e-mail, telefoon of website.
- **Get** — één bedrijf op ondernemingsnummer (`0403.170.701`, `BE0403170701` …).
- **Export CSV** — dezelfde selectie als CSV-bestand.
- **Reference Data** — NACE-codes, provincies en gemeenten opzoeken; **Account** — je plan en verbruik deze maand.

Een regio-filter vindt ook bedrijven met hun zetel elders en een vestiging in die regio (de bakker met zetel in Brussel en een winkel in Kortrijk).

**Gratis plan.** Ondernemingsnummer, straat en contactgegevens zijn versluierd en je ziet 50 bedrijven per maand. Met een betalend plan zie je alles. Per key gelden 60 verzoeken per minuut; de node wacht en probeert automatisch opnieuw.

**Voorbeelden:** elke maandag de nieuwe loodgieters in Oost-Vlaanderen naar Google Sheets; een lijst ondernemingsnummers aanvullen met sector, adres en contact; een AI Agent die prospects zoekt ("zoek 20 kappers in Gent met een telefoonnummer").

Vragen of een fout gevonden? Mail noel@lokalegroei.be of open een issue op GitHub.

## License

[MIT](LICENSE.md)
