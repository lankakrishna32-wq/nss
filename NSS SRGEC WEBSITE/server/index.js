require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');

const { connectDB } = require('./db');
const {
    getSiteContent,
    saveSiteContent,
    saveRegistration,
    getRegistrations
} = require('./api');

const PORT = process.env.PORT || 5000;

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