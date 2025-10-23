import { google } from 'googleapis';
import fs from 'fs';

export default async function checkCompletionHandler(req, res) {
  try {
    const { passcode } = req.body;

    if (!passcode) {
      return res.status(400).json({ error: 'Passcode is required' });
    }

    // Load service account credentials
    const credentials = JSON.parse(
      fs.readFileSync('./service-account-key.json', 'utf8')
    );

    // Initialize Google Drive API
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });
    const folderId = '1rrWA_VK-G5HQd-iL_gH3IsCPNbWkxsRJ';

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
