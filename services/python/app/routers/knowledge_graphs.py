import asyncio
import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..services import get_db, get_chroma_client, KnowledgeGraph, ModelConfig
from ..services.llm.factory import create_llm_client_from_config
from ..utils import logger

router = APIRouter(prefix="/internal/kbs/{kb_id}/knowledge-graphs", tags=["knowledge-graphs"])

EXTRACTION_PROMPT = """从以下文本中抽取实体和关系，以 JSON 格式返回。
实体类型包括：人物、组织、地点、概念、事件、产品。
输出格式：
{"entities": [{"id": "e1", "name": "实体名", "type": "类型"}], "relations": [{"source": "e1", "target": "e2", "label": "关系描述"}]}
只返回 JSON，不要其他内容。

文本：
{text}"""


async def _build_graph(kb_id: str, graph_id: str, db: AsyncSession):
    """Background task to build knowledge graph."""
    try:
        graph = await db.get(KnowledgeGraph, graph_id)
        if not graph:
            return
        graph.status = "building"
        await db.commit()

        # 1. Get active LLM config
        result = await db.execute(
            select(ModelConfig).where(
                ModelConfig.model_type == "llm",
                ModelConfig.is_active == True,
            )
        )
        llm_config = result.scalar_one_or_none()
        if not llm_config:
            graph.status = "failed"
            graph.error_message = "请先在「管理」页面配置并激活 LLM 模型"
            await db.commit()
            return

        llm = create_llm_client_from_config(llm_config)

        # 2. Get chunks from ChromaDB
        settings = None
        from ..utils.config import get_settings
        settings = get_settings()
        chroma = get_chroma_client(settings)
        try:
            collection = chroma.get_collection(kb_id)
        except Exception:
            graph.status = "failed"
            graph.error_message = "知识库暂无分块数据"
            await db.commit()
            return

        all_data = collection.get(include=["documents"])
        chunks = all_data["documents"][:50]  # Limit to 50 chunks

        if not chunks:
            graph.status = "failed"
            graph.error_message = "知识库暂无分块数据"
            await db.commit()
            return

        # 3. Extract entities in batches
        import networkx as nx
        G = nx.DiGraph()
        batch_size = 3
        semaphore = asyncio.Semaphore(5)

        async def process_batch(batch_texts: list[str]):
            async with semaphore:
                combined = "\n\n---\n\n".join(batch_texts)
                try:
                    response = await asyncio.wait_for(
                        llm.chat([{"role": "user", "content": EXTRACTION_PROMPT.format(text=combined)}]),
                        timeout=30.0,
                    )
                    # Parse JSON from response
                    text = response.strip()
                    if text.startswith("```"):
                        text = text.split("```")[1]
                        if text.startswith("json"):
                            text = text[4:]
                    data = json.loads(text)
                    return data
                except Exception as e:
                    logger.warning(f"Entity extraction batch failed: {e}")
                    return None

        batches = [chunks[i:i + batch_size] for i in range(0, len(chunks), batch_size)]
        results = await asyncio.gather(*[process_batch(b) for b in batches])

        for result_data in results:
            if not result_data:
                continue
            entities = result_data.get("entities", [])
            relations = result_data.get("relations", [])

            for ent in entities:
                name = ent.get("name", "").strip()
                ent_type = ent.get("type", "概念").strip()
                if name and not G.has_node(name):
                    G.add_node(name, type=ent_type)

            for rel in relations:
                src = rel.get("source", "").strip()
                tgt = rel.get("target", "").strip()
                label = rel.get("label", "").strip()
                if src and tgt:
                    if not G.has_node(src):
                        G.add_node(src, type="概念")
                    if not G.has_node(tgt):
                        G.add_node(tgt, type="概念")
                    G.add_edge(src, tgt, label=label)

        # 4. Serialize
        nodes = [
            {"id": n, "name": n, "type": d.get("type", "概念")}
            for n, d in G.nodes(data=True)
        ]
        edges = [
            {"source": u, "target": v, "label": d.get("label", "")}
            for u, v, d in G.edges(data=True)
        ]
        graph_data = json.dumps({"nodes": nodes, "edges": edges}, ensure_ascii=False)

        graph.status = "completed"
        graph.node_count = len(nodes)
        graph.edge_count = len(edges)
        graph.graph_data = graph_data
        graph.updated_at = datetime.utcnow()
        await db.commit()

        logger.info(f"Knowledge graph built: graph={graph_id}, nodes={len(nodes)}, edges={len(edges)}")

    except Exception as e:
        logger.error(f"Knowledge graph build failed: {e}")
        try:
            graph = await db.get(KnowledgeGraph, graph_id)
            if graph:
                graph.status = "failed"
                graph.error_message = str(e)
                await db.commit()
        except Exception:
            pass


@router.post("")
async def create_knowledge_graph(kb_id: str, db: AsyncSession = Depends(get_db)):
    graph_id = uuid.uuid4().hex[:16]
    graph = KnowledgeGraph(
        id=graph_id,
        kb_id=kb_id,
        name=f"图谱 {graph_id[:8]}",
        status="pending",
    )
    db.add(graph)
    await db.commit()

    # Start background build
    asyncio.create_task(_build_graph(kb_id, graph_id, db))

    return {"id": graph_id, "status": "pending"}


@router.get("")
async def list_knowledge_graphs(kb_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KnowledgeGraph)
        .where(KnowledgeGraph.kb_id == kb_id)
        .order_by(KnowledgeGraph.created_at.desc())
    )
    graphs = result.scalars().all()
    return [
        {
            "id": g.id,
            "name": g.name,
            "node_count": g.node_count,
            "edge_count": g.edge_count,
            "status": g.status,
            "error_message": g.error_message,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        }
        for g in graphs
    ]


@router.get("/{graph_id}")
async def get_knowledge_graph(kb_id: str, graph_id: str, db: AsyncSession = Depends(get_db)):
    graph = await db.get(KnowledgeGraph, graph_id)
    if not graph or graph.kb_id != kb_id:
        raise HTTPException(status_code=404, detail="Knowledge graph not found")

    result = {
        "id": graph.id,
        "name": graph.name,
        "node_count": graph.node_count,
        "edge_count": graph.edge_count,
        "status": graph.status,
        "error_message": graph.error_message,
    }
    if graph.graph_data:
        result["graph_data"] = json.loads(graph.graph_data)
    return result


@router.delete("/{graph_id}")
async def delete_knowledge_graph(kb_id: str, graph_id: str, db: AsyncSession = Depends(get_db)):
    graph = await db.get(KnowledgeGraph, graph_id)
    if not graph or graph.kb_id != kb_id:
        raise HTTPException(status_code=404, detail="Knowledge graph not found")
    await db.delete(graph)
    await db.commit()
    return {"status": "ok"}
