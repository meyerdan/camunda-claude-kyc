const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3333;
const BASE = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.bpmn': 'application/xml',
  '.xml': 'application/xml',
};

http.createServer((req, res) => {
  let filePath;
  if (req.url === '/' || req.url === '/index.html') {
    filePath = path.join(__dirname, 'index.html');
  } else {
    filePath = path.join(BASE, req.url);
  }

  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`BPMN viewer at http://localhost:${PORT}`));
