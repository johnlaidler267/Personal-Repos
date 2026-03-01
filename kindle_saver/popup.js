// popup.js - Handles the popup UI interactions

// Helper function to convert Blob to base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Remove data URL prefix (data:application/epub+zip;base64,)
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// JSZip is loaded via <script src="jszip.min.js"> in popup.html (bundled in extension to avoid CSP blocking inline/cross-origin script)
async function loadJSZip() {
  if (window.JSZip) {
    return window.JSZip;
  }
  // Scripts in popup.html load in order; JSZip should already be there. If not, fail fast with a clear message.
  throw new Error('JSZip library not loaded. Ensure jszip.min.js is in the extension folder and loaded in popup.html.');
}

// Extract img src URLs from HTML and resolve to absolute URLs (order preserved, duplicates kept for mapping)
function getImageUrlsFromHTML(html, baseUrl) {
  if (!html || !baseUrl) return [];
  const div = document.createElement('div');
  div.innerHTML = html;
  const imgs = div.querySelectorAll('img[src]');
  const urls = [];
  try {
    const base = new URL(baseUrl);
    imgs.forEach((img) => {
      const src = (img.getAttribute('src') || '').trim();
      if (!src || src.startsWith('data:')) return;
      try {
        urls.push(new URL(src, base).href);
      } catch (_) {}
    });
  } catch (_) {}
  return urls;
}

// Fetch a single image via background script; returns { data, contentType } or null
async function fetchImageAsBase64(url) {
  const res = await chrome.runtime.sendMessage({ action: 'fetchImage', url });
  if (res && res.success && res.data) return { data: res.data, contentType: res.contentType || 'image/png' };
  return null;
}

// Content-type to file extension for EPUB
function contentTypeToExt(ct) {
  const m = (ct || '').toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('png')) return 'png';
  if (m.includes('gif')) return 'gif';
  if (m.includes('webp')) return 'webp';
  if (m.includes('svg')) return 'svg';
  return 'png';
}

// Generate EPUB from article (baseUrl = tab URL for resolving image URLs)
async function generateEPUB(article, baseUrl = '') {
  console.log('generateEPUB called with article:', article.title);
  
  console.log('Loading JSZip...');
  const JSZip = await loadJSZip();
  console.log('JSZip loaded, creating zip...');
  
  const zip = new JSZip();
  const rawContent = article.content || article.textContent || '';
  const cleanTitle = escapeXML(article.title || 'Untitled Article');
  const cleanByline = escapeXML(article.byline || '');
  const cleanSiteName = escapeXML(article.siteName || '');

  // Parse images: get ordered list of absolute URLs, then fetch and build url -> local path
  const imageUrls = getImageUrlsFromHTML(rawContent, baseUrl);
  const urlToLocal = {}; // absolute URL -> e.g. "images/img0.png"
  const manifestItems = [];
  let imagesFolder = null;
  let imageIndex = 0;
  const seenUrls = new Set();
  for (const url of imageUrls) {
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    const fetched = await fetchImageAsBase64(url);
    if (!fetched) continue;
    if (!imagesFolder) imagesFolder = zip.folder('OEBPS').folder('images');
    const ext = contentTypeToExt(fetched.contentType);
    const safeName = `img${imageIndex}.${ext}`;
    const localPath = `images/${safeName}`;
    urlToLocal[url] = localPath;
    const binary = Uint8Array.from(atob(fetched.data), (c) => c.charCodeAt(0));
    imagesFolder.file(safeName, binary, { binary: true });
    const mediaType = fetched.contentType.startsWith('image/') ? fetched.contentType : `image/${ext}`;
    manifestItems.push(`    <item id="img${imageIndex}" href="${localPath}" media-type="${escapeXML(mediaType)}"/>`);
    imageIndex++;
  }

  // Replace img src in HTML with local paths
  let cleanContent = sanitizeHTML(rawContent);
  if (baseUrl && Object.keys(urlToLocal).length > 0) {
    const div = document.createElement('div');
    div.innerHTML = cleanContent;
    const imgs = div.querySelectorAll('img[src]');
    try {
      const base = new URL(baseUrl);
      imgs.forEach((img) => {
        const src = (img.getAttribute('src') || '').trim();
        if (!src || src.startsWith('data:')) return;
        try {
          const abs = new URL(src, base).href;
          if (urlToLocal[abs]) img.setAttribute('src', urlToLocal[abs]);
        } catch (_) {}
      });
      cleanContent = div.innerHTML;
    } catch (_) {}
  }
  
  console.log('ZIP created, adding files...');
  
  // mimetype (must be first, uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  
  // META-INF/container.xml
  zip.folder('META-INF').file('container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);
  
  // OEBPS/content.opf (include image items in manifest)
  const manifestImages = manifestItems.length ? '\n' + manifestItems.join('\n') + '\n' : '';
  zip.folder('OEBPS').file('content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${Date.now()}</dc:identifier>
    <dc:title>${cleanTitle}</dc:title>
    <dc:creator>${cleanByline || cleanSiteName || 'Unknown'}</dc:creator>
    <dc:language>en</dc:language>
    <dc:date>${new Date().toISOString()}</dc:date>
    <meta property="dcterms:modified">${new Date().toISOString()}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>${manifestImages}
  </manifest>
  <spine toc="nav">
    <itemref idref="cover"/>
    <itemref idref="chapter1"/>
  </spine>
</package>`);
  
  // Cover
  zip.folder('OEBPS').file('cover.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${cleanTitle}</title>
  <style>
    body { font-family: serif; text-align: center; padding: 2em; margin: 0; }
    h1 { font-size: 2em; margin-top: 3em; line-height: 1.4; }
    .byline { margin-top: 2em; font-style: italic; color: #666; }
    .site { margin-top: 1em; font-size: 0.9em; color: #888; }
  </style>
</head>
<body>
  <h1>${cleanTitle}</h1>
  ${cleanByline ? `<div class="byline">${cleanByline}</div>` : ''}
  ${cleanSiteName ? `<div class="site">${cleanSiteName}</div>` : ''}
</body>
</html>`);
  
  // Navigation
  zip.folder('OEBPS').file('nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body>
  <nav epub:type="toc">
    <ol>
      <li><a href="cover.xhtml">Cover</a></li>
      <li><a href="chapter1.xhtml">${cleanTitle}</a></li>
    </ol>
  </nav>
</body>
</html>`);
  
  // Main content (with embedded image paths)
  zip.folder('OEBPS').file('chapter1.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${cleanTitle}</title>
  <style>
    body { font-family: Georgia, serif; line-height: 1.6; max-width: 40em; margin: 0 auto; padding: 1em; }
    h1 { font-size: 1.8em; margin-bottom: 0.5em; }
    p { margin: 1em 0; text-align: justify; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <h1>${cleanTitle}</h1>
  ${cleanContent}
</body>
</html>`);
  
  console.log('All files added, generating EPUB blob...');
  try {
    const blob = await zip.generateAsync({ 
      type: 'blob', 
      compression: 'DEFLATE', 
      compressionOptions: { level: 9 },
      mimeType: 'application/epub+zip'
    });
    console.log('EPUB blob generated, size:', blob.size);
    return blob;
  } catch (error) {
    console.error('Error generating EPUB blob:', error);
    throw error;
  }
}

function escapeXML(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function sanitizeHTML(html) {
  if (!html) return '';
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
}

const QUOTES = [
  'A reader lives a thousand lives before he dies.',
  'There is no friend as loyal as a book.',
  'Reading is dreaming with open eyes.',
  'Books are a uniquely portable magic.',
];

document.addEventListener('DOMContentLoaded', () => {
  const sendToKindleBtn = document.getElementById('sendToKindleBtn');
  const statusDiv = document.getElementById('status');
  const statusBar = document.getElementById('statusBar');

  // Random quote
  const quoteEl = document.getElementById('quote');
  if (quoteEl) {
    quoteEl.textContent = `"${QUOTES[Math.floor(Math.random() * QUOTES.length)]}"`;
  }

  function setButtonState(state) {
    sendToKindleBtn.querySelectorAll('.btn-content').forEach((el) => el.classList.add('hidden'));
    const active = sendToKindleBtn.querySelector('.btn-' + state);
    if (active) active.classList.remove('hidden');
  }

  function showStatus(message, isError = false, isProgress = false) {
    statusDiv.textContent = message;
    statusBar.classList.add('visible');
    if (!isProgress) {
      statusBar.classList.remove('sending', 'success', 'error');
      statusBar.classList.add(isError ? 'error' : 'success');
      statusBar.querySelectorAll('.status-icon').forEach((el) => el.classList.add('hidden'));
      const icon = statusBar.querySelector(isError ? '.status-icon-error' : '.status-icon-success');
      if (icon) icon.classList.remove('hidden');
    }
  }

  function hideStatusBar() {
    statusBar.classList.remove('visible', 'sending', 'success', 'error');
  }

  // Handle Send to Kindle button click
  sendToKindleBtn.addEventListener('click', async () => {
    try {
      sendToKindleBtn.disabled = true;
      setButtonState('sending');
      statusBar.classList.remove('success', 'error');
      statusBar.classList.add('sending', 'visible');
      statusDiv.textContent = 'Loading Readability library...';
      statusBar.querySelectorAll('.status-icon').forEach((el) => el.classList.add('hidden'));
      statusBar.querySelector('.status-icon-sending')?.classList.remove('hidden');
      statusBar.querySelector('.status-icon-sending')?.classList.add('pulse');

      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('No active tab found');
      }

      // Step 1: Get Readability code from background script
      const readabilityResponse = await chrome.runtime.sendMessage({ action: 'getReadability' });
      
      if (!readabilityResponse || !readabilityResponse.success || !readabilityResponse.code) {
        throw new Error('Failed to load Readability library. Please check your internet connection.');
      }

      showStatus('Injecting Readability...', false, true);

      // Step 2: Inject Readability library using blob URL to avoid CSP issues
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (code) => {
          // Inject Readability code using blob URL to bypass CSP
          if (typeof Readability === 'undefined') {
            const blob = new Blob([code], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => URL.revokeObjectURL(url);
            (document.head || document.documentElement).appendChild(script);
          }
        },
        args: [readabilityResponse.code],
        world: 'MAIN' // Use MAIN world to access page's window object
      });

      // Wait for Readability to initialize
      await new Promise(resolve => setTimeout(resolve, 300));

      showStatus('Extracting article content...', false, true);

      // Step 3: Extract article using executeScript
      const extractResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
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
            
            return article;
          } catch (error) {
            return { error: error.message };
          }
        },
        world: 'MAIN'
      });

      // Extract the result
      if (extractResult && extractResult[0] && extractResult[0].result) {
        const result = extractResult[0].result;
        if (result.error) {
          throw new Error(result.error);
        }
        const article = result;
        console.log('Article extracted:', article);
        
        showStatus('Generating EPUB...', false, true);
        
        // Step 4: Generate EPUB (pass tab URL so images can be resolved and fetched)
        console.log('Starting EPUB generation...');
        let epubBlob;
        try {
          epubBlob = await generateEPUB(article, tab.url);
          console.log('EPUB generated successfully, size:', epubBlob.size);
        } catch (error) {
          console.error('EPUB generation error:', error);
          throw new Error(`Failed to generate EPUB: ${error.message}`);
        }
        
        // Convert EPUB to base64
        console.log('Converting EPUB to base64...');
        let epubBase64;
        try {
          epubBase64 = await blobToBase64(epubBlob);
          console.log('EPUB converted to base64, length:', epubBase64.length);
        } catch (error) {
          console.error('Base64 conversion error:', error);
          throw new Error(`Failed to convert EPUB to base64: ${error.message}`);
        }
        
        showStatus('Sending to Kindle...', false, true);
        
        // Step 5: Send to Kindle via background script
        const sendResponse = await chrome.runtime.sendMessage({
          action: 'sendToKindle',
          epubData: epubBase64,
          title: article.title
        });
        
        if (sendResponse && sendResponse.success) {
          setButtonState('success');
          showStatus('Your reading awaits on your Kindle', false);
          statusBar.classList.remove('sending');
          statusBar.classList.add('success');
          setTimeout(() => {
            setButtonState('idle');
            hideStatusBar();
            sendToKindleBtn.disabled = false;
          }, 3000);
        } else {
          throw new Error(sendResponse?.error || 'Failed to send to Kindle');
        }
      } else {
        throw new Error('Failed to extract article');
      }
    } catch (error) {
      console.error('Error:', error);
      setButtonState('error');
      showStatus(error.message, true);
    } finally {
      if (!statusBar.classList.contains('success')) {
        sendToKindleBtn.disabled = false;
      }
    }
  });
});
