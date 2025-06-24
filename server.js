const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Serve static files
app.use(express.static('.'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Conversion endpoints (simplified for demo)
app.post('/convert/pdf-to-jpg', upload.single('file'), (req, res) => {
    // In a real implementation, you would use pdf2pic or similar
    res.json({ message: 'PDF to JPG conversion would happen here' });
});

app.post('/convert/jpg-to-pdf', upload.array('files'), (req, res) => {
    // In a real implementation, you would use pdf-lib or similar
    res.json({ message: 'JPG to PDF conversion would happen here' });
});

app.post('/convert/pdf-to-docx', upload.single('file'), (req, res) => {
    // In a real implementation, you would use mammoth or similar
    res.json({ message: 'PDF to DOCX conversion would happen here' });
});

app.post('/convert/docx-to-pdf', upload.single('file'), (req, res) => {
    // In a real implementation, you would use puppeteer or similar
    res.json({ message: 'DOCX to PDF conversion would happen here' });
});

app.post('/convert/compress-pdf', upload.single('file'), (req, res) => {
    // In a real implementation, you would use pdf-lib compression
    res.json({ message: 'PDF compression would happen here' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});