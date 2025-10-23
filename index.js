import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import uploadHandler from './api/upload.js';
import combineHandler from './api/combine.js';
import checkCompletionHandler from './api/check-completion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Serve static files from public directory
app.use(express.static(join(__dirname, 'public')));

// API routes
app.post('/api/upload', uploadHandler);
app.post('/api/combine', combineHandler);
app.post('/api/check-completion', checkCompletionHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
