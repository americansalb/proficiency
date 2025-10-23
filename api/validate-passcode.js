import { google } from 'googleapis';

export default async function validatePasscodeHandler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { passcode } = req.body;

    if (!passcode) {
      return res.status(400).json({
        valid: false,
        error: 'Passcode is required'
      });
    }

    // Clean the passcode (remove spaces/dashes)
    const cleanedPasscode = passcode.replace(/[\s-]/g, '');

    // Authenticate with Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Get the spreadsheet ID from environment variable
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Read from Sheet1, column A (all passcodes)
    // Using A:A reads all values in column A
    const range = process.env.GOOGLE_SHEET_RANGE || 'Sheet1!A:A';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];

    // Flatten array (each row is an array with one value)
    const validPasscodes = rows.flat().map(code => code?.toString().trim());

    console.log(`Checking passcode: ${cleanedPasscode}`);
    console.log(`Total valid passcodes in sheet: ${validPasscodes.length}`);

    // Check if entered passcode exists in the list
    const isValid = validPasscodes.includes(cleanedPasscode);

    console.log(`Passcode ${cleanedPasscode} is ${isValid ? 'VALID' : 'INVALID'}`);

    return res.json({
      valid: isValid,
      message: isValid ? 'Passcode is valid' : 'Invalid passcode'
    });

  } catch (error) {
    console.error('Error validating passcode:', error);
    return res.status(500).json({
      valid: false,
      error: 'Failed to validate passcode',
      details: error.message
    });
  }
}
