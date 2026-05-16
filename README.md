# n8n-nodes-kbo-leads

This is an n8n community node for the **KBO Leads API** — giving you access to 1.9M Belgian companies from the official Belgian business database (KBO/BCE).

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

Search for `n8n-nodes-kbo-leads` in the n8n community nodes panel.

## Operations

- **Bedrijven Zoeken** — Filter companies by NACE sector code, city, zipcode, email, phone
- **Statistieken** — Get statistics for a filtered set of companies
- **Bedrijf Detail** — Get full company info by KBO number
- **NACE Codes** — List all available NACE sector codes

## Credentials

1. Go to [leads.lokalegroei.be](https://leads.lokalegroei.be) and create an account
2. Go to your dashboard → API Access → Generate API Key
3. Copy your `kbo_xxxxxxxx` key
4. In n8n, create a new **KBO Leads API** credential and paste your key

## Compatibility

Tested with n8n v1.0+

## Resources

- [KBO Leads API Documentation](https://leads.lokalegroei.be/api)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
