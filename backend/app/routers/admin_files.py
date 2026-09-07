"""
Admin File Manager Router
Handles file metadata CRUD operations for the admin dashboard.
"""

import os
import shutil
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
from app.database import get_db
from app.models.file_asset import FileAsset

router = APIRouter(prefix="/admin/files", tags=["Admin File Manager"])


class FileAssetUpdate(BaseModel):
    name: str
    category: str

class FileAssetResponse(BaseModel):
    id: str
    name: str
    type: str
    category: str
    size_bytes: int
    file_path: str

    class Config:
        from_attributes = True


@router.get("", response_model=List[FileAssetResponse])
@router.get("/", response_model=List[FileAssetResponse])
async def get_all_files(category: str = None, db: AsyncSession = Depends(get_db)):
    """Fetch all file assets, including user uploaded medical records."""
    # 1. Fetch Admin FileAssets
    query = select(FileAsset)
    if category and category != "All":
        query = query.where(FileAsset.category == category)
        
    result = await db.execute(query)
    assets = result.scalars().all()
    
    files = [
        FileAssetResponse(
            id=a.id,
            name=a.name,
            type=a.type,
            category=a.category,
            size_bytes=a.size_bytes,
            file_path=a.file_path
        ) for a in assets
    ]
    
    # 2. Fetch User MedicalRecords
    from app.models.medical_record import MedicalRecord
    record_query = select(MedicalRecord).where(MedicalRecord.file_path.isnot(None))
    res2 = await db.execute(record_query)
    records = res2.scalars().all()
    
    for r in records:
        # Determine category based on extension if not mapping directly
        ext = r.file_path.lower().split('.')[-1] if r.file_path else ""
        cat = "Reports"
        file_type = "unknown"
        if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
            file_type = f"image/{ext}"
        elif ext == 'pdf':
            file_type = "application/pdf"
            
        # Get file size if possible
        size = 0
        try:
            # removing leading slash if present for local path resolution
            local_path = r.file_path.lstrip('/')
            if os.path.exists(local_path):
                size = os.path.getsize(local_path)
        except Exception:
            pass
            
        if not category or category == "All" or category == cat:
            files.append(
                FileAssetResponse(
                    id=r.id,
                    name=r.title,
                    type=file_type,
                    category=cat,
                    size_bytes=size,
                    file_path=r.file_path
                )
            )
            
    return files


@router.post("", response_model=FileAssetResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=FileAssetResponse, status_code=status.HTTP_201_CREATED)
async def create_file(
    name: str = Form(...),
    category: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload a new file and create asset record."""
    settings = get_settings()
    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)

    # Generate unique filename to avoid collisions
    ext = os.path.splitext(file.filename or "file")[1]
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(upload_dir, unique_filename)

    # Read file content
    try:
        content = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")

    file_size = len(content)

    new_file = FileAsset(
        name=name,
        type=file.content_type or "unknown",
        category=category,
        size_bytes=file_size,
        file_path=f"/uploads/{unique_filename}"
    )
    db.add(new_file)
    try:
        await db.commit()
        await db.refresh(new_file)
        return new_file
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{file_id}", response_model=FileAssetResponse)
async def update_file(file_id: str, update_data: FileAssetUpdate, db: AsyncSession = Depends(get_db)):
    """Update file asset metadata."""
    result = await db.execute(select(FileAsset).where(FileAsset.id == file_id))
    file_record = result.scalars().first()
    
    if file_record:
        file_record.name = update_data.name
        file_record.category = update_data.category
        try:
            await db.commit()
            await db.refresh(file_record)
            return file_record
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
            
    # Try MedicalRecord
    from app.models.medical_record import MedicalRecord
    res2 = await db.execute(select(MedicalRecord).where(MedicalRecord.id == file_id))
    med_record = res2.scalars().first()
    
    if not med_record:
        raise HTTPException(status_code=404, detail="File not found")
        
    med_record.title = update_data.name
    # Note: MedicalRecord category is its own set of tabs (e.g. Blood Test), but we can allow it to be overwritten or keep it
    med_record.category = update_data.category
    
    try:
        await db.commit()
        await db.refresh(med_record)
        return FileAssetResponse(
            id=med_record.id,
            name=med_record.title,
            type="unknown",
            category=med_record.category,
            size_bytes=0,
            file_path=med_record.file_path or ""
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(file_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a file asset record."""
    result = await db.execute(select(FileAsset).where(FileAsset.id == file_id))
    file_record = result.scalars().first()
    
    if file_record:
        try:
            await db.delete(file_record)
            await db.commit()
            return
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
            
    # Try MedicalRecord
    from app.models.medical_record import MedicalRecord
    res2 = await db.execute(select(MedicalRecord).where(MedicalRecord.id == file_id))
    med_record = res2.scalars().first()
    
    if not med_record:
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        await db.delete(med_record)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
