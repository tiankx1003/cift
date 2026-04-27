import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schemas import (
    PromptTemplateCreate, PromptTemplateUpdate, PromptTemplateInfo,
)
from ..services import get_db, PromptTemplate

router = APIRouter(prefix="/internal/kbs", tags=["prompt-templates"])


@router.get("/{kb_id}/prompt-templates", response_model=list[PromptTemplateInfo])
async def list_templates(kb_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PromptTemplate).where(
            (PromptTemplate.kb_id == kb_id) | (PromptTemplate.kb_id.is_(None))
        ).order_by(PromptTemplate.is_default.desc(), PromptTemplate.created_at.asc())
    )
    templates = result.scalars().all()
    return [
        PromptTemplateInfo(
            id=t.id, kb_id=t.kb_id, name=t.name,
            system_prompt=t.system_prompt, rag_template=t.rag_template,
            is_default=t.is_default,
        )
        for t in templates
    ]


@router.post("/{kb_id}/prompt-templates", response_model=PromptTemplateInfo)
async def create_template(kb_id: str, req: PromptTemplateCreate, db: AsyncSession = Depends(get_db)):
    template = PromptTemplate(
        id=uuid.uuid4().hex[:32],
        kb_id=kb_id,
        name=req.name,
        system_prompt=req.system_prompt,
        rag_template=req.rag_template,
        is_default=req.is_default,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return PromptTemplateInfo(
        id=template.id, kb_id=template.kb_id, name=template.name,
        system_prompt=template.system_prompt, rag_template=template.rag_template,
        is_default=template.is_default,
    )


@router.put("/{kb_id}/prompt-templates/{template_id}", response_model=PromptTemplateInfo)
async def update_template(kb_id: str, template_id: str, req: PromptTemplateUpdate, db: AsyncSession = Depends(get_db)):
    template = await db.get(PromptTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if req.name is not None:
        template.name = req.name
    if req.system_prompt is not None:
        template.system_prompt = req.system_prompt
    if req.rag_template is not None:
        template.rag_template = req.rag_template
    if req.is_default is not None:
        template.is_default = req.is_default

    await db.commit()
    await db.refresh(template)
    return PromptTemplateInfo(
        id=template.id, kb_id=template.kb_id, name=template.name,
        system_prompt=template.system_prompt, rag_template=template.rag_template,
        is_default=template.is_default,
    )


@router.delete("/{kb_id}/prompt-templates/{template_id}")
async def delete_template(kb_id: str, template_id: str, db: AsyncSession = Depends(get_db)):
    template = await db.get(PromptTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(template)
    await db.commit()
    return {"status": "ok"}


@router.put("/{kb_id}/prompt-templates/{template_id}/default", response_model=PromptTemplateInfo)
async def set_default_template(kb_id: str, template_id: str, db: AsyncSession = Depends(get_db)):
    # Unset all defaults for this KB
    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.kb_id == kb_id,
            PromptTemplate.is_default == True,
        )
    )
    for tmpl in result.scalars().all():
        tmpl.is_default = False

    template = await db.get(PromptTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    template.is_default = True
    await db.commit()
    await db.refresh(template)
    return PromptTemplateInfo(
        id=template.id, kb_id=template.kb_id, name=template.name,
        system_prompt=template.system_prompt, rag_template=template.rag_template,
        is_default=template.is_default,
    )
