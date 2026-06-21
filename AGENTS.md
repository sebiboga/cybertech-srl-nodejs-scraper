# AGENTS.md — Rules for AI agents

## Project
Cybertech scraper for peviitor.ro (Node.js, ESM, Jest)

## 🌱 This Repo Is a Derived Scraper
This repo is a **derived scraper** generated from the EPAM template repository. See the [EPAM template](https://github.com/sebiboga/epam-systems-international-srl-nodejs-scraper) for the full derivation guide.

**🤖 If you've been asked to update this scraper, read [AGENTS.md](AGENTS.md) first.**

When making changes to this derivative:
- **All company-specific identity lives in `config/company.json`** (CIF, brand, legalName, URLs, API params). Read from `config/company.js` in Node code, or via `jq` in workflows. Never hardcode in source files.
- **Only the scraping logic in `index.js`** is company-specific. The output shape (`mapToJobModel`, `transformJobsForSOLR`) must stay uniform across all scrapers.

## Critical Rules

### 0. Background tasks — always pass `--repo` explicitly to `gh`

When polling a workflow run with `until [ "$(gh run view ID --json status -q .status)" = "completed" ]; do sleep N; done`, the `gh run view` command implicitly uses the current working directory's git remote. If the CWD is a different repo (e.g. you cd-ed elsewhere mid-task), `gh` looks in the wrong repo and returns 404 — the loop's check becomes `"" != "completed"` (always true) and the background task sleeps forever.
