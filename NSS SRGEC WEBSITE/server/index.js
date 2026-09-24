require('dotenv').config({ path: '../.env' });

const http = require('http');
const fs = require('fs');
const path = require('path');

const { connectDB } = require('./db');
const {
    getSiteContent,
    saveSiteContent,
    saveRegistration,
    getRegistrations,
    getAadhaarCard,
    reviewRegistration
} = require('./api');

const PORT = process.env.PORT || 5000;
const MAX_AADHAAR_FILE_BYTES = 500 * 1024;
const AADHAAR_FILE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

function validateAadhaarCard(data) {
    if (data.type !== 'NSS Volunteer') return;

    const document = data.aadhaarCard;
    if (!document || typeof document !== 'object') {
        throw new Error('An Aadhaar card PDF or image is required for volunteer registration');
    }

    if (!AADHAAR_FILE_TYPES.has(document.mimeType)) {
        throw new Error('Aadhaar card must be a PDF, JPG, PNG, or WebP file');
    }

    if (typeof document.data !== 'string' || !document.data) {
        throw new Error('Aadhaar card file data is missing');
    }

    const fileBuffer = Buffer.from(document.data, 'base64');
    if (!fileBuffer.length || fileBuffer.length > MAX_AADHAAR_FILE_BYTES) {
        throw new Error('Aadhaar card file must be 500 KB or smaller');
    }

    const isPdf = fileBuffer.subarray(0, 5).toString() === '%PDF-';
    const isJpeg = fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff;
    const isPng = fileBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp = fileBuffer.subarray(0, 4).toString() === 'RIFF' && fileBuffer.subarray(8, 12).toString() === 'WEBP';
    const isValidFile = (document.mimeType === 'application/pdf' && isPdf) ||
        (document.mimeType === 'image/jpeg' && isJpeg) ||
        (document.mimeType === 'image/png' && isPng) ||
        (document.mimeType === 'image/webp' && isWebp);

    if (!isValidFile) {
        throw new Error('The Aadhaar card upload does not match its selected file type');
    }

    document.size = fileBuffer.length;
}

function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();

            if (body.length > 10 * 1024 * 1024) {
                reject(new Error('Request body too large'));
                req.destroy();
            }
        });

        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

// Website root folder
const WEBSITE_ROOT = path.join(__dirname, '..');

// MIME types for website files
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

async function startServer() {
    try {

        // Connect to MongoDB
        await connectDB();

        const server = http.createServer(async (req, res) => {

            // ==========================================
            // HEALTH CHECK API
            // ==========================================

            if (req.url === '/api/health' && req.method === 'GET') {

                res.writeHead(200, {
                    'Content-Type': 'application/json'
                });

                res.end(JSON.stringify({
                    success: true,
                    message: 'NSS Node.js server is running'
                }));

                return;
            }


            // ==========================================
            // SITE DATA API
            // ==========================================

            if (req.url === '/api/site' && req.method === 'GET') {

                try {

                    const data = await getSiteContent();

                    res.writeHead(200, {
                        'Content-Type': 'application/json'
                    });

                    res.end(JSON.stringify({
                        success: true,
                        data: data
                    }));

                } catch (error) {

                    console.error(
                        'Failed to fetch site content:',
                        error
                    );

                    res.writeHead(500, {
                        'Content-Type': 'application/json'
                    });

                    res.end(JSON.stringify({
                        success: false,
                        message: 'Failed to fetch site content'
                    }));
                }

                return;
            }

            // Save site content API
            if (req.url === '/api/site' && req.method === 'PUT') {
                try {
                    const body = await readRequestBody(req);
                    const data = JSON.parse(body);

                    if (!data || typeof data !== 'object') {
                        throw new Error('Invalid site data');
                    }

                    const savedData = await saveSiteContent(data);

                    res.writeHead(200, {
                        'Content-Type': 'application/json'
                    });

                    res.end(JSON.stringify({
                        success: true,
                        message: 'Site data saved successfully',
                        data: savedData
                    }));

                } catch (error) {
                    console.error('Failed to save site content:', error);

                    res.writeHead(400, {
                        'Content-Type': 'application/json'
                    });

                    res.end(JSON.stringify({
                        success: false,
                        message: error.message || 'Failed to save site content'
                    }));
                }

                return;
            }


            // ==========================================
            // REGISTRATION API
            // ==========================================

            // Save registration
            if (req.url === '/api/registrations' && req.method === 'POST') {
                try {
                    const body = await readRequestBody(req);
                    const data = JSON.parse(body);

                    if (!data || typeof data !== 'object') {
                        throw new Error('Invalid registration data');
                    }

                    validateAadhaarCard(data);

                    const savedRegistration = await saveRegistration(data);

                    res.writeHead(201, {
                        'Content-Type': 'application/json'
                    });

                    res.end(JSON.stringify({
                        success: true,
                        message: 'Registration submitted successfully',
                        data: savedRegistration
                    }));
                } catch (error) {
                    console.error(
                        'Failed to save registration:',
                        error
                    );

                    res.writeHead(400, {
                        'Content-Type': 'application/json'
                    });

                    res.end(JSON.stringify({
                        success: false,
                        message:
                            error.message ||
                            'Failed to save registration'
                    }));
                }

                return;
            }


            // Get registrations
            if (req.url === '/api/registrations' && req.method === 'GET') {
                try {
                    const registrations = await getRegistrations();

                    res.writeHead(200, {
                        'Content-Type': 'application/json'
                    });

                    res.end(JSON.stringify({
                        success: true,
                        data: registrations
                    }));
                } catch (error) {
                    console.error(
                        'Failed to fetch registrations:',
                        error
                    );

                    res.writeHead(500, {
                        'Content-Type': 'application/json'
                    });

                    res.end(JSON.stringify({
                        success: false,
                        message: 'Failed to fetch registrations'
                    }));
                }

                return;
            }

            // Approve or reject a volunteer registration
            const aadhaarDocumentMatch = req.url.match(/^\/api\/registrations\/([a-fA-F0-9]{24})\/aadhaar$/);
            if (aadhaarDocumentMatch && req.method === 'GET') {
                try {
                    const document = await getAadhaarCard(aadhaarDocumentMatch[1]);
                    const safeFileName = String(document.fileName || 'aadhaar-document')
                        .replace(/[^a-zA-Z0-9._-]/g, '_');

                    res.writeHead(200, {
                        'Content-Type': document.mimeType || 'application/octet-stream',
                        'Content-Disposition': 'inline; filename="' + safeFileName + '"',
                        'Cache-Control': 'no-store'
                    });
                    res.end(Buffer.from(document.data, 'base64'));
                } catch (error) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: error.message || 'Aadhaar document not found'
                    }));
                }

                return;
            }

            const registrationReviewMatch = req.url.match(/^\/api\/registrations\/([a-fA-F0-9]{24})$/);
            if (registrationReviewMatch && req.method === 'PATCH') {
                try {
                    const body = await readRequestBody(req);
                    const data = JSON.parse(body);
                    const reviewedRegistration = await reviewRegistration(
                        registrationReviewMatch[1],
                        data.status
                    );

                    res.writeHead(200, {
                        'Content-Type': 'application/json'
                    });
                    res.end(JSON.stringify({
                        success: true,
                        message: 'Volunteer registration updated successfully',
                        data: reviewedRegistration
                    }));
                } catch (error) {
                    res.writeHead(400, {
                        'Content-Type': 'application/json'
                    });
                    res.end(JSON.stringify({
                        success: false,
                        message: error.message || 'Failed to update volunteer registration'
                    }));
                }

                return;
            }

            
            // ==========================================
            // SERVE WEBSITE FILES
            // ==========================================

            let requestedPath = req.url.split('?')[0];

            // Remove leading /
            requestedPath = requestedPath.replace(/^\/+/, '');

            // If root is requested, serve index.html
            if (requestedPath === '') {
                requestedPath = 'index.html';
            }

            const filePath = path.join(
                WEBSITE_ROOT,
                requestedPath
            );

            // Security check
            if (!filePath.startsWith(WEBSITE_ROOT)) {

                res.writeHead(403, {
                    'Content-Type': 'text/plain'
                });

                res.end('Forbidden');

                return;
            }

            fs.readFile(filePath, (error, content) => {

                if (error) {

                    res.writeHead(404, {
                        'Content-Type': 'text/plain'
                    });

                    res.end('File not found');

                    return;
                }

                const extension = path.extname(filePath);

                const contentType =
                    mimeTypes[extension] ||
                    'application/octet-stream';

                res.writeHead(200, {
                    'Content-Type': contentType
                });

                res.end(content);
            });

        });


        server.listen(PORT, () => {

            console.log(
                `Server running at http://localhost:${PORT}`
            );

        });

    } catch (error) {

        console.error('MongoDB connection failed:');
        console.error(error);

    }
}

startServer();
