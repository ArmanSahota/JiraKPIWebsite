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
            boardUrl: document.getElementById('boardUrl').value.trim(),
            sprintId: document.getElementById('sprintId').value ? parseInt(document.getElementById('sprintId').value) : null
        };
        
        // Validate that we have either sprint ID or board URL
        if (!formData.sprintId && !formData.boardUrl) {
            throw new Error('Please provide either a Sprint ID or a Board URL to identify which sprint to analyze.');
        }
        
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
        // If no sprint ID provided, try to get active sprint from board URL
        if (!config.sprintId && config.boardUrl) {
            try {
                const boardId = this.extractBoardIdFromUrl(config.boardUrl);
                if (boardId) {
                    config.sprintId = await this.getActiveSprintId(config, boardId);
                    console.log(`Auto-detected sprint ID: ${config.sprintId} from board ${boardId}`);
                } else {
                    throw new Error('Could not extract board ID from the provided board URL');
                }
            } catch (error) {
                throw new Error(`Failed to auto-detect sprint: ${error.message}. Please provide a specific Sprint ID instead.`);
            }
        }
        
        if (!config.sprintId) {
            throw new Error('No sprint ID available. Please provide either a Sprint ID or a valid Board URL.');
        }
        
        const issues = [];
        let startAt = 0;
        const maxResults = 100;
        
        const auth = btoa(`${config.jiraEmail}:${config.jiraApiToken}`);
        
        // CORS proxy options - try multiple strategies
        const corsProxies = [
            '', // Direct request first
            'https://jira-kpi-website-prod.vercel.app/api/jira', // Your deployed proxy
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
                    let requestUrl;
                    const headers = {
                        'Accept': 'application/json'
                    };
                    
                    if (proxy === 'https://jira-kpi-website-prod.vercel.app/api/jira') {
                        // Our custom proxy - send the path and domain separately
                        const jiraDomain = config.jiraBaseUrl.replace('https://', '').replace('http://', '');
                        requestUrl = `${proxy}${baseUrl.replace(config.jiraBaseUrl, '')}?${params}`;
                        headers['X-Jira-Domain'] = jiraDomain;
                        headers['Authorization'] = `Basic ${auth}`;
                        headers['Content-Type'] = 'application/json';
                    } else if (!proxy) {
                        // Direct request
                        requestUrl = targetUrl;
                        headers['Authorization'] = `Basic ${auth}`;
                        headers['Content-Type'] = 'application/json';
                    } else if (proxy.includes('cors-anywhere')) {
                        // CORS Anywhere proxy
                        requestUrl = `${proxy}${targetUrl}`;
                        headers['Authorization'] = `Basic ${auth}`;
                        headers['Content-Type'] = 'application/json';
                    } else {
                        // Other proxies (like allorigins)
                        requestUrl = `${proxy}${encodeURIComponent(targetUrl)}`;
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
                            throw new Error(`Sprint ${config.sprintId} not found. Please check the sprint ID. Make sure the sprint exists and you have access to it.`);
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
        
        // If all proxies failed, check if it's actually a CORS issue or a legitimate API error
        if (lastError && (lastError.message.includes('not found') || lastError.message.includes('Authentication failed') || lastError.message.includes('Rate limit'))) {
            // This is a legitimate API error, not a CORS issue
            throw lastError;
        }
        
        // This is likely a CORS issue
        throw new Error(this.generateCORSErrorMessage(lastError));
    }
    
    extractBoardIdFromUrl(jiraBaseUrl) {
        // Extract board ID from URLs like: /boards/256
        const match = jiraBaseUrl.match(/boards\/(\d+)/);
        return match ? match[1] : null;
    }
    
    async getActiveSprintId(config, boardId) {
        const corsProxies = [
            '', // Direct request first
            'https://jira-kpi-website-dev.vercel.app/api/jira',
            'https://api.allorigins.win/raw?url=',
            'https://cors-anywhere.herokuapp.com/'
        ];
        
        const auth = btoa(`${config.jiraEmail}:${config.jiraApiToken}`);
        
        for (const proxy of corsProxies) {
            try {
                const baseUrl = `${config.jiraBaseUrl}/rest/agile/1.0/board/${boardId}/sprint`;
                const params = new URLSearchParams({
                    state: 'active'
                });
                
                const targetUrl = `${baseUrl}?${params}`;
                let requestUrl;
                const headers = {
                    'Accept': 'application/json'
                };
                
                if (proxy === 'https://jira-kpi-website-prod.vercel.app/api/jira') {
                    // Our custom proxy - send the path and domain separately
                    const jiraDomain = config.jiraBaseUrl.replace('https://', '').replace('http://', '');
                    requestUrl = `${proxy}${baseUrl.replace(config.jiraBaseUrl, '')}?${params}`;
                    headers['X-Jira-Domain'] = jiraDomain;
                    headers['Authorization'] = `Basic ${auth}`;
                    headers['Content-Type'] = 'application/json';
                } else if (!proxy) {
                    // Direct request
                    requestUrl = targetUrl;
                    headers['Authorization'] = `Basic ${auth}`;
                    headers['Content-Type'] = 'application/json';
                } else if (proxy.includes('cors-anywhere')) {
                    // CORS Anywhere proxy
                    requestUrl = `${proxy}${targetUrl}`;
                    headers['Authorization'] = `Basic ${auth}`;
                    headers['Content-Type'] = 'application/json';
                } else {
                    // Other proxies (like allorigins)
                    requestUrl = `${proxy}${encodeURIComponent(targetUrl)}`;
                }
                
                const response = await fetch(requestUrl, {
                    method: 'GET',
                    headers: headers
                });
                
                if (response.ok) {
                    const data = await response.json();
                    let sprintData;
                    
                    if (proxy.includes('allorigins') && data.contents) {
                        sprintData = JSON.parse(data.contents);
                    } else {
                        sprintData = data;
                    }
                    
                    if (sprintData.values && sprintData.values.length > 0) {
                        return sprintData.values[0].id;
                    }
                }
            } catch (error) {
                continue; // Try next proxy
            }
        }
        
        throw new Error('Could not find active sprint for board ' + boardId);
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
                    storyPointsList: [],
                    approvedPRs: 0,
                    prList: []
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
            
            // Track PRs from issue links or custom fields
            const prInfo = this.extractPRInfo(issue);
            if (prInfo) {
                m.approvedPRs += prInfo.count;
                m.prList.push(...prInfo.prs);
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
    
    extractPRInfo(issue) {
        try {
            const prs = [];
            let approvedCount = 0;
            
            // Debug: Log issue key for tracking
            const issueKey = issue.key;
            
            // PRIORITY: Check customfield_10000 for Bitbucket/GitHub PR integration
            const prField = issue.fields?.customfield_10000;
            if (prField) {
                try {
                    // Handle both object and string formats
                    let prData = prField;
                    if (typeof prField === 'string') {
                        // Try to parse if it's a JSON string
                        if (prField.includes('pullrequest') || prField.includes('stateCount')) {
                            const match = prField.match(/stateCount[=:](\d+)/);
                            if (match) {
                                const count = parseInt(match[1]);
                                approvedCount += count;
                                prs.push({
                                    count: count,
                                    source: 'customfield_10000',
                                    status: 'integrated'
                                });
                                console.log(`Found ${count} PRs in customfield_10000 for ${issueKey}`);
                            }
                        }
                    } else if (typeof prField === 'object') {
                        // Handle object format
                        const pullrequest = prData.pullrequest || prData;
                        if (pullrequest.stateCount) {
                            const count = parseInt(pullrequest.stateCount);
                            approvedCount += count;
                            prs.push({
                                count: count,
                                state: pullrequest.state,
                                source: 'customfield_10000',
                                status: 'integrated'
                            });
                            console.log(`Found ${count} PRs (${pullrequest.state}) in customfield_10000 for ${issueKey}`);
                        }
                    }
                } catch (e) {
                    console.warn(`Error parsing customfield_10000 for ${issueKey}:`, e);
                }
            }
            
            // Check for PR links in issue links
            const issueLinks = issue.fields?.issuelinks || [];
            issueLinks.forEach(link => {
                const linkedIssue = link.inwardIssue || link.outwardIssue;
                if (linkedIssue) {
                    const summary = linkedIssue.fields?.summary || '';
                    // Look for PR references in summary (e.g., "PR #123", "Pull Request #456")
                    const prMatch = summary.match(/PR\s*#?(\d+)|Pull Request\s*#?(\d+)/i);
                    if (prMatch) {
                        const prNumber = prMatch[1] || prMatch[2];
                        prs.push({
                            number: prNumber,
                            title: summary,
                            status: 'linked',
                            source: 'issue_link'
                        });
                        approvedCount++;
                        console.log(`Found PR #${prNumber} in linked issue for ${issueKey}`);
                    }
                }
            });
            
            // Check for PR URLs in description
            const description = issue.fields?.description || '';
            if (description) {
                // Handle both string and object descriptions (Jira can return different formats)
                const descText = typeof description === 'string' ? description : JSON.stringify(description);
                const prUrlMatches = descText.match(/github\.com\/[^\/\s]+\/[^\/\s]+\/pull\/(\d+)/gi) || [];
                prUrlMatches.forEach(url => {
                    const prMatch = url.match(/\/pull\/(\d+)/);
                    if (prMatch) {
                        const prNumber = prMatch[1];
                        if (!prs.find(pr => pr.number === prNumber)) {
                            prs.push({
                                number: prNumber,
                                url: url,
                                status: 'mentioned',
                                source: 'description'
                            });
                            approvedCount++;
                            console.log(`Found PR #${prNumber} in description for ${issueKey}`);
                        }
                    }
                });
            }
            
            // Check for PR references in summary
            const summary = issue.fields?.summary || '';
            const summaryPRMatch = summary.match(/PR\s*#?(\d+)|Pull Request\s*#?(\d+)|\[PR-(\d+)\]/i);
            if (summaryPRMatch) {
                const prNumber = summaryPRMatch[1] || summaryPRMatch[2] || summaryPRMatch[3];
                if (!prs.find(pr => pr.number === prNumber)) {
                    prs.push({
                        number: prNumber,
                        title: summary,
                        status: 'in_summary',
                        source: 'summary'
                    });
                    approvedCount++;
                    console.log(`Found PR #${prNumber} in summary for ${issueKey}`);
                }
            }
            
            // Check for custom PR field (if your Jira has one)
            const customFields = Object.keys(issue.fields || {});
            customFields.forEach(fieldKey => {
                if (fieldKey.startsWith('customfield_')) {
                    const fieldValue = issue.fields[fieldKey];
                    if (fieldValue) {
                        const fieldStr = typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue);
                        
                        // Look for GitHub URLs
                        if (fieldStr.includes('github.com')) {
                            const prMatch = fieldStr.match(/\/pull\/(\d+)/);
                            if (prMatch && !prs.find(pr => pr.number === prMatch[1])) {
                                prs.push({
                                    number: prMatch[1],
                                    url: fieldStr,
                                    status: 'custom_field',
                                    source: fieldKey
                                });
                                approvedCount++;
                                console.log(`Found PR #${prMatch[1]} in ${fieldKey} for ${issueKey}`);
                            }
                        }
                        
                        // Look for PR numbers
                        const prNumMatch = fieldStr.match(/PR\s*#?(\d+)|Pull Request\s*#?(\d+)/i);
                        if (prNumMatch) {
                            const prNumber = prNumMatch[1] || prNumMatch[2];
                            if (!prs.find(pr => pr.number === prNumber)) {
                                prs.push({
                                    number: prNumber,
                                    status: 'custom_field',
                                    source: fieldKey
                                });
                                approvedCount++;
                                console.log(`Found PR #${prNumber} in ${fieldKey} for ${issueKey}`);
                            }
                        }
                    }
                }
            });
            
            // Check comments for PR references
            const comments = issue.fields?.comment?.comments || [];
            comments.forEach((comment, idx) => {
                const commentBody = comment.body || '';
                const commentText = typeof commentBody === 'string' ? commentBody : JSON.stringify(commentBody);
                
                const prUrlMatches = commentText.match(/github\.com\/[^\/\s]+\/[^\/\s]+\/pull\/(\d+)/gi) || [];
                prUrlMatches.forEach(url => {
                    const prMatch = url.match(/\/pull\/(\d+)/);
                    if (prMatch) {
                        const prNumber = prMatch[1];
                        if (!prs.find(pr => pr.number === prNumber)) {
                            prs.push({
                                number: prNumber,
                                url: url,
                                status: 'in_comment',
                                source: `comment_${idx}`
                            });
                            approvedCount++;
                            console.log(`Found PR #${prNumber} in comment for ${issueKey}`);
                        }
                    }
                });
            });
            
            if (prs.length > 0) {
                console.log(`Total PRs found for ${issueKey}:`, prs.length, prs);
            }
            
            return prs.length > 0 ? { count: approvedCount, prs } : null;
        } catch (error) {
            console.error('Error extracting PR info:', error, issue.key);
            return null;
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
            totalPRs: 0,
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
            totals.totalPRs += (m.approvedPRs || 0);
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
            'Approved PRs',
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
                    m.approvedPRs || 0,
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
            <div class="summary-item">
                <span class="summary-label">🔀 Approved PRs</span>
                <span class="summary-value">${totals.totalPRs}</span>
            </div>
        `;
    }
    
    generatePreviewHTML(metrics) {
        const sortedMetrics = Object.entries(metrics)
            .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()));
        
        let html = '<table class="preview-table"><thead><tr>';
        html += '<th>Assignee</th><th>Total Issues</th><th>Completed</th><th>Completion %</th>';
        html += '<th>Story Points</th><th>SP Completed</th><th>SP Completion %</th>';
        html += '<th>Approved PRs</th><th>Avg Cycle Time</th></tr></thead><tbody>';
        
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
                <td>${m.approvedPRs || 0}</td>
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