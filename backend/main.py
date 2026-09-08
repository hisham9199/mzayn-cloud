from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from database import engine, Base

# Import all models to register them
from models import user, stable, camel, championship, audit_log  # noqa

# Create tables
Base.metadata.create_all(bind=engine)

from routers import auth, stables, camels, championships, ocr, excel

app = FastAPI(
    title="نظام إدارة النياق - مزاين",
    description="نظام متكامل لإدارة وتحليل النياق الخاصة ببطولات مزاين",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploaded images
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(auth.router)
app.include_router(stables.router)
app.include_router(camels.router)
app.include_router(championships.router)
app.include_router(ocr.router)
app.include_router(excel.router)


@app.on_event("startup")
def validate_and_fix_existing_camels():
    """Ensure all existing camels in the database have their validation flags accurately synced."""
    from database import SessionLocal
    from models.camel import Camel
    from routers.camels import _validate_and_enrich
    db = SessionLocal()
    try:
        all_camels = db.query(Camel).all()
        for c in all_camels:
            _validate_and_enrich(c)
        db.commit()
    except Exception as e:
        print(f"Startup camel validation note: {e}")
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "نظام إدارة النياق - مزاين 🐪", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/dashboard/stats")
def dashboard_stats(db=None):
    """Get dashboard statistics."""
    from sqlalchemy.orm import Session
    from database import SessionLocal
    from models.camel import Camel
    from models.stable import Stable
    from models.championship import Championship, ChampionshipResult

    db = SessionLocal()
    try:
        total = db.query(Camel).count()
        available = db.query(Camel).filter(Camel.status == "available").count()
        sold = db.query(Camel).filter(Camel.status == "sold").count()
        needs_review = db.query(Camel).filter(Camel.needs_review == True).count()
        stables_count = db.query(Stable).count()

        recent_camels = db.query(Camel).order_by(Camel.created_at.desc()).limit(5).all()

        # Best result per stable
        stables_list = db.query(Stable).all()
        best_per_stable = []
        for st in stables_list:
            champs = db.query(Championship).filter(Championship.stable_id == st.id).all()
            best_pts = 0
            for ch in champs:
                r = db.query(ChampionshipResult).filter(
                    ChampionshipResult.championship_id == ch.id
                ).order_by(ChampionshipResult.total_points.desc()).first()
                if r and r.total_points and r.total_points > best_pts:
                    best_pts = r.total_points
            best_per_stable.append({"stable_id": st.id, "stable_name": st.name, "best_points": best_pts})

        return {
            "total_camels": total,
            "available_camels": available,
            "sold_camels": sold,
            "needs_review": needs_review,
            "stables_count": stables_count,
            "best_per_stable": best_per_stable,
            "recent_camels": [
                {"id": c.id, "number": c.number, "name": c.name, "points": c.points,
                 "status": c.status, "created_at": c.created_at}
                for c in recent_camels
            ],
        }
    finally:
        db.close()


@app.post("/backup")
def create_backup():
    """Create a database backup."""
    import subprocess, datetime
    backup_dir = "./backups"
    os.makedirs(backup_dir, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{backup_dir}/backup_{ts}.sql"

    db_url = os.getenv("DATABASE_URL", "postgresql://mzayn:mzayn2024@localhost:5432/mzayn_db")
    # Format: postgresql://user:pass@host:port/db
    parts = db_url.replace("postgresql://", "").split("@")
    user_pass = parts[0].split(":")
    host_db = parts[1]
    host_port = host_db.split("/")[0]
    dbname = host_db.split("/")[1]
    host = host_port.split(":")[0]

    env = os.environ.copy()
    env["PGPASSWORD"] = user_pass[1] if len(user_pass) > 1 else ""

    try:
        result = subprocess.run(
            ["pg_dump", "-h", host, "-U", user_pass[0], dbname, "-f", filename],
            env=env, capture_output=True, timeout=60
        )
        if result.returncode == 0:
            return {"message": "تم إنشاء النسخة الاحتياطية", "filename": filename}
        else:
            return {"error": result.stderr.decode()}
    except Exception as e:
        return {"error": str(e)}
