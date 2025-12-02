# GitHub Pages Deployment Guide

This guide will help you deploy the Jira Sprint KPI Generator to GitHub Pages for free hosting.

## 🚀 Quick Setup (5 minutes)

### Step 1: Create GitHub Repository
1. Go to [GitHub.com](https://github.com) and sign in
2. Click "New repository" (green button)
3. Name it something like `jira-kpi-generator`
4. Make it **Public** (required for free GitHub Pages)
5. Click "Create repository"

### Step 2: Upload Files
You have two options:

#### Option A: Upload via GitHub Web Interface
1. In your new repository, click "uploading an existing file"
2. Drag and drop these files:
   - `index.html`
   - `styles.css`
   - `script.js`
   - `README.md`
   - `.github/workflows/pages.yml`
3. Commit the files

#### Option B: Use Git Commands
```bash
git init
git add index.html styles.css script.js README.md .github/
git commit -m "Initial commit: Jira KPI Generator"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll down to **Pages** section (left sidebar)
4. Under "Source", select **GitHub Actions**
5. The workflow will automatically deploy your site

### Step 4: Access Your Website
- Your site will be available at: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`
- It may take 5-10 minutes for the first deployment

## 🔧 Configuration

### Required Information for Users
When users visit your website, they'll need:

1. **Jira Base URL**: Their company's Jira instance (e.g., `https://company.atlassian.net`)
2. **Email**: Their Jira account email
3. **API Token**: Generated from Jira Account Settings → Security → API tokens
4. **Story Points Field ID**: Custom field ID (usually `customfield_10016` or similar)
5. **Sprint ID**: Found in the Jira sprint URL

### Finding Story Points Field ID
Help users find their story points field ID:
1. Go to any Jira issue with story points
2. Right-click → Inspect Element
3. Search for "story" or "points" in the HTML
4. Look for `customfield_` followed by numbers

### Finding Sprint ID
Help users find their sprint ID:
1. Go to their sprint in Jira
2. Look at the URL: `https://company.atlassian.net/secure/RapidBoard.jspa?rapidView=123&sprint=456`
3. The sprint ID is the number after `sprint=` (456 in this example)

## 🔒 Security Features

### Privacy Protection
- ✅ No data storage - everything processes in the browser
- ✅ No server-side code - pure client-side application
- ✅ Direct HTTPS communication with Jira
- ✅ No third-party services or analytics
- ✅ Credentials never leave the user's browser

### CORS Considerations
Modern browsers may block cross-origin requests to Jira. This is the most common issue users face.

**🔧 COMPREHENSIVE SOLUTION:** See [`CORS-SOLUTION.md`](CORS-SOLUTION.md) for detailed troubleshooting guide.

**Quick fixes:**
1. **Deploy the included CORS proxy** (recommended - see CORS-SOLUTION.md)
2. **Use corporate VPN/network** (often works directly)
3. **Install CORS browser extension** (for testing only)
4. **Contact IT team** about CORS policies for your domain

The application includes multiple fallback strategies and will try different approaches automatically.

## 📊 Features Overview

### Generated Metrics
- Individual assignee performance
- Sprint completion rates
- Story points analysis
- Cycle time calculations
- Bug-to-story ratios
- Workload distribution
- Team velocity metrics

### Export Options
- Downloadable CSV files
- Excel/Google Sheets compatible
- Detailed sprint summaries
- Historical comparison data

## 🛠️ Customization

### Branding
To customize the appearance:
1. Edit [`styles.css`](styles.css) for colors and styling
2. Modify [`index.html`](index.html) for content and structure
3. Update [`README.md`](README.md) with your organization's information

### Additional Fields
To add more Jira fields:
1. Modify the form in [`index.html`](index.html)
2. Update the API calls in [`script.js`](script.js)
3. Extend the CSV generation logic

## 🔄 Updates and Maintenance

### Automatic Deployment
- Any push to the `main` branch automatically deploys
- GitHub Actions handles the build and deployment
- No manual intervention required

### Monitoring
- Check the "Actions" tab in your repository for deployment status
- View deployment logs for troubleshooting
- Monitor user feedback through GitHub Issues

## 📞 Support

### Common Issues
1. **CORS Errors**: User needs to be on corporate network or use CORS extension
2. **Authentication Failures**: Check API token and email combination
3. **Sprint Not Found**: Verify sprint ID is correct and accessible
4. **No Story Points**: Verify custom field ID is correct

### Getting Help
- Create issues in your GitHub repository
- Check browser console for error messages
- Verify Jira API permissions and access

## 📈 Usage Analytics (Optional)

To add privacy-respecting analytics:
1. Consider using privacy-focused solutions like Plausible
2. Add analytics code to [`index.html`](index.html)
3. Update privacy notice accordingly

## 🎯 Next Steps

After deployment:
1. Test with your own Jira instance
2. Share the URL with your team
3. Gather feedback for improvements
4. Consider adding more advanced features

---

**🎉 Congratulations!** Your Jira Sprint KPI Generator is now live and ready to help teams analyze their sprint performance!