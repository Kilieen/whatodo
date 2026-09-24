#!/usr/bin/env python3
"""
Comprehensive end-to-end backend API tests for Whatodo multi-workspace platform.
Tests all endpoints with fresh user registration (NO seed data).
Follows the exact test scenario from Phases A-G.
"""

import os
import requests
import json
import sys
from datetime import datetime, timedelta

# Base URL
BASE_URL = os.environ.get("WHATODO_TEST_BASE_URL", "http://127.0.0.1:3000/api")

# Global state
state = {
    "users": {},  # {name: {email, password, token, id}}
    "workspaces": {},  # {name: {id, inviteCode, ...}}
    "groups": {},  # {name: {id, ...}}
    "tasks": {},  # {name: {id, ...}}
    "invitations": {},  # {name: {id, token, ...}}
    "channels": {},  # {name: {id, ...}}
}

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


def req(method, path, token=None, workspace_id=None, json_data=None, params=None):
    """Helper to make API requests"""
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if workspace_id:
        headers["X-Workspace-Id"] = workspace_id
    
    url = f"{BASE_URL}{path}"
    try:
        if method == "GET":
            return requests.get(url, headers=headers, params=params, timeout=30)
        elif method == "POST":
            return requests.post(url, headers=headers, json=json_data, timeout=30)
        elif method == "PATCH":
            return requests.patch(url, headers=headers, json=json_data, timeout=30)
        elif method == "DELETE":
            return requests.delete(url, headers=headers, timeout=30)
    except requests.exceptions.Timeout:
        print(f"    ⚠️  Timeout on {method} {path}")
        return None
    except Exception as e:
        print(f"    ⚠️  Error on {method} {path}: {str(e)}")
        return None


def phase_a_auth():
    """PHASE A — Auth (no workspace header)"""
    print("\n" + "="*60)
    print("PHASE A — AUTH TESTS")
    print("="*60)
    
    # 1. Register user A
    try:
        email_a = f"alice_{int(datetime.now().timestamp())}@test.com"
        resp = req("POST", "/auth/register", json_data={
            "email": email_a,
            "password": "password123",
            "firstName": "Alice",
            "lastName": "Anderson"
        })
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            if "token" in data and "user" in data:
                state["users"]["A"] = {
                    "email": email_a,
                    "password": "password123",
                    "token": data["token"],
                    "id": data["user"]["id"]
                }
                log_test("1. Register user A", True)
            else:
                log_test("1. Register user A", False, "Missing token or user")
        else:
            log_test("1. Register user A", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("1. Register user A", False, str(e))
    
    # 2. Register with SAME email → 400
    try:
        resp = req("POST", "/auth/register", json_data={
            "email": state["users"]["A"]["email"],
            "password": "password123",
            "firstName": "Alice"
        })
        if resp is not None and resp.status_code == 400:
            log_test("2. Register duplicate email → 400", True)
        else:
            log_test("2. Register duplicate email → 400", False, f"Expected 400, got {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("2. Register duplicate email", False, str(e))
    
    # 3. Register with short password → 400
    try:
        resp = req("POST", "/auth/register", json_data={
            "email": "short@test.com",
            "password": "12345",
            "firstName": "Short"
        })
        if resp is not None and resp.status_code == 400:
            log_test("3. Register short password → 400", True)
        else:
            log_test("3. Register short password → 400", False, f"Expected 400, got {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("3. Register short password", False, str(e))
    
    # 4. Register with invalid email → 400
    try:
        resp = req("POST", "/auth/register", json_data={
            "email": "foo",
            "password": "password123",
            "firstName": "Foo"
        })
        if resp is not None and resp.status_code == 400:
            log_test("4. Register invalid email → 400", True)
        else:
            log_test("4. Register invalid email → 400", False, f"Expected 400, got {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("4. Register invalid email", False, str(e))
    
    # 5. Login with wrong password → 401
    try:
        resp = req("POST", "/auth/login", json_data={
            "email": state["users"]["A"]["email"],
            "password": "wrongpassword"
        })
        if resp is not None and resp.status_code == 401:
            log_test("5. Login wrong password → 401", True)
        else:
            log_test("5. Login wrong password → 401", False, f"Expected 401, got {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("5. Login wrong password", False, str(e))
    
    # 6. Login with correct password → 200
    try:
        resp = req("POST", "/auth/login", json_data={
            "email": state["users"]["A"]["email"],
            "password": "password123"
        })
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            if "token" in data:
                log_test("6. Login correct password → 200", True)
            else:
                log_test("6. Login correct password", False, "Missing token")
        else:
            log_test("6. Login correct password", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("6. Login correct password", False, str(e))
    
    # 7. GET /auth/me → workspaces: []
    try:
        resp = req("GET", "/auth/me", token=state["users"]["A"]["token"])
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            if "user" in data and "workspaces" in data:
                if len(data["workspaces"]) == 0:
                    log_test("7. GET /auth/me → workspaces: []", True)
                else:
                    log_test("7. GET /auth/me", False, f"Expected empty workspaces, got {len(data['workspaces'])}")
            else:
                log_test("7. GET /auth/me", False, "Missing user or workspaces")
        else:
            log_test("7. GET /auth/me", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("7. GET /auth/me", False, str(e))
    
    # 8. PATCH /auth/me with profile updates
    try:
        resp = req("PATCH", "/auth/me", token=state["users"]["A"]["token"], json_data={
            "firstName": "Alice",
            "timezone": "Europe/Paris",
            "notifPrefs": {"mentions": False},
            "tutorialSeen": True
        })
        if resp is not None and resp.status_code == 200:
            log_test("8. PATCH /auth/me → 200", True)
        else:
            log_test("8. PATCH /auth/me", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("8. PATCH /auth/me", False, str(e))
    
    # 9. GET /auth/me again → verify updated fields
    try:
        resp = req("GET", "/auth/me", token=state["users"]["A"]["token"])
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            user = data.get("user", {})
            if user.get("timezone") == "Europe/Paris" and user.get("tutorialSeen") == True:
                log_test("9. GET /auth/me verify updates", True)
            else:
                log_test("9. GET /auth/me verify updates", False, "Fields not updated")
        else:
            log_test("9. GET /auth/me verify updates", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("9. GET /auth/me verify updates", False, str(e))
    
    # 10. POST /auth/change-password
    try:
        resp = req("POST", "/auth/change-password", token=state["users"]["A"]["token"], json_data={
            "currentPassword": "password123",
            "newPassword": "newSecret9!"
        })
        if resp is not None and resp.status_code == 200:
            state["users"]["A"]["password"] = "newSecret9!"
            log_test("10. POST /auth/change-password → 200", True)
        else:
            log_test("10. POST /auth/change-password", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("10. POST /auth/change-password", False, str(e))
    
    # 11. Login with OLD password → 401
    try:
        resp = req("POST", "/auth/login", json_data={
            "email": state["users"]["A"]["email"],
            "password": "password123"
        })
        if resp is not None and resp.status_code == 401:
            log_test("11. Login old password → 401", True)
        else:
            log_test("11. Login old password → 401", False, f"Expected 401, got {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("11. Login old password", False, str(e))
    
    # 12. Login with NEW password → 200
    try:
        resp = req("POST", "/auth/login", json_data={
            "email": state["users"]["A"]["email"],
            "password": "newSecret9!"
        })
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            if "token" in data:
                state["users"]["A"]["token"] = data["token"]
                log_test("12. Login new password → 200", True)
            else:
                log_test("12. Login new password", False, "Missing token")
        else:
            log_test("12. Login new password", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("12. Login new password", False, str(e))
    
    # 13. Change password with wrong current → 401
    try:
        resp = req("POST", "/auth/change-password", token=state["users"]["A"]["token"], json_data={
            "currentPassword": "wrongpassword",
            "newPassword": "another123"
        })
        if resp is not None and resp.status_code == 401:
            log_test("13. Change password wrong current → 401", True)
        else:
            log_test("13. Change password wrong current → 401", False, f"Expected 401, got {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("13. Change password wrong current", False, str(e))
    
    # 14. Forgot password with unknown email → 200 (no enumeration)
    try:
        resp = req("POST", "/auth/forgot-password", json_data={
            "email": "unknown@x.com"
        })
        if resp is not None and resp.status_code == 200:
            log_test("14. Forgot password unknown email → 200", True)
        else:
            log_test("14. Forgot password unknown email", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("14. Forgot password unknown email", False, str(e))
    
    # 15. Forgot password with A's email → 200
    try:
        resp = req("POST", "/auth/forgot-password", json_data={
            "email": state["users"]["A"]["email"]
        })
        if resp is not None and resp.status_code == 200:
            log_test("15. Forgot password A's email → 200", True)
        else:
            log_test("15. Forgot password A's email", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("15. Forgot password A's email", False, str(e))


def phase_b_workspaces():
    """PHASE B — Workspaces"""
    print("\n" + "="*60)
    print("PHASE B — WORKSPACES TESTS")
    print("="*60)
    
    # 16. GET /workspaces → []
    try:
        resp = req("GET", "/workspaces", token=state["users"]["A"]["token"])
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) == 0:
                log_test("16. GET /workspaces → []", True)
            else:
                log_test("16. GET /workspaces", False, f"Expected empty list, got {len(data)} items")
        else:
            log_test("16. GET /workspaces", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("16. GET /workspaces", False, str(e))
    
    # 17. POST /workspaces (create WS1)
    try:
        resp = req("POST", "/workspaces", token=state["users"]["A"]["token"], json_data={
            "name": "Alpha",
            "description": "Team A",
            "emoji": "🚀",
            "color": "#3b82f6",
            "groups": [{"name": "Design"}, {"name": "Dev"}],
            "firstTask": {"title": "Kickoff"}
        })
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            if "id" in data and "inviteCode" in data and data.get("myRole") == "owner":
                state["workspaces"]["WS1"] = {
                    "id": data["id"],
                    "inviteCode": data["inviteCode"],
                    "name": data["name"]
                }
                log_test("17. POST /workspaces (create WS1) → 200", True)
            else:
                log_test("17. POST /workspaces", False, "Missing id/inviteCode/myRole")
        else:
            log_test("17. POST /workspaces", False, f"Status {resp.status_code if resp else 'timeout'}: {resp.text if resp else ''}")
    except Exception as e:
        log_test("17. POST /workspaces", False, str(e))
    
    # 18. GET /workspaces → [WS1]
    try:
        resp = req("GET", "/workspaces", token=state["users"]["A"]["token"])
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) == 1 and data[0].get("memberCount") == 1:
                log_test("18. GET /workspaces → [WS1] memberCount=1", True)
            else:
                log_test("18. GET /workspaces", False, f"Expected 1 workspace, got {len(data)}")
        else:
            log_test("18. GET /workspaces", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("18. GET /workspaces", False, str(e))
    
    # 19. GET /workspace (with X-Workspace-Id)
    try:
        resp = req("GET", "/workspace", token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            if "members" in data and len(data["members"]) == 1:
                log_test("19. GET /workspace → members: [A]", True)
            else:
                log_test("19. GET /workspace", False, "Missing members or wrong count")
        else:
            log_test("19. GET /workspace", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("19. GET /workspace", False, str(e))
    
    # 20. GET /groups → Design and Dev
    try:
        resp = req("GET", "/groups", token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            group_names = [g["name"] for g in data]
            if "Design" in group_names and "Dev" in group_names:
                # Store group IDs
                for g in data:
                    if g["name"] == "Design":
                        state["groups"]["Design"] = {"id": g["id"], "name": g["name"]}
                    elif g["name"] == "Dev":
                        state["groups"]["Dev"] = {"id": g["id"], "name": g["name"]}
                log_test("20. GET /groups → Design and Dev", True)
            else:
                log_test("20. GET /groups", False, f"Expected Design and Dev, got {group_names}")
        else:
            log_test("20. GET /groups", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("20. GET /groups", False, str(e))
    
    # 21. GET /tasks?scope=visible → Kickoff task
    try:
        resp = req("GET", "/tasks", token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"], params={"scope": "visible"})
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            kickoff_found = any(t.get("title") == "Kickoff" for t in data)
            if kickoff_found:
                state["tasks"]["Kickoff"] = {"id": next(t["id"] for t in data if t.get("title") == "Kickoff")}
                log_test("21. GET /tasks → Kickoff task found", True)
            else:
                log_test("21. GET /tasks", False, "Kickoff task not found")
        else:
            log_test("21. GET /tasks", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("21. GET /tasks", False, str(e))
    
    # 22. Register user B and join WS1
    try:
        email_b = f"bob_{int(datetime.now().timestamp())}@test.com"
        resp = req("POST", "/auth/register", json_data={
            "email": email_b,
            "password": "password123",
            "firstName": "Bob"
        })
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            state["users"]["B"] = {
                "email": email_b,
                "password": "password123",
                "token": data["token"],
                "id": data["user"]["id"]
            }
            # Join WS1
            resp2 = req("POST", "/workspaces/join", token=state["users"]["B"]["token"], json_data={
                "inviteCode": state["workspaces"]["WS1"]["inviteCode"]
            })
            if resp2 is not None and resp2.status_code == 200:
                data2 = resp2.json()
                if data2.get("joined") == True:
                    log_test("22. Register B + join WS1 → 200", True)
                else:
                    log_test("22. Register B + join WS1", False, "joined != true")
            else:
                log_test("22. Register B + join WS1", False, f"Join status {resp2.status_code if resp2 else 'timeout'}")
        else:
            log_test("22. Register B", False, f"Register status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("22. Register B + join WS1", False, str(e))
    
    # 23. GET /workspaces as B → myRole: member
    try:
        resp = req("GET", "/workspaces", token=state["users"]["B"]["token"])
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            ws1 = next((w for w in data if w["id"] == state["workspaces"]["WS1"]["id"]), None)
            if ws1 and ws1.get("myRole") == "member":
                log_test("23. GET /workspaces as B → myRole: member", True)
            else:
                log_test("23. GET /workspaces as B", False, f"myRole = {ws1.get('myRole') if ws1 else 'not found'}")
        else:
            log_test("23. GET /workspaces as B", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("23. GET /workspaces as B", False, str(e))
    
    # 24. Regenerate code, try old code → 404
    try:
        old_code = state["workspaces"]["WS1"]["inviteCode"]
        resp = req("POST", "/workspace/regenerate-code", token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            new_code = data.get("inviteCode")
            if new_code and new_code != old_code:
                state["workspaces"]["WS1"]["inviteCode"] = new_code
                # Try joining with old code
                resp2 = req("POST", "/workspaces/join", token=state["users"]["B"]["token"], json_data={
                    "inviteCode": old_code
                })
                if resp2 is not None and resp2.status_code == 404:
                    log_test("24. Regenerate code + old code → 404", True)
                else:
                    log_test("24. Regenerate code + old code", False, f"Expected 404, got {resp2.status_code if resp2 else 'timeout'}")
            else:
                log_test("24. Regenerate code", False, "New code same as old or missing")
        else:
            log_test("24. Regenerate code", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("24. Regenerate code", False, str(e))
    
    # 25. PATCH /workspace as A
    try:
        resp = req("PATCH", "/workspace", token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"], json_data={
            "name": "Alpha 2",
            "emoji": "🌟"
        })
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            if data.get("name") == "Alpha 2" and data.get("emoji") == "🌟":
                log_test("25. PATCH /workspace as A → 200", True)
            else:
                log_test("25. PATCH /workspace as A", False, "Fields not updated")
        else:
            log_test("25. PATCH /workspace as A", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("25. PATCH /workspace as A", False, str(e))
    
    # 26. PATCH /workspace as B (not admin) → 403
    try:
        resp = req("PATCH", "/workspace", token=state["users"]["B"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"], json_data={
            "name": "Hacked"
        })
        if resp is not None and resp.status_code == 403:
            log_test("26. PATCH /workspace as B → 403", True)
        else:
            log_test("26. PATCH /workspace as B", False, f"Expected 403, got {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("26. PATCH /workspace as B", False, str(e))


def phase_c_invitations():
    """PHASE C — Invitations"""
    print("\n" + "="*60)
    print("PHASE C — INVITATIONS TESTS")
    print("="*60)
    
    # 27. Create invitation as A
    try:
        resp = req("POST", "/workspace/invitations", token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"], json_data={
            "role": "leader",
            "expiresInDays": 7
        })
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            if "token" in data and "id" in data:
                state["invitations"]["INV1"] = {
                    "id": data["id"],
                    "token": data["token"]
                }
                log_test("27. POST /workspace/invitations → 200", True)
            else:
                log_test("27. POST /workspace/invitations", False, "Missing token or id")
        else:
            log_test("27. POST /workspace/invitations", False, f"Status {resp.status_code if resp else 'timeout'}: {resp.text if resp else ''}")
    except Exception as e:
        log_test("27. POST /workspace/invitations", False, str(e))
    
    # 28. Register user C and join via invitation token
    try:
        email_c = f"charlie_{int(datetime.now().timestamp())}@test.com"
        resp = req("POST", "/auth/register", json_data={
            "email": email_c,
            "password": "password123",
            "firstName": "Charlie"
        })
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            state["users"]["C"] = {
                "email": email_c,
                "password": "password123",
                "token": data["token"],
                "id": data["user"]["id"]
            }
            # Join via invitation token
            resp2 = req("POST", "/workspaces/join", token=state["users"]["C"]["token"], json_data={
                "inviteCode": state["invitations"]["INV1"]["token"]
            })
            if resp2 is not None and resp2.status_code == 200:
                data2 = resp2.json()
                if data2.get("joined") == True:
                    # Verify C has leader role
                    resp3 = req("GET", "/workspaces", token=state["users"]["C"]["token"])
                    if resp3 is not None and resp3.status_code == 200:
                        ws_list = resp3.json()
                        ws1 = next((w for w in ws_list if w["id"] == state["workspaces"]["WS1"]["id"]), None)
                        if ws1 and ws1.get("myRole") == "leader":
                            log_test("28. Register C + join via INV1 → role=leader", True)
                        else:
                            log_test("28. Register C + join via INV1", False, f"Role = {ws1.get('myRole') if ws1 else 'not found'}")
                    else:
                        log_test("28. Register C + join via INV1", False, "Could not verify role")
                else:
                    log_test("28. Register C + join via INV1", False, "joined != true")
            else:
                log_test("28. Register C + join via INV1", False, f"Join status {resp2.status_code if resp2 else 'timeout'}")
        else:
            log_test("28. Register C", False, f"Register status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("28. Register C + join via INV1", False, str(e))
    
    # 29. GET /workspace/invitations → contains INV1 with uses=1
    try:
        resp = req("GET", "/workspace/invitations", token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            inv1 = next((i for i in data if i["id"] == state["invitations"]["INV1"]["id"]), None)
            if inv1 and inv1.get("uses") == 1:
                log_test("29. GET /workspace/invitations → INV1 uses=1", True)
            else:
                log_test("29. GET /workspace/invitations", False, f"INV1 uses = {inv1.get('uses') if inv1 else 'not found'}")
        else:
            log_test("29. GET /workspace/invitations", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("29. GET /workspace/invitations", False, str(e))
    
    # 30. DELETE invitation, try joining → 404
    try:
        resp = req("DELETE", f"/workspace/invitations/{state['invitations']['INV1']['id']}", 
                  token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            # Try joining with deleted invitation
            email_d = f"dave_{int(datetime.now().timestamp())}@test.com"
            resp2 = req("POST", "/auth/register", json_data={
                "email": email_d,
                "password": "password123",
                "firstName": "Dave"
            })
            if resp2 is not None and resp2.status_code == 200:
                token_d = resp2.json()["token"]
                resp3 = req("POST", "/workspaces/join", token=token_d, json_data={
                    "inviteCode": state["invitations"]["INV1"]["token"]
                })
                if resp3 is not None and resp3.status_code == 404:
                    log_test("30. DELETE invitation + join → 404", True)
                else:
                    log_test("30. DELETE invitation + join", False, f"Expected 404, got {resp3.status_code if resp3 else 'timeout'}")
            else:
                log_test("30. DELETE invitation + join", False, "Could not register test user")
        else:
            log_test("30. DELETE invitation", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("30. DELETE invitation", False, str(e))
    
    # 31. POST /workspace/invitations as B (not admin) → 403
    try:
        resp = req("POST", "/workspace/invitations", token=state["users"]["B"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"], json_data={
            "role": "member"
        })
        if resp is not None and resp.status_code == 403:
            log_test("31. POST /workspace/invitations as B → 403", True)
        else:
            log_test("31. POST /workspace/invitations as B", False, f"Expected 403, got {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("31. POST /workspace/invitations as B", False, str(e))


def phase_d_members_groups_tasks():
    """PHASE D — Members / Groups / Tasks"""
    print("\n" + "="*60)
    print("PHASE D — MEMBERS / GROUPS / TASKS TESTS")
    print("="*60)
    
    # 32. GET /workspace/members → A (owner), B (member), C (leader)
    try:
        resp = req("GET", "/workspace/members", token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            roles = {m["userId"]: m["role"] for m in data}
            if (roles.get(state["users"]["A"]["id"]) == "owner" and 
                roles.get(state["users"]["B"]["id"]) == "member" and 
                roles.get(state["users"]["C"]["id"]) == "leader"):
                # Store membership IDs
                for m in data:
                    if m["userId"] == state["users"]["A"]["id"]:
                        state["users"]["A"]["membershipId"] = m["id"]
                    elif m["userId"] == state["users"]["B"]["id"]:
                        state["users"]["B"]["membershipId"] = m["id"]
                    elif m["userId"] == state["users"]["C"]["id"]:
                        state["users"]["C"]["membershipId"] = m["id"]
                log_test("32. GET /workspace/members → A/B/C roles correct", True)
            else:
                log_test("32. GET /workspace/members", False, f"Roles: {roles}")
        else:
            log_test("32. GET /workspace/members", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("32. GET /workspace/members", False, str(e))
    
    # 33. PATCH member B to Design group
    try:
        resp = req("PATCH", f"/workspace/members/{state['users']['B']['membershipId']}", 
                  token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"], json_data={
            "groupId": state["groups"]["Design"]["id"]
        })
        if resp is not None and resp.status_code == 200:
            log_test("33. PATCH member B → Design group", True)
        else:
            log_test("33. PATCH member B", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("33. PATCH member B", False, str(e))
    
    # 34. Try to demote last owner → 400
    try:
        resp = req("PATCH", f"/workspace/members/{state['users']['A']['membershipId']}", 
                  token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"], json_data={
            "role": "member"
        })
        if resp is not None and resp.status_code == 400:
            log_test("34. Demote last owner → 400", True)
        else:
            log_test("34. Demote last owner", False, f"Expected 400, got {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("34. Demote last owner", False, str(e))
    
    # 35. POST /tasks (Design landing)
    try:
        resp = req("POST", "/tasks", token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"], json_data={
            "title": "Design landing",
            "groupId": state["groups"]["Design"]["id"],
            "dueDate": "2026-12-31"
        })
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            if "id" in data:
                state["tasks"]["T1"] = {"id": data["id"]}
                log_test("35. POST /tasks (Design landing) → 200", True)
            else:
                log_test("35. POST /tasks", False, "Missing id")
        else:
            log_test("35. POST /tasks", False, f"Status {resp.status_code if resp else 'timeout'}: {resp.text if resp else ''}")
    except Exception as e:
        log_test("35. POST /tasks", False, str(e))
    
    # 36. PATCH task T1 (priority + assignees) → notification for B
    try:
        resp = req("PATCH", f"/tasks/{state['tasks']['T1']['id']}", 
                  token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"], json_data={
            "priority": "high",
            "assignees": [state["users"]["B"]["id"]]
        })
        if resp is not None and resp.status_code == 200:
            log_test("36. PATCH task T1 (priority + assignees) → 200", True)
        else:
            log_test("36. PATCH task T1", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("36. PATCH task T1", False, str(e))
    
    # 37. GET /notifications as B → task_assigned
    try:
        resp = req("GET", "/notifications", token=state["users"]["B"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            task_assigned = any(n.get("type") == "task_assigned" for n in data)
            if task_assigned:
                log_test("37. GET /notifications as B → task_assigned", True)
            else:
                log_test("37. GET /notifications as B", False, "No task_assigned notification")
        else:
            log_test("37. GET /notifications as B", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("37. GET /notifications as B", False, str(e))
    
    # 38. PATCH /tasks/:id/dates as B (member, not leader) → 403
    try:
        resp = req("PATCH", f"/tasks/{state['tasks']['T1']['id']}/dates", 
                  token=state["users"]["B"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"], json_data={
            "startDate": "2026-11-01",
            "dueDate": "2026-11-15"
        })
        if resp is not None and resp.status_code == 403:
            log_test("38. PATCH /tasks/:id/dates as B → 403", True)
        else:
            log_test("38. PATCH /tasks/:id/dates as B", False, f"Expected 403, got {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("38. PATCH /tasks/:id/dates as B", False, str(e))
    
    # 39. PATCH /tasks/:id/dates as A → 200
    try:
        resp = req("PATCH", f"/tasks/{state['tasks']['T1']['id']}/dates", 
                  token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"], json_data={
            "startDate": "2026-11-01",
            "dueDate": "2026-11-15"
        })
        if resp is not None and resp.status_code == 200:
            log_test("39. PATCH /tasks/:id/dates as A → 200", True)
        else:
            log_test("39. PATCH /tasks/:id/dates as A", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("39. PATCH /tasks/:id/dates as A", False, str(e))
    
    # 40. PATCH /tasks/:id/dates with invalid range → 400
    try:
        resp = req("PATCH", f"/tasks/{state['tasks']['T1']['id']}/dates", 
                  token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"], json_data={
            "startDate": "2026-11-20",
            "dueDate": "2026-11-10"
        })
        if resp is not None and resp.status_code == 400:
            log_test("40. PATCH /tasks/:id/dates invalid range → 400", True)
        else:
            log_test("40. PATCH /tasks/:id/dates invalid range", False, f"Expected 400, got {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("40. PATCH /tasks/:id/dates invalid range", False, str(e))
    
    # 41. DELETE task T1 → soft delete
    try:
        resp = req("DELETE", f"/tasks/{state['tasks']['T1']['id']}", 
                  token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            # Verify in trash
            resp2 = req("GET", "/tasks", token=state["users"]["A"]["token"], 
                       workspace_id=state["workspaces"]["WS1"]["id"], params={"trash": "1"})
            if resp2 is not None and resp2.status_code == 200:
                trash_tasks = resp2.json()
                t1_in_trash = any(t["id"] == state["tasks"]["T1"]["id"] for t in trash_tasks)
                if t1_in_trash:
                    log_test("41. DELETE task T1 → soft delete", True)
                else:
                    log_test("41. DELETE task T1", False, "Task not in trash")
            else:
                log_test("41. DELETE task T1", False, "Could not verify trash")
        else:
            log_test("41. DELETE task T1", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("41. DELETE task T1", False, str(e))
    
    # 42. POST /tasks/:id/restore → restore T1
    try:
        resp = req("POST", f"/tasks/{state['tasks']['T1']['id']}/restore", 
                  token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            # Verify restored
            resp2 = req("GET", "/tasks", token=state["users"]["A"]["token"], 
                       workspace_id=state["workspaces"]["WS1"]["id"])
            if resp2 is not None and resp2.status_code == 200:
                tasks = resp2.json()
                t1_restored = any(t["id"] == state["tasks"]["T1"]["id"] for t in tasks)
                if t1_restored:
                    log_test("42. POST /tasks/:id/restore → restored", True)
                else:
                    log_test("42. POST /tasks/:id/restore", False, "Task not restored")
            else:
                log_test("42. POST /tasks/:id/restore", False, "Could not verify restore")
        else:
            log_test("42. POST /tasks/:id/restore", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("42. POST /tasks/:id/restore", False, str(e))


def phase_e_chat_notifications_pilot():
    """PHASE E — Chat / Notifications / Pilot"""
    print("\n" + "="*60)
    print("PHASE E — CHAT / NOTIFICATIONS / PILOT TESTS")
    print("="*60)
    
    # 43. GET /channels → #general and #chefs
    try:
        resp = req("GET", "/channels", token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            channel_names = [ch["name"] for ch in data]
            if "general" in channel_names and "chefs" in channel_names:
                # Store channel IDs
                for ch in data:
                    if ch["name"] == "general":
                        state["channels"]["CH1"] = {"id": ch["id"], "name": ch["name"]}
                    elif ch["name"] == "chefs":
                        state["channels"]["chefs"] = {"id": ch["id"], "name": ch["name"]}
                log_test("43. GET /channels → #general and #chefs", True)
            else:
                log_test("43. GET /channels", False, f"Expected general and chefs, got {channel_names}")
        else:
            log_test("43. GET /channels", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("43. GET /channels", False, str(e))
    
    # 44. POST message with @mention → notification for B
    try:
        resp = req("POST", f"/channels/{state['channels']['CH1']['id']}/messages", 
                  token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"], json_data={
            "content": "Hello @Bob"
        })
        if resp is not None and resp.status_code == 200:
            # Verify mention notification for B
            resp2 = req("GET", "/notifications", token=state["users"]["B"]["token"], 
                       workspace_id=state["workspaces"]["WS1"]["id"])
            if resp2 is not None and resp2.status_code == 200:
                notifs = resp2.json()
                mention_notif = any(n.get("type") == "mention" for n in notifs)
                if mention_notif:
                    log_test("44. POST message with @mention → notification", True)
                else:
                    log_test("44. POST message with @mention", False, "No mention notification")
            else:
                log_test("44. POST message with @mention", False, "Could not verify notification")
        else:
            log_test("44. POST message with @mention", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("44. POST message with @mention", False, str(e))
    
    # 45. GET /channels/:id/messages as B
    try:
        resp = req("GET", f"/channels/{state['channels']['CH1']['id']}/messages", 
                  token=state["users"]["B"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                log_test("45. GET /channels/:id/messages as B → 200", True)
            else:
                log_test("45. GET /channels/:id/messages as B", False, "Response not a list")
        else:
            log_test("45. GET /channels/:id/messages as B", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("45. GET /channels/:id/messages as B", False, str(e))
    
    # 46. Mark all notifications as read
    try:
        resp = req("POST", "/notifications/mark-read", token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"], json_data={})
        if resp is not None and resp.status_code == 200:
            log_test("46. POST /notifications/mark-read → 200", True)
        else:
            log_test("46. POST /notifications/mark-read", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("46. POST /notifications/mark-read", False, str(e))
    
    # 47. GET /pilot as A → 200 with kpis
    try:
        resp = req("GET", "/pilot", token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            if "kpis" in data and "byGroup" in data and "byMember" in data and "trend" in data:
                log_test("47. GET /pilot as A → 200 with kpis", True)
            else:
                log_test("47. GET /pilot as A", False, "Missing expected fields")
        else:
            log_test("47. GET /pilot as A", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("47. GET /pilot as A", False, str(e))
    
    # 48. GET /pilot as B (member) → 403
    try:
        resp = req("GET", "/pilot", token=state["users"]["B"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 403:
            log_test("48. GET /pilot as B → 403", True)
        else:
            log_test("48. GET /pilot as B", False, f"Expected 403, got {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("48. GET /pilot as B", False, str(e))


def phase_f_audit_transfer_archive_delete_leave():
    """PHASE F — Audit + Transfer + Archive + Delete + Leave"""
    print("\n" + "="*60)
    print("PHASE F — AUDIT / TRANSFER / ARCHIVE / DELETE / LEAVE TESTS")
    print("="*60)
    
    # 49. GET /workspace/audit as A
    try:
        resp = req("GET", "/workspace/audit", token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) > 0:
                # Check for workspace_created event
                has_created = any(log.get("action") == "workspace_created" for log in data)
                if has_created:
                    log_test("49. GET /workspace/audit → workspace_created", True)
                else:
                    log_test("49. GET /workspace/audit", False, "No workspace_created event")
            else:
                log_test("49. GET /workspace/audit", False, "Empty audit log")
        else:
            log_test("49. GET /workspace/audit", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("49. GET /workspace/audit", False, str(e))
    
    # 50. POST /workspace/transfer-ownership (A → C)
    try:
        resp = req("POST", "/workspace/transfer-ownership", token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"], json_data={
            "targetUserId": state["users"]["C"]["id"]
        })
        if resp is not None and resp.status_code == 200:
            # Verify A is now admin, C is now owner
            resp2 = req("GET", "/workspace/members", token=state["users"]["A"]["token"], 
                       workspace_id=state["workspaces"]["WS1"]["id"])
            if resp2 is not None and resp2.status_code == 200:
                members = resp2.json()
                roles = {m["userId"]: m["role"] for m in members}
                if roles.get(state["users"]["A"]["id"]) == "admin" and roles.get(state["users"]["C"]["id"]) == "owner":
                    log_test("50. POST /workspace/transfer-ownership → A=admin, C=owner", True)
                else:
                    log_test("50. POST /workspace/transfer-ownership", False, f"Roles: A={roles.get(state['users']['A']['id'])}, C={roles.get(state['users']['C']['id'])}")
            else:
                log_test("50. POST /workspace/transfer-ownership", False, "Could not verify roles")
        else:
            log_test("50. POST /workspace/transfer-ownership", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("50. POST /workspace/transfer-ownership", False, str(e))
    
    # 51. POST /workspace/transfer-ownership as A (now admin) → 403
    try:
        resp = req("POST", "/workspace/transfer-ownership", token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"], json_data={
            "targetUserId": state["users"]["B"]["id"]
        })
        if resp is not None and resp.status_code == 403:
            log_test("51. POST /workspace/transfer-ownership as admin → 403", True)
        else:
            log_test("51. POST /workspace/transfer-ownership as admin", False, f"Expected 403, got {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("51. POST /workspace/transfer-ownership as admin", False, str(e))
    
    # 52. POST /workspace/leave as A
    try:
        resp = req("POST", "/workspace/leave", token=state["users"]["A"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            # Verify A is no longer a member
            resp2 = req("GET", "/workspace/members", token=state["users"]["C"]["token"], 
                       workspace_id=state["workspaces"]["WS1"]["id"])
            if resp2 is not None and resp2.status_code == 200:
                members = resp2.json()
                a_still_member = any(m["userId"] == state["users"]["A"]["id"] for m in members)
                if not a_still_member:
                    log_test("52. POST /workspace/leave as A → no longer member", True)
                else:
                    log_test("52. POST /workspace/leave as A", False, "A still a member")
            else:
                log_test("52. POST /workspace/leave as A", False, "Could not verify members")
        else:
            log_test("52. POST /workspace/leave as A", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("52. POST /workspace/leave as A", False, str(e))
    
    # 53. POST /workspace/archive as C (owner)
    try:
        resp = req("POST", "/workspace/archive", token=state["users"]["C"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            # Verify workspace still returned but archivedAt is set
            resp2 = req("GET", "/workspaces", token=state["users"]["C"]["token"])
            if resp2 is not None and resp2.status_code == 200:
                workspaces = resp2.json()
                ws1 = next((w for w in workspaces if w["id"] == state["workspaces"]["WS1"]["id"]), None)
                if ws1:
                    # Try joining as new user D → 400
                    email_d = f"dave_{int(datetime.now().timestamp())}@test.com"
                    resp3 = req("POST", "/auth/register", json_data={
                        "email": email_d,
                        "password": "password123",
                        "firstName": "Dave"
                    })
                    if resp3 is not None and resp3.status_code == 200:
                        token_d = resp3.json()["token"]
                        state["users"]["D"] = {
                            "email": email_d,
                            "password": "password123",
                            "token": token_d,
                            "id": resp3.json()["user"]["id"]
                        }
                        resp4 = req("POST", "/workspaces/join", token=token_d, json_data={
                            "inviteCode": state["workspaces"]["WS1"]["inviteCode"]
                        })
                        if resp4 is not None and resp4.status_code == 400:
                            log_test("53. POST /workspace/archive → join blocked", True)
                        else:
                            log_test("53. POST /workspace/archive", False, f"Join expected 400, got {resp4.status_code if resp4 else 'timeout'}")
                    else:
                        log_test("53. POST /workspace/archive", False, "Could not register test user D")
                else:
                    log_test("53. POST /workspace/archive", False, "Workspace not found after archive")
            else:
                log_test("53. POST /workspace/archive", False, "Could not verify workspaces")
        else:
            log_test("53. POST /workspace/archive", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("53. POST /workspace/archive", False, str(e))
    
    # 54. POST /workspace/unarchive as C
    try:
        resp = req("POST", "/workspace/unarchive", token=state["users"]["C"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            log_test("54. POST /workspace/unarchive → 200", True)
        else:
            log_test("54. POST /workspace/unarchive", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("54. POST /workspace/unarchive", False, str(e))
    
    # 55. Register D and join WS1
    try:
        if "D" not in state["users"]:
            email_d = f"dave_{int(datetime.now().timestamp())}@test.com"
            resp = req("POST", "/auth/register", json_data={
                "email": email_d,
                "password": "password123",
                "firstName": "Dave"
            })
            if resp is not None and resp.status_code == 200:
                data = resp.json()
                state["users"]["D"] = {
                    "email": email_d,
                    "password": "password123",
                    "token": data["token"],
                    "id": data["user"]["id"]
                }
        
        resp2 = req("POST", "/workspaces/join", token=state["users"]["D"]["token"], json_data={
            "inviteCode": state["workspaces"]["WS1"]["inviteCode"]
        })
        if resp2 is not None and resp2.status_code == 200:
            log_test("55. Register D + join WS1 → 200", True)
        else:
            log_test("55. Register D + join WS1", False, f"Status {resp2.status_code if resp2 else 'timeout'}")
    except Exception as e:
        log_test("55. Register D + join WS1", False, str(e))
    
    # 56. DELETE /workspace as C (owner)
    try:
        resp = req("DELETE", "/workspace", token=state["users"]["C"]["token"], 
                  workspace_id=state["workspaces"]["WS1"]["id"])
        if resp is not None and resp.status_code == 200:
            # Verify D can no longer access workspace
            resp2 = req("GET", "/workspace", token=state["users"]["D"]["token"], 
                       workspace_id=state["workspaces"]["WS1"]["id"])
            if resp2 is not None and resp2.status_code == 403:
                log_test("56. DELETE /workspace → D gets 403", True)
            else:
                log_test("56. DELETE /workspace", False, f"D expected 403, got {resp2.status_code if resp2 else 'timeout'}")
        else:
            log_test("56. DELETE /workspace", False, f"Status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("56. DELETE /workspace", False, str(e))


def phase_g_delete_account():
    """PHASE G — Delete account"""
    print("\n" + "="*60)
    print("PHASE G — DELETE ACCOUNT TESTS")
    print("="*60)
    
    # 57. Register X, create workspace, try delete → 400 (sole owner)
    try:
        email_x = f"xavier_{int(datetime.now().timestamp())}@test.com"
        resp = req("POST", "/auth/register", json_data={
            "email": email_x,
            "password": "password123",
            "firstName": "Xavier"
        })
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            state["users"]["X"] = {
                "email": email_x,
                "password": "password123",
                "token": data["token"],
                "id": data["user"]["id"]
            }
            # Create workspace
            resp2 = req("POST", "/workspaces", token=state["users"]["X"]["token"], json_data={
                "name": "Xavier's Workspace"
            })
            if resp2 is not None and resp2.status_code == 200:
                ws_x = resp2.json()
                state["workspaces"]["WSX"] = {"id": ws_x["id"]}
                # Try to delete account
                resp3 = req("POST", "/auth/delete-account", token=state["users"]["X"]["token"], json_data={
                    "password": "password123"
                })
                if resp3 is not None and resp3.status_code == 400:
                    log_test("57. Delete account as sole owner → 400", True)
                else:
                    log_test("57. Delete account as sole owner", False, f"Expected 400, got {resp3.status_code if resp3 else 'timeout'}")
            else:
                log_test("57. Delete account as sole owner", False, "Could not create workspace")
        else:
            log_test("57. Delete account as sole owner", False, "Could not register X")
    except Exception as e:
        log_test("57. Delete account as sole owner", False, str(e))
    
    # 58. Delete workspace, then delete account → 200
    try:
        # Delete workspace
        resp = req("DELETE", "/workspace", token=state["users"]["X"]["token"], 
                  workspace_id=state["workspaces"]["WSX"]["id"])
        if resp is not None and resp.status_code == 200:
            # Now delete account
            resp2 = req("POST", "/auth/delete-account", token=state["users"]["X"]["token"], json_data={
                "password": "password123"
            })
            if resp2 is not None and resp2.status_code == 200:
                # Verify GET /auth/me → 401
                resp3 = req("GET", "/auth/me", token=state["users"]["X"]["token"])
                if resp3 is not None and resp3.status_code == 401:
                    log_test("58. Delete workspace + delete account → 401", True)
                else:
                    log_test("58. Delete workspace + delete account", False, f"Expected 401, got {resp3.status_code if resp3 else 'timeout'}")
            else:
                log_test("58. Delete workspace + delete account", False, f"Delete account status {resp2.status_code if resp2 else 'timeout'}")
        else:
            log_test("58. Delete workspace + delete account", False, f"Delete workspace status {resp.status_code if resp else 'timeout'}")
    except Exception as e:
        log_test("58. Delete workspace + delete account", False, str(e))


def main():
    """Run all test phases"""
    print("=" * 60)
    print("WHATODO BACKEND API END-TO-END TESTS")
    print("Fresh user registration (NO seed data)")
    print("=" * 60)
    
    phase_a_auth()
    phase_b_workspaces()
    phase_c_invitations()
    phase_d_members_groups_tasks()
    phase_e_chat_notifications_pilot()
    phase_f_audit_transfer_archive_delete_leave()
    phase_g_delete_account()
    
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
    print("\nTest users created:")
    for name, user in state["users"].items():
        print(f"  {name}: {user['email']} / {user['password']}")
    
    print("\n" + "=" * 60)
    
    # Exit with appropriate code
    sys.exit(0 if test_results["failed"] == 0 else 1)


if __name__ == "__main__":
    main()
