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
        - working: true
          agent: "testing"
          comment: "✅ COMPREHENSIVE E2E TEST COMPLETE (58/58 passed). All NEW auth endpoints verified: POST /auth/register (8-char password validation, email validation, duplicate detection), PATCH /auth/me (profile updates: firstName/timezone/notifPrefs/tutorialSeen), POST /auth/change-password (validates current password, updates to new), POST /auth/forgot-password (returns 200 for both valid/invalid emails to prevent enumeration), POST /auth/delete-account (blocks if sole owner, deletes account after workspace deletion). All validation working correctly."
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
        - working: true
          agent: "testing"
          comment: "✅ ALL NEW workspace endpoints verified: POST /workspaces (accepts emoji/color/groups[]/firstTask), PATCH /workspace (name/description/emoji/color updates, 403 for non-admin), POST /workspace/regenerate-code (invalidates old code), POST /workspace/leave (blocks sole owner), POST /workspace/transfer-ownership (A→C, demotes A to admin, 403 for non-owner), POST /workspace/archive (blocks new joins), POST /workspace/unarchive, DELETE /workspace (owner only, cascades all data, blocks access for members). All permission checks working correctly."
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
        - working: true
          agent: "testing"
          comment: "✅ NEW Gantt endpoint verified: PATCH /tasks/:id/dates (startDate/dueDate updates for interactive Gantt drag/resize). Permission checks working: owner/admin can update any task dates, group leaders can update their group's tasks, members blocked (403). Date validation working: rejects invalid ranges (startDate > dueDate → 400). Task notifications working correctly (task_assigned notifications created)."
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
        - working: true
          agent: "testing"
          comment: "✅ NEW audit log endpoint verified: GET /workspace/audit returns comprehensive audit trail (workspace_created, invitation_created, workspace_updated, ownership_transferred, member_joined, member_left, workspace_archived, workspace_unarchived events). Correctly restricted to owner/admin (403 for non-privileged). Audit entries include actor information and metadata."
  - task: "Invitations system (per-invitation tokens)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "✅ NEW invitations system fully functional: POST /workspace/invitations (creates invitation with role/expiresInDays, generates 12-char uppercase token), GET /workspace/invitations (lists all invitations with uses count), DELETE /workspace/invitations/:id (revokes invitation, blocks future joins), POST /workspaces/join (accepts both workspace inviteCode and per-invitation token, assigns correct role from invitation). Permission checks working: only admin/owner can create/list/delete invitations (403 for members). Invitation tracking working: uses counter increments, expired/deleted invitations return 404."

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
  version: "4.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Full backend rewrite for multi-workspace. Please test all endpoints comprehensively. Test credentials: [anciens identifiants de démonstration retirés] (owner), [anciens identifiants de démonstration retirés] (leader Communication), [anciens identifiants de démonstration retirés] (member Communication), [anciens identifiants de démonstration retirés] (leader Logistique). All API calls require Authorization: Bearer <token> and X-Workspace-Id: <workspace-id> headers (except /auth/*, /workspaces list/create/join)."
  - agent: "testing"
    message: "✅ COMPREHENSIVE BACKEND TESTING COMPLETE - 49/50 tests passed! All major functionality working correctly. Created /app/backend_test.py with 50 comprehensive tests covering: Auth (login/register/me), Workspaces (CRUD/join), Members (management/permissions), Tasks (CRUD/permissions/soft-delete/restore/comments/proofs/validate), Calendar, Chat (channels/messages/permissions/mentions), Notifications, Pilot, Dashboard, Validation-queue, and Security (401/403/404/400). All critical features verified: role-based permissions, soft delete, last owner protection, proof requirements, channel permissions, mention notifications. Minor data issue: Jules has 'member' role instead of 'leader' in workspace_members, but this doesn't affect functionality - validation-queue works correctly for actual leaders (verified with Sofie). All security checks working (no token→401, wrong workspace→403, invalid ID→404, bad payload→400). Backend is production-ready!"
  - agent: "main"
    message: "⚠️ IMPORTANT: All demo data has been WIPED. There is NO seed user anymore (no [ancien compte de démonstration], no [ancien compte de démonstration], etc). Tests must register fresh users, create their own workspace(s), and drive the full flow from scratch. Please test the NEW endpoints below with a real end-to-end scenario. New endpoints to cover: POST /auth/register (with 8-char min password + confirm), PATCH /auth/me (profile update: firstName/lastName/email/bio/avatar/timezone/locale/notifPrefs/tutorialSeen), POST /auth/change-password, POST /auth/forgot-password (returns 200 always to prevent enumeration), POST /auth/delete-account (blocked if sole owner), POST /workspaces (now accepts icon/emoji/color/groups[]/firstTask{title}), PATCH /workspace (name/description/emoji/color/icon), POST /workspace/leave (blocked if sole owner), POST /workspace/transfer-ownership {targetUserId}, POST /workspace/archive, POST /workspace/unarchive, DELETE /workspace (owner only, cascades), GET/POST /workspace/invitations {role, expiresInDays}, DELETE /workspace/invitations/:id, POST /workspaces/join with per-invitation token (12-char uppercase) → returns joined workspace with proper role, GET /workspace/audit (owner/admin only), PATCH /tasks/:id/dates {startDate?, dueDate?} for Gantt drag/resize (owner/admin/group-leader only). Please run all previously-passing regression checks with the NEW ephemeral users you create yourself."
  - agent: "testing"
    message: "🎉 COMPLETE END-TO-END BACKEND TEST PASSED - 58/58 tests (100%)! Tested with FRESH user registration (no seed data). All NEW endpoints verified and working perfectly: Auth (register validation, PATCH /auth/me, change-password, forgot-password, delete-account), Workspaces (PATCH, leave, transfer-ownership, archive/unarchive, DELETE), Invitations (create/list/revoke + join via per-invitation token with role assignment), Audit log (GET /workspace/audit), Gantt dates (PATCH /tasks/:id/dates with permission checks). All REGRESSION tests passed: login, workspaces CRUD, members management, tasks CRUD, chat with mentions, notifications, pilot dashboard. All permission checks working (403 for unauthorized, 400 for validation errors, 401 for auth failures, 404 for not found). Test users created: A (alice), B (bob), C (charlie), D (dave), X (xavier). Backend is PRODUCTION-READY!"

