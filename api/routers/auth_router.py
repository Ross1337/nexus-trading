from fastapi import APIRouter, HTTPException, Response, Depends
from pydantic import BaseModel
from api.auth import create_access_token, verify_password, get_current_user
from api.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
async def login(body: LoginRequest, response: Response):
    if body.email != settings.ADMIN_EMAIL or not verify_password(body.password, _hashed_admin_pw()):
        # also support plain password comparison for initial setup
        if body.email != settings.ADMIN_EMAIL or body.password != settings.ADMIN_PASSWORD:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": body.email, "role": "admin"})
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=86400,
    )
    return {"ok": True}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"email": user.get("sub"), "role": user.get("role")}


def _hashed_admin_pw() -> str:
    from api.auth import hash_password
    return hash_password(settings.ADMIN_PASSWORD)
