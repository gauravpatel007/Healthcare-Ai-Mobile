# LifeOS - Healthcare AI Features

LifeOS is an AI-powered healthcare operating system with a comprehensive set of features spanning authentication, medical record management, health tracking, and advanced AI integration.

## 🔐 Authentication & Identity
*   **Standard Email/Password Auth**: Secure JWT-based session management with password hashing (`bcrypt`).
*   **Google OAuth**: Quick sign-in and registration using Google accounts.
*   **Face Verification (Liveness)**: Experimental biometric face login using 128-float face descriptors.
*   **Two-Factor Authentication (2FA)**: Enhanced security via TOTP (Authenticator apps).
*   **Email Verification & Password Reset**: Secure flows with short-lived tokens and background email tasks.
*   **Role-Based Access Control (RBAC)**: Support for different user roles like 'patient', 'doctor', and 'admin'.

## 🩺 Core Healthcare Modules
*   **User Dashboard**: High-level summary and unified health-score calculation.
*   **Medical Records**: 
    *   CRUD operations for medical history.
    *   **File Uploads**: Secure storage for PDFs and images.
    *   **AI PDF Parsing**: Automatic extraction of health metrics (e.g., blood pressure) directly from uploaded medical reports.
*   **Medicines**: Medication tracking, CRUD operations, interaction checking, and refill reminders.
*   **Appointments**: Scheduling (CRUD) with AI-powered suggestions.
*   **Emergency Services**: Quick access to emergency contacts, SOS functions, medical QR data, and organ donor status.
*   **Family Management**: Track family members and their vaccination records.

## 📊 Health Tracking & Analytics
*   **Trackers**: Dedicated tracking for water intake, sleep cycles, general health metrics, and BMI/BMR calculators.
*   **Expenses**: Healthcare cost tracking and summaries.
*   **Challenges & Gamification**: Progress tracking, task completion, streaks, and achievement badges to encourage healthy habits.
*   **Analytics**: Health timeline, interactive graphs, risk assessments, and health predictions.

## 🤖 Advanced AI Integration (Powered by Groq Llama 3)
*   **AI Chat**: Intelligent health assistant for chat, history context, and daily tips (Includes a standalone Vector DB Chatbot application).
*   **AI Symptoms Analyzer**: Analyze reported symptoms for potential causes and recommendations.
*   **AI Nutritionist**: Personalized meal planning, macro tracking, and nutritional recommendations.
*   **AI Fitness Coach**: Custom workout generation, weekly planning, step tracking, and fitness statistics.
*   **AI Mental Health**: Mood tracking, AI-assisted journaling, stress analysis, and psychological screening.

---
*Note: This feature list reflects the current capabilities of the LifeOS platform (R1 backend).*
