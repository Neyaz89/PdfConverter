const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const sharp = require('sharp');
const { PDFDocument, rgb, StandardFonts, PageSizes } = require('pdf-lib');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const xlsx = require('xlsx');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');
const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, AlignmentType } = require('docx');
const pdf2pic = require('pdf2pic');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const QRCode = require('qrcode');
const bwipjs = require('bwip-js');
const marked = require('marked');
const TurndownService = require('turndown');
const cheerio = require('cheerio');
const archiver = require('archiver');
const unzipper = require('unzipper');
const iconv = require('iconv-lite');
const xml2js = require('xml2js');
const { htmlToText } = require('html-to-text');
const pptxgen = require('pptxgenjs');
const imagemin = require('imagemin');
const imageminPngquant = require('imagemin-pngquant');
const imageminMozjpeg = require('imagemin-mozjpeg');
const StreamZip = require('node-stream-zip');

const app = express();
const port = process.env.PORT || 3000;

// Enhanced middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
app.use(express.static('.'));

// Ensure directories exist
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

ensureDir('uploads');
ensureDir('outputs');
ensureDir('temp');

// Enhanced multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, file.fieldname + '-' + uniqueSuffix + '-' + sanitizedName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB limit
        files: 100 // Maximum 100 files
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            // PDF
            'application/pdf',
            // Images
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 
            'image/webp', 'image/tiff', 'image/svg+xml', 'image/x-icon',
            // Documents
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword', 'application/rtf', 'text/rtf',
            // Spreadsheets
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            // Presentations
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.ms-powerpoint',
            // Text formats
            'text/csv', 'text/plain', 'text/html', 'text/markdown', 'text/xml',
            // Data formats
            'application/json', 'application/xml',
            // Archives
            'application/zip', 'application/x-zip-compressed',
            'application/x-rar-compressed', 'application/x-7z-compressed',
            // E-books
            'application/epub+zip',
            // OpenDocument
            'application/vnd.oasis.opendocument.text',
            'application/vnd.oasis.opendocument.spreadsheet',
            'application/vnd.oasis.opendocument.presentation'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
        }
    }
});

// Enhanced error handling
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Utility functions
const cleanupFile = async (filePath, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
                return;
            }
        } catch (error) {
            if (i === retries - 1) {
                console.error('Error cleaning up file:', error);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
};

const validateFile = (file, allowedTypes = []) => {
    if (!file) {
        throw new Error('No file provided');
    }
    
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        throw new Error(`Invalid file type. Expected: ${allowedTypes.join(', ')}`);
    }
    
    if (!fs.existsSync(file.path)) {
        throw new Error('File not found on server');
    }
    
    return true;
};

const createZipFromFiles = async (files, zipName) => {
    const zip = new JSZip();
    
    for (const file of files) {
        const buffer = await fs.promises.readFile(file.path);
        zip.file(file.name, buffer);
    }
    
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const zipPath = path.join('outputs', zipName);
    await fs.promises.writeFile(zipPath, zipBuffer);
    
    return zipPath;
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. Enhanced PDF to Image conversion (JPG, PNG, WebP, TIFF)
app.post('/convert/pdf-to-image', upload.single('file'), asyncHandler(async (req, res) => {
    validateFile(req.file, ['application/pdf']);
    
    const { format = 'jpg', quality = 300, pages = 'all' } = req.body;
    const inputPath = req.file.path;
    const outputDir = path.join('outputs', `pdf-to-${format}-${Date.now()}`);
    ensureDir(outputDir);

    try {
        const convert = pdf2pic.fromPath(inputPath, {
            density: parseInt(quality) || 300,
            saveFilename: 'page',
            savePath: outputDir,
            format: format,
            width: format === 'tiff' ? 3508 : 2480,
            height: format === 'tiff' ? 4961 : 3508
        });

        let results;
        if (pages === 'all') {
            results = await convert.bulk(-1);
        } else {
            const pageNumbers = pages.split(',').map(p => parseInt(p.trim()));
            results = await Promise.all(pageNumbers.map(p => convert(p)));
        }
        
        if (results.length === 0) {
            throw new Error('No pages converted');
        }

        if (results.length > 1) {
            const zipFiles = results.map((result, index) => ({
                path: result.path,
                name: `page-${index + 1}.${format}`
            }));
            
            const zipPath = await createZipFromFiles(zipFiles, `converted-images.zip`);
            
            res.download(zipPath, `converted-images.zip`, async () => {
                await cleanupFile(req.file.path);
                await cleanupFile(zipPath);
                for (const result of results) {
                    await cleanupFile(result.path);
                }
                fs.rmSync(outputDir, { recursive: true, force: true });
            });
        } else {
            const imagePath = results[0].path;
            res.download(imagePath, `converted-page.${format}`, async () => {
                await cleanupFile(req.file.path);
                await cleanupFile(imagePath);
                fs.rmSync(outputDir, { recursive: true, force: true });
            });
        }

    } catch (error) {
        console.error('PDF to Image conversion error:', error);
        await cleanupFile(req.file.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
}));

// 2. Enhanced Image to PDF with advanced layout options
app.post('/convert/image-to-pdf', upload.array('files'), asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    const { 
        layout = 'auto', 
        pageSize = 'A4', 
        margin = 50, 
        orientation = 'portrait',
        quality = 90 
    } = req.body;
    
    try {
        const pdfDoc = await PDFDocument.create();
        
        for (const file of req.files) {
            validateFile(file, ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/tiff']);
            
            let imageBuffer = await fs.promises.readFile(file.path);
            
            // Optimize image if needed
            if (file.size > 5 * 1024 * 1024) { // 5MB
                imageBuffer = await sharp(imageBuffer)
                    .jpeg({ quality: parseInt(quality) })
                    .toBuffer();
            }
            
            let image;
            if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
                image = await pdfDoc.embedJpg(imageBuffer);
            } else if (file.mimetype === 'image/png') {
                image = await pdfDoc.embedPng(imageBuffer);
            } else {
                const convertedBuffer = await sharp(imageBuffer).jpeg({ quality: parseInt(quality) }).toBuffer();
                image = await pdfDoc.embedJpg(convertedBuffer);
            }

            const page = pdfDoc.addPage(PageSizes[pageSize] || PageSizes.A4);
            const { width, height } = page.getSize();
            
            const marginValue = parseInt(margin);
            const availableWidth = width - (2 * marginValue);
            const availableHeight = height - (2 * marginValue);

            let imageWidth, imageHeight;
            
            if (layout === 'fit') {
                const imageAspectRatio = image.width / image.height;
                const pageAspectRatio = availableWidth / availableHeight;

                if (imageAspectRatio > pageAspectRatio) {
                    imageWidth = availableWidth;
                    imageHeight = availableWidth / imageAspectRatio;
                } else {
                    imageHeight = availableHeight;
                    imageWidth = availableHeight * imageAspectRatio;
                }
            } else if (layout === 'fill') {
                imageWidth = availableWidth;
                imageHeight = availableHeight;
            } else { // auto
                const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
                imageWidth = image.width * scale;
                imageHeight = image.height * scale;
            }

            page.drawImage(image, {
                x: (width - imageWidth) / 2,
                y: (height - imageHeight) / 2,
                width: imageWidth,
                height: imageHeight,
            });
        }

        const pdfBytes = await pdfDoc.save();
        const outputPath = path.join('outputs', `images-to-pdf-${Date.now()}.pdf`);
        await fs.promises.writeFile(outputPath, pdfBytes);

        res.download(outputPath, 'images-to-pdf.pdf', async () => {
            for (const file of req.files) {
                await cleanupFile(file.path);
            }
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('Image to PDF conversion error:', error);
        for (const file of req.files) {
            await cleanupFile(file.path);
        }
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
}));

// 3. Enhanced PDF to DOCX with OCR support
app.post('/convert/pdf-to-docx', upload.single('file'), asyncHandler(async (req, res) => {
    validateFile(req.file, ['application/pdf']);
    
    const { useOCR = false, language = 'eng' } = req.body;
    
    try {
        let extractedText = '';
        
        if (useOCR) {
            // Convert PDF to images first, then OCR
            const outputDir = path.join('temp', `pdf-ocr-${Date.now()}`);
            ensureDir(outputDir);
            
            const convert = pdf2pic.fromPath(req.file.path, {
                density: 300,
                saveFilename: 'page',
                savePath: outputDir,
                format: 'png'
            });
            
            const results = await convert.bulk(-1);
            
            for (const result of results) {
                const { data: { text } } = await Tesseract.recognize(result.path, language);
                extractedText += text + '\n\n';
                await cleanupFile(result.path);
            }
            
            fs.rmSync(outputDir, { recursive: true, force: true });
        } else {
            // Try to extract text directly from PDF
            const pdfBuffer = await fs.promises.readFile(req.file.path);
            const pdfData = await pdfParse(pdfBuffer);
            extractedText = pdfData.text;
        }

        // Create DOCX document
        const doc = new Document({
            sections: [{
                properties: {},
                children: extractedText.split('\n').map(line => 
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: line,
                                size: 24,
                            }),
                        ],
                        spacing: {
                            after: 200,
                        },
                    })
                ),
            }],
        });

        const buffer = await Packer.toBuffer(doc);
        const outputPath = path.join('outputs', `pdf-to-docx-${Date.now()}.docx`);
        await fs.promises.writeFile(outputPath, buffer);

        res.download(outputPath, 'converted-document.docx', async () => {
            await cleanupFile(req.file.path);
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('PDF to DOCX conversion error:', error);
        await cleanupFile(req.file.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
}));

// 4. Enhanced DOCX to PDF conversion
app.post('/convert/docx-to-pdf', upload.single('file'), asyncHandler(async (req, res) => {
    validateFile(req.file, ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']);
    
    try {
        const result = await mammoth.extractRawText({ path: req.file.path });
        const text = result.value;

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        let page = pdfDoc.addPage(PageSizes.A4);
        let { width, height } = page.getSize();

        const fontSize = 12;
        const lineHeight = fontSize * 1.4;
        const margin = 50;
        const maxWidth = width - 2 * margin;
        
        const paragraphs = text.split('\n\n');
        let y = height - margin;

        for (const paragraph of paragraphs) {
            if (!paragraph.trim()) continue;
            
            const words = paragraph.split(' ');
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

            for (const line of lines) {
                if (y < margin + lineHeight) {
                    page = pdfDoc.addPage(PageSizes.A4);
                    y = page.getSize().height - margin;
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
            
            y -= lineHeight; // Extra space between paragraphs
        }

        const pdfBytes = await pdfDoc.save();
        const outputPath = path.join('outputs', `docx-to-pdf-${Date.now()}.pdf`);
        await fs.promises.writeFile(outputPath, pdfBytes);

        res.download(outputPath, 'converted-document.pdf', async () => {
            await cleanupFile(req.file.path);
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('DOCX to PDF conversion error:', error);
        await cleanupFile(req.file.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
}));

// 5. Advanced PDF compression with quality options
app.post('/convert/compress-pdf', upload.single('file'), asyncHandler(async (req, res) => {
    validateFile(req.file, ['application/pdf']);
    
    const { compressionLevel = 'medium' } = req.body;
    
    try {
        const inputBuffer = await fs.promises.readFile(req.file.path);
        const pdfDoc = await PDFDocument.load(inputBuffer);
        
        let compressionOptions = {};
        
        switch (compressionLevel) {
            case 'low':
                compressionOptions = { useObjectStreams: true, addDefaultPage: false };
                break;
            case 'medium':
                compressionOptions = { useObjectStreams: true, addDefaultPage: false, compress: true };
                break;
            case 'high':
                compressionOptions = { useObjectStreams: true, addDefaultPage: false, compress: true };
                break;
        }

        const compressedBytes = await pdfDoc.save(compressionOptions);

        const outputPath = path.join('outputs', `compressed-pdf-${Date.now()}.pdf`);
        await fs.promises.writeFile(outputPath, compressedBytes);

        const originalSize = inputBuffer.length;
        const compressedSize = compressedBytes.length;
        const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

        res.download(outputPath, 'compressed-document.pdf', async () => {
            await cleanupFile(req.file.path);
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('PDF compression error:', error);
        await cleanupFile(req.file.path);
        res.status(500).json({ error: 'Compression failed: ' + error.message });
    }
}));

// 6. Excel/CSV to PDF with formatting
app.post('/convert/excel-to-pdf', upload.single('file'), asyncHandler(async (req, res) => {
    validateFile(req.file, ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv']);
    
    try {
        let jsonData;
        
        if (req.file.mimetype === 'text/csv') {
            const csvData = [];
            const stream = fs.createReadStream(req.file.path)
                .pipe(csvParser());
            
            for await (const row of stream) {
                csvData.push(Object.values(row));
            }
            jsonData = csvData;
        } else {
            const workbook = xlsx.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        }

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        let page = pdfDoc.addPage(PageSizes.A4);
        let { width, height } = page.getSize();

        const fontSize = 10;
        const lineHeight = fontSize * 1.5;
        const margin = 40;
        let y = height - margin;

        // Title
        page.drawText('Spreadsheet Data', {
            x: margin,
            y: y,
            size: 16,
            font: boldFont,
            color: rgb(0, 0, 0),
        });
        y -= lineHeight * 2;

        // Table data
        for (let i = 0; i < Math.min(jsonData.length, 50); i++) {
            if (y < margin + lineHeight) {
                page = pdfDoc.addPage(PageSizes.A4);
                y = page.getSize().height - margin;
            }
            
            const row = jsonData[i];
            const rowText = row.slice(0, 8).join(' | '); // Limit columns
            
            page.drawText(rowText.substring(0, 100), {
                x: margin,
                y: y,
                size: fontSize,
                font: i === 0 ? boldFont : font,
                color: rgb(0, 0, 0),
            });
            y -= lineHeight;
        }

        const pdfBytes = await pdfDoc.save();
        const outputPath = path.join('outputs', `excel-to-pdf-${Date.now()}.pdf`);
        await fs.promises.writeFile(outputPath, pdfBytes);

        res.download(outputPath, 'spreadsheet-converted.pdf', async () => {
            await cleanupFile(req.file.path);
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('Excel to PDF conversion error:', error);
        await cleanupFile(req.file.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
}));

// 7. Text to PDF with formatting options
app.post('/convert/text-to-pdf', upload.single('file'), asyncHandler(async (req, res) => {
    validateFile(req.file, ['text/plain']);
    
    const { fontSize = 12, fontFamily = 'Helvetica', lineSpacing = 1.4 } = req.body;
    
    try {
        const text = await fs.promises.readFile(req.file.path, 'utf8');
        const pdfDoc = await PDFDocument.create();
        
        let font;
        switch (fontFamily) {
            case 'Times':
                font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
                break;
            case 'Courier':
                font = await pdfDoc.embedFont(StandardFonts.Courier);
                break;
            default:
                font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        }
        
        let page = pdfDoc.addPage(PageSizes.A4);
        let { width, height } = page.getSize();

        const fontSizeNum = parseInt(fontSize);
        const lineHeight = fontSizeNum * parseFloat(lineSpacing);
        const margin = 50;
        const maxWidth = width - 2 * margin;
        
        const paragraphs = text.split('\n');
        let y = height - margin;

        for (const paragraph of paragraphs) {
            if (!paragraph.trim()) {
                y -= lineHeight;
                continue;
            }
            
            const words = paragraph.split(' ');
            let currentLine = '';

            for (const word of words) {
                const testLine = currentLine + (currentLine ? ' ' : '') + word;
                const textWidth = font.widthOfTextAtSize(testLine, fontSizeNum);
                
                if (textWidth <= maxWidth) {
                    currentLine = testLine;
                } else {
                    if (currentLine) {
                        if (y < margin + lineHeight) {
                            page = pdfDoc.addPage(PageSizes.A4);
                            y = page.getSize().height - margin;
                        }
                        
                        page.drawText(currentLine, {
                            x: margin,
                            y: y,
                            size: fontSizeNum,
                            font: font,
                            color: rgb(0, 0, 0),
                        });
                        y -= lineHeight;
                    }
                    currentLine = word;
                }
            }
            
            if (currentLine) {
                if (y < margin + lineHeight) {
                    page = pdfDoc.addPage(PageSizes.A4);
                    y = page.getSize().height - margin;
                }
                
                page.drawText(currentLine, {
                    x: margin,
                    y: y,
                    size: fontSizeNum,
                    font: font,
                    color: rgb(0, 0, 0),
                });
                y -= lineHeight;
            }
        }

        const pdfBytes = await pdfDoc.save();
        const outputPath = path.join('outputs', `text-to-pdf-${Date.now()}.pdf`);
        await fs.promises.writeFile(outputPath, pdfBytes);

        res.download(outputPath, 'text-converted.pdf', async () => {
            await cleanupFile(req.file.path);
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('Text to PDF conversion error:', error);
        await cleanupFile(req.file.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
}));

// 8. Advanced image format conversion
app.post('/convert/image-format', upload.single('file'), asyncHandler(async (req, res) => {
    validateFile(req.file, ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/tiff']);
    
    const { format, quality = 90, width, height, maintainAspectRatio = true } = req.body;
    const supportedFormats = ['jpeg', 'png', 'webp', 'bmp', 'tiff', 'gif'];
    
    if (!supportedFormats.includes(format)) {
        return res.status(400).json({ error: 'Unsupported output format' });
    }

    try {
        const inputBuffer = await fs.promises.readFile(req.file.path);
        let sharpInstance = sharp(inputBuffer);

        // Resize if dimensions provided
        if (width || height) {
            const resizeOptions = {
                width: width ? parseInt(width) : undefined,
                height: height ? parseInt(height) : undefined,
                fit: maintainAspectRatio === 'true' ? 'inside' : 'fill'
            };
            sharpInstance = sharpInstance.resize(resizeOptions);
        }

        let outputBuffer;
        const qualityNum = parseInt(quality);

        switch (format) {
            case 'jpeg':
                outputBuffer = await sharpInstance.jpeg({ quality: qualityNum }).toBuffer();
                break;
            case 'png':
                outputBuffer = await sharpInstance.png({ quality: qualityNum }).toBuffer();
                break;
            case 'webp':
                outputBuffer = await sharpInstance.webp({ quality: qualityNum }).toBuffer();
                break;
            case 'bmp':
                outputBuffer = await sharpInstance.bmp().toBuffer();
                break;
            case 'tiff':
                outputBuffer = await sharpInstance.tiff({ quality: qualityNum }).toBuffer();
                break;
            case 'gif':
                outputBuffer = await sharpInstance.gif().toBuffer();
                break;
        }

        const outputPath = path.join('outputs', `converted-image-${Date.now()}.${format}`);
        await fs.promises.writeFile(outputPath, outputBuffer);

        res.download(outputPath, `converted-image.${format}`, async () => {
            await cleanupFile(req.file.path);
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('Image conversion error:', error);
        await cleanupFile(req.file.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
}));

// 9. Enhanced PDF merge with bookmarks
app.post('/convert/merge-pdf', upload.array('files'), asyncHandler(async (req, res) => {
    if (!req.files || req.files.length < 2) {
        return res.status(400).json({ error: 'At least 2 PDF files required' });
    }

    const { addBookmarks = false } = req.body;

    try {
        const mergedPdf = await PDFDocument.create();

        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            validateFile(file, ['application/pdf']);
            
            const pdfBuffer = await fs.promises.readFile(file.path);
            const pdf = await PDFDocument.load(pdfBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            
            if (addBookmarks) {
                // Add bookmark for each document
                const bookmarkTitle = file.originalname.replace(/\.[^/.]+$/, "");
                // Note: pdf-lib doesn't support bookmarks directly, but we can add metadata
            }
            
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const pdfBytes = await mergedPdf.save();
        const outputPath = path.join('outputs', `merged-pdf-${Date.now()}.pdf`);
        await fs.promises.writeFile(outputPath, pdfBytes);

        res.download(outputPath, 'merged-document.pdf', async () => {
            for (const file of req.files) {
                await cleanupFile(file.path);
            }
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('PDF merge error:', error);
        for (const file of req.files) {
            await cleanupFile(file.path);
        }
        res.status(500).json({ error: 'Merge failed: ' + error.message });
    }
}));

// 10. Enhanced PDF split with page ranges
app.post('/convert/split-pdf', upload.single('file'), asyncHandler(async (req, res) => {
    validateFile(req.file, ['application/pdf']);
    
    const { splitType = 'pages', pageRanges, pagesPerFile = 1 } = req.body;
    
    try {
        const pdfBuffer = await fs.promises.readFile(req.file.path);
        const pdf = await PDFDocument.load(pdfBuffer);
        const pageCount = pdf.getPageCount();

        const zip = new JSZip();

        if (splitType === 'ranges' && pageRanges) {
            // Split by custom ranges (e.g., "1-3,5-7,9")
            const ranges = pageRanges.split(',').map(range => {
                const [start, end] = range.trim().split('-').map(n => parseInt(n) - 1);
                return { start, end: end !== undefined ? end : start };
            });

            for (let i = 0; i < ranges.length; i++) {
                const { start, end } = ranges[i];
                const newPdf = await PDFDocument.create();
                const pageIndices = [];
                
                for (let j = start; j <= Math.min(end, pageCount - 1); j++) {
                    pageIndices.push(j);
                }
                
                const copiedPages = await newPdf.copyPages(pdf, pageIndices);
                copiedPages.forEach(page => newPdf.addPage(page));
                
                const pdfBytes = await newPdf.save();
                zip.file(`pages-${start + 1}-${end + 1}.pdf`, pdfBytes);
            }
        } else {
            // Split by pages per file
            const filesCount = Math.ceil(pageCount / parseInt(pagesPerFile));
            
            for (let i = 0; i < filesCount; i++) {
                const newPdf = await PDFDocument.create();
                const startPage = i * parseInt(pagesPerFile);
                const endPage = Math.min(startPage + parseInt(pagesPerFile), pageCount);
                
                const pageIndices = [];
                for (let j = startPage; j < endPage; j++) {
                    pageIndices.push(j);
                }
                
                const copiedPages = await newPdf.copyPages(pdf, pageIndices);
                copiedPages.forEach(page => newPdf.addPage(page));
                
                const pdfBytes = await newPdf.save();
                zip.file(`part-${i + 1}.pdf`, pdfBytes);
            }
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        const outputPath = path.join('outputs', `split-pdf-${Date.now()}.zip`);
        await fs.promises.writeFile(outputPath, zipBuffer);

        res.download(outputPath, 'split-pages.zip', async () => {
            await cleanupFile(req.file.path);
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('PDF split error:', error);
        await cleanupFile(req.file.path);
        res.status(500).json({ error: 'Split failed: ' + error.message });
    }
}));

// 11. HTML to PDF conversion
app.post('/convert/html-to-pdf', upload.single('file'), asyncHandler(async (req, res) => {
    validateFile(req.file, ['text/html']);
    
    const { pageSize = 'A4', margin = '1cm', orientation = 'portrait' } = req.body;
    
    try {
        const htmlContent = await fs.promises.readFile(req.file.path, 'utf8');
        
        // Parse HTML and convert to PDF-compatible content
        const $ = cheerio.load(htmlContent);
        const textContent = $.text();
        
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        let page = pdfDoc.addPage(PageSizes[pageSize] || PageSizes.A4);
        
        const { width, height } = page.getSize();
        const fontSize = 12;
        const lineHeight = fontSize * 1.4;
        const marginValue = 50;
        const maxWidth = width - 2 * marginValue;
        
        const paragraphs = textContent.split('\n').filter(p => p.trim());
        let y = height - marginValue;

        for (const paragraph of paragraphs) {
            const words = paragraph.split(' ');
            let currentLine = '';

            for (const word of words) {
                const testLine = currentLine + (currentLine ? ' ' : '') + word;
                const textWidth = font.widthOfTextAtSize(testLine, fontSize);
                
                if (textWidth <= maxWidth) {
                    currentLine = testLine;
                } else {
                    if (currentLine) {
                        if (y < marginValue + lineHeight) {
                            page = pdfDoc.addPage(PageSizes[pageSize] || PageSizes.A4);
                            y = page.getSize().height - marginValue;
                        }
                        
                        page.drawText(currentLine, {
                            x: marginValue,
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
                if (y < marginValue + lineHeight) {
                    page = pdfDoc.addPage(PageSizes[pageSize] || PageSizes.A4);
                    y = page.getSize().height - marginValue;
                }
                
                page.drawText(currentLine, {
                    x: marginValue,
                    y: y,
                    size: fontSize,
                    font: font,
                    color: rgb(0, 0, 0),
                });
                y -= lineHeight;
            }
            
            y -= lineHeight / 2; // Paragraph spacing
        }

        const pdfBytes = await pdfDoc.save();
        const outputPath = path.join('outputs', `html-to-pdf-${Date.now()}.pdf`);
        await fs.promises.writeFile(outputPath, pdfBytes);

        res.download(outputPath, 'html-converted.pdf', async () => {
            await cleanupFile(req.file.path);
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('HTML to PDF conversion error:', error);
        await cleanupFile(req.file.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
}));

// 12. Markdown to PDF conversion
app.post('/convert/markdown-to-pdf', upload.single('file'), asyncHandler(async (req, res) => {
    validateFile(req.file, ['text/markdown', 'text/plain']);
    
    try {
        const markdownContent = await fs.promises.readFile(req.file.path, 'utf8');
        const htmlContent = marked.parse(markdownContent);
        const textContent = htmlToText(htmlContent);
        
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        let page = pdfDoc.addPage(PageSizes.A4);
        const { width, height } = page.getSize();
        
        const fontSize = 12;
        const lineHeight = fontSize * 1.4;
        const margin = 50;
        const maxWidth = width - 2 * margin;
        
        const lines = textContent.split('\n');
        let y = height - margin;

        for (const line of lines) {
            if (!line.trim()) {
                y -= lineHeight / 2;
                continue;
            }
            
            if (y < margin + lineHeight) {
                page = pdfDoc.addPage(PageSizes.A4);
                y = page.getSize().height - margin;
            }
            
            // Simple formatting detection
            const isHeading = line.startsWith('#') || line.match(/^[A-Z][^.]*$/);
            const currentFont = isHeading ? boldFont : font;
            const currentSize = isHeading ? fontSize + 2 : fontSize;
            
            const words = line.split(' ');
            let currentLine = '';

            for (const word of words) {
                const testLine = currentLine + (currentLine ? ' ' : '') + word;
                const textWidth = currentFont.widthOfTextAtSize(testLine, currentSize);
                
                if (textWidth <= maxWidth) {
                    currentLine = testLine;
                } else {
                    if (currentLine) {
                        page.drawText(currentLine, {
                            x: margin,
                            y: y,
                            size: currentSize,
                            font: currentFont,
                            color: rgb(0, 0, 0),
                        });
                        y -= lineHeight;
                        
                        if (y < margin + lineHeight) {
                            page = pdfDoc.addPage(PageSizes.A4);
                            y = page.getSize().height - margin;
                        }
                    }
                    currentLine = word;
                }
            }
            
            if (currentLine) {
                page.drawText(currentLine, {
                    x: margin,
                    y: y,
                    size: currentSize,
                    font: currentFont,
                    color: rgb(0, 0, 0),
                });
                y -= lineHeight;
            }
        }

        const pdfBytes = await pdfDoc.save();
        const outputPath = path.join('outputs', `markdown-to-pdf-${Date.now()}.pdf`);
        await fs.promises.writeFile(outputPath, pdfBytes);

        res.download(outputPath, 'markdown-converted.pdf', async () => {
            await cleanupFile(req.file.path);
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('Markdown to PDF conversion error:', error);
        await cleanupFile(req.file.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
}));

// 13. PDF to HTML conversion
app.post('/convert/pdf-to-html', upload.single('file'), asyncHandler(async (req, res) => {
    validateFile(req.file, ['application/pdf']);
    
    try {
        const pdfBuffer = await fs.promises.readFile(req.file.path);
        const pdfData = await pdfParse(pdfBuffer);
        const text = pdfData.text;
        
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Converted PDF Document</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
        }
        p {
            margin-bottom: 15px;
            text-align: justify;
        }
        .page-break {
            border-top: 1px dashed #ccc;
            margin: 30px 0;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Converted PDF Document</h1>
        ${text.split('\n\n').map(paragraph => 
            paragraph.trim() ? `<p>${paragraph.replace(/\n/g, '<br>')}</p>` : ''
        ).join('')}
    </div>
</body>
</html>`;

        const outputPath = path.join('outputs', `pdf-to-html-${Date.now()}.html`);
        await fs.promises.writeFile(outputPath, htmlContent, 'utf8');

        res.download(outputPath, 'converted-document.html', async () => {
            await cleanupFile(req.file.path);
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('PDF to HTML conversion error:', error);
        await cleanupFile(req.file.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
}));

// 14. Image optimization
app.post('/convert/optimize-image', upload.single('file'), asyncHandler(async (req, res) => {
    validateFile(req.file, ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    
    const { quality = 80, maxWidth = 1920, maxHeight = 1080 } = req.body;
    
    try {
        const inputBuffer = await fs.promises.readFile(req.file.path);
        
        let optimizedBuffer;
        if (req.file.mimetype === 'image/png') {
            optimizedBuffer = await imagemin.buffer(inputBuffer, {
                plugins: [
                    imageminPngquant({
                        quality: [0.6, parseInt(quality) / 100]
                    })
                ]
            });
        } else {
            optimizedBuffer = await imagemin.buffer(inputBuffer, {
                plugins: [
                    imageminMozjpeg({
                        quality: parseInt(quality)
                    })
                ]
            });
        }

        // Resize if needed
        const resizedBuffer = await sharp(optimizedBuffer)
            .resize(parseInt(maxWidth), parseInt(maxHeight), {
                fit: 'inside',
                withoutEnlargement: true
            })
            .toBuffer();

        const outputPath = path.join('outputs', `optimized-${Date.now()}${path.extname(req.file.originalname)}`);
        await fs.promises.writeFile(outputPath, resizedBuffer);

        res.download(outputPath, `optimized-${req.file.originalname}`, async () => {
            await cleanupFile(req.file.path);
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('Image optimization error:', error);
        await cleanupFile(req.file.path);
        res.status(500).json({ error: 'Optimization failed: ' + error.message });
    }
}));

// 15. QR Code generator
app.post('/convert/generate-qr', upload.none(), asyncHandler(async (req, res) => {
    const { text, size = 300, format = 'png', errorLevel = 'M' } = req.body;
    
    if (!text) {
        return res.status(400).json({ error: 'Text is required for QR code generation' });
    }
    
    try {
        const qrBuffer = await QRCode.toBuffer(text, {
            width: parseInt(size),
            errorCorrectionLevel: errorLevel,
            type: format === 'png' ? 'png' : 'png'
        });

        const outputPath = path.join('outputs', `qr-code-${Date.now()}.${format}`);
        await fs.promises.writeFile(outputPath, qrBuffer);

        res.download(outputPath, `qr-code.${format}`, async () => {
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('QR code generation error:', error);
        res.status(500).json({ error: 'QR code generation failed: ' + error.message });
    }
}));

// 16. Barcode generator
app.post('/convert/generate-barcode', upload.none(), asyncHandler(async (req, res) => {
    const { text, type = 'code128', width = 2, height = 100 } = req.body;
    
    if (!text) {
        return res.status(400).json({ error: 'Text is required for barcode generation' });
    }
    
    try {
        const barcodeBuffer = await bwipjs.toBuffer({
            bcid: type,
            text: text,
            scale: parseInt(width),
            height: parseInt(height),
            includetext: true,
            textxalign: 'center',
        });

        const outputPath = path.join('outputs', `barcode-${Date.now()}.png`);
        await fs.promises.writeFile(outputPath, barcodeBuffer);

        res.download(outputPath, 'barcode.png', async () => {
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('Barcode generation error:', error);
        res.status(500).json({ error: 'Barcode generation failed: ' + error.message });
    }
}));

// 17. Archive extraction
app.post('/convert/extract-archive', upload.single('file'), asyncHandler(async (req, res) => {
    validateFile(req.file, ['application/zip', 'application/x-zip-compressed']);
    
    try {
        const extractDir = path.join('outputs', `extracted-${Date.now()}`);
        ensureDir(extractDir);

        const zip = new StreamZip.async({ file: req.file.path });
        await zip.extract(null, extractDir);
        await zip.close();

        // Create a new zip with extracted files for download
        const outputZip = new JSZip();
        const addFilesToZip = async (dir, zipFolder = outputZip) => {
            const files = await fs.promises.readdir(dir);
            
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = await fs.promises.stat(filePath);
                
                if (stat.isDirectory()) {
                    const folder = zipFolder.folder(file);
                    await addFilesToZip(filePath, folder);
                } else {
                    const content = await fs.promises.readFile(filePath);
                    zipFolder.file(file, content);
                }
            }
        };

        await addFilesToZip(extractDir);
        const zipBuffer = await outputZip.generateAsync({ type: 'nodebuffer' });
        
        const outputPath = path.join('outputs', `extracted-files-${Date.now()}.zip`);
        await fs.promises.writeFile(outputPath, zipBuffer);

        res.download(outputPath, 'extracted-files.zip', async () => {
            await cleanupFile(req.file.path);
            await cleanupFile(outputPath);
            fs.rmSync(extractDir, { recursive: true, force: true });
        });

    } catch (error) {
        console.error('Archive extraction error:', error);
        await cleanupFile(req.file.path);
        res.status(500).json({ error: 'Extraction failed: ' + error.message });
    }
}));

// 18. Create archive
app.post('/convert/create-archive', upload.array('files'), asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    const { format = 'zip', compressionLevel = 6 } = req.body;
    
    try {
        if (format === 'zip') {
            const zip = new JSZip();
            
            for (const file of req.files) {
                const buffer = await fs.promises.readFile(file.path);
                zip.file(file.originalname, buffer);
            }

            const zipBuffer = await zip.generateAsync({ 
                type: 'nodebuffer',
                compression: 'DEFLATE',
                compressionOptions: {
                    level: parseInt(compressionLevel)
                }
            });
            
            const outputPath = path.join('outputs', `archive-${Date.now()}.zip`);
            await fs.promises.writeFile(outputPath, zipBuffer);

            res.download(outputPath, 'archive.zip', async () => {
                for (const file of req.files) {
                    await cleanupFile(file.path);
                }
                await cleanupFile(outputPath);
            });
        }

    } catch (error) {
        console.error('Archive creation error:', error);
        for (const file of req.files) {
            await cleanupFile(file.path);
        }
        res.status(500).json({ error: 'Archive creation failed: ' + error.message });
    }
}));

// 19. JSON to CSV conversion
app.post('/convert/json-to-csv', upload.single('file'), asyncHandler(async (req, res) => {
    validateFile(req.file, ['application/json']);
    
    try {
        const jsonContent = await fs.promises.readFile(req.file.path, 'utf8');
        const jsonData = JSON.parse(jsonContent);
        
        let csvData;
        if (Array.isArray(jsonData)) {
            csvData = jsonData;
        } else {
            csvData = [jsonData];
        }

        if (csvData.length === 0) {
            throw new Error('No data to convert');
        }

        const headers = Object.keys(csvData[0]);
        const outputPath = path.join('outputs', `json-to-csv-${Date.now()}.csv`);
        
        const csvWriter = createObjectCsvWriter({
            path: outputPath,
            header: headers.map(h => ({ id: h, title: h }))
        });

        await csvWriter.writeRecords(csvData);

        res.download(outputPath, 'converted-data.csv', async () => {
            await cleanupFile(req.file.path);
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('JSON to CSV conversion error:', error);
        await cleanupFile(req.file.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
}));

// 20. CSV to JSON conversion
app.post('/convert/csv-to-json', upload.single('file'), asyncHandler(async (req, res) => {
    validateFile(req.file, ['text/csv']);
    
    try {
        const csvData = [];
        const stream = fs.createReadStream(req.file.path)
            .pipe(csvParser());
        
        for await (const row of stream) {
            csvData.push(row);
        }

        const jsonContent = JSON.stringify(csvData, null, 2);
        const outputPath = path.join('outputs', `csv-to-json-${Date.now()}.json`);
        await fs.promises.writeFile(outputPath, jsonContent, 'utf8');

        res.download(outputPath, 'converted-data.json', async () => {
            await cleanupFile(req.file.path);
            await cleanupFile(outputPath);
        });

    } catch (error) {
        console.error('CSV to JSON conversion error:', error);
        await cleanupFile(req.file.path);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
}));

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    
    // Clean up any uploaded files
    if (req.file) {
        cleanupFile(req.file.path);
    }
    if (req.files) {
        req.files.forEach(file => cleanupFile(file.path));
    }
    
    res.status(500).json({ 
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log('📄 Available conversion endpoints:');
    console.log('   • PDF ↔ Images (JPG, PNG, WebP, TIFF)');
    console.log('   • PDF ↔ Documents (DOCX, HTML, Markdown)');
    console.log('   • Image format conversions & optimization');
    console.log('   • Excel/CSV ↔ PDF');
    console.log('   • Text ↔ PDF');
    console.log('   • PDF merge, split & compression');
    console.log('   • QR Code & Barcode generation');
    console.log('   • Archive creation & extraction');
    console.log('   • JSON ↔ CSV conversion');
    console.log('   • And many more...');
});