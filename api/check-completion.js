import { google } from 'googleapis';

export default async function checkCompletionHandler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { passcode } = req.body;

    if (!passcode) {
      return res.status(400).json({ error: 'Passcode is required' });
    }

    // Authenticate with Google Drive using environment variables
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    // Search for English Q5 - use full name pattern for accuracy
    // Format: LastName_Passcode_ENGLISH_Q5.webm
    const englishQuery = `name contains '${passcode}_ENGLISH_Q5' and mimeType='video/webm' and trashed=false`;
    const englishResponse = await drive.files.list({
      q: englishQuery,
      fields: 'files(id, name, parents)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    // Search for Non-English Q5 - use full name pattern for accuracy
    // Format: LastName_Passcode_NONENG_Q5.webm
    const nonEnglishQuery = `name contains '${passcode}_NONENG_Q5' and mimeType='video/webm' and trashed=false`;
    const nonEnglishResponse = await drive.files.list({
      q: nonEnglishQuery,
      fields: 'files(id, name, parents)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    const englishFiles = englishResponse.data.files || [];
    const nonEnglishFiles = nonEnglishResponse.data.files || [];

    console.log('Completion check for passcode:', passcode);
    console.log('English Q5 files found:', englishFiles.length, englishFiles.map(f => f.name));
    console.log('Non-English Q5 files found:', nonEnglishFiles.length, nonEnglishFiles.map(f => f.name));

    // Consider test completed if Q5 exists (means they finished all questions)
    const completedTests = {
      english: englishFiles.length > 0,
      nonEnglish: nonEnglishFiles.length > 0
    };

    return res.json({
      success: true,
      completed: completedTests,
      details: {
        englishQ5Found: englishFiles.length,
        englishQ5Files: englishFiles.map(f => f.name),
        nonEnglishQ5Found: nonEnglishFiles.length,
        nonEnglishQ5Files: nonEnglishFiles.map(f => f.name)
      }
    });

  } catch (error) {
    console.error('Error checking completion:', error);
    return res.status(500).json({
      error: 'Failed to check completion status',
      details: error.message
    });
  }
}
