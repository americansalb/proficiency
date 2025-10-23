import { google } from 'googleapis';
import formidable from 'formidable';
import fs from 'fs';

export default async function uploadHandler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the multipart form data
    const form = formidable({
      maxFileSize: 100 * 1024 * 1024, // 100MB max file size per question
      keepExtensions: true,
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    // Get uploaded file
    const videoFile = files.video[0];
    const firstName = fields.firstName[0];
    const lastName = fields.lastName[0];
    const passcode = fields.passcode[0];
    const questionNumber = fields.questionNumber[0];
    const timestamp = fields.timestamp[0];

    console.log('Received upload:', {
      filename: videoFile.originalFilename,
      size: videoFile.size,
      firstName,
      lastName,
      passcode,
      questionNumber,
      timestamp
    });

    // Authenticate with Google Drive
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

    // Create or get participant folder: "FirstName_LastName_Passcode"
    const folderName = `${firstName}_${lastName}_${passcode}`;
    let participantFolderId;

    // Search for existing folder
    const folderQuery = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed=false`;
    
    const folderSearch = await drive.files.list({
      q: folderQuery,
      fields: 'files(id, name)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    if (folderSearch.data.files.length > 0) {
      // Folder exists, use it
      participantFolderId = folderSearch.data.files[0].id;
      console.log('Using existing folder:', folderName);
    } else {
      // Create new folder
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
      };

      const folder = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id',
        supportsAllDrives: true
      });

      participantFolderId = folder.data.id;
      console.log('Created new folder:', folderName);
    }

    // Upload video to participant's folder
    const fileMetadata = {
      name: videoFile.originalFilename,
      parents: [participantFolderId],
    };

    const media = {
      mimeType: 'video/webm',
      body: fs.createReadStream(videoFile.filepath),
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    });

    console.log('File uploaded to Google Drive:', file.data);

    // Clean up temp file
    fs.unlinkSync(videoFile.filepath);

    // Return success response
    return res.status(200).json({
      success: true,
      fileId: file.data.id,
      fileName: file.data.name,
      webViewLink: file.data.webViewLink,
      folderName: folderName,
      questionNumber: questionNumber,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
```

## What this does:

1. **Creates a folder named:** `FirstName_LastName_Passcode` (e.g., `Kevin_Thakkar_1089100823457`)
2. **Searches for existing folder** - if it exists, uses it (so all 5 questions go in same folder)
3. **Uploads each question recording** to that person's folder
4. **Each file is named:** `Question_1_timestamp.webm`, `Question_2_timestamp.webm`, etc.

## Result in Google Drive:
```
📁 Language Proficiency Screenings/
  📁 Kevin_Thakkar_1089100823457/
    🎥 Question_1_2025-10-23T01:20:00.webm
    🎥 Question_2_2025-10-23T01:22:30.webm
    🎥 Question_3_2025-10-23T01:25:00.webm
    🎥 Question_4_2025-10-23T01:27:30.webm
    🎥 Question_5_2025-10-23T01:30:00.webm
