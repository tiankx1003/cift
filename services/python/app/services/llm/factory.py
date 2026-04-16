from ...services.database import ModelConfig
from .base import BaseLLMClient
from .openai_client import OpenAILLMClient


def create_llm_client_from_config(config: ModelConfig) -> BaseLLMClient:
    """Create an LLM client from a ModelConfig record."""
    return OpenAILLMClient(
        model=config.model_name,
        api_key=config.api_key,
        base_url=config.base_url or "http://localhost:11434",
    )
