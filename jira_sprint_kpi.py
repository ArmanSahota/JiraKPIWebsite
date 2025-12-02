import os
import csv
import sys
import argparse
from collections import defaultdict
from datetime import datetime, timezone
import statistics

import requests
from dotenv import load_dotenv


# === Load environment variables from .env ===
print("DEBUG: Attempting to load .env file...")
dotenv_loaded = load_dotenv()  # looks for .env in the current directory
print(f"DEBUG: .env file loaded successfully: {dotenv_loaded}")

# Check if .env file exists and show its contents
env_file_path = ".env"
if os.path.exists(env_file_path):
    print(f"DEBUG: .env file exists at: {os.path.abspath(env_file_path)}")
    with open(env_file_path, 'r') as f:
        content = f.read().strip()
        if content:
            print(f"DEBUG: .env file has {len(content.splitlines())} lines of content")
        else:
            print("DEBUG: .env file is EMPTY - this is the problem!")
else:
    print("DEBUG: .env file does NOT exist")

JIRA_BASE_URL = os.getenv("JIRA_BASE_URL")
EMAIL = os.getenv("JIRA_EMAIL")
API_TOKEN = os.getenv("JIRA_API_TOKEN")
STORY_POINTS_FIELD = os.getenv("JIRA_STORY_POINTS_FIELD")

print(f"DEBUG: Environment variables loaded:")
print(f"  JIRA_BASE_URL: {'SET' if JIRA_BASE_URL else 'NOT SET'}")
print(f"  JIRA_EMAIL: {'SET' if EMAIL else 'NOT SET'}")
print(f"  JIRA_API_TOKEN: {'SET' if API_TOKEN else 'NOT SET'}")
print(f"  JIRA_STORY_POINTS_FIELD: {'SET' if STORY_POINTS_FIELD else 'NOT SET'}")

# Some Jira instances use different "done" statuses.
# This uses the statusCategory.key, which is usually "done" for any done-like status.
DONE_STATUS_CATEGORIES = {"done"}


def ensure_config():
    """
    Ensure required environment variables are set, or exit with a clear error.
    """
    missing = []
    if not JIRA_BASE_URL:
        missing.append("JIRA_BASE_URL")
    if not EMAIL:
        missing.append("JIRA_EMAIL")
    if not API_TOKEN:
        missing.append("JIRA_API_TOKEN")
    if not STORY_POINTS_FIELD:
        missing.append("JIRA_STORY_POINTS_FIELD")

    if missing:
        print("ERROR: Missing required environment variables in .env:")
        for m in missing:
            print(f"  - {m}")
        print("\nExample .env:")
        print("JIRA_BASE_URL=https://yourcompany.atlassian.net")
        print("JIRA_EMAIL=your-email@company.com")
        print("JIRA_API_TOKEN=your_api_token_here")
        print("JIRA_STORY_POINTS_FIELD=customfield_10016")
        sys.exit(1)


def fetch_issues_for_sprint(sprint_id: int):
    """
    Fetch all issues in the given sprint using Jira Agile API with pagination.
    """
    issues = []
    start_at = 0
    max_results = 100

    auth = (EMAIL, API_TOKEN)

    while True:
        url = f"{JIRA_BASE_URL}/rest/agile/1.0/sprint/{sprint_id}/issue"
        params = {"startAt": start_at, "maxResults": max_results}
        resp = requests.get(url, params=params, auth=auth)
        resp.raise_for_status()
        data = resp.json()

        issues.extend(data.get("issues", []))

        total = data.get("total", 0)
        start_at += max_results
        if start_at >= total:
            break

    return issues


def get_assignee_name(issue):
    assignee = issue["fields"].get("assignee")
    if assignee is None:
        return "Unassigned"
    return assignee.get("displayName") or assignee.get("emailAddress") or "Unknown"


def get_status_category(issue):
    status = issue["fields"].get("status") or {}
    status_category = status.get("statusCategory") or {}
    # Typically: "new", "indeterminate", "done"
    return status_category.get("key", "").lower()


def get_issue_type(issue):
    issue_type = issue["fields"].get("issuetype") or {}
    return issue_type.get("name", "Unknown")


def get_story_points(issue):
    # Story points may be None or missing
    sp = issue["fields"].get(STORY_POINTS_FIELD)
    if sp is None:
        return 0.0
    try:
        return float(sp)
    except (TypeError, ValueError):
        return 0.0


def get_cycle_time_days(issue):
    """
    Calculate cycle time in days (from first transition to done status to completion).
    Returns 0 if cannot be calculated.
    """
    try:
        created = issue["fields"].get("created")
        resolved = issue["fields"].get("resolutiondate")
        
        if not created or not resolved:
            return 0.0
            
        created_dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
        resolved_dt = datetime.fromisoformat(resolved.replace('Z', '+00:00'))
        
        delta = resolved_dt - created_dt
        return round(delta.total_seconds() / (24 * 3600), 1)  # Convert to days
    except (ValueError, TypeError, AttributeError):
        return 0.0


def compute_metrics(issues):
    """
    Build per-assignee metrics from list of issues with enhanced KPIs.
    """
    metrics = defaultdict(lambda: {
        "total_issues": 0,
        "completed_issues": 0,
        "total_story_points": 0.0,
        "completed_story_points": 0.0,
        "issue_type_counts": defaultdict(int),
        "bug_count": 0,
        "story_count": 0,
        "cycle_times": [],  # For calculating averages
        "story_points_list": [],  # For individual issue story points
    })

    for issue in issues:
        assignee = get_assignee_name(issue)
        status_cat = get_status_category(issue)
        issue_type = get_issue_type(issue)
        story_points = get_story_points(issue)
        cycle_time = get_cycle_time_days(issue)

        m = metrics[assignee]

        m["total_issues"] += 1
        m["total_story_points"] += story_points
        m["issue_type_counts"][issue_type] += 1
        
        # Track story points per issue (including 0-point issues)
        m["story_points_list"].append(story_points)
        
        # Count bugs and stories for quality metrics
        if issue_type.lower() == "bug":
            m["bug_count"] += 1
        elif issue_type.lower() == "story":
            m["story_count"] += 1

        if status_cat in DONE_STATUS_CATEGORIES:
            m["completed_issues"] += 1
            m["completed_story_points"] += story_points
            # Only track cycle time for completed issues
            if cycle_time > 0:
                m["cycle_times"].append(cycle_time)

    return metrics


def compute_sprint_totals(metrics):
    """
    Calculate sprint-wide totals and averages.
    """
    totals = {
        "total_issues": 0,
        "completed_issues": 0,
        "total_story_points": 0.0,
        "completed_story_points": 0.0,
        "total_bugs": 0,
        "total_stories": 0,
        "all_cycle_times": [],
        "all_story_points": [],
        "assignee_story_points": [],  # Story points per assignee for distribution analysis
    }
    
    for assignee, m in metrics.items():
        if assignee == "Unassigned":
            continue  # Skip unassigned for team metrics
            
        totals["total_issues"] += m["total_issues"]
        totals["completed_issues"] += m["completed_issues"]
        totals["total_story_points"] += m["total_story_points"]
        totals["completed_story_points"] += m["completed_story_points"]
        totals["total_bugs"] += m["bug_count"]
        totals["total_stories"] += m["story_count"]
        totals["all_cycle_times"].extend(m["cycle_times"])
        totals["all_story_points"].extend(m["story_points_list"])
        
        # Track story points per assignee for workload distribution
        if m["total_story_points"] > 0:
            totals["assignee_story_points"].append(m["total_story_points"])
    
    return totals


def write_csv(metrics, sprint_id: int):
    """
    Write enhanced metrics to a CSV with sprint totals and advanced KPIs.
    """
    output_csv = f"sprint_{sprint_id}_kpi.csv"
    sprint_totals = compute_sprint_totals(metrics)

    # Collect all issue types seen to make consistent columns
    all_issue_types = set()
    for m in metrics.values():
        all_issue_types.update(m["issue_type_counts"].keys())
    all_issue_types = sorted(all_issue_types)

    fieldnames = [
        "Assignee",
        "Total Issues",
        "Completed Issues",
        "Completion % (Issues)",
        "Total Story Points",
        "Completed Story Points",
        "Completion % (Story Points)",
        "Avg Story Points per Issue",
        "Avg Cycle Time (Days)",
        "Bug Ratio (%)",
        "Workload Score",
    ] + [f"Issues: {t}" for t in all_issue_types]

    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        # Write individual assignee metrics
        for assignee, m in sorted(metrics.items(), key=lambda x: x[0].lower()):
            total_issues = m["total_issues"]
            completed_issues = m["completed_issues"]
            total_sp = m["total_story_points"]
            completed_sp = m["completed_story_points"]
            
            # Calculate enhanced metrics
            avg_sp_per_issue = round(total_sp / total_issues, 1) if total_issues > 0 else 0.0
            avg_cycle_time = round(statistics.mean(m["cycle_times"]), 1) if m["cycle_times"] else 0.0
            bug_ratio = round(100.0 * m["bug_count"] / total_issues, 1) if total_issues > 0 else 0.0
            
            # Workload score (normalized story points - higher means more work)
            workload_score = round(total_sp / max(1, total_issues), 1)

            row = {
                "Assignee": assignee,
                "Total Issues": total_issues,
                "Completed Issues": completed_issues,
                "Completion % (Issues)": (
                    round(100.0 * completed_issues / total_issues, 1)
                    if total_issues > 0 else 0.0
                ),
                "Total Story Points": total_sp,
                "Completed Story Points": completed_sp,
                "Completion % (Story Points)": (
                    round(100.0 * completed_sp / total_sp, 1)
                    if total_sp > 0 else 0.0
                ),
                "Avg Story Points per Issue": avg_sp_per_issue,
                "Avg Cycle Time (Days)": avg_cycle_time,
                "Bug Ratio (%)": bug_ratio,
                "Workload Score": workload_score,
            }

            for t in all_issue_types:
                row[f"Issues: {t}"] = m["issue_type_counts"].get(t, 0)

            writer.writerow(row)

        # Add separator and sprint totals
        writer.writerow({})  # Empty row for separation
        
        # Sprint Summary Section
        sprint_completion_issues = round(100.0 * sprint_totals["completed_issues"] / sprint_totals["total_issues"], 1) if sprint_totals["total_issues"] > 0 else 0.0
        sprint_completion_sp = round(100.0 * sprint_totals["completed_story_points"] / sprint_totals["total_story_points"], 1) if sprint_totals["total_story_points"] > 0 else 0.0
        
        avg_cycle_time_sprint = round(statistics.mean(sprint_totals["all_cycle_times"]), 1) if sprint_totals["all_cycle_times"] else 0.0
        avg_sp_per_task = round(statistics.mean(sprint_totals["all_story_points"]), 1) if sprint_totals["all_story_points"] else 0.0
        
        # Workload distribution analysis
        if sprint_totals["assignee_story_points"]:
            min_workload = min(sprint_totals["assignee_story_points"])
            max_workload = max(sprint_totals["assignee_story_points"])
            avg_workload = round(statistics.mean(sprint_totals["assignee_story_points"]), 1)
            workload_std = round(statistics.stdev(sprint_totals["assignee_story_points"]), 1) if len(sprint_totals["assignee_story_points"]) > 1 else 0.0
        else:
            min_workload = max_workload = avg_workload = workload_std = 0.0
        
        team_velocity = sprint_totals["completed_story_points"]
        bug_to_story_ratio = round(sprint_totals["total_bugs"] / max(1, sprint_totals["total_stories"]) * 100, 1)

        # Write sprint summary rows
        summary_rows = [
            {"Assignee": "=== SPRINT SUMMARY ==="},
            {"Assignee": "Total Tasks Completed", "Total Issues": f"{sprint_totals['completed_issues']}/{sprint_totals['total_issues']} ({sprint_completion_issues}%)"},
            {"Assignee": "Total Story Points Completed", "Total Issues": f"{sprint_totals['completed_story_points']}/{sprint_totals['total_story_points']} ({sprint_completion_sp}%)"},
            {"Assignee": "Team Velocity (Completed SP)", "Total Issues": team_velocity},
            {"Assignee": "Average Cycle Time", "Total Issues": f"{avg_cycle_time_sprint} days"},
            {"Assignee": "Average Story Points per Task", "Total Issues": avg_sp_per_task},
            {"Assignee": "Bug-to-Story Ratio", "Total Issues": f"{bug_to_story_ratio}%"},
            {"Assignee": ""},
            {"Assignee": "=== WORKLOAD DISTRIBUTION ==="},
            {"Assignee": "Min Story Points (Assignee)", "Total Issues": min_workload},
            {"Assignee": "Max Story Points (Assignee)", "Total Issues": max_workload},
            {"Assignee": "Avg Story Points (Assignee)", "Total Issues": avg_workload},
            {"Assignee": "Workload Std Deviation", "Total Issues": workload_std},
        ]
        
        for row in summary_rows:
            writer.writerow(row)

    print(f"Wrote enhanced metrics to {output_csv}")
    print(f"Sprint Summary:")
    print(f"  - Tasks: {sprint_totals['completed_issues']}/{sprint_totals['total_issues']} ({sprint_completion_issues}%)")
    print(f"  - Story Points: {sprint_totals['completed_story_points']}/{sprint_totals['total_story_points']} ({sprint_completion_sp}%)")
    print(f"  - Team Velocity: {team_velocity} points")
    print(f"  - Avg Cycle Time: {avg_cycle_time_sprint} days")
    print(f"  - Bug Ratio: {bug_to_story_ratio}%")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate per-assignee Jira sprint metrics (team health / workload view)."
    )
    parser.add_argument(
        "--sprint-id",
        type=int,
        required=True,
        help="Jira sprint ID (from the Sprint Report URL, e.g., sprint=345).",
    )
    return parser.parse_args()


def main():
    ensure_config()
    args = parse_args()
    sprint_id = args.sprint_id

    print(f"Fetching issues for sprint {sprint_id}...")
    issues = fetch_issues_for_sprint(sprint_id)
    print(f"Fetched {len(issues)} issues.")

    print("Computing enhanced metrics...")
    metrics = compute_metrics(issues)

    print("Writing enhanced CSV with KPIs...")
    write_csv(metrics, sprint_id)
    print("Done! Enhanced KPI report generated with:")
    print("  ✓ Individual assignee metrics")
    print("  ✓ Sprint completion totals")
    print("  ✓ Average cycle times")
    print("  ✓ Workload distribution analysis")
    print("  ✓ Bug-to-story ratios")
    print("Open the CSV in Excel/Sheets for detailed analysis.")


if __name__ == "__main__":
    main()
