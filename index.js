import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import uploadHandler from './api/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(join(__dirname, 'public')));

// API route for upload
app.post('/api/upload', uploadHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
