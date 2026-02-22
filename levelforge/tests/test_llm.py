"""
Tests for LevelForge LLM integration.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import json

from levelforge.src.ai.clients.llm_client import (
    OpenAIClient,
    ZAIClient,
    OllamaClient,
    LLMFactory,
)
from levelforge.src.ai.prompts.templates import (
    PLATFORMER_LINEAR,
    get_platformer_prompt,
)
from levelforge.src.ai.parsers.response_parser import (
    ResponseParser,
    ParseResult,
    parse_llm_response,
)


class TestResponseParser:
    """Tests for ResponseParser."""
    
    def test_parse_direct_json(self):
        """Test parsing direct JSON."""
        json_str = '{"genre": "platformer", "platforms": []}'
        result = ResponseParser.parse_json_response(json_str)
        
        assert result.success
        assert result.data["genre"] == "platformer"
    
    def test_parse_json_in_markdown(self):
        """Test parsing JSON in markdown code block."""
        response = '''
        Here is your level:
        ```json
        {"genre": "platformer", "platforms": []}
        ```
        '''
        result = ResponseParser.parse_json_response(response)
        
        assert result.success
        assert result.data["genre"] == "platformer"
    
    def test_parse_json_embedded_in_text(self):
        """Test parsing JSON embedded in text."""
        response = '''
        Here's the level you requested:
        {"genre": "platformer", "platforms": [{"x": 0, "y": 480, "width": 500}]}
        
        Let me know if you need changes!
        '''
        result = ResponseParser.parse_json_response(response)
        
        assert result.success
        assert result.data["genre"] == "platformer"
        assert len(result.data["platforms"]) == 1
    
    def test_parse_invalid_json(self):
        """Test parsing invalid JSON."""
        result = ResponseParser.parse_json_response("This is not JSON")
        
        assert not result.success
        assert result.error is not None
    
    def test_validate_level_data(self):
        """Test level data validation."""
        valid_data = {
            "version": "1.0",
            "genre": "platformer",
            "platforms": [{"x": 0, "y": 480, "width": 500}],
            "entities": []
        }
        
        is_valid, errors = ResponseParser.validate_level_data(valid_data)
        assert is_valid
        assert len(errors) == 0
    
    def test_validate_level_data_missing_fields(self):
        """Test validation catches missing fields."""
        invalid_data = {
            "genre": "platformer"
            # Missing version, platforms, entities
        }
        
        is_valid, errors = ResponseParser.validate_level_data(invalid_data)
        assert not is_valid
        assert any("version" in e for e in errors)
        assert any("platforms" in e for e in errors)
    
    def test_validate_level_data_invalid_platforms(self):
        """Test validation catches invalid platforms."""
        invalid_data = {
            "version": "1.0",
            "genre": "platformer",
            "platforms": [
                {"y": 480}  # Missing x and width
            ],
            "entities": []
        }
        
        is_valid, errors = ResponseParser.validate_level_data(invalid_data)
        assert not is_valid
        assert any("x" in e for e in errors)


class TestLLMFactory:
    """Tests for LLMFactory."""
    
    @patch('levelforge.src.ai.clients.llm_client.OpenAI')
    def test_create_openai_client(self, mock_openai):
        """Test creating OpenAI client."""
        client = LLMFactory.create("openai", api_key="test-key")
        assert isinstance(client, OpenAIClient)
    
    @patch('levelforge.src.ai.clients.llm_client.OpenAI')
    def test_create_zai_client(self, mock_openai):
        """Test creating z.ai client."""
        client = LLMFactory.create("z-ai", api_key="test-key")
        assert isinstance(client, ZAIClient)
    
    def test_create_ollama_client(self):
        """Test creating Ollama client."""
        client = LLMFactory.create("ollama")
        assert isinstance(client, OllamaClient)
    
    def test_create_invalid_client(self):
        """Test creating invalid client raises error."""
        with pytest.raises(ValueError):
            LLMFactory.create("invalid_client_type")


class TestPromptTemplates:
    """Tests for prompt templates."""
    
    def test_platformer_prompt_format(self):
        """Test platformer prompt formatting."""
        prompt = PLATFORMER_LINEAR
        
        system, user = prompt.format(
            difficulty="hard",
            requirements="10 platforms",
            theme="castle"
        )
        
        assert "hard" in user
        assert "10 platforms" in user
        assert "castle" in user
    
    def test_get_platformer_prompt(self):
        """Test getting platformer prompt."""
        prompt = get_platformer_prompt(
            difficulty="easy",
            theme="cave"
        )
        
        assert prompt is not None


class TestLevelGenerator:
    """Tests for LevelGenerator."""
    
    @patch('levelforge.src.ai.clients.llm_client.LLMFactory.get_best_available')
    def test_generator_initialization(self, mock_factory):
        """Test generator initialization."""
        mock_client = Mock()
        mock_factory.return_value = mock_client
        
        from levelforge.src.core.generation.generator import LevelGenerator
        
        generator = LevelGenerator()
        
        assert generator.client is not None
    
    @patch('levelforge.src.ai.clients.llm_client.LLMFactory.get_best_available')
    def test_generate_with_mock_client(self, mock_factory):
        """Test generation with mocked client."""
        # Create mock client
        mock_client = Mock()
        mock_client.generate.return_value = json.dumps({
            "version": "1.0",
            "genre": "platformer",
            "platforms": [
                {"x": 0, "y": 480, "width": 500, "height": 30}
            ],
            "entities": [
                {"type": "player_spawn", "x": 50, "y": 450},
                {"type": "goal", "x": 450, "y": 80}
            ]
        })
        mock_factory.return_value = mock_client
        
        from levelforge.src.core.generation.generator import LevelGenerator
        
        generator = LevelGenerator(client=mock_client)
        result = generator.generate_platformer(difficulty="easy")
        
        assert result.success
        assert result.level is not None
        assert result.level.genre == "platformer"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
