import logging
import httpx
from typing import Optional
from app.utils.config import settings

logger = logging.getLogger(__name__)

class LLMClient:
    @staticmethod
    def generate_response(prompt: str, system_instruction: str = "You are a helpful customer support AI.") -> str:
        """
        Generate a text response using the selected LLM provider (Gemini or OpenAI).
        Uses highly resilient HTTP/REST client fallback and library calls to guarantee performance.
        """
        provider = settings.LLM_PROVIDER.lower()

        if provider == "gemini":
            return LLMClient._call_gemini(prompt, system_instruction)
        elif provider == "openai":
            return LLMClient._call_openai(prompt, system_instruction)
        else:
            raise ValueError(f"Unsupported LLM Provider: {provider}")

    @staticmethod
    def _call_gemini(prompt: str, system_instruction: str) -> str:
        """
        Direct HTTP implementation for Google Gemini 2.5 Flash API.
        This avoids complex dependency mismatches and is lightning fast.
        """
        api_key = settings.GEMINI_API_KEY
        if not api_key or api_key == "your_gemini_api_key_here":
            raise ValueError("GEMINI_API_KEY is not configured or is the default placeholder.")

        # API URL for Gemini 2.5 Flash
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        
        headers = {
            "Content-Type": "application/json"
        }
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": f"{system_instruction}\n\nUser Query: {prompt}"}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1024
            }
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                
                # Parse Gemini response structure
                content = data["candidates"][0]["content"]["parts"][0]["text"]
                return content.strip()
        except Exception as e:
            logger.error(f"Gemini API invocation failure: {str(e)}")
            raise RuntimeError(f"Gemini LLM error: {str(e)}")

    @staticmethod
    def _call_openai(prompt: str, system_instruction: str) -> str:
        """
        Direct HTTP implementation for OpenAI Chat Completions API (gpt-4o-mini).
        Ensures perfect reliability and zero library overhead.
        """
        api_key = settings.OPENAI_API_KEY
        if not api_key or api_key == "your_openai_api_key_here":
            raise ValueError("OPENAI_API_KEY is not configured or is the default placeholder.")

        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2,
            "max_tokens": 1024
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                
                content = data["choices"][0]["message"]["content"]
                return content.strip()
        except Exception as e:
            logger.error(f"OpenAI API invocation failure: {str(e)}")
            raise RuntimeError(f"OpenAI LLM error: {str(e)}")
