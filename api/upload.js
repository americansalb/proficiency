import { google } from 'googleapis';
import formidable from 'formidable';
import fs from 'fs';

// Disable body parsing, we'll use formidable
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the multipart form data
    const form = formidable({
      maxFileSize: 500 * 1024 * 1024, // 500MB max file size
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
    const participantName = fields.participantName[0];
    const passcode = fields.passcode[0];
    const timestamp = fields.timestamp[0];

    console.log('Received upload:', {
      filename: videoFile.originalFilename,
      size: videoFile.size,
      participantName,
      passcode,
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

    // Upload to Google Drive
    const fileMetadata = {
      name: videoFile.originalFilename,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    };

    const media = {
      mimeType: 'video/webm',
      body: fs.createReadStream(videoFile.filepath),
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink',
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
      participantName,
      passcode,
      timestamp,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
