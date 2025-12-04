# Jira Sprint KPI Generator

A web-based tool for generating comprehensive sprint metrics and KPIs from your Jira data. This tool runs entirely in your browser - no data is stored or transmitted to any third party.

## 🚀 Features

- **Comprehensive KPI Analysis**: Generate detailed sprint metrics including completion rates, story points, cycle times, and workload distribution
- **Team Performance Insights**: Track individual assignee performance and team-wide statistics
- **CSV Export**: Download detailed reports for further analysis in Excel or Google Sheets
- **Secure & Private**: All processing happens in your browser - credentials are never stored or transmitted
- **Beautiful UI**: Modern, responsive design that works on desktop and mobile

## 📊 Generated Metrics

### Individual Assignee Metrics
- Total and completed issues
- Story points (total and completed)
- Completion percentages
- Average story points per issue
- Average cycle time in days
- Bug ratio percentage
- Workload score
- Issue type breakdown

### Sprint Summary
- Team velocity (completed story points)
- Overall completion rates
- Average cycle times
- Bug-to-story ratios
- Workload distribution analysis

## 🔧 Setup Requirements

### Jira API Token
1. Go to your Jira account settings
2. Navigate to Security → API tokens
3. Create a new API token
4. Copy the token for use in the tool

### Story Points Field ID (Auto-Detection Available!)
The tool can now **automatically detect** your story points field! Just leave the field blank and it will find it for you.

If you prefer to specify it manually, you can find your Jira instance's custom field ID:

**Method 1: Use the Detection Script (Recommended)**
```bash
python detect_story_points_field.py --sprint-id 1230
# or
python detect_story_points_field.py --issue-key PROJ-123
```

**Method 2: Manual Detection**
1. Open any Jira issue in your browser
2. Add `/rest/api/2/issue/ISSUE-KEY` to the URL
3. Search the JSON for your story points value
4. The field ID will be `customfield_XXXXX`

**Method 3: Browser DevTools**
1. Open a Jira issue with story points
2. Open DevTools (F12) → Network tab
3. Refresh the page and look for API calls
4. Search responses for your story points value

Common field IDs: `customfield_10016`, `customfield_10004`, `customfield_10026`

### Sprint ID
Find the sprint ID from your Jira sprint URL:
- Example: `https://company.atlassian.net/secure/RapidBoard.jspa?rapidView=123&sprint=456`
- The sprint ID is `456` in this example

## 🌐 Usage

### Web Interface
1. **Access the Tool**: Visit the GitHub Pages URL for this repository
2. **Enter Credentials**: Fill in your Jira base URL, email, and API token
3. **Enter Sprint ID**: Provide the sprint ID you want to analyze
4. **Story Points Field** (Optional): Leave blank for auto-detection, or enter manually
5. **Generate Report**: Click "Generate KPI Report" to fetch and analyze data
6. **Download CSV**: Use the download button to save the detailed report

### Python CLI
```bash
# Set up your .env file (story points field is optional - will auto-detect)
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your_api_token_here
JIRA_STORY_POINTS_FIELD=customfield_10016  # Optional

# Run the script
python jira_sprint_kpi.py --sprint-id 1230
```

### Detect Story Points Field
```bash
# Find your story points field ID
python detect_story_points_field.py --sprint-id 1230
# or
python detect_story_points_field.py --issue-key PROJ-123
```

## 🔒 Security & Privacy

- **No Data Storage**: Your credentials and data are never stored anywhere
- **Client-Side Processing**: All calculations happen in your browser
- **Secure Communication**: Direct HTTPS communication with your Jira instance
- **No Third-Party Services**: No external APIs or services are used

## 📱 Browser Compatibility

This tool works in all modern browsers:
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 🛠️ Development

This is a static web application built with:
- **HTML5** for structure
- **CSS3** with modern features (Grid, Flexbox, CSS Variables)
- **Vanilla JavaScript** (ES6+) for functionality
- **Python** for CLI version
- **Jira REST API** for data fetching

### Local Development

**Web Version:**
1. Clone this repository
2. Open `index.html` in your browser
3. Or serve with any static web server

**Python Version:**
1. Install dependencies: `pip install requests python-dotenv`
2. Create a `.env` file with your credentials
3. Run: `python jira_sprint_kpi.py --sprint-id 1230`

### GitHub Pages Deployment
This repository is configured for automatic GitHub Pages deployment. Any push to the main branch will update the live site.

### New Features
- ✨ **Auto-detection of story points field** - No need to manually find the field ID
- 🎯 **Active sprint detection** - Paste your board URL to auto-detect the current sprint
- 🔍 **Field detection utility** - Standalone script to identify your story points field

## 📈 Sample Output

The generated CSV includes:
- Individual assignee performance metrics
- Sprint completion statistics
- Team velocity and cycle time analysis
- Workload distribution insights
- Quality metrics (bug ratios)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📄 License

This project is open source and available under the MIT License.

## ⚠️ Disclaimer

This tool is not affiliated with Atlassian or Jira. It's an independent tool that uses the public Jira REST API to generate reports.