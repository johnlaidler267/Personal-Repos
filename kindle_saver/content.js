// content.js - Content script (kept for future use)
// Currently, article extraction is handled directly in popup.js to avoid CSP issues

// Listen for messages from popup (for future features)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // This content script is kept for future enhancements
  // Article extraction is now done directly in popup.js using executeScript
  sendResponse({ success: false, error: 'Not implemented in content script' });
  return true;
});

// Function to load Readability and extract article
// Since Readability is in MAIN world and we're in ISOLATED world,
// we need to inject a script into MAIN world to use it
async function extractArticle() {
  // First, ensure Readability is loaded
  await loadReadability();

  // Now extract the article by injecting into MAIN world
  return new Promise((resolve, reject) => {
    // Clear any previous result
    window.__readabilityResult = undefined;
    window.__readabilityError = undefined;

    const extractScript = document.createElement('script');
    extractScript.textContent = `
      (function() {
        try {
          if (typeof Readability === 'undefined') {
            throw new Error('Readability not available');
          }
          
          const documentClone = document.cloneNode(true);
          const reader = new Readability(documentClone, {
            debug: false,
            maxElemsToParseTo: 1000000,
            nbTopCandidates: 5,
            charThreshold: 500
          });
          
          const article = reader.parse();
          
          if (!article) {
            throw new Error('Could not extract article content');
          }
          
          // Store result in window for content script to access
          window.__readabilityResult = article;
          window.__readabilityError = null;
        } catch (error) {
          window.__readabilityResult = null;
          window.__readabilityError = error.message;
        }
      })();
    `;
    (document.head || document.documentElement).appendChild(extractScript);
    extractScript.remove();

    // Wait for the result
    let attempts = 0;
    const maxAttempts = 60;
    
    const checkResult = setInterval(() => {
      attempts++;
      if (window.__readabilityResult !== undefined) {
        clearInterval(checkResult);
        if (window.__readabilityError) {
          reject(new Error(window.__readabilityError));
        } else if (window.__readabilityResult) {
          resolve(window.__readabilityResult);
        } else {
          reject(new Error('Could not extract article content'));
        }
      } else if (attempts >= maxAttempts) {
        clearInterval(checkResult);
        reject(new Error('Timeout waiting for article extraction'));
      }
    }, 50);
  });
}

// Function to load Readability library
// Readability should already be injected by popup.js into the MAIN world
// We need to access it from the page's window object
function loadReadability() {
  return new Promise((resolve, reject) => {
    // Try to access Readability from the page's window (MAIN world)
    // In content scripts, we're in ISOLATED world, so we need to inject into MAIN world
    // But since popup.js already injected it, we should be able to access it
    
    // First check if it's available in our isolated world (unlikely)
    if (typeof Readability !== 'undefined') {
      resolve();
      return;
    }

    // Since Readability was injected into MAIN world, we need to access it differently
    // We'll inject a script into MAIN world to check and use Readability
    const checkScript = document.createElement('script');
    checkScript.textContent = `
      (function() {
        if (typeof Readability !== 'undefined') {
          window.__readabilityReady = true;
        } else {
          window.__readabilityReady = false;
        }
      })();
    `;
    (document.head || document.documentElement).appendChild(checkScript);
    checkScript.remove();

    // Wait for Readability to be available
    let attempts = 0;
    const maxAttempts = 60; // 3 seconds
    
    const checkReadability = setInterval(() => {
      attempts++;
      // Check if Readability is available in MAIN world
      if (window.__readabilityReady === true || typeof window.Readability !== 'undefined') {
        clearInterval(checkReadability);
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkReadability);
        reject(new Error('Readability library not found. Please try again.'));
      }
    }, 50);
  });
}
