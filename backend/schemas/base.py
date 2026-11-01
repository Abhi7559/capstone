import re
from pydantic import BaseModel, ConfigDict


def to_camel(string: str) -> str:
    """Convert snake_case string to camelCase for Next.js frontend contracts."""
    components = string.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


class CamelCaseModel(BaseModel):
    """Base Pydantic model with strict validation, camelCase serialization, and from_attributes."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        extra="ignore",
        strict=False,
        validate_assignment=True,
    )

