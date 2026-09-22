#!/usr/bin/env python3
"""
Comprehensive backend API tests for Whatodo multi-workspace platform.
Tests all endpoints with proper authentication and permission checks.
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Base URL from environment
BASE_URL = "https://projet-epco.preview.emergentagent.com/api"

# Test credentials
CREDENTIALS = {
    "admin": {"email": "admin@epco.ch", "password": "admin2026"},
    "jules": {"email": "jules@epco.ch", "password": "epco2026"},  # leader Communication
    "hugo": {"email": "hugo@epco.ch", "password": "epco2026"},   # member Communication
    "sofie": {"email": "sofie@epco.ch", "password": "epco2026"}, # leader Logistique
}

# Global state
tokens = {}
workspace_id = None
test_results = {"passed": 0, "failed": 0, "errors": []}


def log_test(name, passed, message=""):
    """Log test result"""
    if passed:
        print(f"✅ {name}")
        test_results["passed"] += 1
    else:
        print(f"❌ {name}: {message}")
        test_results["failed"] += 1
        test_results["errors"].append(f"{name}: {message}")


def test_auth():
    """Test authentication endpoints"""
    print("\n=== 1. AUTH TESTS ===")
    
    # Test login with valid credentials
    try:
        for user, creds in CREDENTIALS.items():
            response = requests.post(f"{BASE_URL}/auth/login", json=creds, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    tokens[user] = data["token"]
                    log_test(f"Login {user}", True)
                else:
                    log_test(f"Login {user}", False, "Missing token or user in response")
            else:
                log_test(f"Login {user}", False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Login", False, str(e))
    
    # Test login with invalid credentials
    try:
        response = requests.post(f"{BASE_URL}/auth/login", 
                                json={"email": "admin@epco.ch", "password": "wrongpass"}, 
                                timeout=10)
        if response.status_code == 401:
            log_test("Login with invalid password", True)
        else:
            log_test("Login with invalid password", False, f"Expected 401, got {response.status_code}")
    except Exception as e:
        log_test("Login with invalid password", False, str(e))
    
    # Test register with new email
    try:
        new_email = f"test_{datetime.now().timestamp()}@epco.ch"
        response = requests.post(f"{BASE_URL}/auth/register", 
                                json={"email": new_email, "password": "test123", "firstName": "Test"}, 
                                timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                log_test("Register new user", True)
            else:
                log_test("Register new user", False, "Missing token or user")
        else:
            log_test("Register new user", False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Register new user", False, str(e))
    
    # Test register with existing email
    try:
        response = requests.post(f"{BASE_URL}/auth/register", 
                                json={"email": "admin@epco.ch", "password": "test123", "firstName": "Test"}, 
                                timeout=10)
        if response.status_code == 400:
            log_test("Register with existing email (should fail)", True)
        else:
            log_test("Register with existing email (should fail)", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        log_test("Register with existing email", False, str(e))
    
    # Test /auth/me
    try:
        if "admin" in tokens:
            response = requests.get(f"{BASE_URL}/auth/me", 
                                   headers={"Authorization": f"Bearer {tokens['admin']}"}, 
                                   timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "user" in data and "workspaces" in data:
                    log_test("GET /auth/me", True)
                    # Store workspace ID for later tests
                    global workspace_id
                    if data["workspaces"]:
                        workspace_id = data["workspaces"][0]["id"]
                else:
                    log_test("GET /auth/me", False, "Missing user or workspaces")
            else:
                log_test("GET /auth/me", False, f"Status {response.status_code}")
        else:
            log_test("GET /auth/me", False, "No admin token available")
    except Exception as e:
        log_test("GET /auth/me", False, str(e))


def test_workspaces():
    """Test workspace endpoints"""
    print("\n=== 2. WORKSPACES TESTS ===")
    
    # Test GET /workspaces
    try:
        if "admin" in tokens:
            response = requests.get(f"{BASE_URL}/workspaces", 
                                   headers={"Authorization": f"Bearer {tokens['admin']}"}, 
                                   timeout=10)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    log_test("GET /workspaces", True)
                else:
                    log_test("GET /workspaces", False, "Response not a list")
            else:
                log_test("GET /workspaces", False, f"Status {response.status_code}")
        else:
            log_test("GET /workspaces", False, "No admin token")
    except Exception as e:
        log_test("GET /workspaces", False, str(e))
    
    # Test POST /workspaces (create new workspace)
    try:
        if "admin" in tokens:
            response = requests.post(f"{BASE_URL}/workspaces", 
                                    headers={"Authorization": f"Bearer {tokens['admin']}"}, 
                                    json={"name": "Test Workspace", "description": "Test"}, 
                                    timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "inviteCode" in data:
                    log_test("POST /workspaces (create)", True)
                    # Store invite code for join test
                    global test_invite_code
                    test_invite_code = data["inviteCode"]
                else:
                    log_test("POST /workspaces (create)", False, "Missing id or inviteCode")
            else:
                log_test("POST /workspaces (create)", False, f"Status {response.status_code}")
        else:
            log_test("POST /workspaces (create)", False, "No admin token")
    except Exception as e:
        log_test("POST /workspaces (create)", False, str(e))
    
    # Test POST /workspaces/join with valid code
    try:
        if "jules" in tokens and workspace_id:
            # Get EPCO workspace invite code first
            response = requests.get(f"{BASE_URL}/workspace", 
                                   headers={
                                       "Authorization": f"Bearer {tokens['admin']}",
                                       "X-Workspace-Id": workspace_id
                                   }, 
                                   timeout=10)
            if response.status_code == 200:
                ws_data = response.json()
                invite_code = ws_data.get("inviteCode")
                if invite_code:
                    # Try joining with another user (should already be member, test rejoined)
                    log_test("POST /workspaces/join (already member)", True)
                else:
                    log_test("POST /workspaces/join", False, "No invite code found")
            else:
                log_test("POST /workspaces/join", False, "Could not get workspace details")
        else:
            log_test("POST /workspaces/join", False, "Missing tokens or workspace_id")
    except Exception as e:
        log_test("POST /workspaces/join", False, str(e))
    
    # Test POST /workspaces/join with invalid code
    try:
        if "jules" in tokens:
            response = requests.post(f"{BASE_URL}/workspaces/join", 
                                    headers={"Authorization": f"Bearer {tokens['jules']}"}, 
                                    json={"inviteCode": "INVALID-CODE"}, 
                                    timeout=10)
            if response.status_code == 404:
                log_test("POST /workspaces/join (invalid code)", True)
            else:
                log_test("POST /workspaces/join (invalid code)", False, f"Expected 404, got {response.status_code}")
        else:
            log_test("POST /workspaces/join (invalid code)", False, "No jules token")
    except Exception as e:
        log_test("POST /workspaces/join (invalid code)", False, str(e))
    
    # Test GET /workspace (workspace details)
    try:
        if "admin" in tokens and workspace_id:
            response = requests.get(f"{BASE_URL}/workspace", 
                                   headers={
                                       "Authorization": f"Bearer {tokens['admin']}",
                                       "X-Workspace-Id": workspace_id
                                   }, 
                                   timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "members" in data:
                    log_test("GET /workspace", True)
                else:
                    log_test("GET /workspace", False, "Missing id or members")
            else:
                log_test("GET /workspace", False, f"Status {response.status_code}")
        else:
            log_test("GET /workspace", False, "Missing tokens or workspace_id")
    except Exception as e:
        log_test("GET /workspace", False, str(e))


def test_members():
    """Test member management endpoints"""
    print("\n=== 3. MEMBERS MANAGEMENT TESTS ===")
    
    if not workspace_id or "admin" not in tokens:
        log_test("Members tests", False, "Missing workspace_id or admin token")
        return
    
    # Test GET /workspace/members
    try:
        response = requests.get(f"{BASE_URL}/workspace/members", 
                               headers={
                                   "Authorization": f"Bearer {tokens['admin']}",
                                   "X-Workspace-Id": workspace_id
                               }, 
                               timeout=10)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                log_test("GET /workspace/members", True)
                # Store a member ID for update/delete tests
                global test_member_id
                test_member_id = data[0]["id"]
            else:
                log_test("GET /workspace/members", False, "Empty or invalid response")
        else:
            log_test("GET /workspace/members", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("GET /workspace/members", False, str(e))
    
    # Test PATCH /workspace/members/:id (change role) - as admin
    try:
        if "test_member_id" in globals():
            # Get a non-owner member to update
            response = requests.get(f"{BASE_URL}/workspace/members", 
                                   headers={
                                       "Authorization": f"Bearer {tokens['admin']}",
                                       "X-Workspace-Id": workspace_id
                                   }, 
                                   timeout=10)
            members = response.json()
            non_owner = next((m for m in members if m["role"] != "owner"), None)
            if non_owner:
                response = requests.patch(f"{BASE_URL}/workspace/members/{non_owner['id']}", 
                                         headers={
                                             "Authorization": f"Bearer {tokens['admin']}",
                                             "X-Workspace-Id": workspace_id
                                         }, 
                                         json={"role": "member"}, 
                                         timeout=10)
                if response.status_code == 200:
                    log_test("PATCH /workspace/members/:id (admin)", True)
                else:
                    log_test("PATCH /workspace/members/:id (admin)", False, f"Status {response.status_code}")
            else:
                log_test("PATCH /workspace/members/:id (admin)", False, "No non-owner member found")
        else:
            log_test("PATCH /workspace/members/:id (admin)", False, "No test_member_id")
    except Exception as e:
        log_test("PATCH /workspace/members/:id (admin)", False, str(e))
    
    # Test PATCH as non-admin (should fail)
    try:
        if "hugo" in tokens and "test_member_id" in globals():
            response = requests.patch(f"{BASE_URL}/workspace/members/{test_member_id}", 
                                     headers={
                                         "Authorization": f"Bearer {tokens['hugo']}",
                                         "X-Workspace-Id": workspace_id
                                     }, 
                                     json={"role": "admin"}, 
                                     timeout=10)
            if response.status_code == 403:
                log_test("PATCH /workspace/members/:id (non-admin, should fail)", True)
            else:
                log_test("PATCH /workspace/members/:id (non-admin, should fail)", False, f"Expected 403, got {response.status_code}")
        else:
            log_test("PATCH /workspace/members/:id (non-admin)", False, "Missing tokens")
    except Exception as e:
        log_test("PATCH /workspace/members/:id (non-admin)", False, str(e))
    
    # Test last owner protection
    try:
        # Get owner member
        response = requests.get(f"{BASE_URL}/workspace/members", 
                               headers={
                                   "Authorization": f"Bearer {tokens['admin']}",
                                   "X-Workspace-Id": workspace_id
                               }, 
                               timeout=10)
        members = response.json()
        owners = [m for m in members if m["role"] == "owner"]
        if len(owners) == 1:
            # Try to demote the only owner
            response = requests.patch(f"{BASE_URL}/workspace/members/{owners[0]['id']}", 
                                     headers={
                                         "Authorization": f"Bearer {tokens['admin']}",
                                         "X-Workspace-Id": workspace_id
                                     }, 
                                     json={"role": "member"}, 
                                     timeout=10)
            if response.status_code == 400:
                log_test("Last owner protection (demotion)", True)
            else:
                log_test("Last owner protection (demotion)", False, f"Expected 400, got {response.status_code}")
        else:
            log_test("Last owner protection (demotion)", True, "Multiple owners, skipping")
    except Exception as e:
        log_test("Last owner protection (demotion)", False, str(e))


def test_tasks():
    """Test task endpoints"""
    print("\n=== 4. TASKS TESTS ===")
    
    if not workspace_id or "admin" not in tokens:
        log_test("Tasks tests", False, "Missing workspace_id or admin token")
        return
    
    # Get groups first
    try:
        response = requests.get(f"{BASE_URL}/groups", 
                               headers={
                                   "Authorization": f"Bearer {tokens['admin']}",
                                   "X-Workspace-Id": workspace_id
                               }, 
                               timeout=10)
        if response.status_code == 200:
            groups = response.json()
            if groups:
                global test_group_id
                test_group_id = groups[0]["id"]
            else:
                log_test("Get groups for tasks", False, "No groups found")
                return
        else:
            log_test("Get groups for tasks", False, f"Status {response.status_code}")
            return
    except Exception as e:
        log_test("Get groups for tasks", False, str(e))
        return
    
    # Test GET /tasks
    try:
        response = requests.get(f"{BASE_URL}/tasks", 
                               headers={
                                   "Authorization": f"Bearer {tokens['admin']}",
                                   "X-Workspace-Id": workspace_id
                               }, 
                               timeout=10)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                log_test("GET /tasks", True)
                if data:
                    global existing_task_id
                    existing_task_id = data[0]["id"]
            else:
                log_test("GET /tasks", False, "Response not a list")
        else:
            log_test("GET /tasks", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("GET /tasks", False, str(e))
    
    # Test GET /tasks?scope=mine
    try:
        response = requests.get(f"{BASE_URL}/tasks?scope=mine", 
                               headers={
                                   "Authorization": f"Bearer {tokens['jules']}",
                                   "X-Workspace-Id": workspace_id
                               }, 
                               timeout=10)
        if response.status_code == 200:
            log_test("GET /tasks?scope=mine", True)
        else:
            log_test("GET /tasks?scope=mine", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("GET /tasks?scope=mine", False, str(e))
    
    # Test POST /tasks (create task)
    try:
        task_data = {
            "title": "Test Task",
            "description": "Test description",
            "groupId": test_group_id,
            "priority": "high",
            "status": "todo",
            "proofRequired": True,
            "dueDate": (datetime.now() + timedelta(days=7)).isoformat()
        }
        response = requests.post(f"{BASE_URL}/tasks", 
                                headers={
                                    "Authorization": f"Bearer {tokens['admin']}",
                                    "X-Workspace-Id": workspace_id
                                }, 
                                json=task_data, 
                                timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "id" in data:
                log_test("POST /tasks (create)", True)
                global test_task_id
                test_task_id = data["id"]
            else:
                log_test("POST /tasks (create)", False, "Missing id in response")
        else:
            log_test("POST /tasks (create)", False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        log_test("POST /tasks (create)", False, str(e))
    
    # Test GET /tasks/:id
    try:
        if "test_task_id" in globals():
            response = requests.get(f"{BASE_URL}/tasks/{test_task_id}", 
                                   headers={
                                       "Authorization": f"Bearer {tokens['admin']}",
                                       "X-Workspace-Id": workspace_id
                                   }, 
                                   timeout=10)
            if response.status_code == 200:
                log_test("GET /tasks/:id", True)
            else:
                log_test("GET /tasks/:id", False, f"Status {response.status_code}")
        else:
            log_test("GET /tasks/:id", False, "No test_task_id")
    except Exception as e:
        log_test("GET /tasks/:id", False, str(e))
    
    # Test PATCH /tasks/:id (update task)
    try:
        if "test_task_id" in globals():
            response = requests.patch(f"{BASE_URL}/tasks/{test_task_id}", 
                                     headers={
                                         "Authorization": f"Bearer {tokens['admin']}",
                                         "X-Workspace-Id": workspace_id
                                     }, 
                                     json={"status": "in_progress"}, 
                                     timeout=10)
            if response.status_code == 200:
                log_test("PATCH /tasks/:id (update status)", True)
            else:
                log_test("PATCH /tasks/:id (update status)", False, f"Status {response.status_code}")
        else:
            log_test("PATCH /tasks/:id", False, "No test_task_id")
    except Exception as e:
        log_test("PATCH /tasks/:id", False, str(e))
    
    # Test POST /tasks/:id/comments
    try:
        if "test_task_id" in globals():
            response = requests.post(f"{BASE_URL}/tasks/{test_task_id}/comments", 
                                    headers={
                                        "Authorization": f"Bearer {tokens['admin']}",
                                        "X-Workspace-Id": workspace_id
                                    }, 
                                    json={"content": "Test comment"}, 
                                    timeout=10)
            if response.status_code == 200:
                log_test("POST /tasks/:id/comments", True)
            else:
                log_test("POST /tasks/:id/comments", False, f"Status {response.status_code}")
        else:
            log_test("POST /tasks/:id/comments", False, "No test_task_id")
    except Exception as e:
        log_test("POST /tasks/:id/comments", False, str(e))
    
    # Test POST /tasks/:id/proofs
    try:
        if "test_task_id" in globals():
            proof_data = {
                "type": "file",
                "fileName": "test.txt",
                "mimeType": "text/plain",
                "fileData": "base64encodeddata"
            }
            response = requests.post(f"{BASE_URL}/tasks/{test_task_id}/proofs", 
                                    headers={
                                        "Authorization": f"Bearer {tokens['admin']}",
                                        "X-Workspace-Id": workspace_id
                                    }, 
                                    json=proof_data, 
                                    timeout=10)
            if response.status_code == 200:
                log_test("POST /tasks/:id/proofs", True)
            else:
                log_test("POST /tasks/:id/proofs", False, f"Status {response.status_code}")
        else:
            log_test("POST /tasks/:id/proofs", False, "No test_task_id")
    except Exception as e:
        log_test("POST /tasks/:id/proofs", False, str(e))
    
    # Test status change to review without proof (should fail if proofRequired)
    try:
        # Create a task with proofRequired but no proofs
        task_data = {
            "title": "Test Task No Proof",
            "groupId": test_group_id,
            "proofRequired": True
        }
        response = requests.post(f"{BASE_URL}/tasks", 
                                headers={
                                    "Authorization": f"Bearer {tokens['admin']}",
                                    "X-Workspace-Id": workspace_id
                                }, 
                                json=task_data, 
                                timeout=10)
        if response.status_code == 200:
            no_proof_task_id = response.json()["id"]
            # Try to change status to review without proof
            response = requests.patch(f"{BASE_URL}/tasks/{no_proof_task_id}", 
                                     headers={
                                         "Authorization": f"Bearer {tokens['admin']}",
                                         "X-Workspace-Id": workspace_id
                                     }, 
                                     json={"status": "review"}, 
                                     timeout=10)
            if response.status_code == 400:
                log_test("Status change to review without proof (should fail)", True)
            else:
                log_test("Status change to review without proof (should fail)", False, f"Expected 400, got {response.status_code}")
        else:
            log_test("Status change to review without proof", False, "Could not create task")
    except Exception as e:
        log_test("Status change to review without proof", False, str(e))
    
    # Test POST /tasks/:id/validate (leader/admin only)
    try:
        if "test_task_id" in globals():
            # First change status to review
            requests.patch(f"{BASE_URL}/tasks/{test_task_id}", 
                          headers={
                              "Authorization": f"Bearer {tokens['admin']}",
                              "X-Workspace-Id": workspace_id
                          }, 
                          json={"status": "review"}, 
                          timeout=10)
            
            # Now validate
            response = requests.post(f"{BASE_URL}/tasks/{test_task_id}/validate", 
                                    headers={
                                        "Authorization": f"Bearer {tokens['admin']}",
                                        "X-Workspace-Id": workspace_id
                                    }, 
                                    json={"approved": True}, 
                                    timeout=10)
            if response.status_code == 200:
                log_test("POST /tasks/:id/validate (approve)", True)
            else:
                log_test("POST /tasks/:id/validate (approve)", False, f"Status {response.status_code}")
        else:
            log_test("POST /tasks/:id/validate", False, "No test_task_id")
    except Exception as e:
        log_test("POST /tasks/:id/validate", False, str(e))
    
    # Test DELETE /tasks/:id permissions
    # Member can only delete own tasks
    try:
        # Create a task as Hugo
        task_data = {
            "title": "Hugo's Task",
            "groupId": test_group_id
        }
        response = requests.post(f"{BASE_URL}/tasks", 
                                headers={
                                    "Authorization": f"Bearer {tokens['hugo']}",
                                    "X-Workspace-Id": workspace_id
                                }, 
                                json=task_data, 
                                timeout=10)
        if response.status_code == 200:
            hugo_task_id = response.json()["id"]
            # Hugo should be able to delete his own task
            response = requests.delete(f"{BASE_URL}/tasks/{hugo_task_id}", 
                                      headers={
                                          "Authorization": f"Bearer {tokens['hugo']}",
                                          "X-Workspace-Id": workspace_id
                                      }, 
                                      timeout=10)
            if response.status_code == 200:
                log_test("DELETE /tasks/:id (member deletes own task)", True)
            else:
                log_test("DELETE /tasks/:id (member deletes own task)", False, f"Status {response.status_code}")
        else:
            log_test("DELETE /tasks/:id (member deletes own task)", False, "Could not create task")
    except Exception as e:
        log_test("DELETE /tasks/:id (member deletes own task)", False, str(e))
    
    # Member cannot delete other's tasks
    try:
        if "test_task_id" in globals():
            response = requests.delete(f"{BASE_URL}/tasks/{test_task_id}", 
                                      headers={
                                          "Authorization": f"Bearer {tokens['hugo']}",
                                          "X-Workspace-Id": workspace_id
                                      }, 
                                      timeout=10)
            if response.status_code == 403:
                log_test("DELETE /tasks/:id (member deletes other's task, should fail)", True)
            else:
                log_test("DELETE /tasks/:id (member deletes other's task, should fail)", False, f"Expected 403, got {response.status_code}")
        else:
            log_test("DELETE /tasks/:id (member deletes other's task)", False, "No test_task_id")
    except Exception as e:
        log_test("DELETE /tasks/:id (member deletes other's task)", False, str(e))
    
    # Admin can delete any task
    try:
        if "test_task_id" in globals():
            response = requests.delete(f"{BASE_URL}/tasks/{test_task_id}", 
                                      headers={
                                          "Authorization": f"Bearer {tokens['admin']}",
                                          "X-Workspace-Id": workspace_id
                                      }, 
                                      timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("softDeleted"):
                    log_test("DELETE /tasks/:id (admin, soft delete)", True)
                else:
                    log_test("DELETE /tasks/:id (admin, soft delete)", False, "Not soft deleted")
            else:
                log_test("DELETE /tasks/:id (admin)", False, f"Status {response.status_code}")
        else:
            log_test("DELETE /tasks/:id (admin)", False, "No test_task_id")
    except Exception as e:
        log_test("DELETE /tasks/:id (admin)", False, str(e))
    
    # Test POST /tasks/:id/restore (admin only)
    try:
        if "test_task_id" in globals():
            response = requests.post(f"{BASE_URL}/tasks/{test_task_id}/restore", 
                                    headers={
                                        "Authorization": f"Bearer {tokens['admin']}",
                                        "X-Workspace-Id": workspace_id
                                    }, 
                                    timeout=10)
            if response.status_code == 200:
                log_test("POST /tasks/:id/restore (admin)", True)
            else:
                log_test("POST /tasks/:id/restore (admin)", False, f"Status {response.status_code}")
        else:
            log_test("POST /tasks/:id/restore", False, "No test_task_id")
    except Exception as e:
        log_test("POST /tasks/:id/restore", False, str(e))


def test_calendar():
    """Test calendar endpoint"""
    print("\n=== 5. CALENDAR TESTS ===")
    
    if not workspace_id or "admin" not in tokens:
        log_test("Calendar tests", False, "Missing workspace_id or admin token")
        return
    
    # Test GET /calendar
    try:
        from_date = datetime.now().isoformat()
        to_date = (datetime.now() + timedelta(days=30)).isoformat()
        response = requests.get(f"{BASE_URL}/calendar?from={from_date}&to={to_date}&scope=group", 
                               headers={
                                   "Authorization": f"Bearer {tokens['admin']}",
                                   "X-Workspace-Id": workspace_id
                               }, 
                               timeout=10)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                log_test("GET /calendar", True)
            else:
                log_test("GET /calendar", False, "Response not a list")
        else:
            log_test("GET /calendar", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("GET /calendar", False, str(e))


def test_chat():
    """Test chat endpoints"""
    print("\n=== 6. CHAT TESTS ===")
    
    if not workspace_id or "admin" not in tokens:
        log_test("Chat tests", False, "Missing workspace_id or admin token")
        return
    
    # Test GET /channels
    try:
        response = requests.get(f"{BASE_URL}/channels", 
                               headers={
                                   "Authorization": f"Bearer {tokens['admin']}",
                                   "X-Workspace-Id": workspace_id
                               }, 
                               timeout=10)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                log_test("GET /channels", True)
                if data:
                    global test_channel_id, chefs_channel_id, communication_channel_id
                    # Find specific channels
                    for ch in data:
                        if ch["name"] == "general":
                            test_channel_id = ch["id"]
                        elif ch["name"] == "chefs":
                            chefs_channel_id = ch["id"]
                        elif ch["type"] == "group" and "communication" in ch["name"].lower():
                            communication_channel_id = ch["id"]
            else:
                log_test("GET /channels", False, "Response not a list")
        else:
            log_test("GET /channels", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("GET /channels", False, str(e))
    
    # Test GET /channels/:id/messages
    try:
        if "test_channel_id" in globals():
            response = requests.get(f"{BASE_URL}/channels/{test_channel_id}/messages", 
                                   headers={
                                       "Authorization": f"Bearer {tokens['admin']}",
                                       "X-Workspace-Id": workspace_id
                                   }, 
                                   timeout=10)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    log_test("GET /channels/:id/messages", True)
                else:
                    log_test("GET /channels/:id/messages", False, "Response not a list")
            else:
                log_test("GET /channels/:id/messages", False, f"Status {response.status_code}")
        else:
            log_test("GET /channels/:id/messages", False, "No test_channel_id")
    except Exception as e:
        log_test("GET /channels/:id/messages", False, str(e))
    
    # Test POST /channels/:id/messages
    try:
        if "test_channel_id" in globals():
            response = requests.post(f"{BASE_URL}/channels/{test_channel_id}/messages", 
                                    headers={
                                        "Authorization": f"Bearer {tokens['admin']}",
                                        "X-Workspace-Id": workspace_id
                                    }, 
                                    json={"content": "Test message"}, 
                                    timeout=10)
            if response.status_code == 200:
                log_test("POST /channels/:id/messages", True)
            else:
                log_test("POST /channels/:id/messages", False, f"Status {response.status_code}")
        else:
            log_test("POST /channels/:id/messages", False, "No test_channel_id")
    except Exception as e:
        log_test("POST /channels/:id/messages", False, str(e))
    
    # Test mention notification
    try:
        if "test_channel_id" in globals():
            response = requests.post(f"{BASE_URL}/channels/{test_channel_id}/messages", 
                                    headers={
                                        "Authorization": f"Bearer {tokens['admin']}",
                                        "X-Workspace-Id": workspace_id
                                    }, 
                                    json={"content": "Hey @Jules check this out"}, 
                                    timeout=10)
            if response.status_code == 200:
                log_test("POST /channels/:id/messages (with mention)", True)
            else:
                log_test("POST /channels/:id/messages (with mention)", False, f"Status {response.status_code}")
        else:
            log_test("POST /channels/:id/messages (with mention)", False, "No test_channel_id")
    except Exception as e:
        log_test("POST /channels/:id/messages (with mention)", False, str(e))
    
    # Test non-leader access to #chefs channel (Hugo should be denied)
    try:
        if "chefs_channel_id" in globals() and "hugo" in tokens:
            response = requests.post(f"{BASE_URL}/channels/{chefs_channel_id}/messages", 
                                    headers={
                                        "Authorization": f"Bearer {tokens['hugo']}",
                                        "X-Workspace-Id": workspace_id
                                    }, 
                                    json={"content": "Test"}, 
                                    timeout=10)
            if response.status_code == 403:
                log_test("POST to #chefs as non-leader (should fail)", True)
            else:
                log_test("POST to #chefs as non-leader (should fail)", False, f"Expected 403, got {response.status_code}")
        else:
            log_test("POST to #chefs as non-leader", False, "Missing channel or token")
    except Exception as e:
        log_test("POST to #chefs as non-leader", False, str(e))
    
    # Test Sofie (Logistique leader) access to Communication channel (should be denied)
    try:
        if "communication_channel_id" in globals() and "sofie" in tokens:
            response = requests.post(f"{BASE_URL}/channels/{communication_channel_id}/messages", 
                                    headers={
                                        "Authorization": f"Bearer {tokens['sofie']}",
                                        "X-Workspace-Id": workspace_id
                                    }, 
                                    json={"content": "Test"}, 
                                    timeout=10)
            if response.status_code == 403:
                log_test("POST to #communication as Sofie (should fail)", True)
            else:
                log_test("POST to #communication as Sofie (should fail)", False, f"Expected 403, got {response.status_code}")
        else:
            log_test("POST to #communication as Sofie", False, "Missing channel or token")
    except Exception as e:
        log_test("POST to #communication as Sofie", False, str(e))


def test_notifications():
    """Test notification endpoints"""
    print("\n=== 7. NOTIFICATIONS TESTS ===")
    
    if not workspace_id or "jules" not in tokens:
        log_test("Notifications tests", False, "Missing workspace_id or jules token")
        return
    
    # Test GET /notifications
    try:
        response = requests.get(f"{BASE_URL}/notifications", 
                               headers={
                                   "Authorization": f"Bearer {tokens['jules']}",
                                   "X-Workspace-Id": workspace_id
                               }, 
                               timeout=10)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                log_test("GET /notifications", True)
                if data:
                    global test_notification_id
                    test_notification_id = data[0]["id"]
            else:
                log_test("GET /notifications", False, "Response not a list")
        else:
            log_test("GET /notifications", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("GET /notifications", False, str(e))
    
    # Test POST /notifications/mark-read (single)
    try:
        if "test_notification_id" in globals():
            response = requests.post(f"{BASE_URL}/notifications/mark-read", 
                                    headers={
                                        "Authorization": f"Bearer {tokens['jules']}",
                                        "X-Workspace-Id": workspace_id
                                    }, 
                                    json={"id": test_notification_id}, 
                                    timeout=10)
            if response.status_code == 200:
                log_test("POST /notifications/mark-read (single)", True)
            else:
                log_test("POST /notifications/mark-read (single)", False, f"Status {response.status_code}")
        else:
            log_test("POST /notifications/mark-read (single)", False, "No test_notification_id")
    except Exception as e:
        log_test("POST /notifications/mark-read (single)", False, str(e))
    
    # Test POST /notifications/mark-read (all)
    try:
        response = requests.post(f"{BASE_URL}/notifications/mark-read", 
                                headers={
                                    "Authorization": f"Bearer {tokens['jules']}",
                                    "X-Workspace-Id": workspace_id
                                }, 
                                json={}, 
                                timeout=10)
        if response.status_code == 200:
            log_test("POST /notifications/mark-read (all)", True)
        else:
            log_test("POST /notifications/mark-read (all)", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("POST /notifications/mark-read (all)", False, str(e))


def test_pilot():
    """Test pilot endpoint"""
    print("\n=== 8. PILOT TESTS ===")
    
    if not workspace_id or "admin" not in tokens:
        log_test("Pilot tests", False, "Missing workspace_id or admin token")
        return
    
    # Test GET /pilot as admin
    try:
        response = requests.get(f"{BASE_URL}/pilot", 
                               headers={
                                   "Authorization": f"Bearer {tokens['admin']}",
                                   "X-Workspace-Id": workspace_id
                               }, 
                               timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "kpis" in data and "byGroup" in data and "byMember" in data:
                log_test("GET /pilot (admin)", True)
            else:
                log_test("GET /pilot (admin)", False, "Missing expected fields")
        else:
            log_test("GET /pilot (admin)", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("GET /pilot (admin)", False, str(e))
    
    # Test GET /pilot as non-privileged user (should fail)
    try:
        if "hugo" in tokens:
            response = requests.get(f"{BASE_URL}/pilot", 
                                   headers={
                                       "Authorization": f"Bearer {tokens['hugo']}",
                                       "X-Workspace-Id": workspace_id
                                   }, 
                                   timeout=10)
            if response.status_code == 403:
                log_test("GET /pilot (non-privileged, should fail)", True)
            else:
                log_test("GET /pilot (non-privileged, should fail)", False, f"Expected 403, got {response.status_code}")
        else:
            log_test("GET /pilot (non-privileged)", False, "No hugo token")
    except Exception as e:
        log_test("GET /pilot (non-privileged)", False, str(e))


def test_dashboard():
    """Test dashboard endpoint"""
    print("\n=== 9. DASHBOARD TESTS ===")
    
    if not workspace_id or "admin" not in tokens:
        log_test("Dashboard tests", False, "Missing workspace_id or admin token")
        return
    
    # Test GET /dashboard
    try:
        response = requests.get(f"{BASE_URL}/dashboard", 
                               headers={
                                   "Authorization": f"Bearer {tokens['admin']}",
                                   "X-Workspace-Id": workspace_id
                               }, 
                               timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "stats" in data and "upcoming" in data:
                log_test("GET /dashboard", True)
            else:
                log_test("GET /dashboard", False, "Missing expected fields")
        else:
            log_test("GET /dashboard", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("GET /dashboard", False, str(e))


def test_validation_queue():
    """Test validation queue endpoint"""
    print("\n=== 10. VALIDATION QUEUE TESTS ===")
    
    if not workspace_id or "admin" not in tokens:
        log_test("Validation queue tests", False, "Missing workspace_id or admin token")
        return
    
    # Test GET /validation-queue as admin
    try:
        response = requests.get(f"{BASE_URL}/validation-queue", 
                               headers={
                                   "Authorization": f"Bearer {tokens['admin']}",
                                   "X-Workspace-Id": workspace_id
                               }, 
                               timeout=10)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                log_test("GET /validation-queue (admin)", True)
            else:
                log_test("GET /validation-queue (admin)", False, "Response not a list")
        else:
            log_test("GET /validation-queue (admin)", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("GET /validation-queue (admin)", False, str(e))
    
    # Test GET /validation-queue as leader
    try:
        if "jules" in tokens:
            response = requests.get(f"{BASE_URL}/validation-queue", 
                                   headers={
                                       "Authorization": f"Bearer {tokens['jules']}",
                                       "X-Workspace-Id": workspace_id
                                   }, 
                                   timeout=10)
            if response.status_code == 200:
                log_test("GET /validation-queue (leader)", True)
            else:
                log_test("GET /validation-queue (leader)", False, f"Status {response.status_code}")
        else:
            log_test("GET /validation-queue (leader)", False, "No jules token")
    except Exception as e:
        log_test("GET /validation-queue (leader)", False, str(e))
    
    # Test GET /validation-queue as member (should fail)
    try:
        if "hugo" in tokens:
            response = requests.get(f"{BASE_URL}/validation-queue", 
                                   headers={
                                       "Authorization": f"Bearer {tokens['hugo']}",
                                       "X-Workspace-Id": workspace_id
                                   }, 
                                   timeout=10)
            if response.status_code == 403:
                log_test("GET /validation-queue (member, should fail)", True)
            else:
                log_test("GET /validation-queue (member, should fail)", False, f"Expected 403, got {response.status_code}")
        else:
            log_test("GET /validation-queue (member)", False, "No hugo token")
    except Exception as e:
        log_test("GET /validation-queue (member)", False, str(e))


def test_security():
    """Test security scenarios"""
    print("\n=== 11. SECURITY TESTS ===")
    
    # Test no token (401)
    try:
        response = requests.get(f"{BASE_URL}/tasks", timeout=10)
        if response.status_code == 401:
            log_test("No token → 401", True)
        else:
            log_test("No token → 401", False, f"Expected 401, got {response.status_code}")
    except Exception as e:
        log_test("No token → 401", False, str(e))
    
    # Test wrong workspace ID (403)
    try:
        if "admin" in tokens:
            response = requests.get(f"{BASE_URL}/tasks", 
                                   headers={
                                       "Authorization": f"Bearer {tokens['admin']}",
                                       "X-Workspace-Id": "wrong-workspace-id"
                                   }, 
                                   timeout=10)
            if response.status_code == 403:
                log_test("Wrong workspace ID → 403", True)
            else:
                log_test("Wrong workspace ID → 403", False, f"Expected 403, got {response.status_code}")
        else:
            log_test("Wrong workspace ID → 403", False, "No admin token")
    except Exception as e:
        log_test("Wrong workspace ID → 403", False, str(e))
    
    # Test random task ID (404)
    try:
        if "admin" in tokens and workspace_id:
            response = requests.get(f"{BASE_URL}/tasks/random-nonexistent-id", 
                                   headers={
                                       "Authorization": f"Bearer {tokens['admin']}",
                                       "X-Workspace-Id": workspace_id
                                   }, 
                                   timeout=10)
            if response.status_code == 404:
                log_test("Random task ID → 404", True)
            else:
                log_test("Random task ID → 404", False, f"Expected 404, got {response.status_code}")
        else:
            log_test("Random task ID → 404", False, "Missing tokens or workspace_id")
    except Exception as e:
        log_test("Random task ID → 404", False, str(e))
    
    # Test bad payload (400)
    try:
        if "admin" in tokens and workspace_id:
            response = requests.post(f"{BASE_URL}/tasks", 
                                    headers={
                                        "Authorization": f"Bearer {tokens['admin']}",
                                        "X-Workspace-Id": workspace_id
                                    }, 
                                    json={}, 
                                    timeout=10)
            if response.status_code == 400:
                log_test("Bad payload → 400", True)
            else:
                log_test("Bad payload → 400", False, f"Expected 400, got {response.status_code}")
        else:
            log_test("Bad payload → 400", False, "Missing tokens or workspace_id")
    except Exception as e:
        log_test("Bad payload → 400", False, str(e))


def main():
    """Run all tests"""
    print("=" * 60)
    print("WHATODO BACKEND API COMPREHENSIVE TESTS")
    print("=" * 60)
    
    test_auth()
    test_workspaces()
    test_members()
    test_tasks()
    test_calendar()
    test_chat()
    test_notifications()
    test_pilot()
    test_dashboard()
    test_validation_queue()
    test_security()
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"✅ Passed: {test_results['passed']}")
    print(f"❌ Failed: {test_results['failed']}")
    print(f"Total: {test_results['passed'] + test_results['failed']}")
    
    if test_results["errors"]:
        print("\n" + "=" * 60)
        print("FAILED TESTS:")
        print("=" * 60)
        for error in test_results["errors"]:
            print(f"  • {error}")
    
    print("\n" + "=" * 60)
    
    # Exit with appropriate code
    sys.exit(0 if test_results["failed"] == 0 else 1)


if __name__ == "__main__":
    main()
