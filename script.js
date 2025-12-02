// Jira Sprint KPI Generator - Client-side JavaScript
class JiraKPIGenerator {
    constructor() {
        this.form = document.getElementById('kpiForm');
        this.resultsContainer = document.getElementById('results');
        this.errorContainer = document.getElementById('error');
        this.generateBtn = document.getElementById('generateBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        
        this.csvData = null;
        this.sprintData = null;
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.downloadBtn.addEventListener('click', () => this.downloadCSV());
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        const formData = {
            jiraBaseUrl: document.getElementById('jiraBaseUrl').value.trim(),
            jiraEmail: document.getElementById('jiraEmail').value.trim(),
            jiraApiToken: document.getElementById('jiraApiToken').value.trim(),
            storyPointsField: document.getElementById('storyPointsField').value.trim(),
            sprintId: parseInt(document.getElementById('sprintId').value)
        };
        
        this.hideError();
        this.setLoading(true);
        
        try {
            await this.generateKPIReport(formData);
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setLoading(false);
        }
    }
    
    async generateKPIReport(config) {
        // Fetch sprint issues
        const issues = await this.fetchSprintIssues(config);
        
        // Compute metrics
        const metrics = this.computeMetrics(issues, config.storyPointsField);
        
        // Generate CSV data
        this.csvData = this.generateCSVData(metrics, config.sprintId);
        
        // Display results
        this.displayResults(metrics, config.sprintId);
    }
    
    async fetchSprintIssues(config) {
        const issues = [];
        let startAt = 0;
        const maxResults = 100;
        
        const auth = btoa(`${config.jiraEmail}:${config.jiraApiToken}`);
        
        // CORS proxy options - try multiple strategies
        const corsProxies = [
            '', // Direct request first
            'https://your-proxy-domain.vercel.app/api/jira', // Your deployed proxy
            'https://api.allorigins.win/raw?url=',
            'https://cors-anywhere.herokuapp.com/',
            'https://api.codetabs.com/v1/proxy?quest='
        ];
        
        let lastError = null;
        
        for (const proxy of corsProxies) {
            try {
                while (true) {
                    const baseUrl = `${config.jiraBaseUrl}/rest/agile/1.0/sprint/${config.sprintId}/issue`;
                    const params = new URLSearchParams({
                        startAt: startAt.toString(),
                        maxResults: maxResults.toString()
                    });
                    
                    const targetUrl = `${baseUrl}?${params}`;
                    const requestUrl = proxy ? `${proxy}${encodeURIComponent(targetUrl)}` : targetUrl;
                    
                    const headers = {
                        'Accept': 'application/json'
                    };
                    
                    // Only add auth headers for direct requests or specific proxies
                    if (!proxy || proxy.includes('cors-anywhere')) {
                        headers['Authorization'] = `Basic ${auth}`;
                        headers['Content-Type'] = 'application/json';
                    }
                    
                    const response = await fetch(requestUrl, {
                        method: 'GET',
                        headers: headers,
                        mode: proxy ? 'cors' : 'cors'
                    });
                    
                    if (!response.ok) {
                        if (response.status === 401) {
                            throw new Error('Authentication failed. Please check your email and API token.');
                        } else if (response.status === 404) {
                            throw new Error(`Sprint ${config.sprintId} not found. Please check the sprint ID.`);
                        } else if (response.status === 429) {
                            throw new Error('Rate limit exceeded. Please wait a moment and try again.');
                        } else {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                    }
                    
                    const data = await response.json();
                    
                    // Handle different proxy response formats
                    let issuesData;
                    if (proxy.includes('allorigins') && data.contents) {
                        issuesData = JSON.parse(data.contents);
                    } else {
                        issuesData = data;
                    }
                    
                    issues.push(...(issuesData.issues || []));
                    
                    const total = issuesData.total || 0;
                    startAt += maxResults;
                    
                    if (startAt >= total) {
                        break;
                    }
                }
                
                // If we get here, the request was successful
                return issues;
                
            } catch (error) {
                lastError = error;
                
                // Reset for next proxy attempt
                issues.length = 0;
                startAt = 0;
                
                // If this is a CORS error and we haven't tried all proxies, continue
                if (error.message.includes('CORS') || error.message.includes('fetch')) {
                    continue;
                }
                
                // For other errors, don't try more proxies
                break;
            }
        }
        
        // If all proxies failed, throw a comprehensive error
        throw new Error(this.generateCORSErrorMessage(lastError));
    }
    
    generateCORSErrorMessage(originalError) {
        return `
🚫 Unable to connect to Jira API. This is likely due to CORS (Cross-Origin Resource Sharing) restrictions.

Original error: ${originalError?.message || 'Network request failed'}

🔧 SOLUTIONS TO TRY:

1. 📡 CORPORATE NETWORK: Try accessing this tool from your company's network or VPN
2. 🌐 BROWSER EXTENSION: Install a CORS extension:
   • Chrome: "CORS Unblock" or "Disable CORS"
   • Firefox: "CORS Everywhere"
   • Edge: "CORS Unblock"
3. 🔒 BROWSER SETTINGS: Launch Chrome with disabled security (for testing only):
   chrome.exe --user-data-dir="C:/Chrome dev session" --disable-web-security
4. 💼 IT SUPPORT: Contact your IT team about CORS policies for ${window.location.origin}
5. 🖥️ DESKTOP VERSION: Consider using the Python version of this tool locally

⚠️ Note: CORS is a browser security feature. The issue is not with your credentials or this application.
        `.trim();
    }
    
    computeMetrics(issues, storyPointsField) {
        const metrics = {};
        const DONE_STATUS_CATEGORIES = new Set(['done']);
        
        issues.forEach(issue => {
            const assignee = this.getAssigneeName(issue);
            const statusCategory = this.getStatusCategory(issue);
            const issueType = this.getIssueType(issue);
            const storyPoints = this.getStoryPoints(issue, storyPointsField);
            const cycleTime = this.getCycleTimeDays(issue);
            
            if (!metrics[assignee]) {
                metrics[assignee] = {
                    totalIssues: 0,
                    completedIssues: 0,
                    totalStoryPoints: 0,
                    completedStoryPoints: 0,
                    issueTypeCounts: {},
                    bugCount: 0,
                    storyCount: 0,
                    cycleTimes: [],
                    storyPointsList: []
                };
            }
            
            const m = metrics[assignee];
            
            m.totalIssues += 1;
            m.totalStoryPoints += storyPoints;
            m.issueTypeCounts[issueType] = (m.issueTypeCounts[issueType] || 0) + 1;
            m.storyPointsList.push(storyPoints);
            
            if (issueType.toLowerCase() === 'bug') {
                m.bugCount += 1;
            } else if (issueType.toLowerCase() === 'story') {
                m.storyCount += 1;
            }
            
            if (DONE_STATUS_CATEGORIES.has(statusCategory)) {
                m.completedIssues += 1;
                m.completedStoryPoints += storyPoints;
                if (cycleTime > 0) {
                    m.cycleTimes.push(cycleTime);
                }
            }
        });
        
        return metrics;
    }
    
    getAssigneeName(issue) {
        const assignee = issue.fields?.assignee;
        if (!assignee) return 'Unassigned';
        return assignee.displayName || assignee.emailAddress || 'Unknown';
    }
    
    getStatusCategory(issue) {
        const status = issue.fields?.status || {};
        const statusCategory = status.statusCategory || {};
        return (statusCategory.key || '').toLowerCase();
    }
    
    getIssueType(issue) {
        const issueType = issue.fields?.issuetype || {};
        return issueType.name || 'Unknown';
    }
    
    getStoryPoints(issue, storyPointsField) {
        const sp = issue.fields?.[storyPointsField];
        if (sp === null || sp === undefined) return 0;
        try {
            return parseFloat(sp) || 0;
        } catch {
            return 0;
        }
    }
    
    getCycleTimeDays(issue) {
        try {
            const created = issue.fields?.created;
            const resolved = issue.fields?.resolutiondate;
            
            if (!created || !resolved) return 0;
            
            const createdDate = new Date(created);
            const resolvedDate = new Date(resolved);
            
            const diffMs = resolvedDate - createdDate;
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            
            return Math.round(diffDays * 10) / 10; // Round to 1 decimal
        } catch {
            return 0;
        }
    }
    
    computeSprintTotals(metrics) {
        const totals = {
            totalIssues: 0,
            completedIssues: 0,
            totalStoryPoints: 0,
            completedStoryPoints: 0,
            totalBugs: 0,
            totalStories: 0,
            allCycleTimes: [],
            allStoryPoints: [],
            assigneeStoryPoints: []
        };
        
        Object.entries(metrics).forEach(([assignee, m]) => {
            if (assignee === 'Unassigned') return;
            
            totals.totalIssues += m.totalIssues;
            totals.completedIssues += m.completedIssues;
            totals.totalStoryPoints += m.totalStoryPoints;
            totals.completedStoryPoints += m.completedStoryPoints;
            totals.totalBugs += m.bugCount;
            totals.totalStories += m.storyCount;
            totals.allCycleTimes.push(...m.cycleTimes);
            totals.allStoryPoints.push(...m.storyPointsList);
            
            if (m.totalStoryPoints > 0) {
                totals.assigneeStoryPoints.push(m.totalStoryPoints);
            }
        });
        
        return totals;
    }
    
    generateCSVData(metrics, sprintId) {
        const sprintTotals = this.computeSprintTotals(metrics);
        
        // Get all issue types
        const allIssueTypes = new Set();
        Object.values(metrics).forEach(m => {
            Object.keys(m.issueTypeCounts).forEach(type => allIssueTypes.add(type));
        });
        const sortedIssueTypes = Array.from(allIssueTypes).sort();
        
        // CSV headers
        const headers = [
            'Assignee',
            'Total Issues',
            'Completed Issues',
            'Completion % (Issues)',
            'Total Story Points',
            'Completed Story Points',
            'Completion % (Story Points)',
            'Avg Story Points per Issue',
            'Avg Cycle Time (Days)',
            'Bug Ratio (%)',
            'Workload Score',
            ...sortedIssueTypes.map(type => `Issues: ${type}`)
        ];
        
        const rows = [headers];
        
        // Add assignee data
        Object.entries(metrics)
            .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
            .forEach(([assignee, m]) => {
                const avgSpPerIssue = m.totalIssues > 0 ? 
                    Math.round((m.totalStoryPoints / m.totalIssues) * 10) / 10 : 0;
                const avgCycleTime = m.cycleTimes.length > 0 ? 
                    Math.round((m.cycleTimes.reduce((a, b) => a + b, 0) / m.cycleTimes.length) * 10) / 10 : 0;
                const bugRatio = m.totalIssues > 0 ? 
                    Math.round((m.bugCount / m.totalIssues) * 1000) / 10 : 0;
                const workloadScore = Math.round((m.totalStoryPoints / Math.max(1, m.totalIssues)) * 10) / 10;
                
                const row = [
                    assignee,
                    m.totalIssues,
                    m.completedIssues,
                    m.totalIssues > 0 ? Math.round((m.completedIssues / m.totalIssues) * 1000) / 10 : 0,
                    m.totalStoryPoints,
                    m.completedStoryPoints,
                    m.totalStoryPoints > 0 ? Math.round((m.completedStoryPoints / m.totalStoryPoints) * 1000) / 10 : 0,
                    avgSpPerIssue,
                    avgCycleTime,
                    bugRatio,
                    workloadScore,
                    ...sortedIssueTypes.map(type => m.issueTypeCounts[type] || 0)
                ];
                
                rows.push(row);
            });
        
        // Add empty row
        rows.push(new Array(headers.length).fill(''));
        
        // Add sprint summary
        const sprintCompletionIssues = sprintTotals.totalIssues > 0 ? 
            Math.round((sprintTotals.completedIssues / sprintTotals.totalIssues) * 1000) / 10 : 0;
        const sprintCompletionSP = sprintTotals.totalStoryPoints > 0 ? 
            Math.round((sprintTotals.completedStoryPoints / sprintTotals.totalStoryPoints) * 1000) / 10 : 0;
        const avgCycleTimeSprint = sprintTotals.allCycleTimes.length > 0 ? 
            Math.round((sprintTotals.allCycleTimes.reduce((a, b) => a + b, 0) / sprintTotals.allCycleTimes.length) * 10) / 10 : 0;
        const avgSpPerTask = sprintTotals.allStoryPoints.length > 0 ? 
            Math.round((sprintTotals.allStoryPoints.reduce((a, b) => a + b, 0) / sprintTotals.allStoryPoints.length) * 10) / 10 : 0;
        const bugToStoryRatio = sprintTotals.totalStories > 0 ? 
            Math.round((sprintTotals.totalBugs / sprintTotals.totalStories) * 1000) / 10 : 0;
        
        const summaryRows = [
            ['=== SPRINT SUMMARY ==='],
            ['Total Tasks Completed', `${sprintTotals.completedIssues}/${sprintTotals.totalIssues} (${sprintCompletionIssues}%)`],
            ['Total Story Points Completed', `${sprintTotals.completedStoryPoints}/${sprintTotals.totalStoryPoints} (${sprintCompletionSP}%)`],
            ['Team Velocity (Completed SP)', sprintTotals.completedStoryPoints],
            ['Average Cycle Time', `${avgCycleTimeSprint} days`],
            ['Average Story Points per Task', avgSpPerTask],
            ['Bug-to-Story Ratio', `${bugToStoryRatio}%`],
            [''],
            ['=== WORKLOAD DISTRIBUTION ===']
        ];
        
        if (sprintTotals.assigneeStoryPoints.length > 0) {
            const minWorkload = Math.min(...sprintTotals.assigneeStoryPoints);
            const maxWorkload = Math.max(...sprintTotals.assigneeStoryPoints);
            const avgWorkload = Math.round((sprintTotals.assigneeStoryPoints.reduce((a, b) => a + b, 0) / sprintTotals.assigneeStoryPoints.length) * 10) / 10;
            const workloadStd = sprintTotals.assigneeStoryPoints.length > 1 ? 
                Math.round(Math.sqrt(sprintTotals.assigneeStoryPoints.reduce((acc, val) => acc + Math.pow(val - avgWorkload, 2), 0) / sprintTotals.assigneeStoryPoints.length) * 10) / 10 : 0;
            
            summaryRows.push(
                ['Min Story Points (Assignee)', minWorkload],
                ['Max Story Points (Assignee)', maxWorkload],
                ['Avg Story Points (Assignee)', avgWorkload],
                ['Workload Std Deviation', workloadStd]
            );
        }
        
        summaryRows.forEach(row => {
            const paddedRow = [...row, ...new Array(headers.length - row.length).fill('')];
            rows.push(paddedRow);
        });
        
        return rows;
    }
    
    displayResults(metrics, sprintId) {
        const sprintTotals = this.computeSprintTotals(metrics);
        
        // Show summary
        const summaryHtml = this.generateSummaryHTML(sprintTotals);
        document.getElementById('summary').innerHTML = summaryHtml;
        
        // Show preview table
        const previewHtml = this.generatePreviewHTML(metrics);
        document.getElementById('preview').innerHTML = previewHtml;
        
        // Show results container
        this.resultsContainer.style.display = 'block';
        this.resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }
    
    generateSummaryHTML(totals) {
        const completionRate = totals.totalIssues > 0 ? 
            Math.round((totals.completedIssues / totals.totalIssues) * 100) : 0;
        const spCompletionRate = totals.totalStoryPoints > 0 ? 
            Math.round((totals.completedStoryPoints / totals.totalStoryPoints) * 100) : 0;
        const avgCycleTime = totals.allCycleTimes.length > 0 ? 
            Math.round((totals.allCycleTimes.reduce((a, b) => a + b, 0) / totals.allCycleTimes.length) * 10) / 10 : 0;
        
        return `
            <div class="summary-item">
                <span class="summary-label">📋 Tasks Completed</span>
                <span class="summary-value">${totals.completedIssues}/${totals.totalIssues} (${completionRate}%)</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">⭐ Story Points Completed</span>
                <span class="summary-value">${totals.completedStoryPoints}/${totals.totalStoryPoints} (${spCompletionRate}%)</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">🚀 Team Velocity</span>
                <span class="summary-value">${totals.completedStoryPoints} points</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">⏱️ Average Cycle Time</span>
                <span class="summary-value">${avgCycleTime} days</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">🐛 Total Bugs</span>
                <span class="summary-value">${totals.totalBugs}</span>
            </div>
        `;
    }
    
    generatePreviewHTML(metrics) {
        const sortedMetrics = Object.entries(metrics)
            .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()));
        
        let html = '<table class="preview-table"><thead><tr>';
        html += '<th>Assignee</th><th>Total Issues</th><th>Completed</th><th>Completion %</th>';
        html += '<th>Story Points</th><th>SP Completed</th><th>SP Completion %</th>';
        html += '<th>Avg Cycle Time</th></tr></thead><tbody>';
        
        sortedMetrics.forEach(([assignee, m]) => {
            const completionRate = m.totalIssues > 0 ? 
                Math.round((m.completedIssues / m.totalIssues) * 100) : 0;
            const spCompletionRate = m.totalStoryPoints > 0 ? 
                Math.round((m.completedStoryPoints / m.totalStoryPoints) * 100) : 0;
            const avgCycleTime = m.cycleTimes.length > 0 ? 
                Math.round((m.cycleTimes.reduce((a, b) => a + b, 0) / m.cycleTimes.length) * 10) / 10 : 0;
            
            html += `<tr>
                <td><strong>${assignee}</strong></td>
                <td>${m.totalIssues}</td>
                <td>${m.completedIssues}</td>
                <td>${completionRate}%</td>
                <td>${m.totalStoryPoints}</td>
                <td>${m.completedStoryPoints}</td>
                <td>${spCompletionRate}%</td>
                <td>${avgCycleTime}d</td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        return html;
    }
    
    downloadCSV() {
        if (!this.csvData) return;
        
        const csvContent = this.csvData.map(row => 
            row.map(cell => {
                const cellStr = String(cell);
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(',')
        ).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `sprint_${document.getElementById('sprintId').value}_kpi.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
    
    setLoading(loading) {
        const btnText = this.generateBtn.querySelector('.btn-text');
        const spinner = this.generateBtn.querySelector('.spinner');
        
        if (loading) {
            btnText.style.display = 'none';
            spinner.style.display = 'inline-block';
            this.generateBtn.disabled = true;
            this.form.classList.add('loading');
        } else {
            btnText.style.display = 'inline-block';
            spinner.style.display = 'none';
            this.generateBtn.disabled = false;
            this.form.classList.remove('loading');
        }
    }
    
    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        this.errorContainer.style.display = 'block';
        this.resultsContainer.style.display = 'none';
        this.errorContainer.scrollIntoView({ behavior: 'smooth' });
    }
    
    hideError() {
        this.errorContainer.style.display = 'none';
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new JiraKPIGenerator();
});