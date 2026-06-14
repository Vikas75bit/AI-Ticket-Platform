import os
from groq import Groq

class EmbeddingService:

    def __init__(self):

        self.client = Groq(
            api_key=os.getenv("GROQ_API_KEY")
        )

        self.model = "embeddinggemma-300m"

    def get_vector(
        self,
        text: str
    ) -> list[float]:

        response = self.client.embeddings.create(
            model=self.model,
            input=text
        )

        return response.data[0].embedding

encoder = EmbeddingService()
