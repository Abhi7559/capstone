# DATABASE_DESIGN.md

## 1. Relational Schema Architecture (PostgreSQL)

The database design uses strict relational integrity, indexed foreign keys, and audit logging tables.

```
                         ┌─────────────────────────────┐
                         │            users            │
                         ├─────────────────────────────┤
                         │ id: UUID (PK)               │
                         │ name: VARCHAR(255)          │
                         │ email: VARCHAR(255) (UQ)    │
                         │ hashed_password: VARCHAR    │
                         │ role: VARCHAR(50)           │
                         │ status: VARCHAR(50)         │
                         │ designation: VARCHAR(255)   │
                         │ joining_date: DATE          │
                         │ requires_password_change: B │
                         │ created_at: TIMESTAMPTZ     │
                         │ updated_at: TIMESTAMPTZ     │
                         └──────────────┬──────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           │ 1                          │ 1                          │ 1
           │                            │                            │
           ▼ N                          ▼ N                          ▼ N
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│     project_members     │  │          tasks          │  │   project_activities    │
├─────────────────────────┤  ├─────────────────────────┤  ├─────────────────────────┤
│ project_id: UUID (PK,FK)│  │ id: UUID (PK)           │  │ id: UUID (PK)           │
│ user_id: UUID (PK,FK)   │  │ project_id: UUID (FK)   │  │ project_id: UUID (FK)   │
│ assigned_at: TIMESTAMPTZ│  │ title: VARCHAR(255)     │  │ task_id: UUID (FK)      │
└───────────▲─────────────┘  │ description: TEXT       │  │ task_title: VARCHAR(255)│
            │                │ priority: VARCHAR(50)   │  │ user_id: UUID (FK)      │
            │ N              │ status: VARCHAR(50)     │  │ user_name: VARCHAR(255) │
            │                │ assignee_id: UUID (FK)  │  │ from_status: VARCHAR(50)│
            │ 1              │ due_date: DATE          │  │ to_status: VARCHAR(50)  │
┌───────────┴─────────────┐  │ tags: JSONB             │  │ created_at: TIMESTAMPTZ │
│        projects         │  │ created_at: TIMESTAMPTZ │  └─────────────────────────┘
├─────────────────────────┤  │ updated_at: TIMESTAMPTZ │
│ id: UUID (PK)           │  └─────────────────────────┘
│ name: VARCHAR(255)      │
│ description: TEXT       │
│ status: VARCHAR(50)     │
│ category: VARCHAR(100)  │
│ priority: VARCHAR(50)   │
│ start_date: DATE        │
│ due_date: DATE          │
│ end_date: DATE          │
│ previous_status: VARCHAR│
│ created_by: UUID (FK)   │
│ created_at: TIMESTAMPTZ │
│ updated_at: TIMESTAMPTZ │
└─────────────────────────┘
```

---

## 2. Table Definitions & DDL Scripts

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    designation VARCHAR(255),
    joining_date DATE,
    requires_password_change BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_user_role CHECK (role IN ('admin', 'member')),
    CONSTRAINT chk_user_status CHECK (status IN ('active', 'invited'))
);

CREATE INDEX idx_users_email ON users(email);

-- Table: projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'planning',
    category VARCHAR(100),
    priority VARCHAR(50) DEFAULT 'medium',
    start_date DATE,
    due_date DATE,
    end_date DATE,
    previous_status VARCHAR(50),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_project_status CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'archived')),
    CONSTRAINT chk_project_priority CHECK (priority IN ('low', 'medium', 'high')),
    CONSTRAINT chk_project_dates CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date)
);

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_category ON projects(category);

-- Junction Table: project_members
CREATE TABLE project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

CREATE INDEX idx_project_members_user ON project_members(user_id);

-- Table: tasks
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(50) NOT NULL DEFAULT 'medium',
    status VARCHAR(50) NOT NULL DEFAULT 'todo',
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date DATE NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_task_priority CHECK (priority IN ('low', 'medium', 'high')),
    CONSTRAINT chk_task_status CHECK (status IN ('backlog', 'todo', 'in_progress', 'done'))
);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- Table: project_activities
CREATE TABLE project_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    task_title VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    from_status VARCHAR(50) NOT NULL,
    to_status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_activities_project ON project_activities(project_id, created_at DESC);

-- Table: global_activities
CREATE TABLE global_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_global_activities_timestamp ON global_activities(timestamp DESC);
```

---

## 3. SQLAlchemy 2.0 Async Models Mapping

```python
# models.py
import uuid
from datetime import datetime, date
from typing import List, Optional
from sqlalchemy import String, Text, Boolean, Date, DateTime, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="member")
    status: Mapped[str] = mapped_column(String(50), default="active")
    designation: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    joining_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    requires_password_change: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    projects: Mapped[List["Project"]] = relationship(
        "Project", secondary="project_members", back_populates="members", lazy="selectin"
    )

class ProjectMember(Base):
    __tablename__ = "project_members"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="planning", index=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    priority: Mapped[Optional[str]] = mapped_column(String(50), default="medium")
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    previous_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    members: Mapped[List[User]] = relationship("User", secondary="project_members", back_populates="projects", lazy="selectin")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="project", cascade="all, delete-orphan", lazy="selectin")

class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(50), default="medium", index=True)
    status: Mapped[str] = mapped_column(String(50), default="todo", index=True)
    assignee_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project: Mapped[Project] = relationship("Project", back_populates="tasks")
    assignee: Mapped[Optional[User]] = relationship("User")
```

---

## 4. Initial Seed Data (Admin Account)

To match current frontend expectations (`admin@teamboard.com` / `Admin@123`):
```sql
INSERT INTO users (
    id,
    name,
    email,
    hashed_password,
    role,
    status,
    designation,
    joining_date,
    requires_password_change
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'System Admin',
    'admin@teamboard.com',
    '$2b$12$e/9V6gDcfk1h4pWvFqVdGeR5.jVdO07M3wN2F0F9i9d.o7yqR0gme', -- bcrypt hash for Admin@123
    'admin',
    'active',
    'System Administrator',
    '2026-09-01',
    FALSE
) ON CONFLICT (email) DO NOTHING;
```
