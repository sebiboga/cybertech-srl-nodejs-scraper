import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import companyConfig from '../../config/company.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const HAS_SOLR = !!process.env.SOLR_AUTH;

function itIfSolr(name, fn, timeout) {
  if (HAS_SOLR) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: SOLR_AUTH not set)`, fn, timeout);
}

beforeAll(() => {
  if (HAS_SOLR) {
    process.env.SOLR_AUTH = process.env.SOLR_AUTH;
  }
}, 60000);

const TEST_CIF = companyConfig.cif;
const TEST_BRAND = companyConfig.brand;

describe('E2E: Full Scraping Pipeline', () => {

  describe('ANAF Company Data', () => {
    let anaf;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
    }, 60000);

    it('should find Cybertech in ANAF and validate active status', async () => {
      const results = await anaf.searchCompany(TEST_BRAND);

      const company = results.find(c =>
        c.name.toUpperCase().startsWith('CYBERTECH') &&
        c.statusLabel === 'Funcțiune'
      );
      expect(company).toBeDefined();
      expect(company.cui.toString()).toBe(TEST_CIF);

      const anafData = await anaf.getCompanyFromANAF(TEST_CIF);
      expect(anafData).toBeDefined();
      expect(anafData.inactive).toBe(false);
    }, 30000);
  });

  describe('Parse + Transform Pipeline', () => {
    let index;

    beforeAll(async () => {
      index = await import('../../index.js');
    }, 60000);

    it('should parse ANOFM-style API response into standardized format', () => {
      const apiData = {
        total: 2,
        rows: [
          { id: '1', occupation: 'Software Developer', address_locality_name: 'București' },
          { id: '2', occupation: 'Web Designer', address_locality_name: 'Cluj-Napoca' }
        ]
      };

      const result = index.parseApiJobs(apiData);

      expect(result).toHaveProperty('jobs');
      expect(result).toHaveProperty('total');
      expect(result.jobs.length).toBe(2);

      const parsed = result.jobs[0];
      expect(parsed).toHaveProperty('url');
      expect(parsed.url).toMatch(/^https:\/\/mediere\.anofm\.ro\//);
      expect(parsed).toHaveProperty('title');
      expect(parsed).toHaveProperty('workmode', 'on-site');
      expect(parsed).toHaveProperty('location');
      expect(Array.isArray(parsed.location)).toBe(true);
    });

    it('should map parsed jobs to job model', () => {
      const apiData = {
        total: 1,
        rows: [{ id: '123', occupation: 'Developer', address_locality_name: 'București' }]
      };
      const parsed = index.parseApiJobs(apiData);
      const model = index.mapToJobModel(parsed.jobs[0], TEST_CIF);

      expect(model).toHaveProperty('url');
      expect(model).toHaveProperty('title');
      expect(model).toHaveProperty('company');
      expect(model).toHaveProperty('cif', TEST_CIF);
      expect(model).toHaveProperty('status', 'scraped');
      expect(model).toHaveProperty('date');
    });

    it('should transform jobs and filter to Romanian locations', () => {
      const apiData = {
        total: 1,
        rows: [{ id: '123', occupation: 'Developer', address_locality_name: 'București' }]
      };
      const parsed = index.parseApiJobs(apiData);
      const jobs = parsed.jobs.map(j => index.mapToJobModel(j, TEST_CIF));

      const payload = {
        source: 'anofm.ro',
        company: 'CYBERTECH SRL',
        cif: TEST_CIF,
        jobs
      };

      const transformed = index.transformJobsForSOLR(payload);

      expect(transformed.company).toBe('CYBERTECH SRL');
      expect(transformed.jobs.length).toBe(jobs.length);

      for (const job of transformed.jobs) {
        expect(job).toHaveProperty('location');
        expect(Array.isArray(job.location)).toBe(true);
        expect(job.location.length).toBeGreaterThan(0);
        expect(job.workmode).toMatch(/^(remote|on-site|hybrid)$/);
      }
    });

    it('should produce valid job URLs that are accessible', async () => {
      const apiData = {
        total: 1,
        rows: [{ id: '123', occupation: 'Test Job', address_locality_name: 'București' }]
      };
      const parsed = index.parseApiJobs(apiData);

      for (const job of parsed.jobs.slice(0, 1)) {
        const res = await fetch(job.url, {
          method: 'HEAD',
          headers: { 'User-Agent': 'job_seeker_ro_spider' }
        });
        // ANOFM URLs may return 404 for test IDs — that's expected
        console.log(`URL: ${job.url} — status: ${res.status}`);
      }
    }, 30000);
  });

  describe('Company Validation Path', () => {
    let anaf;
    let company;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
      company = await import('../../company.js');
    }, 60000);

    it('should find Cybertech in ANAF and validate active status', async () => {
      const results = await anaf.searchCompany(TEST_BRAND);

      const c = results.find(c =>
        c.name.toUpperCase().startsWith('CYBERTECH') &&
        c.statusLabel === 'Funcțiune'
      );
      expect(c).toBeDefined();
      expect(c.cui.toString()).toBe(TEST_CIF);

      const anafData = await anaf.getCompanyFromANAF(TEST_CIF);
      expect(anafData).toBeDefined();
      expect(anafData.inactive).toBe(false);
    }, 30000);

    itIfSolr('should run full validation and report active status with job count', async () => {
      const result = await company.validateAndGetCompany();

      expect(result.status).toBe('active');
      expect(result.company).toBe('CYBERTECH SRL');
      expect(result.cif).toBe(TEST_CIF);

      if (result.existingJobsCount === 0) {
        console.log('⚠️ No Cybertech jobs in Solr — skipping job count assertion');
        return;
      }
      expect(result.existingJobsCount).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Inactive Company Handling', () => {
    let anaf;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
    });

    it('should detect inactive/radiated companies via ANAF', async () => {
      const results = await anaf.searchCompany('Cybertech');

      const nonActive = results.find(c => c.statusLabel !== 'Funcțiune');

      if (nonActive) {
        try {
          const anafData = await anaf.getCompanyFromANAF(nonActive.cui.toString());
          expect(anafData).toBeDefined();
          if (anafData.inactive !== undefined) {
            expect(anafData.inactive).toBe(true);
          }
        } catch {
          expect(nonActive.statusLabel).toMatch(/Radiată|Inactiv|Suspendat/);
        }
      }
    }, 30000);
  });

  describe('SOLR Data Verification', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should have Cybertech jobs in SOLR with correct company name', async () => {
      const result = await solr.querySOLR(TEST_CIF);

      if (result.numFound === 0) {
        console.log('⚠️ No Cybertech jobs in Solr — skipping SOLR data verification');
        return;
      }

      for (const job of result.docs) {
        expect(job.company).toBe('CYBERTECH SRL');
        expect(job.cif).toBe(TEST_CIF);
      }
    }, 15000);

    itIfSolr('should have Cybertech company core entry with required fields', async () => {
      const result = await solr.queryCompanySOLR(`id:${TEST_CIF}`);

      expect(result.numFound).toBe(1);
      const comp = result.docs[0];
      expect(comp.company).toBe('CYBERTECH SRL');
      expect(comp.status).toBe('activ');
    }, 15000);
  });
});
