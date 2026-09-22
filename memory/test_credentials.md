# Test Credentials

## IMPORTANT — Whatodo now starts EMPTY

All demo/seed data has been wiped. There is no pre-existing user.

The testing agent must **register fresh users via POST /api/auth/register** for every test run. No credentials to reuse.

Suggested test scenario for a full flow:
1. Register user A (owner)         → creates a workspace via POST /api/workspaces
2. Register user B (member)        → joins via POST /api/workspaces/join with A's inviteCode
3. Register user C (admin)         → invited by A via POST /api/workspace/invitations, then joins with the returned token
4. Register user D (leader)        → assigned to a group by A

Password rules: min 8 characters.
Email must be a valid RFC email (`user@example.com`).

No hardcoded admin exists anymore.
