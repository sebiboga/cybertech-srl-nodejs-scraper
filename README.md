# job_seeker_ro_spider — Cybertech Romania Scraper

[![Oportunitati SI Cariere](https://github.com/sebiboga/cybertech-srl-nodejs-scraper/actions/workflows/job-seeker-ro-spider.yml/badge.svg)](https://github.com/sebiboga/cybertech-srl-nodejs-scraper/actions/workflows/job-seeker-ro-spider.yml)
[![Automation Tests](https://github.com/sebiboga/cybertech-srl-nodejs-scraper/actions/workflows/automation-testing.yml/badge.svg)](https://github.com/sebiboga/cybertech-srl-nodejs-scraper/actions/workflows/automation-testing.yml)

[![Version](https://img.shields.io/github/package-json/v/sebiboga/cybertech-srl-nodejs-scraper?label=version&color=blue)](CHANGELOG.md)
[![Test Results](https://img.shields.io/badge/test--results-HTML-9b59b6)](https://sebiboga.github.io/cybertech-srl-nodejs-scraper/test-results/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![JavaScript](https://img.shields.io/badge/javascript-ESM-F7DF1E?logo=javascript&logoColor=black)](https://ecma-international.org/)
[![Node.js](https://img.shields.io/badge/node-24-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fpeviitor.ro&label=peviitor.ro)](https://peviitor.ro)
[![API](https://img.shields.io/website?url=https%3A%2F%2Fapi.peviitor.ro%2F&label=api.peviitor.ro)](https://api.peviitor.ro/)
[![SOLR](https://img.shields.io/website?url=https%3A%2F%2Fsolr.peviitor.ro%2Fsolr%2F&label=solr.peviitor.ro)](https://solr.peviitor.ro/solr/)
[![GitHub Pages](https://img.shields.io/github/deployments/sebiboga/cybertech-srl-nodejs-scraper/github-pages?label=GitHub%20Pages)](https://sebiboga.github.io/cybertech-srl-nodejs-scraper/)

**job_seeker_ro_spider** — un scraper pentru job-urile Cybertech din România. Extrage anunțurile de pe [ANOFM](https://www.anofm.ro/) și le publică în [peviitor.ro](https://peviitor.ro) prin API-ul SOLR.

> **📐 Derivat din template-ul EPAM.** Acest repo a fost generat din [sebiboga/epam-systems-international-srl-nodejs-scraper](https://github.com/sebiboga/epam-systems-international-srl-nodejs-scraper). Vezi [CONTRIBUTING.md](CONTRIBUTING.md) pentru detalii.

## Overview

Proiectul automatizează colectarea zilnică a job-urilor Cybertech din România, menținând board-ul peviitor.ro la zi cu cele mai recente oportunități de carieră.

## Features

- Extrage job-uri din API-ul public ANOFM (Agentia Nationala pentru Ocuparea Fortei de Munca)
- Validează compania via ANAF (CUI, status activ/inactiv, adresă completă)
- **Cache ANAF la 7 zile** — committed în repo, nu lovește demoANAF la fiecare scrape
- **Fallback la cache stale** dacă ANAF e indisponibil
- Cross-validează cu Peviitor API
- Stochează în SOLR (job core + company core)
- Generează `docs/jobs.md` automat — accesibil pe GitHub Pages
- **Identitate companie într-un singur fișier** (`config/company.json`) — derivare ușoară pentru alte companii
- GitHub Actions: scrape zilnic + testare automată (unit, integration, e2e, consistency)
- Teste SOLR condiționale — auto-skip când `SOLR_AUTH` nu e setat
- Se identifică prin User-Agent: `job_seeker_ro_spider`

## Project Structure

```
├── index.js                    # Main scraper entry point
├── company.js                  # Company validation via ANAF + Peviitor + SOLR
├── demoanaf.js                 # CLI wrapper for src/anaf.js
├── solr.js                     # SOLR operations (query, upsert, delete, company)
├── validate-jobs.js            # Job URL validator — checks active/expired, deletes stale jobs
├── config/
│   ├── company.json            # Single source of truth: CIF, brand, URLs, API params
│   └── company.js              # ESM loader for company.json
├── src/
│   ├── anaf.js                 # ANAF API core (3 retries, 2s exponential backoff)
│   ├── job-validator.js        # URL validation (HEAD + content scan)
│   └── markdown-generator.js   # Generates docs/jobs.md
├── tests/
│   ├── package.json            # Jest config for test suite
│   ├── validate-cybertech-jobs.js # CI fast validator (HEAD checks)
│   ├── unit/                   # Unit tests (6 files)
│   ├── integration/            # Integration tests (ANAF + Peviitor + SOLR)
│   ├── e2e/                    # End-to-end tests (full pipeline)
│   └── consistency/            # Consistency tests (repo config, Pages, workflows)
├── docs/
│   ├── index.html              # Live job board (GitHub Pages)
│   ├── company.json            # Company config published to Pages
│   ├── jobs.md                 # Generated jobs listing
│   └── test-results/           # CI test reports
└── .github/workflows/
    ├── job-seeker-ro-spider.yml  # Daily scrape at 6 AM UTC
    └── automation-testing.yml    # Tests on push/PR/schedule
```

## Quick Start

### Prerequisites

- Node.js 24+
- npm

### Setup

```bash
git clone https://github.com/sebiboga/cybertech-srl-nodejs-scraper.git
cd cybertech-srl-nodejs-scraper
npm install
```

### Usage

```bash
# Run scraper (single page, for testing)
npm run scrape -- --test

# Run scraper (all pages)
npm run scrape

# Run all tests
npm test

# Run specific test layers
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:consistency
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SOLR_AUTH` | ✅ Yes | SOLR authentication (`user:password`) |
| `GITHUB_TOKEN` | For CI | GitHub API token (consistency tests) |
| `GITHUB_REPOSITORY` | For CI | Repo name (consistency tests) |

## Scraping Method

This scraper uses the **ANOFM API** (Agentia Nationala pentru Ocuparea Fortei de Munca) to fetch job listings for CYBERTECH SRL by CIF (12463238). ANOFM is the national employment agency in Romania, and its API provides comprehensive job listing data for companies registered in Romania.

## Verification

- [ ] Derived repo exists and is public
- [ ] "Generated from" badge visible
- [ ] `config/company.json` has correct CIF, brand, legalName, URLs
- [ ] All tests pass
- [ ] Topics set: `job-seeker-ro-spider`, `peviitor-ro`
- [ ] Homepage URL set to GitHub Pages URL
- [ ] GitHub Pages enabled
- [ ] SOLR_AUTH secret set
- [ ] CI workflow triggered and green

## License

MIT
