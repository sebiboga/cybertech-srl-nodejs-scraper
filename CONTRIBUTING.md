# Contributing

Thank you for your interest in contributing!

## 🌱 This Repo Is a Derived Scraper

This is a **derived scraper** for CYBERTECH SRL, generated from the [EPAM template repository](https://github.com/sebiboga/epam-systems-international-srl-nodejs-scraper).

> **🔗 Derived from:** [sebiboga/epam-systems-international-srl-nodejs-scraper](https://github.com/sebiboga/epam-systems-international-srl-nodejs-scraper)

### Making Changes

1. Update `config/company.json` with any changed identity fields
2. Adjust the ANOFM scraping logic in `index.js` if the API changes
3. Update test fixtures to match new data
4. Run `npm test` to verify all layers pass
5. Commit and push — CI will validate

## CI/CD

Two GitHub Actions workflows keep the scraper running:
- **job-seeker-ro-spider.yml** — Daily scrape at 6 AM UTC
- **automation-testing.yml** — Tests on push/PR + nightly validation
