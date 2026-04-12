from app.utils.config import Settings
from .base import BaseEmbeddingProvider
from .dummy_provider import DummyProvider
from .mlx_provider import MLXProvider
from .ollama_provider import OllamaProvider
from .llama_cpp_provider import LlamaCppProvider
from .openai_provider import OpenAIProvider


def create_embedding_provider(settings: Settings) -> BaseEmbeddingProvider:
    provider = settings.embedding_provider

    if provider == "dummy":
        return DummyProvider()
    elif provider == "mlx":
        return MLXProvider(
            model_name=settings.mlx_model_name,
            batch_size=settings.mlx_batch_size,
        )
    elif provider == "ollama":
        return OllamaProvider(
            model=settings.embedding_model,
            base_url=settings.ollama_base_url,
        )
    elif provider == "llama_cpp":
        return LlamaCppProvider(
            model_path=settings.llama_cpp_model_path,
            n_gpu_layers=settings.llama_cpp_n_gpu_layers,
            n_batch=settings.llama_cpp_n_batch,
        )
    elif provider == "openai":
        return OpenAIProvider(
            model=settings.embedding_model,
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url or None,
        )
    else:
        raise ValueError(f"Unknown embedding provider: {provider}")
