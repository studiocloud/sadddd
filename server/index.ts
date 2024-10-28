import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEmail, validateEmailBulk } from './emailValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../dist')));

app.post('/api/validate', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await validateEmail(email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Validation failed' });
  }
});

app.post('/api/validate-bulk', async (req, res) => {
  try {
    const { emails } = req.body;
    const results = await validateEmailBulk(emails);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Bulk validation failed' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});