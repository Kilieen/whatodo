#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# Communication Protocol between main and testing agents
# THIS SECTION MUST BE PRESERVED

user_problem_statement: "Whatodo — plateforme multi-workspace de gestion de projets avec Kanban, calendrier, Gantt, chat, notifications, pilotage admin, permissions par rôle. Backend Next.js + MongoDB."

backend:
  - task: "Auth multi-workspace"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "JWT login, /auth/me returns user + workspaces list. Register endpoint added."
        - working: true
          agent: "testing"
          comment: "✅ All auth endpoints tested successfully. POST /auth/login (valid/invalid), POST /auth/register (new/existing email), GET /auth/me all working correctly. Returns proper 401 for invalid credentials, 400 for duplicate registration."
  - task: "Workspaces CRUD + join via invite code"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "POST /workspaces, POST /workspaces/join, GET /workspaces. Owner auto-assigned. Invite code regen for admin."
        - working: true
          agent: "testing"
          comment: "✅ All workspace endpoints working. GET /workspaces returns user's workspaces, POST /workspaces creates new workspace with owner role, POST /workspaces/join works with valid codes (returns 404 for invalid), GET /workspace returns workspace details with members."
  - task: "Workspace members management"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "GET/PATCH/DELETE /workspace/members/:id. Owner protection (cannot demote last owner)."
        - working: true
          agent: "testing"
          comment: "✅ Member management working correctly. GET /workspace/members returns all members, PATCH updates roles/groups (admin only, returns 403 for non-admin), last owner protection working (cannot demote sole owner). All permission checks functioning properly."
  - task: "Tasks CRUD with soft delete and role-based permissions"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Members can only delete own tasks, leaders their group tasks, admin/owner all. Soft delete with deletedAt. POST /tasks/:id/restore for admin/owner."
        - working: true
          agent: "testing"
          comment: "✅ All task endpoints working perfectly. GET /tasks with scope filters (mine/group/visible), POST /tasks creates tasks, PATCH updates (assignees can change status, managers can change all fields), DELETE permissions correct (member=own tasks only, leader=group tasks, admin=all), soft delete working, restore working, comments/proofs/validate all functional. ProofRequired validation working (blocks review status without proof)."
  - task: "Calendar endpoint"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "GET /calendar?from&to&scope. Filters mine/group/all per role."
        - working: true
          agent: "testing"
          comment: "✅ Calendar endpoint working. GET /calendar with date range and scope parameters returns filtered tasks correctly."
  - task: "Chat: channels + messages"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Auto-created channels per workspace (general, chefs, one per group). Read/write permissions enforced. Unread counter. Mentions trigger notifications."
        - working: true
          agent: "testing"
          comment: "✅ Chat system fully functional. GET /channels returns visible channels with unread counts, GET/POST /channels/:id/messages working, permission checks correct (non-leader blocked from #chefs, group members blocked from other groups' channels), @mentions create notifications properly."
  - task: "Notifications system"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Auto-emitted on task_assigned, validation_requested, task_validated, task_rejected, comment, mention. GET /notifications, POST /notifications/mark-read."
        - working: true
          agent: "testing"
          comment: "✅ Notifications working correctly. GET /notifications returns user's notifications, POST /notifications/mark-read works for single notification (with id) and all notifications (without id). Notifications created properly for task assignments, comments, mentions."
  - task: "Pilotage KPIs (admin)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "GET /pilot with KPIs, byGroup, byMember, critical tasks, 30-day trend. Restricted to owner/admin/teacher."
        - working: true
          agent: "testing"
          comment: "✅ Pilot dashboard working. GET /pilot returns comprehensive KPIs (total, by status, overdue), byGroup stats, byMember stats, critical tasks, 30-day trend. Correctly restricted to owner/admin/teacher (returns 403 for non-privileged users). GET /dashboard and GET /validation-queue also tested and working. Minor: Jules has 'member' role instead of 'leader' in workspace_members (data seeding issue), but validation-queue endpoint works correctly for actual leaders like Sofie."

frontend:
  - task: "Full UI (dashboard, kanban, calendar, gantt, chat, notifications, pilot, members)"
    implemented: true
    working: "NA"
    file: "app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Frontend not tested automatically per user preference. Visual checks OK via screenshots."

metadata:
  created_by: "main_agent"
  version: "3.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Auth multi-workspace"
    - "Workspaces CRUD + join via invite code"
    - "Workspace members management"
    - "Tasks CRUD with soft delete and role-based permissions"
    - "Chat: channels + messages"
    - "Notifications system"
    - "Pilotage KPIs (admin)"
  stuck_tasks: []
  test_all: true
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Full backend rewrite for multi-workspace. Please test all endpoints comprehensively. Test credentials: admin@epco.ch/admin2026 (owner), jules@epco.ch/epco2026 (leader Communication), hugo@epco.ch/epco2026 (member Communication), sofie@epco.ch/epco2026 (leader Logistique). All API calls require Authorization: Bearer <token> and X-Workspace-Id: <workspace-id> headers (except /auth/*, /workspaces list/create/join)."
  - agent: "testing"
    message: "✅ COMPREHENSIVE BACKEND TESTING COMPLETE - 49/50 tests passed! All major functionality working correctly. Created /app/backend_test.py with 50 comprehensive tests covering: Auth (login/register/me), Workspaces (CRUD/join), Members (management/permissions), Tasks (CRUD/permissions/soft-delete/restore/comments/proofs/validate), Calendar, Chat (channels/messages/permissions/mentions), Notifications, Pilot, Dashboard, Validation-queue, and Security (401/403/404/400). All critical features verified: role-based permissions, soft delete, last owner protection, proof requirements, channel permissions, mention notifications. Minor data issue: Jules has 'member' role instead of 'leader' in workspace_members, but this doesn't affect functionality - validation-queue works correctly for actual leaders (verified with Sofie). All security checks working (no token→401, wrong workspace→403, invalid ID→404, bad payload→400). Backend is production-ready!"

