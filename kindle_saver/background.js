// background.js - Service worker for background tasks
// Handles EPUB generation and email sending via Google Apps Script

// Test defaults (for development; replace in Settings for production)
const DEFAULT_SETTINGS = {
  kindleEmail: 'jlaidler_MGDjb4@kindle.com',
  fromEmail: 'laidlertsc@gmail.com',
  scriptUrl: 'https://script.google.com/macros/s/AKfycbz9nvKa0DslJrFBDfs5VHyjT2Eq4ORIpJmsOfQDfeBhjPH4OPrHNtpAlBh60PoZrdtb/exec',
  apiKey: ''
};

chrome.runtime.onInstalled.addListener(() => {
  console.log('Send to Kindle extension installed');
  chrome.storage.local.get(['kindleEmail', 'fromEmail', 'scriptUrl'], (existing) => {
    // Pre-fill defaults only if nothing saved yet
    if (!existing.kindleEmail && !existing.fromEmail && !existing.scriptUrl) {
      chrome.storage.local.set(DEFAULT_SETTINGS, () => {
        console.log('Default test settings applied');
      });
    }
  });
});

// Cache for Readability library code
let readabilityCache = null;

// Cache for JSZip library code
let jszipCache = null;

/**
 * Fetches Readability library code and caches it
 * This bypasses CSP issues by fetching from the background script
 */
async function getReadabilityCode() {
  // Return cached version if available
  if (readabilityCache) {
    return readabilityCache;
  }

  // Try multiple CDN sources
  const cdnUrls = [
    'https://cdn.jsdelivr.net/npm/@mozilla/readability@0.4.4/Readability.js',
    'https://unpkg.com/@mozilla/readability@0.4.4/Readability.js',
    'https://raw.githubusercontent.com/mozilla/readability/main/Readability.js'
  ];

  for (const url of cdnUrls) {
    try {
      console.log(`Attempting to fetch Readability from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch from ${url}: HTTP ${response.status}`);
        continue; // Try next URL
      }
      const code = await response.text();
      console.log(`Fetched code from ${url}, length: ${code.length}`);
      
      // Check if it looks like valid JavaScript
      if (code && code.length > 100 && (code.includes('Readability') || code.includes('function'))) {
        readabilityCache = code;
        console.log('Readability code cached successfully');
        return code;
      } else {
        console.warn(`Code from ${url} doesn't look valid`);
      }
    } catch (error) {
      console.warn(`Failed to fetch from ${url}:`, error.message);
      continue; // Try next URL
    }
  }

  throw new Error('Failed to fetch Readability library from all CDN sources. Please check your internet connection.');
}

/**
 * Fetches JSZip library code and caches it
 * This bypasses CSP issues by fetching from the background script
 */
async function getJSZipCode() {
  // Return cached version if available
  if (jszipCache) {
    return jszipCache;
  }

  try {
    console.log('Fetching JSZip from CDN...');
    const response = await fetch('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const code = await response.text();
    console.log(`JSZip fetched successfully, length: ${code.length}`);
    
    // Check if it looks like valid JavaScript
    if (code && code.length > 100 && (code.includes('JSZip') || code.includes('function'))) {
      jszipCache = code;
      return code;
    } else {
      throw new Error('JSZip code doesn\'t look valid');
    }
  } catch (error) {
    console.error('Failed to fetch JSZip:', error);
    throw new Error(`Failed to fetch JSZip library: ${error.message}`);
  }
}

/**
 * Sends EPUB data to Kindle via Google Apps Script
 * @param {string} epubData - Base64 encoded EPUB file data
 * @param {string} title - Article title (for filename and subject)
 * @returns {Promise<Object>} Response from Google Apps Script
 */
async function sendToKindle(epubData, title) {
  try {
    // Get settings from storage
    const settings = await chrome.storage.local.get([
      'kindleEmail',
      'fromEmail',
      'scriptUrl',
      'apiKey'
    ]);

    // Validate settings
    if (!settings.kindleEmail || !settings.fromEmail || !settings.scriptUrl) {
      throw new Error('Please configure your settings first. Go to extension options.');
    }

    // Prepare the request payload
    const payload = {
      kindleEmail: settings.kindleEmail,
      fromEmail: settings.fromEmail,
      subject: title || 'Article from Send to Kindle',
      filename: `${(title || 'article').replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.epub`,
      epubData: epubData
    };

    // Add API key if configured
    if (settings.apiKey) {
      payload.apiKey = settings.apiKey;
    }

    // Send POST request to Google Apps Script
    const response = await fetch(settings.scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Script returned ${response.status}. ${text.slice(0, 200)}`);
    }

    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid response from script. Make sure the Apps Script URL is the web app "exec" URL.');
    }

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
    }

    return result;
  } catch (error) {
    console.error('Error sending to Kindle:', error);
    if (error.message === 'Failed to fetch' || (error.name === 'TypeError' && error.message && error.message.includes('fetch'))) {
      throw new Error('Could not reach the Apps Script. Check the script URL in Settings and that the app is deployed as "Anyone".');
    }
    throw error;
  }
}

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendToKindle') {
    sendToKindle(request.epubData, request.title)
      .then((result) => {
        sendResponse({ success: true, data: result });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
  
  if (request.action === 'getReadability') {
    getReadabilityCode()
      .then((code) => {
        console.log('Readability code fetched successfully, length:', code.length);
        sendResponse({ success: true, code: code });
      })
      .catch((error) => {
        console.error('Failed to get Readability code:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
  
  if (request.action === 'generateEPUB') {
    generateEPUB(request.article, request.url)
      .then((result) => {
        sendResponse({ success: true, data: result });
      })
      .catch((error) => {
        console.error('Failed to generate EPUB:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
  
  if (request.action === 'getJSZip') {
    getJSZipCode()
      .then((code) => {
        sendResponse({ success: true, code: code });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
});
