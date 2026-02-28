// options.js - Handles settings page functionality

// Test defaults (same as background.js – for pre-fill when nothing saved)
const DEFAULT_KINDLE_EMAIL = 'jlaidler_MGDjb4@kindle.com';
const DEFAULT_FROM_EMAIL = 'laidlertsc@gmail.com';
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz9nvKa0DslJrFBDfs5VHyjT2Eq4ORIpJmsOfQDfeBhjPH4OPrHNtpAlBh60PoZrdtb/exec';

document.addEventListener('DOMContentLoaded', () => {
  const kindleEmailInput = document.getElementById('kindleEmail');
  const fromEmailInput = document.getElementById('fromEmail');
  const scriptUrlInput = document.getElementById('scriptUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');

  // Load saved settings (use test defaults when not set)
  chrome.storage.local.get([
    'kindleEmail',
    'fromEmail',
    'scriptUrl',
    'apiKey'
  ], (result) => {
    kindleEmailInput.value = result.kindleEmail || DEFAULT_KINDLE_EMAIL;
    fromEmailInput.value = result.fromEmail || DEFAULT_FROM_EMAIL;
    scriptUrlInput.value = result.scriptUrl || DEFAULT_SCRIPT_URL;
    apiKeyInput.value = result.apiKey || '';
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    // Validate required fields
    if (!kindleEmailInput.value || !fromEmailInput.value || !scriptUrlInput.value) {
      statusDiv.textContent = 'Please fill in all required fields';
      statusDiv.className = 'text-sm text-red-600';
      statusDiv.classList.remove('hidden');
      setTimeout(() => {
        statusDiv.classList.add('hidden');
      }, 3000);
      return;
    }

    // Validate URL format
    try {
      new URL(scriptUrlInput.value);
    } catch (e) {
      statusDiv.textContent = 'Please enter a valid Google Apps Script URL';
      statusDiv.className = 'text-sm text-red-600';
      statusDiv.classList.remove('hidden');
      setTimeout(() => {
        statusDiv.classList.add('hidden');
      }, 3000);
      return;
    }

    const settings = {
      kindleEmail: kindleEmailInput.value,
      fromEmail: fromEmailInput.value,
      scriptUrl: scriptUrlInput.value,
      apiKey: apiKeyInput.value || '' // Optional field
    };

    chrome.storage.local.set(settings, () => {
      statusDiv.textContent = 'Settings saved successfully!';
      statusDiv.className = 'text-sm text-green-600';
      statusDiv.classList.remove('hidden');
      
      setTimeout(() => {
        statusDiv.classList.add('hidden');
      }, 3000);
    });
  });
});
