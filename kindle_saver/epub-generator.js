// epub-generator.js - Generates EPUB files from article content

// JSZip will be loaded from CDN
let JSZipLoaded = false;
let JSZip = null;

/**
 * Loads JSZip library
 */
async function loadJSZip() {
  if (JSZipLoaded && JSZip) return JSZip;
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    script.onload = () => {
      JSZip = window.JSZip;
      JSZipLoaded = true;
      resolve(JSZip);
    };
    script.onerror = () => reject(new Error('Failed to load JSZip'));
    document.head.appendChild(script);
  });
}

/**
 * Generates an EPUB file from article data
 * @param {Object} article - Article object from Readability
 * @param {string} url - Original article URL
 * @returns {Promise<Blob>} EPUB file as Blob
 */
async function generateEPUB(article, url = '') {
  // Load JSZip library
  const JSZip = await loadJSZip();
  
  const zip = new JSZip();
  
  // EPUB requires mimetype file (must be first, uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  
  // META-INF/container.xml
  zip.folder('META-INF').file('container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);
  
  // Generate clean HTML content
  const cleanTitle = escapeXML(article.title || 'Untitled Article');
  const cleanContent = sanitizeHTML(article.content || article.textContent || '');
  const cleanByline = escapeXML(article.byline || '');
  const cleanSiteName = escapeXML(article.siteName || '');
  
  // OEBPS/content.opf (package document)
  const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
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
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="nav">
    <itemref idref="cover"/>
    <itemref idref="chapter1"/>
  </spine>
</package>`;
  
  zip.folder('OEBPS').file('content.opf', opfContent);
  
  // Cover page
  const coverContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${cleanTitle}</title>
  <style>
    body {
      font-family: serif;
      text-align: center;
      padding: 2em;
      margin: 0;
    }
    h1 {
      font-size: 2em;
      margin-top: 3em;
      line-height: 1.4;
    }
    .byline {
      margin-top: 2em;
      font-style: italic;
      color: #666;
    }
    .site {
      margin-top: 1em;
      font-size: 0.9em;
      color: #888;
    }
  </style>
</head>
<body>
  <h1>${cleanTitle}</h1>
  ${cleanByline ? `<div class="byline">${cleanByline}</div>` : ''}
  ${cleanSiteName ? `<div class="site">${cleanSiteName}</div>` : ''}
</body>
</html>`;
  
  zip.folder('OEBPS').file('cover.xhtml', coverContent);
  
  // Navigation
  const navContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Navigation</title>
</head>
<body>
  <nav epub:type="toc">
    <ol>
      <li><a href="cover.xhtml">Cover</a></li>
      <li><a href="chapter1.xhtml">${cleanTitle}</a></li>
    </ol>
  </nav>
</body>
</html>`;
  
  zip.folder('OEBPS').file('nav.xhtml', navContent);
  
  // Main content
  const chapterContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${cleanTitle}</title>
  <style>
    body {
      font-family: Georgia, serif;
      line-height: 1.6;
      max-width: 40em;
      margin: 0 auto;
      padding: 1em;
    }
    h1 {
      font-size: 1.8em;
      margin-bottom: 0.5em;
    }
    p {
      margin: 1em 0;
      text-align: justify;
    }
    img {
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <h1>${cleanTitle}</h1>
  ${cleanContent}
</body>
</html>`;
  
  zip.folder('OEBPS').file('chapter1.xhtml', chapterContent);
  
  // Generate EPUB as Blob
  const epubBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });
  
  return epubBlob;
}

/**
 * Escapes XML special characters
 */
function escapeXML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Sanitizes HTML content for EPUB
 */
function sanitizeHTML(html) {
  if (!html) return '';
  
  // Create a temporary div to parse HTML
  const div = document.createElement('div');
  div.innerHTML = html;
  
  // Remove script tags and their content
  const scripts = div.querySelectorAll('script, style');
  scripts.forEach(el => el.remove());
  
  // Clean up attributes that might cause issues
  const allElements = div.querySelectorAll('*');
  allElements.forEach(el => {
    // Remove event handlers and problematic attributes
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on') || 
          attr.name === 'style' && attr.value.includes('javascript')) {
        el.removeAttribute(attr.name);
      }
    });
    
    // Convert relative URLs to absolute (if we have base URL)
    if (el.tagName === 'IMG' && el.src && !el.src.startsWith('http')) {
      // Keep relative URLs as-is for now
    }
  });
  
  return div.innerHTML;
}
