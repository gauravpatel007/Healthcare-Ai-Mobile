"""
LifeOS Backend — Database Seed Script
Populates the database with sample data matching the frontend's Store.initSampleData().

Usage:
    cd backend
    python -m seeds.seed_data
"""

import asyncio
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import AsyncSessionLocal, init_db, engine
from app.models.user import User, UserProfile
from app.models.medical_record import MedicalRecord
from app.models.medicine import Medicine
from app.models.appointment import Appointment
from app.models.emergency import EmergencyContact
from app.models.family import FamilyMember, Vaccination
from app.models.health_tracker import HealthEntry, SleepEntry
from app.models.expense import MedicalExpense
from app.models.mood import MoodEntry
from app.models.challenge import UserBadge
from app.utils.security import hash_password


async def seed():
    """Seed the database with sample data."""
    print("🌱 Seeding database...")

    # Create tables
    await init_db()

    async with AsyncSessionLocal() as db:
        # ─── User ────────────────────────────────────────────────────
        user = User(
            id="seed-user-001",
            email="gaurav@lifeos.com",
            hashed_password=hash_password("password123"),
            role="patient",
        )
        db.add(user)
        await db.flush()

        profile = UserProfile(
            user_id=user.id,
            name="Gaurav",
            age=28,
            gender="Male",
            blood_type="B+",
            height=175,
            weight=72,
            allergies=["Peanuts", "Dust mites"],
            conditions=["Mild Asthma"],
            organ_donor=False,
            language="en",
        )
        db.add(profile)

        # ─── Medicines ───────────────────────────────────────────────
        meds = [
            Medicine(
                user_id=user.id, name="Montelukast", dosage="10mg",
                type="tablet", frequency="once_daily", times=["22:00"],
                purpose="Asthma prevention", total_pills=30, remaining=22,
                start_date=date.today() - timedelta(days=60),
            ),
            Medicine(
                user_id=user.id, name="Vitamin D3", dosage="60000 IU",
                type="capsule", frequency="once_weekly", times=["09:00"],
                purpose="Vitamin D deficiency", total_pills=8, remaining=5,
                start_date=date.today() - timedelta(days=21),
            ),
            Medicine(
                user_id=user.id, name="Cetirizine", dosage="10mg",
                type="tablet", frequency="once_daily", times=["08:00"],
                purpose="Allergies", total_pills=30, remaining=18,
                start_date=date.today() - timedelta(days=12),
            ),
        ]
        db.add_all(meds)

        # ─── Appointments ────────────────────────────────────────────
        apts = [
            Appointment(
                user_id=user.id, doctor="Dr. Priya Sharma",
                specialty="Pulmonologist", hospital="Apollo Hospital",
                date=date.today() + timedelta(days=5), time=time(10, 30),
                notes="Regular asthma checkup", status="upcoming",
            ),
            Appointment(
                user_id=user.id, doctor="Dr. Raj Patel",
                specialty="Dermatologist", hospital="Max Healthcare",
                date=date.today() + timedelta(days=12), time=time(14, 0),
                notes="Skin allergy follow-up", status="upcoming",
            ),
        ]
        db.add_all(apts)

        # ─── Medical Records ────────────────────────────────────────
        records = [
            MedicalRecord(
                user_id=user.id, title="Complete Blood Count",
                category="blood_test", doctor="Dr. Priya Sharma",
                hospital="Apollo Hospital",
                date=date.today() - timedelta(days=30),
                findings="All values within normal range. Hemoglobin: 14.2 g/dL",
            ),
            MedicalRecord(
                user_id=user.id, title="Chest X-Ray",
                category="imaging", doctor="Dr. Kumar",
                hospital="Fortis Hospital",
                date=date.today() - timedelta(days=90),
                findings="Clear lungs, no abnormalities detected",
            ),
            MedicalRecord(
                user_id=user.id, title="Allergy Test Panel",
                category="blood_test", doctor="Dr. Raj Patel",
                hospital="Max Healthcare",
                date=date.today() - timedelta(days=60),
                findings="Positive for dust mites and peanut allergy. IgE elevated.",
            ),
        ]
        db.add_all(records)

        # ─── Emergency Contacts ──────────────────────────────────────
        contacts = [
            EmergencyContact(user_id=user.id, name="Dad", phone="+91-9876543210", relation="Father", is_primary=True),
            EmergencyContact(user_id=user.id, name="Mom", phone="+91-9876543211", relation="Mother"),
            EmergencyContact(user_id=user.id, name="Dr. Priya Sharma", phone="+91-9988776655", relation="Doctor"),
        ]
        db.add_all(contacts)

        # ─── Family Members ──────────────────────────────────────────
        family = [
            FamilyMember(
                user_id=user.id, name="Rajesh Patel", relation="father",
                age=55, blood_type="B+", avatar="👨",
                conditions=["Type 2 Diabetes", "Hypertension"],
                medications=["Metformin", "Amlodipine"],
            ),
            FamilyMember(
                user_id=user.id, name="Meena Patel", relation="mother",
                age=52, blood_type="A+", avatar="👩",
                conditions=["Thyroid"], medications=["Levothyroxine"],
            ),
        ]
        db.add_all(family)


        # ─── Health Data (6 months) ──────────────────────────────────
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
        weights = [74, 73.5, 73, 72.5, 72.2, 72]
        sugars = [95, 98, 92, 88, 90, 87]
        heart_rates = [72, 74, 70, 68, 72, 70]
        bp_sys = [120, 122, 118, 115, 120, 118]
        bp_dia = [80, 82, 78, 75, 80, 78]
        chol = [190, 185, 180, 178, 175, 172]

        for i, label in enumerate(months):
            dt = datetime(2024, i + 1, 15, tzinfo=timezone.utc)
            db.add(HealthEntry(user_id=user.id, category="weight", value=weights[i], label=label, recorded_at=dt))
            db.add(HealthEntry(user_id=user.id, category="blood_sugar", value=sugars[i], label=label, recorded_at=dt))
            db.add(HealthEntry(user_id=user.id, category="heart_rate", value=heart_rates[i], label=label, recorded_at=dt))
            db.add(HealthEntry(user_id=user.id, category="blood_pressure", value=bp_sys[i], secondary_value=bp_dia[i], label=label, recorded_at=dt))
            db.add(HealthEntry(user_id=user.id, category="cholesterol", value=chol[i], label=label, recorded_at=dt))

        # ─── Water Intake ────────────────────────────────────────────


        # ─── Sleep Data ──────────────────────────────────────────────
        for i in range(7):
            d = date.today() - timedelta(days=i)
            hours = [7.5, 6.8, 8.0, 7.2, 6.5, 7.8, 8.2][i]
            db.add(SleepEntry(
                user_id=user.id, date=d, hours=hours, quality=min(5, max(1, round(hours - 3))),
                bedtime=time(23, 0), wake_time=time(7, 0),
            ))

        # ─── Expenses ───────────────────────────────────────────────
        expenses = [
            MedicalExpense(user_id=user.id, description="Monthly medicines", category="medicine", amount=1200, date=date.today() - timedelta(days=5)),
            MedicalExpense(user_id=user.id, description="Pulmonologist consultation", category="doctor", amount=800, date=date.today() - timedelta(days=30)),
            MedicalExpense(user_id=user.id, description="Blood test panel", category="tests", amount=1500, date=date.today() - timedelta(days=30)),
        ]
        db.add_all(expenses)

        # ─── Mood Entries ────────────────────────────────────────────
        mood_emojis = ["😄", "🙂", "😐", "🙂", "😄", "😔", "🙂"]
        for i, emoji in enumerate(mood_emojis):
            entry = MoodEntry(
                user_id=user.id, mood=emoji,
            )
            db.add(entry)

        # ─── Badges ─────────────────────────────────────────────────
        db.add(UserBadge(user_id=user.id, badge_name="First Steps"))
        db.add(UserBadge(user_id=user.id, badge_name="Early Bird"))

        await db.commit()

    await engine.dispose()
    print("✅ Database seeded successfully!")
    print("\n📧 Login credentials:")
    print("   Email:    gaurav@lifeos.com")
    print("   Password: password123")


if __name__ == "__main__":
    asyncio.run(seed())
