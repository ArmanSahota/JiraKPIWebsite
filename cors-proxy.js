// Simple CORS proxy server for Jira API
// Deploy this to Vercel, Netlify, or any Node.js hosting service

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes with explicit headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Jira-Domain');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
});

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
    onProxyRes: (proxyRes, req, res) => {
        // Add CORS headers to the proxied response
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept, X-Jira-Domain';
        proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
        
        console.log(`Proxy response status: ${proxyRes.statusCode}`);
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