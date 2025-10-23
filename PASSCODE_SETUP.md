# Google Sheet Passcode Validation Setup

## Overview
The app validates passcodes against a Google Sheet instead of hardcoded ranges. This allows you to manage 5,000+ valid passcodes easily.

---

## Step 1: Create Your Google Sheet

1. **Create a new Google Sheet** (or use an existing one)
2. **Format it like this:**

   ```
   |    A      |
   |-----------|
   | Passcodes |  <- Header (optional)
   | 1089100855555 |
   | 1089100855556 |
   | 1089100855557 |
   | ... (5,000 rows) |
   ```

3. **Important:**
   - Column A contains passcodes only
   - One passcode per row
   - No spaces or special characters in passcodes
   - Numbers only

4. **Share with service account:**
   - Click "Share" button
   - Add: `your-service-account@your-project.iam.gserviceaccount.com`
   - Give "Viewer" access (read-only)

---

## Step 2: Get Your Google Sheet ID

The Sheet ID is in the URL:
```
https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
                                      ^^^^^^^^^^^^^^^^
```

**Example:**
```
https://docs.google.com/spreadsheets/d/1abc123xyz456/edit
Sheet ID = 1abc123xyz456
```

Copy this ID - you'll need it in Step 3.

---

## Step 3: Add Environment Variable to Render

1. **Go to your Render dashboard**
2. **Select your app**
3. **Go to "Environment" tab**
4. **Add these variables:**

   ```
   GOOGLE_SHEET_ID=your_sheet_id_from_step_2
   GOOGLE_SHEET_RANGE=Sheet1!A:A
   ```

   **Notes:**
   - `GOOGLE_SHEET_ID`: The ID from Step 2
   - `GOOGLE_SHEET_RANGE`:
     - If your sheet is named "Sheet1", use `Sheet1!A:A`
     - If you renamed it to "Passcodes", use `Passcodes!A:A`
     - `A:A` means "read all of column A"

5. **Click "Save Changes"**
6. **Render will automatically redeploy**

---

## Step 4: Test It

1. **Go to your test URL**
2. **Enter a passcode from your Google Sheet**
3. **It should accept it and let you continue**
4. **Try an invalid passcode (not in sheet)**
5. **It should reject it**

---

## How It Works

1. User enters passcode on your site
2. App calls `/api/validate-passcode`
3. API reads your Google Sheet (column A)
4. Checks if entered passcode exists in the list
5. Returns `valid: true` or `valid: false`

**Performance:**
- Google Sheets API is fast (< 1 second)
- Supports 5,000+ passcodes easily
- Service account has read-only access (secure)

---

## Managing Passcodes

**To add new passcodes:**
1. Open your Google Sheet
2. Add rows to column A
3. Changes take effect immediately (no redeploy needed)

**To remove passcodes:**
1. Delete the row from your sheet
2. Changes take effect immediately

**To track usage:**
- Keep your "used passcodes" sheet separate
- The app only reads from the valid passcodes sheet
- You can manually mark passcodes as used in your tracking sheet

---

## Troubleshooting

**"Invalid passcode" for valid codes:**
- Check that the Sheet ID is correct
- Verify service account has access to the sheet
- Check that `GOOGLE_SHEET_RANGE` matches your sheet name
- Look at Render logs for specific errors

**Slow validation:**
- Google Sheets API can handle thousands of rows
- If you have 10,000+ passcodes, consider splitting into multiple sheets

**Service account email:**
You can find it in your Render environment variables:
```
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
```

---

## Example Google Sheet Setup

**Sheet Name:** Passcodes
**Range to use:** `Passcodes!A:A`

| A (Passcodes) |
|---------------|
| 1089100800001 |
| 1089100800002 |
| 1089100800003 |
| 1089100800004 |
| 1089100800005 |
| ... |

**Environment Variables:**
```
GOOGLE_SHEET_ID=1abc123xyz456
GOOGLE_SHEET_RANGE=Passcodes!A:A
```

Done! The app will now validate against this sheet.
