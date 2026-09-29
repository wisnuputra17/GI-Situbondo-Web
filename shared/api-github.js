/**
 * api-github.js
 * GitHub JSON Database API
 * Fast read from GitHub CDN with localStorage caching
 */

const GITHUB_CONFIG = {
  RAW_URL: 'https://raw.githubusercontent.com/wisnuputra17/GI-Situbondo-Web/main/data',
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  CACHE_PREFIX: 'gh_v1_' // Version prefix for cache invalidation
};

/**
 * Load data dari GitHub dengan caching
 * @param {string} filename - Nama file JSON (tanpa path)
 * @param {boolean} forceRefresh - Bypass cache
 * @returns {Promise<Array>} Data array
 */
async function loadFromGitHub(filename, forceRefresh = false) {
  const cacheKey = `${GITHUB_CONFIG.CACHE_PREFIX}${filename}`;
  
  // Check localStorage cache
  if (!forceRefresh) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        
        if (age < GITHUB_CONFIG.CACHE_DURATION) {
          console.log(`✅ Cache HIT: ${filename} (${Math.round(age/1000)}s old)`);
          return data;
        } else {
          console.log(`⏰ Cache expired: ${filename}`);
        }
      } catch (e) {
        console.warn('Cache parse error:', e);
        localStorage.removeItem(cacheKey);
      }
    }
  }
  
  // Fetch from GitHub
  console.log(`📥 Fetching from GitHub: ${filename}`);
  const url = `${GITHUB_CONFIG.RAW_URL}/${filename}?t=${Date.now()}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Save to cache
    localStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    
    console.log(`✅ Loaded ${filename}: ${Array.isArray(data) ? data.length : 1} entries`);
    
    return data;
  } catch (error) {
    console.error(`❌ Failed to load ${filename}:`, error);
    
    // Fallback: return stale cache if available
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      console.warn(`⚠️  Using stale cache for ${filename}`);
      const { data } = JSON.parse(cached);
      return data;
    }
    
    throw error;
  }
}

/**
 * Clear cache untuk file tertentu atau semua cache
 * @param {string} filename - Optional, specific file to clear
 */
function clearGitHubCache(filename = null) {
  if (filename) {
    const cacheKey = `${GITHUB_CONFIG.CACHE_PREFIX}${filename}`;
    localStorage.removeItem(cacheKey);
    console.log(`🗑️  Cleared cache: ${filename}`);
  } else {
    // Clear all GitHub cache
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(GITHUB_CONFIG.CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    console.log('🗑️  Cleared all GitHub cache');
  }
}

/**
 * Get cache metadata
 * @returns {Object} Cache info
 */
function getGitHubCacheInfo() {
  const cacheInfo = {};
  
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(GITHUB_CONFIG.CACHE_PREFIX)) {
      const filename = key.replace(GITHUB_CONFIG.CACHE_PREFIX, '');
      try {
        const { data, timestamp } = JSON.parse(localStorage.getItem(key));
        const age = Date.now() - timestamp;
        
        cacheInfo[filename] = {
          entries: Array.isArray(data) ? data.length : 1,
          age_seconds: Math.round(age / 1000),
          expires_in: Math.round((GITHUB_CONFIG.CACHE_DURATION - age) / 1000),
          stale: age > GITHUB_CONFIG.CACHE_DURATION
        };
      } catch (e) {
        cacheInfo[filename] = { error: 'Parse error' };
      }
    }
  });
  
  return cacheInfo;
}

/**
 * Preload multiple files (parallel)
 * @param {Array<string>} filenames - List of files to preload
 */
async function preloadGitHubData(filenames) {
  console.log(`🚀 Preloading ${filenames.length} files...`);
  
  const promises = filenames.map(filename => 
    loadFromGitHub(filename).catch(err => {
      console.error(`Failed to preload ${filename}:`, err);
      return [];
    })
  );
  
  const results = await Promise.all(promises);
  
  console.log(`✅ Preloaded ${results.filter(r => r.length > 0).length}/${filenames.length} files`);
  
  return results;
}

// Export functions
if (typeof window !== 'undefined') {
  window.loadFromGitHub = loadFromGitHub;
  window.clearGitHubCache = clearGitHubCache;
  window.getGitHubCacheInfo = getGitHubCacheInfo;
  window.preloadGitHubData = preloadGitHubData;
  window.GITHUB_CONFIG = GITHUB_CONFIG;
}
