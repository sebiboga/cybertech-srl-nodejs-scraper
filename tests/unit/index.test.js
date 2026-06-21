import { jest } from '@jest/globals';

describe('index.js Component Tests', () => {
  let index;

  beforeAll(async () => {
    index = await import('../../index.js');
  });

  describe('transformJobsForSOLR', () => {
    it('should filter locations to only Romanian cities', () => {
      const payload = {
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', location: ['România'] },
          { url: 'https://test.com/2', title: 'Job 2', location: ['Bucharest'] },
          { url: 'https://test.com/3', title: 'Job 3', location: ['Bulgaria'] },
          { url: 'https://test.com/4', title: 'Job 4', location: ['Cluj-Napoca'] },
          { url: 'https://test.com/5', title: 'Job 5', location: [] }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.jobs[0].location).toEqual(['România']);
      expect(result.jobs[1].location).toEqual(['Bucharest']);
      expect(result.jobs[2].location).toEqual(['România']);
      expect(result.jobs[3].location).toEqual(['Cluj-Napoca']);
      expect(result.jobs[4].location).toEqual(['România']);
    });

    it('should keep company uppercase', () => {
      const payload = {
        source: 'anofm.ro',
        company: 'cybertech srl',
        cif: '12463238',
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', company: 'cybertech srl', cif: '12463238' }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.company).toBe('CYBERTECH SRL');
    });

    it('should normalize workmode values', () => {
      const payload = {
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', workmode: 'Remote' },
          { url: 'https://test.com/2', title: 'Job 2', workmode: 'ON-SITE' },
          { url: 'https://test.com/3', title: 'Job 3', workmode: 'Hybrid' },
          { url: 'https://test.com/4', title: 'Job 4', workmode: 'hybrid' }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.jobs[0].workmode).toBe('remote');
      expect(result.jobs[1].workmode).toBe('on-site');
      expect(result.jobs[2].workmode).toBe('hybrid');
      expect(result.jobs[3].workmode).toBe('hybrid');
    });

    it('should handle empty jobs array', () => {
      const result = index.transformJobsForSOLR({ jobs: [] });
      expect(result.jobs).toEqual([]);
    });
  });

  describe('mapToJobModel', () => {
    it('should map raw job to job model format', () => {
      const rawJob = {
        url: 'https://mediere.anofm.ro/app/module/mediere/job/123',
        title: 'Software Developer',
        location: ['București'],
        workmode: 'on-site'
      };

      const COMPANY_NAME = 'CYBERTECH SRL';
      const COMPANY_CIF = '12463238';

      const result = index.mapToJobModel(rawJob, COMPANY_CIF, COMPANY_NAME);

      expect(result.url).toBe(rawJob.url);
      expect(result.title).toBe(rawJob.title);
      expect(result.company).toBe(COMPANY_NAME);
      expect(result.cif).toBe(COMPANY_CIF);
      expect(result.location).toEqual(rawJob.location);
      expect(result.workmode).toBe(rawJob.workmode);
      expect(result.status).toBe('scraped');
      expect(result.date).toBeDefined();
    });

    it('should remove undefined fields', () => {
      const rawJob = {
        url: 'https://test.com/1',
        title: 'Job 1'
      };

      const result = index.mapToJobModel(rawJob, '12463238');

      expect(result.location).toBeUndefined();
      expect(result.tags).toBeUndefined();
      expect(result.workmode).toBeUndefined();
    });

    it('should handle missing title', () => {
      const rawJob = { url: 'https://test.com/1' };

      const result = index.mapToJobModel(rawJob, '12463238');

      expect(result.title).toBeUndefined();
      expect(result.url).toBe('https://test.com/1');
    });
  });

  describe('parseApiJobs', () => {
    it('should parse ANOFM API response format', () => {
      const apiData = {
        total: 100,
        rows: [
          {
            id: '123',
            occupation: 'Software Developer',
            address_locality_name: 'București',
            employer_tax_code: '12463238'
          }
        ]
      };

      const result = index.parseApiJobs(apiData);

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe('Software Developer');
      expect(result.jobs[0].location).toEqual(['București']);
      expect(result.jobs[0].workmode).toBe('on-site');
      expect(result.jobs[0].url).toBe('https://mediere.anofm.ro/app/module/mediere/job/123');
    });

    it('should handle empty job list', () => {
      const apiData = { total: 0, rows: [] };

      const result = index.parseApiJobs(apiData);

      expect(result.jobs).toEqual([]);
    });

    it('should handle missing data field', () => {
      const result = index.parseApiJobs({});

      expect(result.jobs).toEqual([]);
    });

    it('should handle location parsing with multiple parts', () => {
      const apiData = {
        total: 1,
        rows: [
          {
            id: '456',
            occupation: 'Developer',
            address_locality_name: 'România > București',
            employer_tax_code: '12463238'
          }
        ]
      };

      const result = index.parseApiJobs(apiData);

      expect(result.jobs[0].location).toEqual(['București']);
    });
  });
});
