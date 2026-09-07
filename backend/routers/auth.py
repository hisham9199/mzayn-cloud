import os
import jwt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import requests
from dotenv import load_dotenv

from database import get_db
from models.user import User
from models.stable import Stable

load_dotenv()

router = APIRouter(prefix="/auth", tags=["auth"])

DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID", "1544401637446258898")
DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET", "JGnz5Op4ZRLHnmgzy2imnBoxNuY1dyES")
DISCORD_REDIRECT_URI = os.getenv("DISCORD_REDIRECT_URI", "http://168.119.170.236/api/auth/discord/callback")
DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "")

GUILD_ID = os.getenv("DISCORD_GUILD_ID", "1544399866933944332")
ROLE_BASIC_USER = os.getenv("DISCORD_ROLE_BASIC_USER", "1544427122968240190")
ROLE_ADMIN_1 = os.getenv("DISCORD_ROLE_ADMIN_1", "1546140238173306910")
ROLE_ADMIN_OK = os.getenv("DISCORD_ROLE_ADMIN_OK", "1546145712256065608")

ADMIN_ROLES = {ROLE_ADMIN_1, ROLE_ADMIN_OK}

JWT_SECRET = os.getenv("JWT_SECRET", "mzayn_super_secret_jwt_key_2026_!#*")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 72


def create_token(user_id: int, role: str, discord_id: str, username: str) -> str:
    payload = {
        "sub": str(user_id),
        "discord_id": discord_id,
        "username": username,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="يرجى تسجيل الدخول أولاً عبر ديسكورد")
    token = auth_header.split(" ")[1]
    payload = decode_token(token)
    user = db.query(User).filter(User.id == int(payload["sub"]), User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="المستخدم غير موجود أو معطل")
    return user


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    try:
        token = auth_header.split(" ")[1]
        payload = decode_token(token)
        return db.query(User).filter(User.id == int(payload["sub"]), User.is_active == True).first()
    except Exception:
        return None


@router.get("/discord/login")
def discord_login():
    url = (
        f"https://discord.com/api/oauth2/authorize?client_id={DISCORD_CLIENT_ID}"
        f"&redirect_uri={requests.utils.quote(DISCORD_REDIRECT_URI)}"
        f"&response_type=code&scope=identify%20guilds.members.read"
    )
    return {"url": url}


@router.get("/discord/callback")
def discord_callback(code: str, db: Session = Depends(get_db)):
    # 1. تبديل الـ Code بـ Access Token من ديسكورد
    data = {
        "client_id": DISCORD_CLIENT_ID,
        "client_secret": DISCORD_CLIENT_SECRET,
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": DISCORD_REDIRECT_URI,
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    r = requests.post("https://discord.com/api/oauth2/token", data=data, headers=headers)
    if r.status_code != 200:
        return RedirectResponse(url="/?error=discord_token_failed")

    token_data = r.json()
    user_access_token = token_data.get("access_token")

    # 2. جلب هوية المستخدم من ديسكورد
    user_res = requests.get(
        "https://discord.com/api/users/@me",
        headers={"Authorization": f"Bearer {user_access_token}"}
    )
    if user_res.status_code != 200:
        return RedirectResponse(url="/?error=discord_user_failed")

    user_info = user_res.json()
    discord_id = str(user_info["id"])
    username = user_info.get("username", "")
    global_name = user_info.get("global_name") or username
    avatar = user_info.get("avatar")

    # 3. جلب رتب المستخدم داخل سيرفرك المحدد
    bot_headers = {"Authorization": f"Bot {DISCORD_BOT_TOKEN}"} if DISCORD_BOT_TOKEN else {}
    member_res = requests.get(
        f"https://discord.com/api/guilds/{GUILD_ID}/members/{discord_id}",
        headers=bot_headers
    )
    
    # إذا لم يكن البوت قادراً على الوصول عبر Bot Token، نستخدم التوكن الخاص بالمستخدم إذا توفرت صلاحية
    if member_res.status_code != 200:
        member_res = requests.get(
            f"https://discord.com/api/users/@me/guilds/{GUILD_ID}/member",
            headers={"Authorization": f"Bearer {user_access_token}"}
        )

    if member_res.status_code != 200:
        return RedirectResponse(url="/?error=not_in_server")

    member_data = member_res.json()
    user_roles = set(member_data.get("roles", []))

    # 4. فحص الصلاحيات والرتب
    role = None
    if user_roles.intersection(ADMIN_ROLES):
        role = "admin"
    elif ROLE_BASIC_USER in user_roles:
        role = "basic_user"
    else:
        return RedirectResponse(url="/?error=no_permission_role")

    # 5. حفظ أو تحديث المستخدم في قاعدة البيانات
    user = db.query(User).filter(User.discord_id == discord_id).first()
    if not user:
        user = User(
            discord_id=discord_id,
            username=username,
            global_name=global_name,
            avatar=avatar,
            role=role,
            is_active=True
        )
        db.add(user)
    else:
        user.username = username
        user.global_name = global_name
        user.avatar = avatar
        user.role = role
    db.commit()
    db.refresh(user)

    # 6. إصدار التوكن وتوجيه المستخدم للواجهة
    token = create_token(user.id, user.role, user.discord_id, user.username)
    return RedirectResponse(url=f"/?token={token}")


@router.get("/me")
def get_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stable = db.query(Stable).filter(Stable.discord_user_id == user.discord_id).first()
    return {
        "id": user.id,
        "discord_id": user.discord_id,
        "username": user.username,
        "global_name": user.global_name,
        "avatar": user.avatar,
        "role": user.role,
        "is_admin": user.role == "admin",
        "stable_id": stable.id if stable else None,
        "stable_name": stable.name if stable else None,
    }
