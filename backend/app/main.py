"""FastAPI application bootstrap for the EzFinanz lending workflow.

This module wires together the database schema, routers, and demo-friendly CORS
settings used by the customer and admin flows. It also performs a small startup
migration for the OTP table when older SQLite databases are detected.
"""

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .database import Base, engine
from . import models  # noqa: F401  (ensures models are registered before create_all)
from .routers import auth, verification, application, admin


def _ensure_schema():
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    if "otp_codes" in inspector.get_table_names():
        existing = {col["name"] for col in inspector.get_columns("otp_codes")}
        with engine.begin() as conn:
            if "destination" not in existing:
                conn.execute(text("ALTER TABLE otp_codes ADD COLUMN destination VARCHAR"))
            if "message_body" not in existing:
                conn.execute(text("ALTER TABLE otp_codes ADD COLUMN message_body TEXT"))


_ensure_schema()

app = FastAPI(title="EzFinanz Personal Loan API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # demo/assignment build — tighten to the deployed frontend origin in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(verification.router)
app.include_router(application.router)
app.include_router(admin.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "ezfinanz-loan-api"}
