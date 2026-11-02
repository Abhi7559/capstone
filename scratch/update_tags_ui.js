const fs = require('fs');
const filePath = 'pages/projects/[id].tsx';

let content = fs.readFileSync(filePath, 'utf8');
const isCRLF = content.includes('\r\n');
const eol = isCRLF ? '\r\n' : '\n';

// 1. Add useMemo to react imports
content = content.replace(
  /import \{ useEffect, useRef, useState \} from "react";/,
  'import { useEffect, useMemo, useRef, useState } from "react";'
);

// 2. Add tag: "all" to initial filters
content = content.replace(
  /const \[filters, setFilters\] = useState<TaskFilters>\(\{\s*status: "all",\s*priority: "all",\s*assigneeId: "all",\s*dueDate: "",\s*\}\);/,
  `const [filters, setFilters] = useState<TaskFilters>({\n    status: "all",\n    priority: "all",\n    assigneeId: "all",\n    dueDate: "",\n    tag: "all",\n  });`.replace(/\n/g, eol)
);

// 3. Add tag: "all" to handleClearFilters
content = content.replace(
  /const handleClearFilters = \(\) => \{\s*setFilters\(\{\s*status: "all",\s*priority: "all",\s*assigneeId: "all",\s*dueDate: "",\s*\}\);\s*setSearchQuery\(""\);\s*\};/,
  `const handleClearFilters = () => {\n    setFilters({\n      status: "all",\n      priority: "all",\n      assigneeId: "all",\n      dueDate: "",\n      tag: "all",\n    });\n    setSearchQuery("");\n  };`.replace(/\n/g, eol)
);

// 4. Add availableTags definition right after rawTasks declaration
const targetRawTasks = `  const {
    data: rawTasks,
    isLoading,
    isError,
    error,
  } = useTasks(projectId, filters);`.replace(/\n/g, eol);

const replacementRawTasks = `${targetRawTasks}

  // Aggregate all unique tags from tasks across this project
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    (rawTasks || []).forEach((t) => {
      if (Array.isArray(t.tags)) {
        t.tags.forEach((tag) => {
          if (tag && typeof tag === "string" && tag.trim()) {
            tagSet.add(tag.trim().toLowerCase());
          }
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [rawTasks]);`.replace(/\n/g, eol);

content = content.replace(targetRawTasks, replacementRawTasks);

// 5. Update tasks filtering logic to also filter by tag
const targetTasksFilter = `  const tasks = (rawTasks || []).filter((t) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = t.title.toLowerCase().includes(query);
    const descMatch = t.description.toLowerCase().includes(query);
    const tagMatch = t.tags?.some((tag) => tag.toLowerCase().includes(query));
    return titleMatch || descMatch || tagMatch;
  });`.replace(/\n/g, eol);

const replacementTasksFilter = `  const tasks = (rawTasks || []).filter((t) => {
    // 1. Tag Filter
    if (filters.tag && filters.tag !== "all") {
      const match = t.tags?.some(
        (tag) => tag.toLowerCase() === filters.tag?.toLowerCase()
      );
      if (!match) return false;
    }
    // 2. Text Search
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = t.title.toLowerCase().includes(query);
    const descMatch = t.description.toLowerCase().includes(query);
    const tagMatch = t.tags?.some((tag) => tag.toLowerCase().includes(query));
    return titleMatch || descMatch || tagMatch;
  });`.replace(/\n/g, eol);

content = content.replace(targetTasksFilter, replacementTasksFilter);

// 6. Add Tag filter dropdown right next to Priority Filter
const targetPriorityFilter = `                    {/* Priority Filter */}
                    <div>
                      <select
                        value={filters.priority || "all"}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            priority: e.target.value as TaskPriority | "all",
                          }))
                        }
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="all">All Priorities</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>`.replace(/\n/g, eol);

const replacementPriorityFilter = `${targetPriorityFilter}

                    {/* Tag Filter */}
                    <div>
                      <select
                        value={filters.tag || "all"}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            tag: e.target.value,
                          }))
                        }
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 capitalize"
                        title="Filter tasks by tag"
                      >
                        <option value="all">🏷️ All Tags</option>
                        {availableTags.map((t) => (
                          <option key={t} value={t}>
                            #{t}
                          </option>
                        ))}
                      </select>
                    </div>`.replace(/\n/g, eol);

content = content.replace(targetPriorityFilter, replacementPriorityFilter);

// 7. Update Clear Filters condition
content = content.replace(
  `filters.priority !== "all" ||\n                    filters.assigneeId !== "all") && (`.replace(/\n/g, eol),
  `filters.priority !== "all" ||\n                    filters.assigneeId !== "all" ||\n                    (filters.tag && filters.tag !== "all")) && (`.replace(/\n/g, eol)
);

// 8. Make Tag Badges on task card interactive (click to filter/unfilter)
const targetTagBadge = `                                    {/* Tags */}
                                    {task.tags && task.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                                        {task.tags.map((tag) => (
                                          <span
                                            key={tag}
                                            className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md text-[10px] font-semibold break-all break-words"
                                          >
                                            #{tag}
                                          </span>
                                        ))}
                                      </div>
                                    )}`.replace(/\n/g, eol);

const replacementTagBadge = `                                    {/* Tags */}
                                    {task.tags && task.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                                        {task.tags.map((tag) => {
                                          const isSelected =
                                            filters.tag?.toLowerCase() ===
                                            tag.toLowerCase();
                                          return (
                                            <span
                                              key={tag}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setFilters((prev) => ({
                                                  ...prev,
                                                  tag: isSelected
                                                    ? "all"
                                                    : tag.toLowerCase(),
                                                }));
                                              }}
                                              className={\`px-2 py-0.5 rounded-md text-[10px] font-semibold break-all break-words cursor-pointer transition select-none \${
                                                isSelected
                                                  ? "bg-blue-600 text-white shadow-xs"
                                                  : "bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100"
                                              }\`}
                                              title={
                                                isSelected
                                                  ? \`Filtering by #\${tag}. Click to clear\`
                                                  : \`Click to filter tasks by #\${tag}\`
                                              }
                                            >
                                              #{tag}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}`.replace(/\n/g, eol);

content = content.replace(targetTagBadge, replacementTagBadge);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated pages/projects/[id].tsx with Tag filtering & interactive badges');

