"""
LifeOS Backend — Database Models Package
Imports all models so Alembic and Base.metadata can discover them.
"""

from app.models.user import User, UserProfile, PasswordResetToken, LoginHistory, BlockedIP, UserActivity
from app.models.medical_record import MedicalRecord
from app.models.medicine import Medicine, MedicineLibrary
from app.models.gamification import UserGamification
from app.models.disease import DiseaseLibrary, SymptomLibrary, SymptomCheckHistory
from app.models.diet import Recipe, MealPlan, ScannedMeal
from app.models.appointment import Appointment
from app.models.emergency import EmergencyContact, SOSLog
from app.models.family import FamilyMember, Vaccination
from app.models.health_tracker import HealthEntry, SleepEntry, WaterLog
from app.models.expense import MedicalExpense
from app.models.challenge import CommunityChallenge, ChallengeProgress, UserBadge
from app.models.mood import MoodEntry, JournalEntry
from app.models.chat import ChatMessage
from app.models.share import SharedLink
from app.models.admin import SystemSetting, AdminAuditLog, AIUsageLog, Role, Permission, RolePermission, AdminUser, AdminLog, AuditLog, ApiLog
from app.models.ai_prompt import AIPrompt, AIPromptVersion
from app.models.fitness import Exercise, WorkoutPlan
from app.models.article import HealthArticle
from app.models.notification import SystemNotification
from app.models.feedback import UserFeedback
from app.models.file_asset import FileAsset

__all__ = [
    "User", "UserProfile", "PasswordResetToken", "LoginHistory", "BlockedIP", "UserActivity",
    "MedicalRecord",
    "Medicine", "MedicineLibrary",
    "DiseaseLibrary", "SymptomLibrary", "SymptomCheckHistory",
    "Appointment",
    "EmergencyContact", "SOSLog",
    "FamilyMember", "Vaccination",
    "HealthEntry", "SleepEntry", "WaterLog",
    "MedicalExpense",
    "ChallengeProgress", "UserBadge",
    "MoodEntry", "JournalEntry",
    "ChatMessage",
    "SharedLink",
    "SystemSetting", "AdminAuditLog", "AIUsageLog", "Role", "Permission", "RolePermission", "AdminUser", "AdminLog", "AuditLog", "ApiLog",
    "AIPrompt", "AIPromptVersion",
    "Exercise", "WorkoutPlan",
    "HealthArticle", "SystemNotification", "UserFeedback",
    "Recipe", "MealPlan", "FileAsset"
]
