import httpx

from .base import BaseLLMClient


class OpenAILLMClient(BaseLLMClient):
    """LLM client using OpenAI-compatible chat completions API."""

    def __init__(self, model: str, api_key: str = "", base_url: str = ""):
        self.model = model
        self.api_key = api_key
        self.base_url = (base_url or "http://localhost:11434").rstrip("/")

    async def chat(self, messages: list[dict]) -> str:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.1,
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=60.0,
            )
            resp.raise_for_status()
            data = resp.json()

        return data["choices"][0]["message"]["content"]
