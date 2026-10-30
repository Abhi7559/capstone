"""Tests for Jinja2 + HTMX Server-Rendered Dashboard Endpoints."""

import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.mark.asyncio
async def test_htmx_dashboard_full_page():
    """Verify that GET /htmx/dashboard renders the full HTML page with HTMX scripts."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/htmx/dashboard")
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")
        html = response.text
        assert "htmx.org" in html
        assert "tailwindcss.com" in html
        assert "kpi-container" in html
        assert "Total Projects" in html
        assert "Total Tasks" in html


@pytest.mark.asyncio
async def test_htmx_dashboard_stats_fragment():
    """Verify that GET /htmx/dashboard/stats returns the KPI fragment with HTMX attributes."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/htmx/dashboard/stats", headers={"HX-Request": "true"})
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")
        html = response.text
        assert 'id="kpi-container"' in html
        assert 'data-hx-trigger="every 30s"' in html
        assert 'data-hx-get="/htmx/dashboard/stats"' in html
        assert "Total Projects" in html
        assert "Completed Tasks" in html

