"""
LevelForge response parsing utilities.
"""

import json
import re
from typing import Optional, Any, Dict
from dataclasses import dataclass


@dataclass
class ParseResult:
    """Result of parsing an LLM response."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    raw_response: str = ""


class ResponseParser:
    """Parses and extracts JSON from LLM responses."""
    
    @staticmethod
    def parse_json_response(response: str) -> ParseResult:
        """
        Parse JSON from an LLM response.
        
        Handles:
        - Raw JSON
        - JSON wrapped in markdown code blocks
        - JSON embedded in text
        - Malformed JSON with common issues
        """
        # Store raw response
        result = ParseResult(success=False, raw_response=response)
        
        if not response or not response.strip():
            result.error = "Empty response"
            return result
        
        # Strategy 1: Try direct parse
        try:
            data = json.loads(response)
            result.success = True
            result.data = data
            return result
        except json.JSONDecodeError:
            pass
        
        # Strategy 2: Extract from markdown code blocks
        json_blocks = ResponseParser._extract_json_blocks(response)
        if json_blocks:
            for block in json_blocks:
                try:
                    data = json.loads(block)
                    result.success = True
                    result.data = data
                    return result
                except json.JSONDecodeError:
                    continue
        
        # Strategy 3: Try to find JSON in the text
        json_str = ResponseParser._find_json_in_text(response)
        if json_str:
            try:
                data = json.loads(json_str)
                result.success = True
                result.data = data
                return result
            except json.JSONDecodeError:
                pass
        
        # Strategy 4: Try to fix common JSON issues
        fixed = ResponseParser._fix_json(response)
        if fixed:
            try:
                data = json.loads(fixed)
                result.success = True
                result.data = data
                return result
            except json.JSONDecodeError:
                pass
        
        result.error = "Could not parse JSON from response"
        return result
    
    @staticmethod
    def _extract_json_blocks(text: str) -> list[str]:
        """Extract JSON from markdown code blocks."""
        blocks = []
        
        # Match ```json and ``` code blocks
        pattern = r'```(?:json)?\s*(.*?)```'
        matches = re.findall(pattern, text, re.DOTALL)
        
        for match in matches:
            # Try each match
            blocks.append(match.strip())
        
        return blocks
    
    @staticmethod
    def _find_json_in_text(text: str) -> Optional[str]:
        """Find JSON object/array in text."""
        # Find the first { and last }
        start = text.find('{')
        if start == -1:
            start = text.find('[')
        
        if start == -1:
            return None
        
        # Find matching closing bracket
        if text[start] == '{':
            end = ResponseParser._find_matching_brace(text, start)
        else:
            end = ResponseParser._find_matching_bracket(text, start)
        
        if end == -1:
            return None
        
        return text[start:end+1]
    
    @staticmethod
    def _find_matching_brace(text: str, start: int) -> int:
        """Find matching closing brace."""
        depth = 0
        in_string = False
        escape_next = False
        
        for i in range(start, len(text)):
            char = text[i]
            
            if escape_next:
                escape_next = False
                continue
            
            if char == '\\':
                escape_next = True
                continue
            
            if char == '"' and not escape_next:
                in_string = not in_string
                continue
            
            if in_string:
                continue
            
            if char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0:
                    return i
        
        return -1
    
    @staticmethod
    def _find_matching_bracket(text: str, start: int) -> int:
        """Find matching closing bracket."""
        depth = 0
        in_string = False
        escape_next = False
        
        for i in range(start, len(text)):
            char = text[i]
            
            if escape_next:
                escape_next = False
                continue
            
            if char == '\\':
                escape_next = True
                continue
            
            if char == '"' and not escape_next:
                in_string = not in_string
                continue
            
            if in_string:
                continue
            
            if char == '[':
                depth += 1
            elif char == ']':
                depth -= 1
                if depth == 0:
                    return i
        
        return -1
    
    @staticmethod
    def _fix_json(text: str) -> Optional[str]:
        """Attempt to fix common JSON issues."""
        # Extract just the JSON portion
        json_str = ResponseParser._find_json_in_text(text)
        if not json_str:
            return None
        
        # Fix common issues
        fixes = [
            # Remove trailing commas
            (r',(\s*[}\]])', r'\1'),
            # Fix missing quotes around keys
            (r'([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":'),
            # Fix single quotes to double quotes
            (r"'([^']*)'", r'"\1"'),
            # Remove comments
            (r'//.*', r''),
            (r'#.*', r''),
        ]
        
        for pattern, replacement in fixes:
            json_str = re.sub(pattern, replacement, json_str)
        
        return json_str
    
    @staticmethod
    def validate_level_data(data: Dict) -> tuple[bool, list[str]]:
        """Validate that parsed data looks like a level."""
        errors = []
        
        # Check top-level structure
        required = ["version", "genre", "platforms", "entities"]
        for field in required:
            if field not in data:
                errors.append(f"Missing required field: {field}")
        
        # Validate platforms
        if "platforms" in data:
            if not isinstance(data["platforms"], list):
                errors.append("platforms must be a list")
            else:
                for i, p in enumerate(data["platforms"]):
                    if not isinstance(p, dict):
                        errors.append(f"platforms[{i}] must be an object")
                    elif "x" not in p or "y" not in p or "width" not in p:
                        errors.append(f"platforms[{i}] missing required fields")
        
        # Validate entities
        if "entities" in data:
            if not isinstance(data["entities"], list):
                errors.append("entities must be a list")
        
        return len(errors) == 0, errors


def parse_llm_response(response: str) -> ParseResult:
    """Convenience function to parse an LLM response."""
    return ResponseParser.parse_json_response(response)
