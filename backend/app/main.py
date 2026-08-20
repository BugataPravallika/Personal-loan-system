"""FastAPI application bootstrap for the EzFinanz lending workflow.

This module wires together the database schema, routers, and demo-friendly CORS
settings used by the customer and admin flows. It also performs a small startup
migration for the OTP table when older SQLite databases are detected.
"""

import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .database import Base, engine
from . import models  # noqa: F401  (ensures models are registered before create_all)
from .routers import auth, verification, application, admin


def _ensure_schema():
    if engine.url.get_backend_name() == "postgresql" and os.environ.get("EZFINANZ_SCHEMA_INIT", "false").lower() != "true":
        return

    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    if "otp_codes" in inspector.get_table_names():
        existing = {col["name"] for col in inspector.get_columns("otp_codes")}
        with engine.begin() as conn:
            if "destination" not in existing:
                conn.execute(text("ALTER TABLE otp_codes ADD COLUMN destination VARCHAR"))
            if "message_body" not in existing:
                conn.execute(text("ALTER TABLE otp_codes ADD COLUMN message_body TEXT"))
            if "code_hash" not in existing:
                conn.execute(text("ALTER TABLE otp_codes ADD COLUMN code_hash VARCHAR"))
            if "failed_attempts" not in existing:
                conn.execute(text("ALTER TABLE otp_codes ADD COLUMN failed_attempts INTEGER DEFAULT 0"))

    # migrate loan_applications to add review fields if missing
    if "loan_applications" in inspector.get_table_names():
        existing_app_cols = {col["name"] for col in inspector.get_columns("loan_applications")}
        with engine.begin() as conn:
            if "review_status" not in existing_app_cols:
                conn.execute(text("ALTER TABLE loan_applications ADD COLUMN review_status VARCHAR"))
            if "review_remarks" not in existing_app_cols:
                conn.execute(text("ALTER TABLE loan_applications ADD COLUMN review_remarks TEXT"))
            if "review_date" not in existing_app_cols:
                conn.execute(text("ALTER TABLE loan_applications ADD COLUMN review_date DATETIME"))
            if "reviewed_by" not in existing_app_cols:
                conn.execute(text("ALTER TABLE loan_applications ADD COLUMN reviewed_by VARCHAR"))


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
