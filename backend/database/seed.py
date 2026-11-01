import asyncio
import uuid
from datetime import date
from sqlalchemy import select
from database.engine import async_session_factory
from models.user import User
from core.security import get_password_hash
from core.logger import logger

ADMIN_ID = uuid.UUID("550e8400-e29b-41d4-a716-446655440000")
ADMIN_EMAIL = "admin@teamboard.com"
ADMIN_PASSWORD = "Admin@123"


async def seed_admin_user() -> None:
    """Seed the initial default Administrator into PostgreSQL if not already present."""
    async with async_session_factory() as session:
        admin_emails = [
            (ADMIN_ID, ADMIN_EMAIL),
            (uuid.UUID("550e8400-e29b-41d4-a716-446655440001"), "admin@teamhub.com"),
        ]
        for uid, email in admin_emails:
            result = await session.execute(select(User).where(User.email == email))
            existing_admin = result.scalar_one_or_none()

            if existing_admin:
                logger.info("Admin user (%s) already exists in database.", email)
                continue

            logger.info("Seeding default Administrator user: %s", email)
            admin = User(
                id=uid,
                name="System Admin",
                email=email,
                hashed_password=get_password_hash(ADMIN_PASSWORD),
                role="admin",
                status="active",
                designation="System Administrator",
                joining_date=date(2026, 9, 1),
                requires_password_change=False,
            )
            session.add(admin)
            await session.commit()
            logger.info("Admin user seeded successfully with ID: %s", uid)


async def seed_initial_data() -> None:
    """Seed initial administrator and default workspace projects if empty."""
    await seed_admin_user()
    try:
        from models.project import Project
        async with async_session_factory() as session:
            proj_result = await session.execute(select(Project).where(Project.is_deleted == False))
            existing_projects = proj_result.scalars().all()
            if not existing_projects:
                logger.info("Seeding default workspace projects...")
                p1 = Project(
                    id=uuid.UUID("8e50124d-efd2-414e-bbde-777f8d866480"),
                    name="Internal Team Task Board",
                    description="Centralized Kanban workflow tracking and team task governance.",
                    status="active",
                    category="Engineering",
                    priority="high",
                    created_by=ADMIN_ID,
                )
                p2 = Project(
                    id=uuid.UUID("a0569f6c-5510-45f2-ae81-1c3cfa02fc36"),
                    name="Capstone Governance Platform",
                    description="Enterprise project lifecycle management and RBAC security platform.",
                    status="active",
                    category="Engineering",
                    priority="high",
                    created_by=ADMIN_ID,
                )
                session.add_all([p1, p2])
                await session.commit()
                logger.info("Default projects seeded successfully.")
    except Exception as exc:
        logger.warning("Could not seed default projects: %s", exc)


if __name__ == "__main__":
    asyncio.run(seed_initial_data())
