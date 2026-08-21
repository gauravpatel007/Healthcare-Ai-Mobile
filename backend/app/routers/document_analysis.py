from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import os

from app.database import get_db
from app.models.medical_record import MedicalRecord
from app.models.lab_metric import LabMetric
from app.models.health_tracker import HealthEntry
from app.dependencies import CurrentUserId
from app.services.document_ai_service import document_ai_service
from datetime import datetime, timezone

router = APIRouter(prefix="/records", tags=["Document Analysis"])

@router.post("/{record_id}/analyze")
async def analyze_record(
    record_id: str,
    current_user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db)
):
    """
    Triggers AI analysis on a specific medical record file (PDF/Image)
    and extracts structured lab metrics.
    """
    result = await db.execute(
        select(MedicalRecord).where(
            MedicalRecord.id == record_id, 
            MedicalRecord.user_id == current_user_id
        )
    )
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found.")
        
    if not record.file_path:
        raise HTTPException(status_code=400, detail="No file attached to this record.")
        
    record_info = f"Title: {record.title}\nCategory: {record.category}\nDoctor: {record.doctor or 'N/A'}\nHospital: {record.hospital or 'N/A'}\nFindings: {record.findings or 'None'}\nNotes: {record.notes or 'None'}"
    
    abs_path = None
    if record.file_path:
        # Check if file exists on disk
        temp_path = os.path.abspath(record.file_path)
        if os.path.exists(temp_path):
            abs_path = temp_path
        else:
            temp_path = os.path.join(os.getcwd(), record.file_path)
            if os.path.exists(temp_path):
                abs_path = temp_path
    
    # Call AI service with or without file (fallback to metadata analysis)
    try:
        analysis_result = await document_ai_service.analyze_document(abs_path, record_info=record_info)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Analysis Failed: {str(e)}")

    summary = analysis_result.get("summary", "No summary generated.")
    metrics_data = analysis_result.get("metrics", [])

    # Update medical record
    record.ai_analyzed = True
    record.ai_summary = summary

    # Clear existing metrics
    await db.execute(delete(LabMetric).where(LabMetric.record_id == record.id))
    
    # Save new metrics
    new_metrics = []
    record_date = record.date if record.date else None
    
    for metric in metrics_data:
        m = LabMetric(
            user_id=current_user_id,
            record_id=record.id,
            metric_name=metric.get("metric_name", "Unknown"),
            value=str(metric.get("value", "")),
            unit=metric.get("unit"),
            reference_range=metric.get("reference_range"),
            status=metric.get("status"),
            recorded_date=record_date
        )
        db.add(m)
        new_metrics.append(m)
        
        # Check if it maps to a HealthEntry for the main graph
        metric_name_lower = m.metric_name.lower()
        val_str = str(metric.get("value", "")).strip()
        
        if not val_str:
            continue
            
        try:
            # Blood Pressure
            if "blood pressure" in metric_name_lower or "bp" == metric_name_lower:
                if "/" in val_str:
                    parts = val_str.split("/")
                    he = HealthEntry(
                        user_id=current_user_id,
                        category="blood_pressure",
                        value=float(parts[0]),
                        secondary_value=float(parts[1]),
                        recorded_at=record_date if record_date else datetime.now(timezone.utc)
                    )
                    db.add(he)
            # Weight
            elif "weight" in metric_name_lower:
                he = HealthEntry(
                    user_id=current_user_id,
                    category="weight",
                    value=float(val_str),
                    recorded_at=record_date if record_date else datetime.now(timezone.utc)
                )
                db.add(he)
            # Heart Rate / Pulse
            elif "heart rate" in metric_name_lower or "pulse" in metric_name_lower:
                he = HealthEntry(
                    user_id=current_user_id,
                    category="heart_rate",
                    value=float(val_str),
                    recorded_at=record_date if record_date else datetime.now(timezone.utc)
                )
                db.add(he)
            # Blood Sugar / Glucose
            elif "sugar" in metric_name_lower or "glucose" in metric_name_lower:
                he = HealthEntry(
                    user_id=current_user_id,
                    category="blood_sugar",
                    value=float(val_str),
                    recorded_at=record_date if record_date else datetime.now(timezone.utc)
                )
                db.add(he)
            # Cholesterol
            elif "cholesterol" in metric_name_lower:
                he = HealthEntry(
                    user_id=current_user_id,
                    category="cholesterol",
                    value=float(val_str),
                    recorded_at=record_date if record_date else datetime.now(timezone.utc)
                )
                db.add(he)
        except ValueError:
            # Ignore parsing errors for HealthEntry, still saved in LabMetric
            pass
            
    await db.commit()
    
    return {
        "success": True,
        "summary": summary,
        "metrics_extracted": len(new_metrics)
    }

@router.get("/{record_id}/metrics")
async def get_record_metrics(
    record_id: str,
    current_user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db)
):
    """
    Get the extracted metrics for a specific record.
    """
    result = await db.execute(
        select(MedicalRecord).where(
            MedicalRecord.id == record_id, 
            MedicalRecord.user_id == current_user_id
        )
    )
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found.")
        
    metrics_result = await db.execute(
        select(LabMetric).where(LabMetric.record_id == record.id)
    )
    metrics = metrics_result.scalars().all()
    
    return {
        "record_id": record.id,
        "ai_analyzed": record.ai_analyzed,
        "ai_summary": record.ai_summary,
        "metrics": metrics
    }

@router.get("/user/lab-metrics")
async def get_user_lab_metrics(
    current_user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all extracted metrics for the current user for charting.
    """
    metrics_result = await db.execute(
        select(LabMetric).where(LabMetric.user_id == current_user_id).order_by(LabMetric.recorded_date.asc())
    )
    metrics = metrics_result.scalars().all()
    return metrics
