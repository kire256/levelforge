"""
LevelForge level generation engine.
"""

import json
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

from levelforge.src.ai.clients.llm_client import LLMClient, LLMFactory
from levelforge.src.ai.prompts.templates import (
    get_platformer_prompt,
    get_metroidvania_prompt,
    PLATFORMER_LINEAR,
    PLATFORMER_METROIDVANIA,
    PUZZLE,
    SHOOTER,
    REFINE_MAKE_HARDER,
    REFINE_ADD_PLATFORMS,
)
from levelforge.src.ai.parsers.response_parser import ResponseParser, ParseResult
from levelforge.src.core.validation.validator import SchemaValidator
from levelforge.src.core.schemas import Level

logger = logging.getLogger(__name__)


@dataclass
class GenerationResult:
    """Result of a level generation attempt."""
    success: bool
    level: Optional[Level] = None
    raw_response: str = ""
    error: Optional[str] = None
    validation_errors: List[str] = None
    
    def __post_init__(self):
        if self.validation_errors is None:
            self.validation_errors = []


class LevelGenerator:
    """Main class for generating levels using LLMs."""
    
    def __init__(
        self,
        client: Optional[LLMClient] = None,
        model: str = "gpt-4o",
        max_retries: int = 3
    ):
        """
        Initialize the level generator.
        
        Args:
            client: LLM client to use. If None, will try to find best available.
            model: Model name to use (default: gpt-4o)
            max_retries: Maximum number of retries on failure
        """
        self.client = client or LLMFactory.get_best_available()
        self.model = model
        self.max_retries = max_retries
        
        if not self.client:
            raise ValueError("No LLM client available")
        
        logger.info(f"LevelGenerator initialized with {type(self.client).__name__}")
    
    def generate_platformer(
        self,
        difficulty: str = "medium",
        requirements: str = "5-7 platforms, 3-5 enemies, 5-8 coins",
        theme: str = "default"
    ) -> GenerationResult:
        """
        Generate a platformer level.
        
        Args:
            difficulty: Difficulty level (easy, medium, hard, expert)
            requirements: Additional requirements description
            theme: Visual theme
            
        Returns:
            GenerationResult with generated level or error
        """
        prompt_template = PLATFORMER_LINEAR
        system_prompt = prompt_template.system
        user_prompt = prompt_template.user.format(
            difficulty=difficulty,
            requirements=requirements,
            theme=theme
        )
        
        return self._generate(system_prompt, user_prompt)
    
    def generate_metroidvania(
        self,
        difficulty: str = "medium",
        abilities: List[str] = None,
        gates: str = "2 ability gates",
        key_count: int = 2,
        theme: str = "default"
    ) -> GenerationResult:
        """
        Generate a metroidvania level.
        
        Args:
            difficulty: Difficulty level
            abilities: List of player abilities available
            gates: Description of required gates
            key_count: Number of collectible keys
            theme: Visual theme
            
        Returns:
            GenerationResult with generated level
        """
        if abilities is None:
            abilities = ["double_jump", "dash"]
        
        prompt_template = PLATFORMER_METROIDVANIA
        system_prompt = prompt_template.system
        user_prompt = prompt_template.user.format(
            difficulty=difficulty,
            abilities=", ".join(abilities),
            gates=gates,
            key_count=key_count,
            theme=theme
        )
        
        return self._generate(system_prompt, user_prompt)
    
    def generate_puzzle(
        self,
        difficulty: str = "medium",
        puzzle_type: str = "switch",
        requirements: str = "",
    ) -> GenerationResult:
        """Generate a puzzle level."""
        prompt_template = PUZZLE
        system_prompt = prompt_template.system
        user_prompt = prompt_template.user.format(
            difficulty=difficulty,
            puzzle_type=puzzle_type,
            requirements=requirements
        )
        
        return self._generate(system_prompt, user_prompt)
    
    def generate_shooter(
        self,
        difficulty: str = "medium",
        subgenre: str = "run_and_gun",
        requirements: str = "",
    ) -> GenerationResult:
        """Generate a shooter level."""
        prompt_template = SHOOTER
        system_prompt = prompt_template.system
        user_prompt = prompt_template.user.format(
            difficulty=difficulty,
            subgenre=subgenre,
            requirements=requirements
        )
        
        return self._generate(system_prompt, user_prompt)
    
    def refine_level(
        self,
        original_level: Dict[str, Any],
        modification: str
    ) -> GenerationResult:
        """
        Refine an existing level.
        
        Args:
            original_level: The original level as a dict
            modification: Description of the modification
            
        Returns:
            GenerationResult with modified level
        """
        prompt_template = REFINE_MAKE_HARDER
        
        # Format the original level as JSON
        original_json = json.dumps(original_level, indent=2)
        
        system_prompt = prompt_template.system
        user_prompt = prompt_template.user.format(
            modifications=modification,
            original_level=original_json
        )
        
        return self._generate(system_prompt, user_prompt)
    
    def _generate(
        self,
        system_prompt: str,
        user_prompt: str,
        retry_count: int = 0
    ) -> GenerationResult:
        """Internal method to generate a level with retry logic."""
        try:
            logger.info(f"Generating level (attempt {retry_count + 1})")
            
            # Get response from LLM
            response = self.client.generate(
                prompt=f"System: {system_prompt}\n\nUser: {user_prompt}",
                model=self.model
            )
            
            logger.debug(f"LLM response: {response[:200]}...")
            
            # Parse the response
            parse_result = ResponseParser.parse_json_response(response)
            
            if not parse_result.success:
                return GenerationResult(
                    success=False,
                    raw_response=response,
                    error=f"Failed to parse response: {parse_result.error}"
                )
            
            # Validate the level data
            is_valid, validation_errors = SchemaValidator.validate_level_data(
                parse_result.data
            )
            
            if not is_valid:
                # Try to fix with retries
                if retry_count < self.max_retries:
                    logger.warning(f"Validation failed: {validation_errors}. Retrying...")
                    return self._generate(
                        system_prompt,
                        f"{user_prompt}\n\nIMPORTANT: The previous response had validation errors. Please fix them: {validation_errors}",
                        retry_count + 1
                    )
                
                return GenerationResult(
                    success=False,
                    raw_response=response,
                    validation_errors=validation_errors,
                    error="Validation failed after max retries"
                )
            
            # Try to create the Level object
            try:
                level = Level(**parse_result.data)
            except Exception as e:
                return GenerationResult(
                    success=False,
                    raw_response=response,
                    error=f"Failed to create Level object: {str(e)}"
                )
            
            return GenerationResult(
                success=True,
                level=level,
                raw_response=response
            )
            
        except Exception as e:
            logger.error(f"Generation error: {str(e)}")
            
            if retry_count < self.max_retries:
                return self._generate(system_prompt, user_prompt, retry_count + 1)
            
            return GenerationResult(
                success=False,
                error=str(e)
            )


def create_generator(
    client_type: str = "openai",
    model: str = "gpt-4o",
    **kwargs
) -> LevelGenerator:
    """
    Factory function to create a LevelGenerator.
    
    Args:
        client_type: Type of client (openai, z-ai, ollama)
        model: Model name
        **kwargs: Additional arguments for the client
        
    Returns:
        Configured LevelGenerator
    """
    client = LLMFactory.create(client_type, **kwargs)
    return LevelGenerator(client=client, model=model)


# Example usage
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    # Try to create a generator
    try:
        generator = create_generator()
        print(f"Using client: {type(generator.client).__name__}")
        
        # Generate a simple platformer
        result = generator.generate_platformer(
            difficulty="easy",
            theme="forest"
        )
        
        if result.success:
            print(f"Generated level: {result.level.genre}")
            print(json.dumps(result.level.model_dump(), indent=2))
        else:
            print(f"Error: {result.error}")
            
    except Exception as e:
        print(f"Could not create generator: {e}")
