const fs = require('fs');
let content = fs.readFileSync('.github/QA.md', 'utf8');

// Ensure Base URL is teamhub-backend-p5a1
content = content.replace(
  '- **Base URL:** `https://workstream-backend-1rr8.onrender.com/task_management/api/v1`\r\n- **Alternative Mirror:** `https://teamhub-backend-p5a1.onrender.com/task_management/api/v1`',
  '- **Base URL (Verified Active):** `https://teamhub-backend-p5a1.onrender.com/task_management/api/v1`\r\n- **Alternative Mirror:** `https://workstream-backend-1rr8.onrender.com/task_management/api/v1`'
);

// Count how many times "#### 6. `POST /task_management/api/v1/tasks/{id}/restore`" occurs
const marker = '#### 6. `POST /task_management/api/v1/tasks/{id}/restore`';
const count = (content.match(new RegExp(marker, 'g')) || []).length;
console.log('Restore count:', count);

// If count > 1, clean it up:
if (count > 1) {
  // Read file as lines
  const lines = content.split(/\r?\n/);
  const result = [];
  let inRestore = false;
  let restoreKept = false;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.includes(marker)) {
      inRestore = true;
      continue;
    }
    if (inRestore) {
      if (l.startsWith('#### ') || l.startsWith('### Router 4')) {
        inRestore = false;
        // do not continue, process l
      } else {
        continue;
      }
    }
    result.push(l);
  }

  // Now insert restore right before "### Router 4: Members"
  const restoreSnippet = [
    '#### 6. `POST /task_management/api/v1/tasks/{id}/restore`',
    '',
    '- **Purpose:** Restores a soft-deleted task back to its active column on the Kanban board. Automatically resets `is_deleted = False` and invalidates the project dashboard cache.',
    '- **Scoping & RBAC:**',
    '    - Protected. Requires valid access token. Accessible to Admins and assigned project members.',
    '- **Headers:** `Authorization: Bearer <access_token>`',
    '- **Path Parameters:**',
    '    - `id` (`UUID`, required) — Task UUID identifier.',
    '- **Query Parameters:** None',
    '- **Request Body:** None',
    '- **Positive Response Scenario A (Task Restored):**',
    '    - HTTP 200 OK — Returns restored task object:',
    '    ',
    '    ```json',
    '    {',
    '      "id": "e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f",',
    '      "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",',
    '      "title": "Implement Drag and Drop Kanban Transitions",',
    '      "description": "Add HTML5 drag and drop handlers and call PATCH /tasks/{id} on drop.",',
    '      "priority": "medium",',
    '      "status": "todo",',
    '      "assigneeId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",',
    '      "dueDate": "2026-11-10",',
    '      "tags": ["frontend", "kanban", "ux"],',
    '      "isDeleted": false,',
    '      "createdAt": "2026-10-30T10:45:00Z",',
    '      "updatedAt": "2026-10-30T11:15:00Z"',
    '    }',
    '    ```',
    '',
    '- **Negative Scenarios:**',
    '    - **HTTP 401 Unauthorized** | **Exception:** `UnauthorizedException`',
    '        ```json',
    '        { "detail": "Could not validate credentials." }',
    '        ```',
    '    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`',
    '        ```json',
    '        { "detail": "Task with identifier \'e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f\' not found." }',
    '        ```',
    '',
    '---',
    '',
  ];

  const finalLines = [];
  for (const line of result) {
    if (line.includes('### Router 4: Members')) {
      finalLines.push(...restoreSnippet);
    }
    finalLines.push(line);
  }

  content = finalLines.join('\n');
  fs.writeFileSync('.github/QA.md', content, 'utf8');
  console.log('Successfully de-duplicated restore endpoint!');
}

