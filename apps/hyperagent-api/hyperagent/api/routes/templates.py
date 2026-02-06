"""Template management API endpoints"""

import logging
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.core.config import settings
from hyperagent.db.session import get_db
from hyperagent.llm.provider import LLMProviderFactory
from hyperagent.models.template import ContractTemplate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/templates", tags=["templates"])


class TemplateResponse(BaseModel):
    """Template response model"""

    id: str
    name: str
    description: Optional[str]
    contract_type: Optional[str]
    template_code: str
    version: Optional[str]
    is_active: bool
    tags: List[str]
    created_at: str
    updated_at: Optional[str]


class TemplateSearchRequest(BaseModel):
    """Template search request"""

    query: str
    contract_type: Optional[str] = None
    limit: int = 5
    similarity_threshold: float = 0.7


class TemplateUpdateRequest(BaseModel):
    """Template update request"""

    name: Optional[str] = None
    description: Optional[str] = None
    contract_type: Optional[str] = None
    template_code: Optional[str] = None
    version: Optional[str] = None
    is_active: Optional[bool] = None
    tags: Optional[List[str]] = None
    upload_to_ipfs: bool = True  # Re-upload to IPFS if code changed


class TemplateCreateRequest(BaseModel):
    """Template creation request"""

    name: str
    description: Optional[str] = None
    contract_type: Optional[str] = None
    template_code: str
    ipfs_hash: Optional[str] = None
    version: Optional[str] = "1.0.0"
    is_active: bool = True
    tags: List[str] = []
    upload_to_ipfs: bool = True  # Auto-upload to IPFS if Pinata configured


@router.get("", response_model=List[TemplateResponse])
async def list_templates(
    contract_type: Optional[str] = Query(None, description="Filter by contract type"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List all contract templates"""
    try:
        query = select(ContractTemplate)

        if contract_type:
            query = query.where(ContractTemplate.contract_type == contract_type)

        if is_active is not None:
            query = query.where(ContractTemplate.is_active == is_active)

        query = query.limit(limit).offset(offset)

        result = await db.execute(query)
        templates = result.scalars().all()

        return [
            TemplateResponse(
                id=str(t.id),
                name=t.name,
                description=t.description,
                contract_type=t.contract_type,
                template_code=t.template_code,
                version=t.version,
                is_active=t.is_active,
                tags=t.tags or [],
                created_at=t.created_at.isoformat() if t.created_at else "",
                updated_at=t.updated_at.isoformat() if t.updated_at else None,
            )
            for t in templates
        ]
    except Exception as e:
        logger.error(f"Error listing templates: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list templates")


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str, db: AsyncSession = Depends(get_db)):
    """Get template details by ID"""
    try:
        template_uuid = uuid.UUID(template_id)
        result = await db.execute(
            select(ContractTemplate).where(ContractTemplate.id == template_uuid)
        )
        template = result.scalar_one_or_none()

        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        return TemplateResponse(
            id=str(template.id),
            name=template.name,
            description=template.description,
            contract_type=template.contract_type,
            template_code=template.template_code,
            version=template.version,
            is_active=template.is_active,
            tags=template.tags or [],
            created_at=template.created_at.isoformat() if template.created_at else "",
            updated_at=template.updated_at.isoformat() if template.updated_at else None,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid template ID format")
    except Exception as e:
        logger.error(f"Error getting template: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get template")


@router.post("", response_model=TemplateResponse)
async def create_template(request: TemplateCreateRequest, db: AsyncSession = Depends(get_db)):
    """Create a new template (admin only - add auth later)"""
    try:
        # Check if template with same name exists
        result = await db.execute(
            select(ContractTemplate).where(ContractTemplate.name == request.name)
        )
        existing = result.scalar_one_or_none()

        if existing:
            raise HTTPException(status_code=400, detail="Template with this name already exists")

        # Generate embedding for template
        if not settings.gemini_api_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

        llm_provider = LLMProviderFactory.create(
            "gemini", api_key=settings.gemini_api_key, model_name=settings.gemini_model
        )

        embedding_text = f"{request.description or ''}\n{request.template_code[:500]}"
        embedding = await llm_provider.embed(embedding_text)

        # Upload to IPFS if requested and Pinata is configured
        ipfs_hash = request.ipfs_hash
        if not ipfs_hash and settings.pinata_jwt and request.upload_to_ipfs:
            try:
                from hyperagent.rag.pinata_manager import PinataManager

                pinata = PinataManager(settings.pinata_jwt)
                upload_result = await pinata.upload_template_with_metadata(
                    name=f"{request.name}.sol",
                    content=request.template_code,
                    metadata={
                        "name": request.name,
                        "contract_type": request.contract_type,
                        "version": request.version,
                        "source": "api",
                    },
                )
                ipfs_hash = upload_result["ipfs_hash"]
                logger.info(f"Uploaded template '{request.name}' to IPFS: {ipfs_hash}")
            except Exception as e:
                logger.warning(f"IPFS upload failed: {e}")
                # Continue without IPFS hash

        # Create template
        template = ContractTemplate(
            name=request.name,
            description=request.description,
            contract_type=request.contract_type,
            template_code=request.template_code,
            ipfs_hash=ipfs_hash,
            embedding=embedding,
            version=request.version,
            is_active=request.is_active,
            tags=request.tags,
        )

        db.add(template)
        await db.commit()
        await db.refresh(template)

        return TemplateResponse(
            id=str(template.id),
            name=template.name,
            description=template.description,
            contract_type=template.contract_type,
            template_code=template.template_code,
            version=template.version,
            is_active=template.is_active,
            tags=template.tags or [],
            created_at=template.created_at.isoformat() if template.created_at else "",
            updated_at=template.updated_at.isoformat() if template.updated_at else None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating template: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create template")


@router.post("/search", response_model=List[TemplateResponse])
async def search_templates(request: TemplateSearchRequest, db: AsyncSession = Depends(get_db)):
    """Semantic search for templates using vector similarity"""
    try:
        from hyperagent.rag.template_retriever import TemplateRetriever

        if not settings.gemini_api_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

        llm_provider = LLMProviderFactory.create(
            "gemini", api_key=settings.gemini_api_key, model_name=settings.gemini_model
        )

        retriever = TemplateRetriever(llm_provider, db)
        templates = await retriever.retrieve_templates(
            request.query,
            contract_type=request.contract_type or "Custom",
            limit=request.limit,
            similarity_threshold=request.similarity_threshold,
        )

        # Convert to response format
        return [
            TemplateResponse(
                id=t["id"],
                name=t["name"],
                description=t.get("description"),
                contract_type=t.get("contract_type"),
                template_code=t["template_code"],
                version=t.get("version"),
                is_active=True,
                tags=t.get("tags", []),
                created_at="",
                updated_at=None,
            )
            for t in templates
        ]
    except Exception as e:
        logger.error(f"Error searching templates: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to search templates")


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: str, request: TemplateUpdateRequest, db: AsyncSession = Depends(get_db)
):
    """
    Update template (admin only - add auth later)

    If template_code is updated:
    - Re-upload to IPFS (new hash)
    - Regenerate embedding
    - Store old IPFS hash in metadata for version history
    """
    try:
        template_uuid = uuid.UUID(template_id)
        result = await db.execute(
            select(ContractTemplate).where(ContractTemplate.id == template_uuid)
        )
        template = result.scalar_one_or_none()

        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        # Track if code changed (requires IPFS re-upload and embedding regeneration)
        code_changed = request.template_code and request.template_code != template.template_code
        old_ipfs_hash = template.ipfs_hash

        # Update fields
        if request.name is not None:
            template.name = request.name
        if request.description is not None:
            template.description = request.description
        if request.contract_type is not None:
            template.contract_type = request.contract_type
        if request.version is not None:
            template.version = request.version
        if request.is_active is not None:
            template.is_active = request.is_active
        if request.tags is not None:
            template.tags = request.tags

        # Handle code update
        if code_changed:
            template.template_code = request.template_code

            # Re-upload to IPFS if enabled
            new_ipfs_hash = None
            if settings.pinata_jwt and request.upload_to_ipfs:
                try:
                    from hyperagent.rag.pinata_manager import PinataManager

                    pinata = PinataManager(settings.pinata_jwt)
                    upload_result = await pinata.upload_template_with_metadata(
                        name=f"{template.name}.sol",
                        content=request.template_code,
                        metadata={
                            "name": template.name,
                            "contract_type": template.contract_type,
                            "version": template.version,
                            "source": "api_update",
                        },
                    )
                    new_ipfs_hash = upload_result["ipfs_hash"]
                    logger.info(f"Re-uploaded template to IPFS: {new_ipfs_hash}")
                except Exception as e:
                    logger.warning(f"IPFS re-upload failed: {e}")

            # Store old IPFS hash in template_metadata for version history
            if template.template_metadata is None:
                template.template_metadata = {}
            if "version_history" not in template.template_metadata:
                template.template_metadata["version_history"] = []
            template.template_metadata["version_history"].append(
                {"ipfs_hash": old_ipfs_hash, "updated_at": datetime.now().isoformat()}
            )

            template.ipfs_hash = new_ipfs_hash or old_ipfs_hash

            # Regenerate embedding
            if settings.gemini_api_key:
                llm_provider = LLMProviderFactory.create(
                    "gemini", api_key=settings.gemini_api_key, model_name=settings.gemini_model
                )
                embedding_text = f"{template.description or ''}\n{request.template_code[:500]}"
                template.embedding = await llm_provider.embed(embedding_text)

        await db.commit()
        await db.refresh(template)

        return TemplateResponse(
            id=str(template.id),
            name=template.name,
            description=template.description,
            contract_type=template.contract_type,
            template_code=template.template_code,
            version=template.version,
            is_active=template.is_active,
            tags=template.tags or [],
            created_at=template.created_at.isoformat() if template.created_at else "",
            updated_at=template.updated_at.isoformat() if template.updated_at else None,
        )

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid template ID format")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating template: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update template")


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    soft_delete: bool = True,
    unpin_from_ipfs: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete template (admin only - add auth later)

    Args:
        template_id: Template ID to delete
        soft_delete: If True, set is_active=False. If False, hard delete.
        unpin_from_ipfs: If True, unpin from IPFS (only if soft_delete=False)
    """
    try:
        template_uuid = uuid.UUID(template_id)
        result = await db.execute(
            select(ContractTemplate).where(ContractTemplate.id == template_uuid)
        )
        template = result.scalar_one_or_none()

        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        if soft_delete:
            # Soft delete
            template.is_active = False
            await db.commit()
            logger.info(f"Soft deleted template: {template_id}")
        else:
            # Hard delete
            ipfs_hash = template.ipfs_hash

            # Optionally unpin from IPFS
            if unpin_from_ipfs and ipfs_hash and settings.pinata_jwt:
                try:
                    from hyperagent.rag.pinata_manager import PinataManager

                    pinata = PinataManager(settings.pinata_jwt)
                    await pinata.unpin(ipfs_hash)
                    logger.info(f"Unpinned template from IPFS: {ipfs_hash}")
                except Exception as e:
                    logger.warning(f"Failed to unpin from IPFS: {e}")

            await db.delete(template)
            await db.commit()
            logger.info(f"Hard deleted template: {template_id}")

        return {
            "status": "success",
            "template_id": template_id,
            "deleted": not soft_delete,
            "unpinned_from_ipfs": unpin_from_ipfs and not soft_delete,
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid template ID format")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting template: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete template")


@router.post("/{template_id}/verify")
async def verify_template(template_id: str, db: AsyncSession = Depends(get_db)):
    """
    Verify template integrity against IPFS

    Returns:
        Verification result with hash comparison
    """
    try:
        template_uuid = uuid.UUID(template_id)
        result = await db.execute(
            select(ContractTemplate).where(ContractTemplate.id == template_uuid)
        )
        template = result.scalar_one_or_none()

        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        if not template.ipfs_hash:
            return {"verified": False, "error": "Template has no IPFS hash"}

        if not settings.pinata_jwt:
            raise HTTPException(status_code=500, detail="PINATA_JWT not configured")

        from hyperagent.rag.pinata_manager import PinataManager

        pinata = PinataManager(settings.pinata_jwt)

        # Verify integrity
        verified = await pinata.verify_template_integrity(
            template.ipfs_hash, template.template_code or ""
        )

        return {
            "verified": verified,
            "ipfs_hash": template.ipfs_hash,
            "content_hash": template.ipfs_hash,  # IPFS hash is the content hash
            "match": verified,
            "verified_at": datetime.now().isoformat(),
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid template ID format")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying template: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to verify template")


class IPFSImportRequest(BaseModel):
    """IPFS import request"""

    ipfs_hash: str  # IPFS CID
    name: Optional[str] = None  # Auto-detect from IPFS if not provided
    contract_type: Optional[str] = None
    description: Optional[str] = None
    tags: List[str] = []
    verify_integrity: bool = True  # Verify IPFS hash matches content


class BulkIPFSImportRequest(BaseModel):
    """Bulk IPFS import request"""

    ipfs_hashes: List[str]  # List of IPFS CIDs
    verify_integrity: bool = True


@router.post("/import-from-ipfs", response_model=TemplateResponse)
async def import_template_from_ipfs(request: IPFSImportRequest, db: AsyncSession = Depends(get_db)):
    """
    Import community template from IPFS

    Concept: Community uploads to IPFS, we import to VectorDB
    Flow:
        1. Validate IPFS hash format
        2. Retrieve template from IPFS via Pinata
        3. Verify integrity (optional)
        4. Generate embedding
        5. Store in VectorDB
        6. Return template details
    """
    try:
        # Validate IPFS hash format (basic check)
        if not request.ipfs_hash.startswith("Qm") and not request.ipfs_hash.startswith("baf"):
            raise HTTPException(
                status_code=400, detail="Invalid IPFS hash format. Must start with 'Qm' or 'baf'"
            )

        if not settings.pinata_jwt:
            raise HTTPException(
                status_code=500, detail="PINATA_JWT not configured. Cannot retrieve from IPFS."
            )

        from hyperagent.rag.pinata_manager import PinataManager

        pinata = PinataManager(settings.pinata_jwt)

        # Retrieve template from IPFS
        try:
            template_code = await pinata.retrieve_template(request.ipfs_hash)
        except Exception as e:
            logger.error(f"Failed to retrieve template from IPFS: {e}")
            raise HTTPException(
                status_code=404, detail=f"Template not found on IPFS: {request.ipfs_hash}"
            )

        # Verify integrity if requested
        if request.verify_integrity:
            verified = await pinata.verify_template_integrity(request.ipfs_hash, template_code)
            if not verified:
                raise HTTPException(
                    status_code=400, detail="IPFS hash integrity verification failed"
                )

        # Check if template already exists
        result = await db.execute(
            select(ContractTemplate).where(ContractTemplate.ipfs_hash == request.ipfs_hash)
        )
        existing = result.scalar_one_or_none()

        if existing:
            logger.info(f"Template with IPFS hash {request.ipfs_hash} already exists")
            return TemplateResponse(
                id=str(existing.id),
                name=existing.name,
                description=existing.description,
                contract_type=existing.contract_type,
                template_code=existing.template_code,
                version=existing.version,
                is_active=existing.is_active,
                tags=existing.tags or [],
                created_at=existing.created_at.isoformat() if existing.created_at else "",
                updated_at=existing.updated_at.isoformat() if existing.updated_at else None,
            )

        # Generate embedding
        if not settings.gemini_api_key:
            raise HTTPException(
                status_code=500, detail="GEMINI_API_KEY not configured. Cannot generate embeddings."
            )

        llm_provider = LLMProviderFactory.create(
            "gemini", api_key=settings.gemini_api_key, model_name=settings.gemini_model
        )

        embedding_text = f"{request.description or ''}\n{template_code[:500]}"
        embedding = await llm_provider.embed(embedding_text)

        # Create template
        template = ContractTemplate(
            name=request.name or f"Imported_{request.ipfs_hash[:8]}",
            description=request.description,
            contract_type=request.contract_type,
            template_code=template_code,
            ipfs_hash=request.ipfs_hash,
            embedding=embedding,
            version="1.0.0",
            is_active=True,
            tags=request.tags,
        )

        db.add(template)
        await db.commit()
        await db.refresh(template)

        logger.info(f"Imported template from IPFS: {request.ipfs_hash}")

        return TemplateResponse(
            id=str(template.id),
            name=template.name,
            description=template.description,
            contract_type=template.contract_type,
            template_code=template.template_code,
            version=template.version,
            is_active=template.is_active,
            tags=template.tags or [],
            created_at=template.created_at.isoformat() if template.created_at else "",
            updated_at=template.updated_at.isoformat() if template.updated_at else None,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing template from IPFS: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to import template: {str(e)}")


@router.post("/import-bulk-from-ipfs")
async def import_bulk_from_ipfs(request: BulkIPFSImportRequest, db: AsyncSession = Depends(get_db)):
    """
    Import multiple templates from IPFS hashes

    Returns:
        List of import results with success/failure status
    """
    results = []

    for ipfs_hash in request.ipfs_hashes:
        try:
            import_request = IPFSImportRequest(
                ipfs_hash=ipfs_hash, verify_integrity=request.verify_integrity
            )
            template = await import_template_from_ipfs(import_request, db)
            results.append(
                {
                    "ipfs_hash": ipfs_hash,
                    "status": "success",
                    "template_id": template.id,
                    "name": template.name,
                }
            )
        except Exception as e:
            results.append({"ipfs_hash": ipfs_hash, "status": "failed", "error": str(e)})

    return {
        "total": len(request.ipfs_hashes),
        "success": len([r for r in results if r["status"] == "success"]),
        "failed": len([r for r in results if r["status"] == "failed"]),
        "results": results,
    }
