import pytest
from httpx import AsyncClient
from core.config import settings


@pytest.mark.asyncio
async def test_list_members(client: AsyncClient):
    """API 17: GET /members lists all workspace members without exposing passwords."""
    # 1. Login as admin
    login_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "admin@teamboard.com", "password": "Admin@123"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["accessToken"]

    # 2. Get members list
    res = await client.get(
        f"{settings.API_V1_PREFIX}/members",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    members = res.json()
    assert isinstance(members, list)
    assert len(members) >= 1

    # Check member structure
    admin_member = next((m for m in members if m["email"] == "admin@teamboard.com"), None)
    assert admin_member is not None
    assert admin_member["name"] == "System Admin"
    assert admin_member["role"] == "admin"
    assert "password" not in admin_member
    assert "hashedPassword" not in admin_member


@pytest.mark.asyncio
async def test_update_member_profile(client: AsyncClient):
    """API 19: PATCH /members/{id} updates member details."""
    login_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "admin@teamboard.com", "password": "Admin@123"},
    )
    token = login_res.json()["accessToken"]

    # 1. Invite a member to update
    invite_res = await client.post(
        f"{settings.API_V1_PREFIX}/members/invite",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Alex UpdateTest",
            "email": "alex.update@teamboard.com",
            "designation": "Junior Engineer",
            "joiningDate": "2026-11-01",
        },
    )
    assert invite_res.status_code == 201
    member_id = invite_res.json()["member"]["id"]

    # 2. Update member details as admin
    update_res = await client.patch(
        f"{settings.API_V1_PREFIX}/members/{member_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Alex Senior",
            "designation": "Lead Engineer",
        },
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["name"] == "Alex Senior"
    assert updated["designation"] == "Lead Engineer"


@pytest.mark.asyncio
async def test_delete_member_and_last_admin_guard(client: AsyncClient):
    """API 20: DELETE /members/{id} removes a member and protects the last admin."""
    login_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "admin@teamboard.com", "password": "Admin@123"},
    )
    admin_data = login_res.json()
    token = admin_data.get("accessToken") or admin_data.get("access_token")

    # Fetch admin profile via GET /auth/me
    me_res = await client.get(
        f"{settings.API_V1_PREFIX}/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    admin_id = me_res.json()["id"]

    # 1. Guard check: Deleting last admin should fail with 400
    del_admin_res = await client.delete(
        f"{settings.API_V1_PREFIX}/members/{admin_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_admin_res.status_code == 400
    assert "last remaining Administrator" in del_admin_res.json()["details"]

    # 2. Invite a normal member
    invite_res = await client.post(
        f"{settings.API_V1_PREFIX}/members/invite",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Delete Me",
            "email": "deleteme@teamboard.com",
            "designation": "Intern",
            "joiningDate": "2026-11-01",
        },
    )
    assert invite_res.status_code == 201
    member_id = invite_res.json()["member"]["id"]

    # 3. Delete normal member succeeds with 200 OK
    del_res = await client.delete(
        f"{settings.API_V1_PREFIX}/members/{member_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code in (200, 204)
    if del_res.status_code == 200:
        assert del_res.json()["success"] is True

    # 4. Verify member is gone (404 on update)
    get_res = await client.patch(
        f"{settings.API_V1_PREFIX}/members/{member_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Ghost"},
    )
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_update_member_password_via_patch(client: AsyncClient):
    """API 19: PATCH /members/{id} can update password (QAex.md Section 5.3)."""
    # 1. Login as admin
    login_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "admin@teamboard.com", "password": "Admin@123"},
    )
    admin_token = login_res.json()["accessToken"]

    # 2. Invite a new member
    invite_res = await client.post(
        f"{settings.API_V1_PREFIX}/members/invite",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Password Patch User",
            "email": "patch.pwd@teamboard.com",
            "designation": "QA Tester",
        },
    )
    assert invite_res.status_code == 201
    member_data = invite_res.json()
    member_id = member_data["member"]["id"]
    invite_token = member_data.get("invitationToken") or member_data.get("invitation_token")
    assert invite_token is not None

    # 3. Activate account and set initial password via /auth/signup
    signup_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/signup",
        json={
            "email": "patch.pwd@teamboard.com",
            "newPassword": "InitialPassword@123",
            "confirmPassword": "InitialPassword@123",
            "token": invite_token,
        },
    )
    assert signup_res.status_code == 200

    # 4. Login as the newly activated member
    member_login = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "patch.pwd@teamboard.com", "password": "InitialPassword@123"},
    )
    assert member_login.status_code == 200
    member_token = member_login.json()["accessToken"]

    # 5. Attempt to change password with WRONG current password -> should fail 401
    bad_patch = await client.patch(
        f"{settings.API_V1_PREFIX}/members/{member_id}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={
            "currentPassword": "WrongPassword123!",
            "newPassword": "NewSecurePassword@2026",
        },
    )
    assert bad_patch.status_code == 401

    # 6. Change password successfully with correct current password via PATCH /members/{id}
    good_patch = await client.patch(
        f"{settings.API_V1_PREFIX}/members/{member_id}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={
            "currentPassword": "InitialPassword@123",
            "newPassword": "NewSecurePassword@2026",
        },
    )
    assert good_patch.status_code == 200
    assert good_patch.json()["requiresPasswordChange"] is False

    # 6. Verify member can login with the NEW password
    re_login = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "patch.pwd@teamboard.com", "password": "NewSecurePassword@2026"},
    )
    assert re_login.status_code == 200
    new_token = re_login.json().get("accessToken") or re_login.json().get("access_token")
    assert new_token is not None

    # Fetch updated profile via GET /auth/me
    re_me = await client.get(
        f"{settings.API_V1_PREFIX}/auth/me",
        headers={"Authorization": f"Bearer {new_token}"},
    )
    assert re_me.status_code == 200
    assert re_me.json()["email"] == "patch.pwd@teamboard.com"


@pytest.mark.asyncio
async def test_member_permissions_and_restrictions(client: AsyncClient):
    """
    Step 5 specific test coverage:
    - Member can update their own permitted fields (name, designation).
    - Member cannot change their own role (403 Forbidden).
    - Member cannot update another member's profile (403 Forbidden).
    - Member cannot delete another member (403 Forbidden).
    - Nonexistent member returns 404 Not Found on PATCH and DELETE.
    - Unauthenticated request is rejected (401 Unauthorized).
    """
    # 1. Unauthenticated GET /members should return 401
    unauth_res = await client.get(f"{settings.API_V1_PREFIX}/members")
    assert unauth_res.status_code == 401

    # 2. Login as admin to prepare two members
    login_admin = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "admin@teamboard.com", "password": "Admin@123"},
    )
    admin_token = login_admin.json()["accessToken"]

    # Create Member A
    inv_a = await client.post(
        f"{settings.API_V1_PREFIX}/members/invite",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Member Alpha",
            "email": "alpha.test@teamboard.com",
            "designation": "Frontend Dev",
        },
    )
    assert inv_a.status_code == 201
    member_a_id = inv_a.json()["member"]["id"]
    token_a = inv_a.json()["invitationToken"]

    # Activate Member A
    await client.post(
        f"{settings.API_V1_PREFIX}/auth/signup",
        json={
            "email": "alpha.test@teamboard.com",
            "newPassword": "PasswordAlpha@123",
            "confirmPassword": "PasswordAlpha@123",
            "token": token_a,
        },
    )

    # Create Member B
    inv_b = await client.post(
        f"{settings.API_V1_PREFIX}/members/invite",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Member Beta",
            "email": "beta.test@teamboard.com",
            "designation": "Backend Dev",
        },
    )
    assert inv_b.status_code == 201
    member_b_id = inv_b.json()["member"]["id"]

    # Login as Member A
    login_a = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "alpha.test@teamboard.com", "password": "PasswordAlpha@123"},
    )
    assert login_a.status_code == 200
    token_user_a = login_a.json()["accessToken"]

    # 3. Member A updates their OWN name and designation -> 200 OK
    self_update = await client.patch(
        f"{settings.API_V1_PREFIX}/members/{member_a_id}",
        headers={"Authorization": f"Bearer {token_user_a}"},
        json={"name": "Alpha Updated", "designation": "Senior Frontend Dev"},
    )
    assert self_update.status_code == 200
    assert self_update.json()["name"] == "Alpha Updated"
    assert self_update.json()["designation"] == "Senior Frontend Dev"
    # Ensure role is still 'member'
    assert self_update.json()["role"] == "member"

    # 4. Member A attempts to escalate their own role to 'admin' -> 403 Forbidden
    role_escalate = await client.patch(
        f"{settings.API_V1_PREFIX}/members/{member_a_id}",
        headers={"Authorization": f"Bearer {token_user_a}"},
        json={"role": "admin"},
    )
    assert role_escalate.status_code == 403

    # 5. Member A attempts to update Member B's profile -> 403 Forbidden
    other_update = await client.patch(
        f"{settings.API_V1_PREFIX}/members/{member_b_id}",
        headers={"Authorization": f"Bearer {token_user_a}"},
        json={"name": "Tampered By Alpha"},
    )
    assert other_update.status_code == 403

    # 6. Member A attempts to delete Member B -> 403 Forbidden
    member_del = await client.delete(
        f"{settings.API_V1_PREFIX}/members/{member_b_id}",
        headers={"Authorization": f"Bearer {token_user_a}"},
    )
    assert member_del.status_code == 403

    # 7. Nonexistent member operations return 404 Not Found
    nonexistent_id = "00000000-0000-0000-0000-000000000000"
    patch_404 = await client.patch(
        f"{settings.API_V1_PREFIX}/members/{nonexistent_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Nonexistent"},
    )
    assert patch_404.status_code == 404

    del_404 = await client.delete(
        f"{settings.API_V1_PREFIX}/members/{nonexistent_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert del_404.status_code == 404

    # 8. Admin promotes Member A role to 'admin' -> 200 OK
    admin_promote = await client.patch(
        f"{settings.API_V1_PREFIX}/members/{member_a_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "admin"},
    )
    assert admin_promote.status_code == 200
    assert admin_promote.json()["role"] == "admin"

