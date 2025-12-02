// Simple CORS proxy server for Jira API
// Deploy this to Vercel, Netlify, or any Node.js hosting service

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors({
    origin: true, // Allow all origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'CORS Proxy Server is running' });
});

// Proxy endpoint for Jira API
app.use('/api/jira/*', createProxyMiddleware({
    target: 'https://placeholder.atlassian.net', // This will be replaced dynamically
    changeOrigin: true,
    pathRewrite: {
        '^/api/jira': '' // Remove /api/jira from the path
    },
    router: (req) => {
        // Extract the Jira domain from the request headers or query params
        const jiraDomain = req.headers['x-jira-domain'] || req.query.domain;
        if (jiraDomain) {
            return `https://${jiraDomain}`;
        }
        return 'https://placeholder.atlassian.net';
    },
    onProxyReq: (proxyReq, req, res) => {
        // Forward the authorization header
        if (req.headers.authorization) {
            proxyReq.setHeader('Authorization', req.headers.authorization);
        }
        
        // Set proper headers for Jira API
        proxyReq.setHeader('Accept', 'application/json');
        proxyReq.setHeader('Content-Type', 'application/json');
        
        console.log(`Proxying request to: ${proxyReq.getHeader('host')}${proxyReq.path}`);
    },
    onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(500).json({
            error: 'Proxy error',
            message: err.message
        });
    }
}));

// Catch-all for unmatched routes
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'Use /api/jira/* endpoints to proxy Jira API requests'
    });
});

app.listen(PORT, () => {
    console.log(`CORS Proxy Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;