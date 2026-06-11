import pytest
from api.auth import create_access_token, decode_token, verify_password, hash_password


def test_hash_and_verify():
    pw = "TestPassword123!"
    hashed = hash_password(pw)
    assert verify_password(pw, hashed)
    assert not verify_password("wrong", hashed)


def test_token_roundtrip():
    data = {"sub": "admin@test.com", "role": "admin"}
    token = create_access_token(data)
    decoded = decode_token(token)
    assert decoded["sub"] == "admin@test.com"
    assert decoded["role"] == "admin"


def test_invalid_token():
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        decode_token("not.a.valid.token")
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_login_success(client):
    resp = await client.post("/api/auth/login", json={"email": "xq1.3x3@gmail.com", "password": "Azerty123"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    resp = await client.post("/api/auth/login", json={"email": "xq1.3x3@gmail.com", "password": "wrongpassword"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_unauthenticated(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
