const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const sharp = require('sharp');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const xlsx = require('xlsx');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');
const { Document, Packer, Paragraph, TextRun } = require('docx');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Ensure directories exist
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

ensureDir('uploads');
ensureDir('outputs');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/bmp',
            'image/webp',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
            'text/plain',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.ms-powerpoint'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type'), false);
        }
    }
});

// Helper function to clean up files
const cleanupFile = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error('Error cleaning up file:', error);
    }
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// PDF to JPG conversion
app.post('/convert/pdf-to-jpg', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const inputPath = req.file.path;
        const outputDir = path.join('outputs', `pdf-to-jpg-${Date.now()}`);
        ensureDir(outputDir);

        // Use pdf2pic for conversion
        const pdf2pic = require('pdf2pic');
        const convert = pdf2pic.fromPath(inputPath, {
            density: 300,
            saveFilename: 'page',
            savePath: outputDir,
            format: 'jpg',
            width: 2480,
            height: 3508
        });

        const results = await convert.bulk(-1);
        
        if (results.length === 0) {
            throw new Error('No pages converted');
        }

        // Create ZIP file if multiple pages
        if (results.length > 1) {
            const zip = new JSZip();
            
            for (let i = 0; i < results.length; i++) {
                const imagePath = results[i].path;
                const imageBuffer = fs.readFileSync(imagePath);
                zip.file(`page-${i + 1}.jpg`, imageBuffer);
                cleanupFile(imagePath);
            }

            const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
            const zipPath = path.join(outputDir, 'converted-images.zip');
            fs.writeFileSync(zipPath, zipBuffer);

            res.download(zipPath, 'converted-images.zip', () => {
                cleanupFile(inputPath);
                cleanupFile(zipPath);
                fs.rmSync(outputDir, { recursive: true, force: true });
            });
        } else {
            // Single page
            const imagePath = results[0].path;
            res.download(imagePath, 'converted-page.jpg', () => {
                cleanupFile(inputPath);
                cleanupFile(imagePath);
                fs.rmSync(outputDir, { recursive: true, force: true });
            });
        }

    } catch (error) {
        console.error('PDF to JPG conversion error:', error);
        cleanupFile(req.file?.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
});

// JPG to PDF conversion
app.post('/convert/jpg-to-pdf', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const pdfDoc = await PDFDocument.create();
        
        for (const file of req.files) {
            const imageBuffer = fs.readFileSync(file.path);
            let image;
            
            if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
                image = await pdfDoc.embedJpg(imageBuffer);
            } else if (file.mimetype === 'image/png') {
                image = await pdfDoc.embedPng(imageBuffer);
            } else {
                // Convert other formats to JPEG using Sharp
                const convertedBuffer = await sharp(imageBuffer).jpeg().toBuffer();
                image = await pdfDoc.embedJpg(convertedBuffer);
            }

            const page = pdfDoc.addPage();
            const { width, height } = page.getSize();
            const imageAspectRatio = image.width / image.height;
            const pageAspectRatio = width / height;

            let imageWidth, imageHeight;
            if (imageAspectRatio > pageAspectRatio) {
                imageWidth = width;
                imageHeight = width / imageAspectRatio;
            } else {
                imageHeight = height;
                imageWidth = height * imageAspectRatio;
            }

            page.drawImage(image, {
                x: (width - imageWidth) / 2,
                y: (height - imageHeight) / 2,
                width: imageWidth,
                height: imageHeight,
            });
        }

        const pdfBytes = await pdfDoc.save();
        const outputPath = path.join('outputs', `merged-${Date.now()}.pdf`);
        fs.writeFileSync(outputPath, pdfBytes);

        res.download(outputPath, 'merged-document.pdf', () => {
            req.files.forEach(file => cleanupFile(file.path));
            cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('JPG to PDF conversion error:', error);
        req.files?.forEach(file => cleanupFile(file.path));
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
});

// PDF to DOCX conversion
app.post('/convert/pdf-to-docx', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // For demo purposes, create a DOCX with extracted text
        // In production, you'd use more sophisticated PDF text extraction
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "PDF Content Extracted",
                                bold: true,
                                size: 28,
                            }),
                        ],
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "This is a converted document from PDF. In a production environment, this would contain the actual extracted text from your PDF file with proper formatting preservation.",
                                size: 24,
                            }),
                        ],
                    }),
                ],
            }],
        });

        const buffer = await Packer.toBuffer(doc);
        const outputPath = path.join('outputs', `converted-${Date.now()}.docx`);
        fs.writeFileSync(outputPath, buffer);

        res.download(outputPath, 'converted-document.docx', () => {
            cleanupFile(req.file.path);
            cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('PDF to DOCX conversion error:', error);
        cleanupFile(req.file?.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
});

// DOCX to PDF conversion
app.post('/convert/docx-to-pdf', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const result = await mammoth.extractRawText({ path: req.file.path });
        const text = result.value;

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();

        const fontSize = 12;
        const lineHeight = fontSize * 1.2;
        const margin = 50;
        const maxWidth = width - 2 * margin;
        
        const words = text.split(' ');
        let lines = [];
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const textWidth = font.widthOfTextAtSize(testLine, fontSize);
            
            if (textWidth <= maxWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine) lines.push(currentLine);

        let y = height - margin;
        for (const line of lines) {
            if (y < margin) {
                const newPage = pdfDoc.addPage();
                y = newPage.getSize().height - margin;
            }
            
            page.drawText(line, {
                x: margin,
                y: y,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
            });
            y -= lineHeight;
        }

        const pdfBytes = await pdfDoc.save();
        const outputPath = path.join('outputs', `converted-${Date.now()}.pdf`);
        fs.writeFileSync(outputPath, pdfBytes);

        res.download(outputPath, 'converted-document.pdf', () => {
            cleanupFile(req.file.path);
            cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('DOCX to PDF conversion error:', error);
        cleanupFile(req.file?.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
});

// PDF compression
app.post('/convert/compress-pdf', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const inputBuffer = fs.readFileSync(req.file.path);
        const pdfDoc = await PDFDocument.load(inputBuffer);
        
        // Basic compression by re-saving
        const compressedBytes = await pdfDoc.save({
            useObjectStreams: false,
            addDefaultPage: false,
        });

        const outputPath = path.join('outputs', `compressed-${Date.now()}.pdf`);
        fs.writeFileSync(outputPath, compressedBytes);

        res.download(outputPath, 'compressed-document.pdf', () => {
            cleanupFile(req.file.path);
            cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('PDF compression error:', error);
        cleanupFile(req.file?.path);
        res.status(500).json({ error: 'Compression failed: ' + error.message });
    }
});

// Excel to PDF conversion
app.post('/convert/excel-to-pdf', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();

        const fontSize = 10;
        const lineHeight = fontSize * 1.5;
        const margin = 50;
        let y = height - margin;

        page.drawText('Excel Data Conversion', {
            x: margin,
            y: y,
            size: 16,
            font: font,
            color: rgb(0, 0, 0),
        });
        y -= lineHeight * 2;

        for (const row of jsonData.slice(0, 30)) { // Limit to 30 rows for demo
            if (y < margin) break;
            
            const rowText = row.join(' | ');
            page.drawText(rowText.substring(0, 80), {
                x: margin,
                y: y,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
            });
            y -= lineHeight;
        }

        const pdfBytes = await pdfDoc.save();
        const outputPath = path.join('outputs', `excel-converted-${Date.now()}.pdf`);
        fs.writeFileSync(outputPath, pdfBytes);

        res.download(outputPath, 'excel-converted.pdf', () => {
            cleanupFile(req.file.path);
            cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('Excel to PDF conversion error:', error);
        cleanupFile(req.file?.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
});

// CSV to PDF conversion
app.post('/convert/csv-to-pdf', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const csvData = [];
        fs.createReadStream(req.file.path)
            .pipe(csvParser())
            .on('data', (data) => csvData.push(data))
            .on('end', async () => {
                try {
                    const pdfDoc = await PDFDocument.create();
                    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                    const page = pdfDoc.addPage();
                    const { width, height } = page.getSize();

                    const fontSize = 10;
                    const lineHeight = fontSize * 1.5;
                    const margin = 50;
                    let y = height - margin;

                    page.drawText('CSV Data Conversion', {
                        x: margin,
                        y: y,
                        size: 16,
                        font: font,
                        color: rgb(0, 0, 0),
                    });
                    y -= lineHeight * 2;

                    for (const row of csvData.slice(0, 25)) {
                        if (y < margin) break;
                        
                        const rowText = Object.values(row).join(' | ');
                        page.drawText(rowText.substring(0, 80), {
                            x: margin,
                            y: y,
                            size: fontSize,
                            font: font,
                            color: rgb(0, 0, 0),
                        });
                        y -= lineHeight;
                    }

                    const pdfBytes = await pdfDoc.save();
                    const outputPath = path.join('outputs', `csv-converted-${Date.now()}.pdf`);
                    fs.writeFileSync(outputPath, pdfBytes);

                    res.download(outputPath, 'csv-converted.pdf', () => {
                        cleanupFile(req.file.path);
                        cleanupFile(outputPath);
                    });
                } catch (error) {
                    console.error('CSV processing error:', error);
                    cleanupFile(req.file.path);
                    res.status(500).json({ error: 'Conversion failed: ' + error.message });
                }
            });

    } catch (error) {
        console.error('CSV to PDF conversion error:', error);
        cleanupFile(req.file?.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
});

// Text to PDF conversion
app.post('/convert/txt-to-pdf', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const text = fs.readFileSync(req.file.path, 'utf8');
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        let page = pdfDoc.addPage();
        let { width, height } = page.getSize();

        const fontSize = 12;
        const lineHeight = fontSize * 1.2;
        const margin = 50;
        const maxWidth = width - 2 * margin;
        
        const lines = text.split('\n');
        let y = height - margin;

        for (const line of lines) {
            const words = line.split(' ');
            let currentLine = '';

            for (const word of words) {
                const testLine = currentLine + (currentLine ? ' ' : '') + word;
                const textWidth = font.widthOfTextAtSize(testLine, fontSize);
                
                if (textWidth <= maxWidth) {
                    currentLine = testLine;
                } else {
                    if (currentLine) {
                        if (y < margin) {
                            page = pdfDoc.addPage();
                            y = page.getSize().height - margin;
                        }
                        
                        page.drawText(currentLine, {
                            x: margin,
                            y: y,
                            size: fontSize,
                            font: font,
                            color: rgb(0, 0, 0),
                        });
                        y -= lineHeight;
                    }
                    currentLine = word;
                }
            }
            
            if (currentLine) {
                if (y < margin) {
                    page = pdfDoc.addPage();
                    y = page.getSize().height - margin;
                }
                
                page.drawText(currentLine, {
                    x: margin,
                    y: y,
                    size: fontSize,
                    font: font,
                    color: rgb(0, 0, 0),
                });
                y -= lineHeight;
            }
        }

        const pdfBytes = await pdfDoc.save();
        const outputPath = path.join('outputs', `text-converted-${Date.now()}.pdf`);
        fs.writeFileSync(outputPath, pdfBytes);

        res.download(outputPath, 'text-converted.pdf', () => {
            cleanupFile(req.file.path);
            cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('Text to PDF conversion error:', error);
        cleanupFile(req.file?.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
});

// Image format conversions
app.post('/convert/image-convert', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { format } = req.body;
        const supportedFormats = ['jpeg', 'png', 'webp', 'bmp', 'tiff'];
        
        if (!supportedFormats.includes(format)) {
            return res.status(400).json({ error: 'Unsupported output format' });
        }

        const inputBuffer = fs.readFileSync(req.file.path);
        let outputBuffer;

        switch (format) {
            case 'jpeg':
                outputBuffer = await sharp(inputBuffer).jpeg({ quality: 90 }).toBuffer();
                break;
            case 'png':
                outputBuffer = await sharp(inputBuffer).png().toBuffer();
                break;
            case 'webp':
                outputBuffer = await sharp(inputBuffer).webp({ quality: 90 }).toBuffer();
                break;
            case 'bmp':
                outputBuffer = await sharp(inputBuffer).bmp().toBuffer();
                break;
            case 'tiff':
                outputBuffer = await sharp(inputBuffer).tiff().toBuffer();
                break;
        }

        const outputPath = path.join('outputs', `converted-${Date.now()}.${format}`);
        fs.writeFileSync(outputPath, outputBuffer);

        res.download(outputPath, `converted-image.${format}`, () => {
            cleanupFile(req.file.path);
            cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('Image conversion error:', error);
        cleanupFile(req.file?.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
});

// PDF merge
app.post('/convert/merge-pdf', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length < 2) {
            return res.status(400).json({ error: 'At least 2 PDF files required' });
        }

        const mergedPdf = await PDFDocument.create();

        for (const file of req.files) {
            const pdfBuffer = fs.readFileSync(file.path);
            const pdf = await PDFDocument.load(pdfBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const pdfBytes = await mergedPdf.save();
        const outputPath = path.join('outputs', `merged-${Date.now()}.pdf`);
        fs.writeFileSync(outputPath, pdfBytes);

        res.download(outputPath, 'merged-document.pdf', () => {
            req.files.forEach(file => cleanupFile(file.path));
            cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('PDF merge error:', error);
        req.files?.forEach(file => cleanupFile(file.path));
        res.status(500).json({ error: 'Merge failed: ' + error.message });
    }
});

// PDF split
app.post('/convert/split-pdf', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const pdfBuffer = fs.readFileSync(req.file.path);
        const pdf = await PDFDocument.load(pdfBuffer);
        const pageCount = pdf.getPageCount();

        const zip = new JSZip();

        for (let i = 0; i < pageCount; i++) {
            const newPdf = await PDFDocument.create();
            const [copiedPage] = await newPdf.copyPages(pdf, [i]);
            newPdf.addPage(copiedPage);
            
            const pdfBytes = await newPdf.save();
            zip.file(`page-${i + 1}.pdf`, pdfBytes);
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        const outputPath = path.join('outputs', `split-${Date.now()}.zip`);
        fs.writeFileSync(outputPath, zipBuffer);

        res.download(outputPath, 'split-pages.zip', () => {
            cleanupFile(req.file.path);
            cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('PDF split error:', error);
        cleanupFile(req.file?.path);
        res.status(500).json({ error: 'Split failed: ' + error.message });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Available conversion endpoints:');
    console.log('- POST /convert/pdf-to-jpg');
    console.log('- POST /convert/jpg-to-pdf');
    console.log('- POST /convert/pdf-to-docx');
    console.log('- POST /convert/docx-to-pdf');
    console.log('- POST /convert/compress-pdf');
    console.log('- POST /convert/excel-to-pdf');
    console.log('- POST /convert/csv-to-pdf');
    console.log('- POST /convert/txt-to-pdf');
    console.log('- POST /convert/image-convert');
    console.log('- POST /convert/merge-pdf');
    console.log('- POST /convert/split-pdf');
});