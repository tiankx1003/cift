from ...models.schemas import ModelConfigInfo
from .base import BaseRerankProvider
from .ollama_provider import OllamaRerankProvider
from .openai_provider import OpenAIRerankProvider


def create_rerank_provider_from_config(config: ModelConfigInfo) -> BaseRerankProvider:
    if config.provider == "ollama":
        return OllamaRerankProvider(
            model=config.model_name,
            base_url=config.base_url or "http://localhost:11434",
        )
    elif config.provider == "openai":
        return OpenAIRerankProvider(
            model=config.model_name,
            api_key=config.api_key,
            base_url=config.base_url,
        )
    else:
        raise ValueError(f"Unsupported rerank provider: {config.provider}")
