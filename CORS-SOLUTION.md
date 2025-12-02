# CORS Solution Guide for Jira KPI Generator

This guide provides multiple solutions to resolve CORS (Cross-Origin Resource Sharing) issues when accessing Jira APIs from the browser.

## 🚨 The Problem

When your Jira KPI Generator is hosted on GitHub Pages (or any web domain), browsers block direct requests to Jira's API due to CORS security policies. This results in errors like:

```
Access to fetch at 'https://company.atlassian.net/rest/agile/1.0/...' 
from origin 'https://yourusername.github.io' has been blocked by CORS policy
```

## 🔧 Solutions (Ranked by Reliability)

### 1. Deploy Your Own CORS Proxy (Recommended)

**Files included:**
- `cors-proxy.js` - Node.js proxy server
- `package.json` - Dependencies
- `vercel.json` - Vercel deployment config

**Steps:**
1. **Deploy to Vercel (Free):**
   ```bash
   npm install -g vercel
   vercel login
   vercel --prod
   ```

2. **Deploy to Netlify:**
   - Connect your GitHub repo to Netlify
   - Set build command: `npm install`
   - Set publish directory: `.`

3. **Deploy to Railway/Heroku:**
   - Connect your repo
   - Auto-deploys from `package.json`

4. **Update your application:**
   - Replace `https://your-proxy-domain.vercel.app` in `script.js` with your actual proxy URL

**How it works:**
- Your proxy server receives requests from your web app
- Adds proper CORS headers
- Forwards requests to Jira API
- Returns responses back to your app

### 2. Corporate Network/VPN

**Best for enterprise users:**
- Access the tool from your company's internal network
- Connect via corporate VPN
- Many organizations pre-configure CORS policies for internal tools

### 3. Browser Extensions (Quick Testing)

**Chrome:**
- "CORS Unblock" extension
- "Disable CORS" extension

**Firefox:**
- "CORS Everywhere" extension

**Edge:**
- "CORS Unblock" extension

⚠️ **Note:** Only use for testing, not production use.

### 4. Browser Developer Mode

**Chrome (Windows):**
```cmd
chrome.exe --user-data-dir="C:/Chrome dev session" --disable-web-security --disable-features=VizDisplayCompositor
```

**Chrome (Mac):**
```bash
open -n -a /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --args --user-data-dir="/tmp/chrome_dev_test" --disable-web-security
```

**Chrome (Linux):**
```bash
google-chrome --user-data-dir="/tmp/chrome_dev_test" --disable-web-security
```

### 5. IT Department Solution

Contact your IT team to:
- Whitelist your GitHub Pages domain in CORS policies
- Configure Jira to allow cross-origin requests from your domain
- Set up internal proxy or gateway

## 🛠️ Implementation Details

### Proxy Server Features

The included proxy server (`cors-proxy.js`):
- ✅ Handles CORS headers automatically
- ✅ Forwards authentication headers securely
- ✅ Supports dynamic Jira domain routing
- ✅ Includes error handling and logging
- ✅ Works with all major cloud platforms

### Application Fallback Strategy

The updated `script.js` tries multiple approaches:
1. Direct request (works on corporate networks)
2. Your custom proxy server
3. Public CORS proxies (as fallbacks)
4. Comprehensive error messaging

### Security Considerations

- ✅ No credentials stored on proxy server
- ✅ Headers forwarded securely
- ✅ HTTPS encryption maintained
- ✅ No data logging or storage

## 📋 Quick Setup Checklist

- [ ] Deploy proxy server to Vercel/Netlify
- [ ] Update proxy URL in `script.js`
- [ ] Test with your Jira instance
- [ ] Add troubleshooting info to your users
- [ ] Monitor proxy server logs

## 🔍 Troubleshooting

### Common Issues:

**"Proxy server not responding"**
- Check if your proxy deployment is active
- Verify the proxy URL in `script.js`
- Check proxy server logs

**"Authentication still failing"**
- Verify Jira API token is correct
- Check if your Jira instance allows API access
- Ensure email matches Jira account

**"Rate limiting errors"**
- Jira API has rate limits
- Wait a few minutes between requests
- Consider implementing request throttling

### Testing Your Setup:

1. **Test proxy health:**
   ```bash
   curl https://your-proxy-domain.vercel.app/health
   ```

2. **Test with browser dev tools:**
   - Open Network tab
   - Watch for successful proxy requests
   - Check response headers for CORS

3. **Test different networks:**
   - Try from corporate network (might work directly)
   - Try from home network (needs proxy)
   - Try with mobile hotspot

## 🚀 Production Recommendations

1. **Use your own proxy** - Most reliable solution
2. **Monitor proxy performance** - Set up basic monitoring
3. **Have fallback instructions** - Guide users on alternatives
4. **Consider rate limiting** - Protect your proxy from abuse
5. **Keep dependencies updated** - Regular security updates

## 💡 Alternative Approaches

If web-based solution doesn't work for your organization:

1. **Desktop Application:** Convert to Electron app
2. **Browser Extension:** Create a Chrome/Firefox extension
3. **Local Python Script:** Use the included Python version
4. **Jira Plugin:** Develop as Jira marketplace app

---

**Need Help?** Create an issue in the GitHub repository with:
- Your browser and version
- Network environment (corporate/home)
- Specific error messages
- Steps you've tried