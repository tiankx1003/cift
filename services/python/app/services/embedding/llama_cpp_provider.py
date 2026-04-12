from .base import BaseEmbeddingProvider


class LlamaCppProvider(BaseEmbeddingProvider):
    """Embedding provider using llama.cpp (llama-cpp-python)."""

    def __init__(
        self,
        model_path: str,
        n_gpu_layers: int = -1,
        n_batch: int = 512,
    ):
        self.model_path = model_path
        self.n_gpu_layers = n_gpu_layers
        self.n_batch = n_batch
        self._model = None

    def _load_model(self):
        if self._model is not None:
            return
        try:
            from llama_cpp import Llama

            self._model = Llama(
                model_path=self.model_path,
                n_gpu_layers=self.n_gpu_layers,
                n_batch=self.n_batch,
                embedding=True,
                verbose=False,
            )
        except ImportError:
            raise ImportError(
                "llama-cpp-python is required for llama.cpp provider. "
                "Install with: pip install llama-cpp-python"
            )

    @property
    def dimension(self) -> int:
        self._load_model()
        return self._model.n_embd()

    async def embed(self, texts: list[str]) -> list[list[float]]:
        self._load_model()
        results = []
        for text in texts:
            data = self._model.create_embedding(text)
            results.append(data["data"][0]["embedding"])
        return results

    async def embed_query(self, text: str) -> list[float]:
        results = await self.embed([text])
        return results[0]
