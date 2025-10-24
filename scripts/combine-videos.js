#!/usr/bin/env node

import { google } from 'googleapis';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const execPromise = promisify(exec);

console.log('🎬 Video Combination Script Starting...\n');
console.log('==========================================');
console.log(`Started at: ${new Date().toLocaleString()}\n`);

// Check if ffmpeg is installed
try {
  await execPromise('ffmpeg -version');
  console.log('✅ ffmpeg is installed\n');
} catch (error) {
  console.error('❌ ERROR: ffmpeg is not installed!');
  console.error('Please install ffmpeg:');
  console.error('  Mac: brew install ffmpeg');
  console.error('  Ubuntu: sudo apt-get install ffmpeg');
  console.error('  Windows: Download from https://ffmpeg.org/download.html\n');
  process.exit(1);
}

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
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Create temp directory for downloads
const tempDir = path.join(process.cwd(), 'temp_videos');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

async function downloadFile(fileId, fileName) {
  const dest = path.join(tempDir, fileName);
  const destStream = fs.createWriteStream(dest);

  const response = await drive.files.get(
    { fileId: fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return new Promise((resolve, reject) => {
    response.data
      .pipe(destStream)
      .on('finish', () => resolve(dest))
      .on('error', reject);
  });
}

async function combineVideos(videoPaths, outputPath) {
  // Create a text file listing all videos to combine
  const listFile = path.join(tempDir, 'file_list.txt');
  const fileList = videoPaths.map(p => `file '${p}'`).join('\n');
  fs.writeFileSync(listFile, fileList);

  // Use ffmpeg to concatenate videos
  const command = `ffmpeg -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}"`;

  console.log('   🔧 Running ffmpeg...');
  await execPromise(command);

  // Clean up list file
  fs.unlinkSync(listFile);
}

async function uploadFile(filePath, fileName) {
  const fileMetadata = {
    name: fileName,
    parents: [folderId],
  };

  const media = {
    mimeType: 'video/webm',
    body: fs.createReadStream(filePath),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, name, webViewLink',
  });

  return response.data;
}

async function processMetadataFile(metadataFile) {
  console.log(`\n📋 Processing: ${metadataFile.name}`);
  console.log('─────────────────────────────────────────');

  try {
    // Download metadata file
    console.log('   📥 Downloading metadata...');
    const metadataPath = await downloadFile(metadataFile.id, metadataFile.name);
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

    console.log(`   👤 Participant: ${metadata.participant}`);
    console.log(`   🔢 Passcode: ${metadata.passcode}`);
    console.log(`   📹 Videos: ${metadata.videos.length}`);

    if (metadata.videos.length !== 5) {
      console.log(`   ⚠️  Expected 5 videos, found ${metadata.videos.length}. Skipping.`);
      return false;
    }

    // Download all 5 videos
    console.log('   📥 Downloading videos...');
    const downloadedPaths = [];

    for (let i = 0; i < metadata.videos.length; i++) {
      const video = metadata.videos[i];
      console.log(`      ${i + 1}/5: ${video.name}`);
      const videoPath = await downloadFile(video.id, video.name);
      downloadedPaths.push(videoPath);
    }

    // Combine videos
    console.log('   🎬 Combining videos...');
    const outputName = `${metadata.participant.replace(/\s+/g, '_')}_${metadata.passcode}_COMBINED.webm`;
    const outputPath = path.join(tempDir, outputName);

    await combineVideos(downloadedPaths, outputPath);

    // Upload combined video
    console.log('   📤 Uploading combined video...');
    const uploadedFile = await uploadFile(outputPath, outputName);

    console.log(`   ✅ COMBINED VIDEO UPLOADED!`);
    console.log(`   🔗 Link: ${uploadedFile.webViewLink}`);

    // Clean up temporary files
    console.log('   🧹 Cleaning up temporary files...');
    downloadedPaths.forEach(p => fs.unlinkSync(p));
    fs.unlinkSync(outputPath);
    fs.unlinkSync(metadataPath);

    // Delete metadata file from Drive (marks as processed)
    console.log('   🗑️  Deleting metadata file from Drive...');
    await drive.files.delete({ fileId: metadataFile.id });

    console.log('   ✅ COMPLETED!\n');
    return true;

  } catch (error) {
    console.error(`   ❌ ERROR: ${error.message}\n`);
    return false;
  }
}

async function main() {
  try {
    // Search for all metadata files
    console.log('🔍 Searching for pending video combinations...\n');

    const searchQuery = `'${folderId}' in parents and name contains 'COMBINE_METADATA.json' and mimeType='application/json'`;

    const response = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name)',
    });

    const metadataFiles = response.data.files;

    if (metadataFiles.length === 0) {
      console.log('✨ No pending combinations found. All done!\n');
      return;
    }

    console.log(`📊 Found ${metadataFiles.length} pending combination(s)\n`);

    let successCount = 0;
    let failCount = 0;

    // Process each metadata file
    for (const metadataFile of metadataFiles) {
      const success = await processMetadataFile(metadataFile);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    // Summary
    console.log('==========================================');
    console.log('📊 SUMMARY');
    console.log('==========================================');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📅 Completed at: ${new Date().toLocaleString()}\n`);

  } catch (error) {
    console.error('❌ FATAL ERROR:', error);
    process.exit(1);
  } finally {
    // Clean up temp directory
    if (fs.existsSync(tempDir) && fs.readdirSync(tempDir).length === 0) {
      fs.rmdirSync(tempDir);
    }
  }
}

// Run the script
main().catch(console.error);
