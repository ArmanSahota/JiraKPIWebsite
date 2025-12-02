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

### Story Points Field ID
You'll need to find your Jira instance's custom field ID for story points:
1. Go to any Jira issue with story points
2. Right-click and "Inspect Element"
3. Look for the story points field ID (usually something like `customfield_10016`)

### Sprint ID
Find the sprint ID from your Jira sprint URL:
- Example: `https://company.atlassian.net/secure/RapidBoard.jspa?rapidView=123&sprint=456`
- The sprint ID is `456` in this example

## 🌐 Usage

1. **Access the Tool**: Visit the GitHub Pages URL for this repository
2. **Enter Credentials**: Fill in your Jira base URL, email, and API token
3. **Configure Fields**: Enter your story points field ID and sprint ID
4. **Generate Report**: Click "Generate KPI Report" to fetch and analyze data
5. **Download CSV**: Use the download button to save the detailed report

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
- **Jira REST API** for data fetching

### Local Development
1. Clone this repository
2. Open `index.html` in your browser
3. Or serve with any static web server

### GitHub Pages Deployment
This repository is configured for automatic GitHub Pages deployment. Any push to the main branch will update the live site.

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