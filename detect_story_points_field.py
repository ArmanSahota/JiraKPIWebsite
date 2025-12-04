#!/usr/bin/env python3
"""
Utility script to detect the story points field ID in your Jira instance.
This helps you find the correct customfield_XXXXX to use in your configuration.
"""

import os
import sys
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

JIRA_BASE_URL = os.getenv("JIRA_BASE_URL")
EMAIL = os.getenv("JIRA_EMAIL")
API_TOKEN = os.getenv("JIRA_API_TOKEN")


def detect_story_points_field(sprint_id=None, issue_key=None):
    """
    Detect the story points field by analyzing a sample issue.
    
    Args:
        sprint_id: Optional sprint ID to fetch an issue from
        issue_key: Optional specific issue key to analyze (e.g., "PROJ-123")
    """
    if not all([JIRA_BASE_URL, EMAIL, API_TOKEN]):
        print("ERROR: Missing required environment variables.")
        print("Please set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN in your .env file")
        sys.exit(1)
    
    auth = (EMAIL, API_TOKEN)
    
    # Get a sample issue
    issue = None
    
    if issue_key:
        # Fetch specific issue
        print(f"Fetching issue {issue_key}...")
        url = f"{JIRA_BASE_URL}/rest/api/2/issue/{issue_key}"
        try:
            resp = requests.get(url, auth=auth)
            resp.raise_for_status()
            issue = resp.json()
        except Exception as e:
            print(f"Error fetching issue {issue_key}: {e}")
            return None
    
    elif sprint_id:
        # Fetch first issue from sprint
        print(f"Fetching sample issue from sprint {sprint_id}...")
        url = f"{JIRA_BASE_URL}/rest/agile/1.0/sprint/{sprint_id}/issue"
        params = {"startAt": 0, "maxResults": 5}
        try:
            resp = requests.get(url, params=params, auth=auth)
            resp.raise_for_status()
            data = resp.json()
            
            if not data.get("issues"):
                print("No issues found in sprint")
                return None
            
            # Try to find an issue with story points
            for iss in data["issues"]:
                fields = iss.get("fields", {})
                for field_id, field_value in fields.items():
                    if field_id.startswith("customfield_") and isinstance(field_value, (int, float)) and field_value > 0:
                        issue = iss
                        break
                if issue:
                    break
            
            if not issue:
                issue = data["issues"][0]
                
        except Exception as e:
            print(f"Error fetching issues from sprint {sprint_id}: {e}")
            return None
    
    else:
        print("ERROR: Please provide either --sprint-id or --issue-key")
        return None
    
    if not issue:
        print("Could not fetch a sample issue")
        return None
    
    print(f"\nAnalyzing issue: {issue.get('key', 'Unknown')}")
    print("-" * 60)
    
    fields = issue.get("fields", {})
    
    # Find all custom fields with numeric values
    print("\nCustom fields with numeric values (potential story points):")
    print("-" * 60)
    
    potential_fields = []
    for field_id, field_value in sorted(fields.items()):
        if field_id.startswith("customfield_"):
            if isinstance(field_value, (int, float)):
                potential_fields.append((field_id, field_value))
                print(f"  {field_id}: {field_value}")
    
    if not potential_fields:
        print("  No numeric custom fields found")
    
    # Try to get field metadata to show names
    print("\n\nFetching field metadata to show field names...")
    print("-" * 60)
    
    try:
        fields_url = f"{JIRA_BASE_URL}/rest/api/2/field"
        fields_resp = requests.get(fields_url, auth=auth)
        fields_resp.raise_for_status()
        all_fields = fields_resp.json()
        
        # Create a mapping of field IDs to names
        field_names = {f["id"]: f["name"] for f in all_fields if "id" in f and "name" in f}
        
        # Show potential story points fields with names
        # Prioritize exact matches for "Story Points" or "Story Point Estimate"
        exact_patterns = [
            r"^story points?$",
            r"^story point estimate$",
            r"^points?$",
        ]
        
        partial_patterns = [
            "story points", "story point", "estimate", "sp"
        ]
        
        print("\nFields matching story points patterns:")
        exact_matches = []
        partial_matches = []
        
        for field in all_fields:
            field_id = field.get("id", "")
            field_name = field.get("name", "")
            field_name_lower = field_name.lower()
            
            if not field_id.startswith("customfield_"):
                continue
            
            # Check for exact matches first
            import re
            is_exact = False
            for pattern in exact_patterns:
                if re.match(pattern, field_name_lower):
                    exact_matches.append((field_id, field_name))
                    is_exact = True
                    break
            
            # If not exact, check partial matches
            if not is_exact:
                for pattern in partial_patterns:
                    if pattern in field_name_lower:
                        # Exclude fields that are clearly not story points
                        exclude_terms = ["sprint", "response", "chart", "date", "time", "ready", "spec"]
                        if not any(term in field_name_lower for term in exclude_terms):
                            partial_matches.append((field_id, field_name))
                        break
        
        found_matches = exact_matches + partial_matches
        
        for field_id, field_name in found_matches:
            # Check if this field has a value in our sample issue
            field_value = fields.get(field_id)
            value_str = f" = {field_value}" if field_value is not None else " (no value in sample)"
            marker = "  ✓✓" if (field_id, field_name) in exact_matches else "  ✓"
            print(f"{marker} {field_id}: {field_name}{value_str}")
        
        if not found_matches:
            print("  No fields found matching common story points patterns")
        
        # Show all potential fields with their names
        if potential_fields:
            print("\n\nAll numeric custom fields with names:")
            print("-" * 60)
            for field_id, field_value in potential_fields:
                field_name = field_names.get(field_id, "Unknown")
                print(f"  {field_id}: {field_name} = {field_value}")
        
        # Make a recommendation
        print("\n\n" + "=" * 60)
        print("RECOMMENDATION:")
        print("=" * 60)
        
        if exact_matches:
            recommended = exact_matches[0][0]
            recommended_name = exact_matches[0][1]
            print(f"Based on exact field name match, the story points field is:")
            print(f"  {recommended} ({recommended_name})")
        elif found_matches:
            recommended = found_matches[0][0]
            recommended_name = found_matches[0][1]
            print(f"Based on field names, the story points field is likely:")
            print(f"  {recommended} ({recommended_name})")
        elif potential_fields:
            recommended = potential_fields[0][0]
            recommended_name = field_names.get(recommended, "Unknown")
            print(f"Based on numeric values, the story points field might be:")
            print(f"  {recommended} ({recommended_name})")
        else:
            print("Could not determine story points field.")
            print("Common defaults to try: customfield_10016, customfield_10004, customfield_10026")
            recommended = "customfield_10016"
        
        print("\nAdd this to your .env file:")
        print(f"JIRA_STORY_POINTS_FIELD={recommended}")
        
        return recommended
        
    except Exception as e:
        print(f"Error fetching field metadata: {e}")
        if potential_fields:
            print(f"\nBest guess based on numeric values: {potential_fields[0][0]}")
            return potential_fields[0][0]
        return None


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Detect the story points field ID in your Jira instance"
    )
    parser.add_argument(
        "--sprint-id",
        type=int,
        help="Sprint ID to fetch a sample issue from"
    )
    parser.add_argument(
        "--issue-key",
        type=str,
        help="Specific issue key to analyze (e.g., PROJ-123)"
    )
    
    args = parser.parse_args()
    
    if not args.sprint_id and not args.issue_key:
        print("ERROR: Please provide either --sprint-id or --issue-key")
        print("\nExamples:")
        print("  python detect_story_points_field.py --sprint-id 1230")
        print("  python detect_story_points_field.py --issue-key PROJ-123")
        sys.exit(1)
    
    detect_story_points_field(sprint_id=args.sprint_id, issue_key=args.issue_key)