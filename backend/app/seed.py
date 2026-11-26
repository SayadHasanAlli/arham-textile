from app.database import SessionLocal
from app.models import User, Worker, Vendor, ProductionType
from app.auth.security import hash_password
from app.utils.normalize import normalize_name

INITIAL_VENDORS = ["ShreeHive", "Diamond", "Sambalpuri Handloom"]

INITIAL_PRODUCTION_TYPES = [
    "Half Shirt",
    "Full Shirt",
    "Long Panjabi",
    "Short Panjabi",
    "Plain Kurti",
    "Design Kurti",
    "Flair Gown",
    "Angrakha Gown",
    "Full Border Gown",
    "Half Hand S. Kurta",
    "Full Hand S. Kurta",
    "Chunni",
    "Ladies Jacket",
    "Modi Coat",
    "Full Blazer",
]


def seed_database():
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.username == "admin").first():
            db.add(User(username="admin", password_hash=hash_password("Admin@123"), role="admin"))

        hasan_norm = normalize_name("Hasan")
        hasan = db.query(Worker).filter(Worker.normalized_name == hasan_norm).first()
        if not hasan:
            hasan = Worker(full_name="Hasan", normalized_name=hasan_norm, status="active")
            db.add(hasan)
            db.flush()

        if not db.query(User).filter(User.username == "hasan").first():
            db.add(
                User(
                    username="hasan",
                    password_hash=hash_password("Hasan@123"),
                    role="worker",
                    worker_id=hasan.id,
                )
            )

        for vendor_name in INITIAL_VENDORS:
            norm = normalize_name(vendor_name)
            if not db.query(Vendor).filter(Vendor.normalized_name == norm).first():
                db.add(Vendor(vendor_name=vendor_name, normalized_name=norm, status="active"))

        for ptype_name in INITIAL_PRODUCTION_TYPES:
            norm = normalize_name(ptype_name)
            if not db.query(ProductionType).filter(ProductionType.normalized_name == norm).first():
                db.add(ProductionType(production_name=ptype_name, normalized_name=norm, status="active"))

        db.commit()
        print("Database seeded successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
