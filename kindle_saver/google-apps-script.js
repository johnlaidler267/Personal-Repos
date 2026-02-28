/**
 * Google Apps Script - Email Relay for Send to Kindle Extension
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://script.google.com/
 * 2. Click "New Project"
 * 3. Delete the default code and paste this entire file
 * 4. Click "Deploy" > "New deployment"
 * 5. Click the gear icon next to "Select type" and choose "Web app"
 * 6. Set:
 *    - Description: "Send to Kindle Email Relay"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone" (or "Anyone with Google account" for more security)
 * 7. Click "Deploy"
 * 8. Copy the Web App URL and use it in the extension settings
 * 9. Click "Authorize access" and grant permissions when prompted
 * 
 * SECURITY (Optional but Recommended):
 * - Add a simple API key check by uncommenting the API_KEY section below
 * - Generate a random string and use it as your API key
 */

// OPTIONAL: Set an API key for security (uncomment and set a random string)
// const API_KEY = 'your-random-api-key-here';

/**
 * Main function to handle POST requests from the extension
 */
function doPost(e) {
  try {
    // Parse the request
    const data = JSON.parse(e.postData.contents);
    
    // OPTIONAL: Verify API key (uncomment if using API_KEY above)
    // if (data.apiKey !== API_KEY) {
    //   return ContentService.createTextOutput(JSON.stringify({
    //     success: false,
    //     error: 'Invalid API key'
    //   })).setMimeType(ContentService.MimeType.JSON);
    // }
    
    // Validate required fields
    if (!data.kindleEmail || !data.fromEmail || !data.epubData || !data.subject) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Missing required fields'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Create the email
    const emailBody = `Please find the attached EPUB file: ${data.subject}`;
    
    // Convert base64 EPUB data to blob
    const epubBlob = Utilities.newBlob(
      Utilities.base64Decode(data.epubData),
      'application/epub+zip',
      data.filename || 'article.epub'
    );
    
    // Send the email
    MailApp.sendEmail({
      to: data.kindleEmail,
      from: data.fromEmail,
      subject: data.subject,
      body: emailBody,
      attachments: [epubBlob]
    });
    
    // Return success response
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Email sent successfully'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Return error response
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Test function - you can run this manually to test the script
 */
function testSendEmail() {
  const testData = {
    kindleEmail: 'your-kindle-email@kindle.com',
    fromEmail: Session.getActiveUser().getEmail(),
    subject: 'Test EPUB',
    filename: 'test.epub',
    epubData: 'UEsDBBQAAAAIA...' // Base64 encoded test data
  };
  
  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}
