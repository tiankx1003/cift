from .parse import router as parse_router
from .search import router as search_router
from .vectors import router as vectors_router
from .upload import router as upload_router
from .kbs import router as kbs_router

__all__ = ["parse_router", "search_router", "vectors_router", "upload_router", "kbs_router"]
