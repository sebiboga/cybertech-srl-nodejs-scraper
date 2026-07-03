/**
 * ANAF API Integration Module (with cuifirma.ro fallback)
 * 
 * PURPOSE: Provides interface to Romania's ANAF (National Agency for Fiscal Administration)
 * for company validation. Used to verify company existence, activity status, and get
 * official company details like registered name, address, and CIF.
 * 
 * Falls back to cuifirma.ro when ANAF is unavailable (Cloudflare block, etc.).
 * 
 * API Endpoints:
 * - Search: https://demoanaf.ro/api/search?q=<brand>
 * - Company Details: https://demoanaf.ro/api/company/<cif>
 * - Fallback Search: https://cuifirma.ro/api/search?q=<brand>
 */

import fetch from "node-fetch";

// ============================================================================
// CONFIGURATION
// ============================================================================

// DemoANAF API base URL for company details
const ANAF_API_URL = "https://demoanaf.ro/api/company/";

// DemoANAF API base URL for company search
const ANAF_SEARCH_URL = "https://demoanaf.ro/api/search";

// Maximum retry attempts for API calls
const MAX_RETRIES = 3;

// Delay between retry attempts in milliseconds
const RETRY_DELAY_MS = 2000;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Promise-based sleep function for introducing delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// ANAF API - Fetching company details by CIF
// ============================================================================

/**
 * Fetches company details from ANAF API by CIF (company identifier)
 * Implements retry logic for resilience against temporary failures
 * 
 * @param {string} cif - Company CIF/CUI (8-digit number)
 * @returns {Promise<Object|null>} - Company data or null if not found
 * @throws {Error} - If API fails after all retries
 */
export async function getCompanyFromANAF(cif) {
  let lastError = null;
  
  // Retry loop with exponential backoff
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${ANAF_API_URL}${cif}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "job_seeker_ro_spider" }
      });
      
      // Handle HTTP errors
      if (!res.ok) {
        lastError = new Error(`ANAF API error: ${res.status}`);
        console.log(`ANAF attempt ${attempt}/${MAX_RETRIES} failed: ${res.status}, retrying...`);
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
        continue;
      }
      
      const json = await res.json();
      
      // Handle API-level errors (e.g., company not found)
      if (json.success === false) {
        lastError = new Error(json.error?.message || "ANAF returned error");
        console.log(`ANAF attempt ${attempt}/${MAX_RETRIES} failed: ${json.error?.message}, retrying...`);
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
        continue;
      }
      
      // Success - return company data
      return json.data || null;
    } catch (err) {
      lastError = err;
      console.log(`ANAF attempt ${attempt}/${MAX_RETRIES} error: ${err.message}, retrying...`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }
  
  // All retries exhausted
  throw lastError || new Error("ANAF API failed after retries");
}

// ============================================================================
// ANAF API WITH FALLBACK - Graceful degradation when API is unavailable
// ============================================================================

/**
 * Fetches company from ANAF with fallback to cached data
 * This ensures the scraper can continue when ANAF API is down
 * 
 * @param {string} cif - Company CIF/CUI
 * @param {Object|null} cachedData - Previously cached company data (from company.json)
 * @returns {Promise<Object>} - Company data (fresh or cached)
 * @throws {Error} - If API fails and no cache available
 */
export async function getCompanyFromANAFWithFallback(cif, cachedData = null) {
  try {
    // Try live API first
    return await getCompanyFromANAF(cif);
  } catch (err) {
    // API failed - log warning
    console.log(`\n⚠️ ANAF API unavailable: ${err.message}`);
    
    // Use cached data if available
    if (cachedData) {
      console.log("✅ Using cached company data as fallback");
      return cachedData;
    }
    
    // No cache - rethrow error
    throw err;
  }
}

// ============================================================================
// CUIFIRMA.RO FALLBACK - Alternative data source when ANAF is unreachable
// ============================================================================

const CUIFIRMA_SEARCH_URL = "https://cuifirma.ro/api/search";

/**
 * Fetches company data from cuifirma.ro as a fallback when ANAF is unavailable.
 * Maps the cuifirma.ro response shape to match the expected ANAF-like format.
 * 
 * @param {string} cif - Company CIF/CUI
 * @returns {Promise<Object>} - Company data in ANAF-compatible shape
 * @throws {Error} - If cuifirma.ro is also unreachable
 */
export async function getCompanyFromCuiFirma(cif) {
  const url = `${CUIFIRMA_SEARCH_URL}?q=${encodeURIComponent(cif)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "job_seeker_ro_spider",
      "Accept": "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`cuifirma.ro search error: ${res.status}`);
  }

  const json = await res.json();
  const results = json.results || [];

  // Find exact CIF match
  const match = results.find(c => c.cui === cif);
  if (!match) {
    throw new Error(`cuifirma.ro: no company found for CIF ${cif}`);
  }

  console.log(`✅ cuifirma.ro found: ${match.name} (CIF ${match.cui})`);

  // Map to ANAF-compatible shape
  return {
    cui: parseInt(match.cui, 10),
    name: match.name,
    address: match.location || "",
    registrationNumber: "",
    caenCode: "",
    inactive: !match.is_active,
    onrcStatusLabel: match.status_label || (match.is_active ? "Funcțiune" : "Inactiv"),
    vatRegistered: false,
    eFacturaRegistered: false,
    _source: "cuifirma.ro"
  };
}

/**
 * Searches for companies by name on cuifirma.ro as fallback.
 * @param {string} query - Company name or brand to search for
 * @returns {Promise<Array>} - Array of matching company objects
 * @throws {Error} - If search API fails
 */
export async function searchCompanyCuiFirma(query) {
  const url = `${CUIFIRMA_SEARCH_URL}?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "job_seeker_ro_spider",
      "Accept": "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`cuifirma.ro search error: ${res.status}`);
  }

  const json = await res.json();
  return json.results || [];
}

// ============================================================================
// ANAF API - Searching companies by name/brand
// ============================================================================

/**
 * Searches for companies by brand name in ANAF database
 * Returns list of matching companies with their CIF and status
 * 
 * @param {string} brandName - Company name or brand to search for
 * @returns {Promise<Array>} - Array of matching company objects
 * @throws {Error} - If search API fails
 */
/**
 * Searches for companies by name/brand, trying ANAF first then cuifirma.ro
 * @param {string} brandName - Company name or brand to search for
 * @returns {Promise<Array>} - Array of matching company objects
 */
export async function searchCompanyWithFallback(brandName) {
  try {
    return await searchCompany(brandName);
  } catch {
    console.log("⚠️ ANAF search failed, trying cuifirma.ro...");
    return await searchCompanyCuiFirma(brandName);
  }
}

/**
 * Fetches company details by CIF, trying ANAF first then cuifirma.ro
 * @param {string} cif - Company CIF/CUI
 * @returns {Promise<Object>} - Company data
 */
export async function getCompanyFromANAFWithCuiFirmaFallback(cif) {
  try {
    return await getCompanyFromANAF(cif);
  } catch (err) {
    console.log(`⚠️ ANAF unreachable (${err.message}) — trying cuifirma.ro...`);
    return await getCompanyFromCuiFirma(cif);
  }
}

export async function searchCompany(brandName) {
  const url = `${ANAF_SEARCH_URL}?q=${encodeURIComponent(brandName)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "job_seeker_ro_spider" }
  });
  
  if (!res.ok) {
    throw new Error(`ANAF search error: ${res.status}`);
  }
  
  const json = await res.json();
  return json.data || [];
}
