# Send to Kindle Chrome Extension

A Chrome Extension (Manifest V3) that converts webpages to EPUB format and sends them to your Kindle via email.

## Features

- Extract clean article content using Mozilla Readability
- Convert articles to EPUB format
- Send to Kindle via email (using free Google Apps Script)
- Clean, modern UI with Tailwind CSS
- **100% Free** - No paid email services required!

## Project Structure

```
kindle_saver/
├── manifest.json              # Extension manifest (Manifest V3)
├── popup.html                 # Main popup UI
├── popup.js                   # Popup interaction logic
├── content.js                 # Content script for article extraction
├── background.js             # Service worker for background tasks
├── options.html               # Settings page
├── options.js                 # Settings page logic
├── google-apps-script.js      # Google Apps Script template
└── README.md                  # This file
```

## Installation

### 1. Install the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `kindle_saver` directory

*Note: The extension will use Chrome's default icon. To add custom icons later, create an `icons` folder with `icon16.png`, `icon48.png`, and `icon128.png` files, then add the icon references back to `manifest.json`.*

### 2. Set Up Google Apps Script (Free Email Relay)

This extension uses **Google Apps Script** as a completely free email relay. No paid services needed!

#### Quick Setup:

1. **Create the Script:**
   - Go to https://script.google.com/
   - Click "New Project"
   - Delete the default code
   - Copy the entire contents of `google-apps-script.js` from this project
   - Paste it into the Google Apps Script editor

2. **Deploy as Web App:**
   - Click "Deploy" → "New deployment"
   - Click the gear icon (⚙️) next to "Select type" and choose "Web app"
   - Configure:
     - **Description:** "Send to Kindle Email Relay"
     - **Execute as:** "Me"
     - **Who has access:** "Anyone" (or "Anyone with Google account" for more security)
   - Click "Deploy"
   - **Copy the Web App URL** - you'll need this for the extension settings

3. **Authorize the Script:**
   - When prompted, click "Authorize access"
   - Choose your Google account
   - Click "Advanced" → "Go to [Project Name] (unsafe)" if you see a warning
   - Click "Allow" to grant email sending permissions

4. **Configure Extension Settings:**
   - Click the extension icon → "Settings"
   - Enter your **Kindle email address** (from Amazon Kindle settings)
   - Enter your **Gmail address** (the one you used for Google Apps Script)
   - Paste the **Google Apps Script Web App URL** you copied earlier
   - (Optional) Add an API key if you enabled API key protection in the script
   - Click "Save Settings"

#### Important Notes:

- **Free Limits:** 
  - Gmail accounts: Up to 100 emails per day
  - Google Workspace: Up to 1,500 emails per day
- **Kindle Email:** Make sure your Gmail address is added to Amazon's "Approved Senders" list in your Kindle settings
- **Security (Optional):** Uncomment the API_KEY section in the Google Apps Script if you want to add an extra layer of security

## Usage

1. Navigate to any article webpage
2. Click the extension icon
3. Click "Send to Kindle" button
4. The article will be converted to EPUB and sent to your Kindle via email

## Development Status

- ✅ Project structure scaffolded
- ✅ Manifest V3 configuration
- ✅ Popup UI with Tailwind CSS
- ✅ Content script with Readability integration
- ✅ Article title extraction and console logging
- ✅ Google Apps Script email relay (free!)
- ✅ Settings page for email configuration
- ✅ Background service worker for email sending
- ⏳ EPUB generation (coming next)
- ⏳ Cover image generation (coming next)
- ⏳ Image handling in articles

## How It Works

1. **Content Extraction:** Uses Mozilla Readability to extract clean article content from webpages
2. **EPUB Generation:** (Coming soon) Converts HTML to EPUB format
3. **Email Sending:** Sends EPUB as attachment via Google Apps Script to your Kindle email
4. **Free & Simple:** No paid services, no complex setup - just Google Apps Script!

## Troubleshooting

- **"Please configure your settings first"**: Make sure you've set up Google Apps Script and entered all settings in the extension options
- **Email not received**: Check that your Gmail address is in Amazon's "Approved Senders" list for your Kindle
- **Script URL error**: Make sure you copied the full Web App URL from Google Apps Script deployment
- **Permission errors**: Re-authorize the Google Apps Script if you see permission issues
