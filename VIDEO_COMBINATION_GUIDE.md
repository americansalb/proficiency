# Video Combination Guide

## What This Does

After participants complete the proficiency test, their 5 question videos need to be combined into one continuous video. This guide shows you how to do that.

---

## 🚀 Quick Start (For Team Members)

### Option A: Run Manually (One Time)

Use this when you want to combine videos right now:

```bash
npm run combine-videos
```

That's it! The script will:
- Find all participants with 5 completed videos
- Download and combine them
- Upload the combined video to Google Drive
- Show you a summary of what was processed

---

### Option B: Run Automatically (Every 8 Hours)

Use this to set up automatic video combination that runs in the background:

```bash
npm run schedule-combine
```

This will:
- Run the combination script immediately
- Then run it again every 8 hours
- Keep running until you stop it with `Ctrl+C`

**Tip:** Run this in a separate terminal window and leave it open!

---

## 📋 First Time Setup

### 1. Install ffmpeg

ffmpeg is the tool that combines videos. You only need to install it once.

**On Mac:**
```bash
brew install ffmpeg
```

**On Windows:**
1. Download from https://ffmpeg.org/download.html
2. Follow the installation instructions
3. Restart your terminal

**On Linux (Ubuntu/Debian):**
```bash
sudo apt-get install ffmpeg
```

### 2. Install Dependencies

Run this in the project folder:
```bash
npm install
```

---

## 📖 How It Works

1. **Participant completes test** → 5 separate videos upload to Google Drive
2. **Metadata file is created** → Marks these videos as "ready to combine"
3. **Combination script runs** → Either manually or automatically every 8 hours
4. **Script processes videos:**
   - Downloads all 5 videos
   - Combines them into one continuous video
   - Uploads combined video to Drive
   - Deletes metadata file (marks as complete)

---

## 🎯 Common Scenarios

### "I want to combine videos right now"
```bash
npm run combine-videos
```

### "I want videos to combine automatically"
Start the scheduler and leave it running:
```bash
npm run schedule-combine
```

### "How do I know if it worked?"
The script shows colorful progress messages:
- ✅ Green checkmarks = success
- ❌ Red X = error
- 📊 Summary at the end shows how many were processed

### "Where are the combined videos?"
They're uploaded to the same Google Drive folder as the original videos. Look for files ending with `_COMBINED.webm`

---

## 🆘 Troubleshooting

### "ERROR: ffmpeg is not installed"
→ Follow the "Install ffmpeg" instructions above

### "No pending combinations found"
→ This means all videos have already been combined! Nothing to do.

### "Found X files, expected 5"
→ The participant hasn't finished all 5 questions yet. The script will skip them and try again next time.

### Script crashes or freezes
→ Stop it with `Ctrl+C` and run it again. It's safe to re-run.

---

## 🔧 Advanced: Running on a Server

If you want this to run 24/7 on a server without keeping a terminal open, use a process manager:

### Using PM2 (Recommended)
```bash
# Install PM2
npm install -g pm2

# Start the scheduler
pm2 start npm --name "video-combiner" -- run schedule-combine

# View logs
pm2 logs video-combiner

# Stop the scheduler
pm2 stop video-combiner
```

### Using screen (Linux/Mac)
```bash
# Start a screen session
screen -S video-combiner

# Run the scheduler
npm run schedule-combine

# Detach: Press Ctrl+A then D
# Reattach later: screen -r video-combiner
```

---

## 📞 Need Help?

If something isn't working:
1. Check the error message - it usually tells you what's wrong
2. Make sure ffmpeg is installed: `ffmpeg -version`
3. Make sure dependencies are installed: `npm install`
4. Try running manually first before setting up automatic scheduling

---

## 🎬 Example Output

```
🎬 Video Combination Script Starting...
==========================================
Started at: 1/23/2025, 3:45:00 PM

✅ ffmpeg is installed

🔍 Searching for pending video combinations...

📊 Found 2 pending combination(s)

📋 Processing: Smith_ABC123_COMBINE_METADATA.json
─────────────────────────────────────────
   📥 Downloading metadata...
   👤 Participant: John Smith
   🔢 Passcode: ABC123
   📹 Videos: 5
   📥 Downloading videos...
      1/5: Smith_ABC123_Q1.webm
      2/5: Smith_ABC123_Q2.webm
      3/5: Smith_ABC123_Q3.webm
      4/5: Smith_ABC123_Q4.webm
      5/5: Smith_ABC123_Q5.webm
   🎬 Combining videos...
   🔧 Running ffmpeg...
   📤 Uploading combined video...
   ✅ COMBINED VIDEO UPLOADED!
   🔗 Link: https://drive.google.com/...
   🧹 Cleaning up temporary files...
   🗑️  Deleting metadata file from Drive...
   ✅ COMPLETED!

==========================================
📊 SUMMARY
==========================================
✅ Successful: 2
❌ Failed: 0
📅 Completed at: 1/23/2025, 3:46:30 PM
```
