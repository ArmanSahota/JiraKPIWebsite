# CORS Proxy Server for Jira KPI Generator

This is a simple Node.js proxy server that resolves CORS issues when accessing Jira APIs from web browsers.

## Quick Deploy

### Vercel (Recommended)
```bash
npm install -g vercel
vercel login
vercel --prod
```

### Netlify
1. Connect this repo to Netlify
2. Build command: `npm install`
3. Publish directory: `.`

### Railway
1. Connect GitHub repo to Railway
2. Auto-deploys from package.json

## Usage

Once deployed, update `script.js` in your main application:

```javascript
// Replace this line:
'https://your-proxy-domain.vercel.app/api/jira',

// With your actual proxy URL:
'https://jira-kpi-proxy.vercel.app/api/jira',
```

## How It Works

1. Your web app sends requests to the proxy server
2. Proxy adds CORS headers and forwards to Jira
3. Jira responds to proxy
4. Proxy returns response with CORS headers to your app

## Testing

Health check: `https://your-proxy-domain.vercel.app/health`

## Files

- `cors-proxy.js` - Main proxy server
- `package.json` - Dependencies
- `vercel.json` - Vercel configuration
- `proxy-README.md` - This file

## Security

- No data is stored or logged
- Authentication headers are forwarded securely
- HTTPS encryption maintained end-to-end