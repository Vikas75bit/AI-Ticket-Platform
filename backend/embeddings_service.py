from sentence_transformers import SentenceTransformer

class EmbeddingService:

    def __init__(self):

        self.model = SentenceTransformer(
            "BAAI/bge-base-en-v1.5"
        )

    def get_vector(
        self,
        text: str
    ) -> list[float]:

        vector = self.model.encode(
            text,
            normalize_embeddings=True
        )

        return vector.tolist()

encoder = EmbeddingService()