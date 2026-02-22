"""
LevelForge AI - LLM client wrapper.
Supports OpenAI Codex, z.ai (GLM), and Ollama.
"""

import os
from typing import Optional
from abc import ABC, abstractmethod
import json

# Try importing openai - will be installed via requirements.txt
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


class LLMClient(ABC):
    """Abstract base class for LLM clients."""
    
    @abstractmethod
    def generate(self, prompt: str, **kwargs) -> str:
        """Generate a response from the LLM."""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if this client is available."""
        pass


class OpenAIClient(LLMClient):
    """OpenAI API client ( Codex, GPT-4)."""
    
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        if not OPENAI_AVAILABLE:
            raise ImportError("openai package not installed")
        
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self.client = OpenAI(api_key=self.api_key, base_url=base_url)
    
    def generate(self, prompt: str, model: str = "gpt-4o", **kwargs) -> str:
        """Generate using OpenAI API."""
        response = self.client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            **kwargs
        )
        return response.choices[0].message.content
    
    def is_available(self) -> bool:
        """Check if OpenAI is available."""
        return bool(self.api_key)


class ZAIClient(LLMClient):
    """z.ai (GLM) API client."""
    
    def __init__(self, api_key: Optional[str] = None, base_url: str = "https://open.bigmodel.cn/api/paas/v4"):
        self.api_key = api_key or os.environ.get("ZAI_API_KEY")
        self.base_url = base_url
        self.client = OpenAI(api_key=self.api_key, base_url=base_url)
    
    def generate(self, prompt: str, model: str = "glm-5", **kwargs) -> str:
        """Generate using z.ai GLM API."""
        response = self.client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            **kwargs
        )
        return response.choices[0].message.content
    
    def is_available(self) -> bool:
        """Check if z.ai is available."""
        return bool(self.api_key)


class OllamaClient(LLMClient):
    """Ollama local LLM client."""
    
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
    
    def generate(self, prompt: str, model: str = "llama3", **kwargs) -> str:
        """Generate using local Ollama."""
        import requests
        
        response = requests.post(
            f"{self.base_url}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False
            },
            **kwargs
        )
        return response.json().get("response", "")
    
    def is_available(self) -> bool:
        """Check if Ollama is running."""
        import requests
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=2)
            return response.status_code == 200
        except:
            return False
    
    def list_models(self) -> list[str]:
        """List available Ollama models."""
        import requests
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return [m["name"] for m in response.json().get("models", [])]
        except:
            return []


class LLMFactory:
    """Factory for creating LLM clients."""
    
    @staticmethod
    def create(client_type: str, **kwargs) -> LLMClient:
        """Create an LLM client by type."""
        clients = {
            "openai": OpenAIClient,
            "codex": OpenAIClient,
            "z-ai": ZAIClient,
            "glm": ZAIClient,
            "ollama": OllamaClient,
        }
        
        if client_type.lower() not in clients:
            raise ValueError(f"Unknown client type: {client_type}")
        
        return clients[client_type.lower()](**kwargs)
    
    @staticmethod
    def get_best_available() -> Optional[LLMClient]:
        """Get the best available LLM client."""
        # Try each client in order of preference
        
        # 1. Try OpenAI (highest quality)
        try:
            client = OpenAIClient()
            if client.is_available():
                return client
        except:
            pass
        
        # 2. Try z.ai
        try:
            client = ZAIClient()
            if client.is_available():
                return client
        except:
            pass
        
        # 3. Try Ollama (local)
        try:
            client = OllamaClient()
            if client.is_available():
                return client
        except:
            pass
        
        return None


# Example usage
if __name__ == "__main__":
    # Get the best available client
    client = LLMFactory.get_best_available()
    
    if client:
        print(f"Using client: {type(client).__name__}")
        response = client.generate("Write a short level design in JSON format.")
        print(response)
    else:
        print("No LLM clients available")
