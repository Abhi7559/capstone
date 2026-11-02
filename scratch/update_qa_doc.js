const fs = require('fs');
const filePath = '.github/QA.md';

let content = fs.readFileSync(filePath, 'utf8');
const isCRLF = content.includes('\r\n');
const eol = isCRLF ? '\r\n' : '\n';

// 1. Live Environment & Connection Parameters in Section 4
const targetSec4 = `## 4. Complete API Reference

**Base URL Prefix:** \`/task_management/api/v1\`  
**Standard Headers:**
- \`Content-Type: application/json\`
- \`Authorization: Bearer <JWT_ACCESS_TOKEN>\` (on protected routes)
**Naming Convention:** JSON request and response payloads strictly enforce \`camelCase\`.`.replace(/\n/g, eol);

const replacementSec4 = `## 4. Complete API Reference

### Live Environment & Connection Parameters

- **Base URL:** \`https://workstream-backend-1rr8.onrender.com/task_management/api/v1\`
- **Alternative Mirror:** \`https://teamhub-backend-p5a1.onrender.com/task_management/api/v1\`
- **Default Admin Credentials:**
  - Email: \`admin@teamboard.com\` (or \`admin@teamhub.com\`)
  - Password: \`Admin@123\`
- **PostgreSQL 16 Connection (Render Cloud):**
  - **External Host:** \`dpg-dbi6hb6tlv9c7390ga9g-a.oregon-postgres.render.com\` (Port: \`5432\`)
  - **Internal Host:** \`dpg-dbi6hb6tlv9c7390ga9g-a\`
  - **Database:** \`teamhub_vj36\`
  - **User:** \`teamhub_vj36_user\`
  - **Password:** \`bvBLm7q49dlLVmOZdXQ7edLUpsOONPOB\`
  - **SSL Mode:** \`require\`

**Standard Headers:**
- \`Content-Type: application/json\`
- \`Authorization: Bearer <JWT_ACCESS_TOKEN>\` (on protected routes)
**Naming Convention:** JSON request and response payloads strictly enforce \`camelCase\`.`.replace(/\n/g, eol);

content = content.replace(targetSec4, replacementSec4);

// 2. Router 3 heading and tag query param
content = content.replace(
  '### Router 3: Tasks (`/tasks`) — 5 Endpoints',
  '### Router 3: Tasks (`/tasks`) — 6 Endpoints'
);

content = content.replace(
  `- \`dueDate\` (\`date\`, optional, \`YYYY-MM-DD\`) — Filter by target due date.`,
  `- \`dueDate\` (\`date\`, optional, \`YYYY-MM-DD\`) — Filter by target due date.\n    - \`tag\` (\`string\`, optional) — Filter tasks containing a specific tag (e.g. \`frontend\`, \`backend\`, \`database\`).`.replace(/\n/g, eol)
);

// 3. Add POST /tasks/{id}/restore right before Router 4
const targetRouter4 = `### Router 4: Members (\`/members\`) — 5 Endpoints`;

const restoreEndpoint = `#### 6. \`POST /task_management/api/v1/tasks/{id}/restore\`

- **Purpose:** Restores a soft-deleted task back to its active column on the Kanban board. Automatically resets \`is_deleted = False\` and invalidates the project dashboard cache.
- **Scoping & RBAC:**
    - Protected. Requires valid access token. Accessible to Admins and assigned project members.
- **Headers:** \`Authorization: Bearer <access_token>\`
- **Path Parameters:**
    - \`id\` (\`UUID\`, required) — Task UUID identifier.
- **Query Parameters:** None
- **Request Body:** None
- **Positive Response Scenario A (Task Restored):**
    - HTTP 200 OK — Returns restored task object:
    
    \`\`\`json
    {
      "id": "e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f",
      "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
      "title": "Implement Drag and Drop Kanban Transitions",
      "description": "Add HTML5 drag and drop handlers and call PATCH /tasks/{id} on drop.",
      "priority": "medium",
      "status": "todo",
      "assigneeId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
      "dueDate": "2026-11-10",
      "tags": ["frontend", "kanban", "ux"],
      "isDeleted": false,
      "createdAt": "2026-10-30T10:45:00Z",
      "updatedAt": "2026-10-30T11:15:00Z"
    }
    \`\`\`

- **Negative Scenarios:**
    - **HTTP 401 Unauthorized** | **Exception:** \`UnauthorizedException\`
        \`\`\`json
        { "detail": "Could not validate credentials." }
        \`\`\`
    - **HTTP 404 Not Found** | **Exception:** \`EntityNotFoundException\`
        \`\`\`json
        { "detail": "Task with identifier 'e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f' not found." }
        \`\`\`

---

${targetRouter4}`.replace(/\n/g, eol);

content = content.replace(targetRouter4, restoreEndpoint);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated .github/QA.md');

