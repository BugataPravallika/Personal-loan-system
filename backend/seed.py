"""
Run once to create the default admin login:
    python seed.py

Admin credentials (change after first login in a real deployment):
    email:    admin@ezfinanz.com
    password: Admin@123
"""
from app.database import Base, engine, SessionLocal
from app import models
from app.security import hash_password

Base.metadata.create_all(bind=engine)

db = SessionLocal()

existing = db.query(models.User).filter(models.User.email == "admin@ezfinanz.com").first()
if existing:
    print("Admin already exists.")
else:
    admin = models.User(
        full_name="EzFinanz Admin",
        email="admin@ezfinanz.com",
        password_hash=hash_password("Admin@123"),
        auth_provider=models.AuthProvider.EMAIL,
        role=models.Role.ADMIN,
        email_verified=True,
        phone_verified=True,
    )
    db.add(admin)
    db.commit()
    print("Admin created: admin@ezfinanz.com / Admin@123")

db.close()
