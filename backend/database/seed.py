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
        result = await session.execute(select(User).where(User.email == ADMIN_EMAIL))
        existing_admin = result.scalar_one_or_none()

        if existing_admin:
            logger.info("Admin user (%s) already exists in database.", ADMIN_EMAIL)
            return

        logger.info("Seeding default Administrator user: %s", ADMIN_EMAIL)
        admin = User(
            id=ADMIN_ID,
            name="System Admin",
            email=ADMIN_EMAIL,
            hashed_password=get_password_hash(ADMIN_PASSWORD),
            role="admin",
            status="active",
            designation="System Administrator",
            joining_date=date(2026, 9, 1),
            requires_password_change=False,
        )
        session.add(admin)
        await session.commit()
        logger.info("Admin user seeded successfully with ID: %s", ADMIN_ID)


if __name__ == "__main__":
    asyncio.run(seed_admin_user())
