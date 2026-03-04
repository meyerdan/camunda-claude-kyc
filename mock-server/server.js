const express = require('express');
const app = express();
const PORT = 3001;

app.use(express.json());

// Deterministic score from name (600-850 range)
function deterministicScore(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return 600 + Math.abs(hash % 251); // 600-850
}

// POST /api/identity-verify
app.post('/api/identity-verify', (req, res) => {
  const { name, dateOfBirth, idDocumentNumber } = req.body;
  console.log(`[ID VERIFY] name=${name}, dob=${dateOfBirth}, doc=${idDocumentNumber}`);

  if (idDocumentNumber && idDocumentNumber.startsWith('ERROR')) {
    return res.status(500).json({ error: 'Service unavailable' });
  }

  if (idDocumentNumber && idDocumentNumber.startsWith('FAIL')) {
    return res.json({ verified: false, score: 0, error: 'Document not recognized' });
  }

  const score = 85 + Math.floor(Math.random() * 16); // 85-100
  return res.json({ verified: true, score });
});

// POST /api/sanctions-check
app.post('/api/sanctions-check', (req, res) => {
  const { name, dateOfBirth, country } = req.body;
  console.log(`[SANCTIONS] name=${name}, dob=${dateOfBirth}, country=${country}`);

  if (name && name.includes('SANCTIONED')) {
    return res.json({ hit: true, lists: ['OFAC', 'EU'] });
  }

  return res.json({ hit: false, lists: [] });
});

// POST /api/credit-score
app.post('/api/credit-score', (req, res) => {
  const { name, dateOfBirth, country } = req.body;
  console.log(`[CREDIT] name=${name}, dob=${dateOfBirth}, country=${country}`);

  if (country === 'XX') {
    return res.status(503).json({ error: 'Credit bureau unavailable' });
  }

  const score = deterministicScore(name || 'unknown');
  return res.json({ score });
});

app.listen(PORT, () => {
  console.log(`Mock KYC API server running on http://localhost:${PORT}`);
});
