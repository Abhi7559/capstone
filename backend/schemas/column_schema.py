import uuid
from typing import Optional, Union, List
from pydantic import Field
from schemas.base import CamelCaseModel


class ColumnCreate(CamelCaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: Optional[str] = Field(default="bg-purple-50 border-purple-200 text-purple-800")


class ColumnReorder(CamelCaseModel):
    column_ids: List[str]


class ColumnOut(CamelCaseModel):
    id: str
    project_id: Union[uuid.UUID, str]
    name: str
    slug: str
    order: int
    color: str
