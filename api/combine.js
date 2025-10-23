import { google } from 'googleapis';

export default async function combineHandler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { firstName, lastName, passcode } = req.body;

    console.log('Video combination requested:', {
      firstName,
      lastName,
      passcode
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

    // Get folder ID from environment
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    // Search for all 5 question videos for this participant
    const searchQuery = `'${folderId}' in parents and name contains '${lastName}' and name contains '${passcode}' and mimeType='video/webm'`;

    const response = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime',
    });

    const files = response.data.files;

    if (files.length !== 5) {
      console.log(`Found ${files.length} files, expected 5. Videos may still be uploading.`);
      return res.status(200).json({
        message: 'Not all videos uploaded yet',
        filesFound: files.length
      });
    }

    console.log('All 5 videos found:', files.map(f => f.name));

    // Create a metadata file indicating videos should be combined
    // (Actual video combination would require ffmpeg and downloading files,
    // which is better done as a separate background job)
    const metadataContent = {
      participant: `${firstName} ${lastName}`,
      passcode: passcode,
      timestamp: new Date().toISOString(),
      videos: files.map(f => ({
        id: f.id,
        name: f.name,
        createdTime: f.createdTime
      })),
      status: 'ready_for_combination'
    };

    const metadataBlob = Buffer.from(JSON.stringify(metadataContent, null, 2));

    const metadataFile = await drive.files.create({
      requestBody: {
        name: `${lastName}_${passcode}_COMBINE_METADATA.json`,
        parents: [folderId],
        mimeType: 'application/json',
      },
      media: {
        mimeType: 'application/json',
        body: require('stream').Readable.from([metadataBlob]),
      },
      fields: 'id, name',
    });

    console.log('Combination metadata file created:', metadataFile.data.name);

    return res.status(200).json({
      success: true,
      message: 'Videos marked for combination',
      metadataFileId: metadataFile.data.id,
      videosFound: files.length
    });

  } catch (error) {
    console.error('Error in combine handler:', error);
    return res.status(500).json({
      error: 'Failed to process video combination',
      message: error.message
    });
  }
}
