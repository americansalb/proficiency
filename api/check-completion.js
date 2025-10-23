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

    // Check for English test completion
    const englishQuery = `'${folderId}' in parents and name contains '${passcode}' and name contains 'ENGLISH' and mimeType='video/webm'`;
    const englishResponse = await drive.files.list({
      q: englishQuery,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    // Check for Non-English test completion
    const nonEnglishQuery = `'${folderId}' in parents and name contains '${passcode}' and name contains 'NONENG' and mimeType='video/webm'`;
    const nonEnglishResponse = await drive.files.list({
      q: nonEnglishQuery,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const englishFiles = englishResponse.data.files || [];
    const nonEnglishFiles = nonEnglishResponse.data.files || [];

    // Consider test completed if 5 videos exist
    const completedTests = {
      english: englishFiles.length >= 5,
      nonEnglish: nonEnglishFiles.length >= 5
    };

    return res.json({
      success: true,
      completed: completedTests,
      details: {
        english: englishFiles.length,
        nonEnglish: nonEnglishFiles.length
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
