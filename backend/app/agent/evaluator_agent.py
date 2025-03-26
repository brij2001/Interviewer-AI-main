from typing import Dict, Any, Optional
import json
import re

from .base_agent import BaseAgent
from .prompts import CODE_EVALUATION_TEMPLATE

class EvaluatorAgent(BaseAgent):
    """Agent responsible for evaluating code submissions."""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Initialize evaluation chain with a specific memory configuration for code evaluation
        self.evaluation_chain = self.create_chain(
            CODE_EVALUATION_TEMPLATE,
            memory=self.memory  # Use the memory from BaseAgent
        )
    
    def evaluate_code(
        self,
        code: str,
        problem_statement: str,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluate a code submission based on the problem statement.
        
        Args:
            code: The submitted code to evaluate
            problem_statement: The original problem statement
            language: The programming language used (optional)
            
        Returns:
            Dictionary containing evaluation results with:
            - correctness: score from 0-10
            - time_complexity: assessment of time complexity
            - space_complexity: assessment of space complexity
            - code_quality: score from 0-10
            - feedback: detailed feedback about the solution
            - suggestions: suggestions for improvement
        """
        # Prepare input for the evaluation chain
        input_data = {
            "code": code,
            "problem_statement": problem_statement,
            "language": language if language else "Not specified"
        }
        
        # Add human input key for memory compatibility
        human_input = f"Please evaluate this {language if language else 'code'} solution for the problem: {problem_statement}\n\n```\n{code}\n```"
        input_data["human"] = human_input
            
        # Run evaluation
        evaluation_text = self.evaluation_chain.run(**input_data)
        
        # Try to extract structured evaluation from the text
        try:
            # First try to find if there's a JSON structure in the response
            # More robust JSON extraction using regex to find anything that looks like a JSON object
            json_matches = re.findall(r'(\{[\s\S]*?\})', evaluation_text)
            
            if json_matches:
                # Try each match to find valid JSON
                for json_str in json_matches:
                    try:
                        evaluation = json.loads(json_str)
                        # If we found valid JSON with expected fields, use it
                        if any(key in evaluation for key in ["correctness", "feedback", "time_complexity"]):
                            # Make sure required fields exist
                            if "feedback" not in evaluation or not evaluation["feedback"]:
                                evaluation["feedback"] = evaluation_text
                            return evaluation
                    except json.JSONDecodeError:
                        continue
            
            # If no JSON found or none were valid, create a semi-structured evaluation
            evaluation = {
                "correctness": self._extract_score(evaluation_text, "correctness"),
                "time_complexity": self._extract_complexity(evaluation_text, "time"),
                "space_complexity": self._extract_complexity(evaluation_text, "space"),
                "code_quality": self._extract_score(evaluation_text, "quality"),
                "feedback": evaluation_text,
                "suggestions": self._extract_suggestions(evaluation_text)
            }
        except Exception as e:
            # Fallback to unstructured evaluation
            print(f"Error parsing evaluation: {str(e)}")
            evaluation = {
                "feedback": evaluation_text,
                "suggestions": [],
                "correctness": None,
                "time_complexity": None,
                "space_complexity": None,
                "code_quality": None
            }
        
        # Ensure feedback field is not empty
        if "feedback" not in evaluation or not evaluation["feedback"]:
            evaluation["feedback"] = evaluation_text
            
        return evaluation
    
    def _extract_score(self, text: str, score_type: str) -> Optional[int]:
        """Extract numerical score from text."""
        # Look for patterns like "Correctness: 8/10" or "Code Quality: 7 out of 10"
        patterns = [
            rf"{score_type}[:\s]+(\d+)[/\s]*10",
            rf"{score_type}[:\s]+(\d+)[\s]*out of[\s]*10",
            rf"{score_type}[:\s]*(\d+)"
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                try:
                    return int(matches[0])
                except (ValueError, IndexError):
                    pass
        return None
    
    def _extract_complexity(self, text: str, complexity_type: str) -> Optional[str]:
        """Extract time or space complexity from text."""
        # Look for sections describing complexity
        section_pattern = rf"{complexity_type}\s*complexity[:\s]+(.*?)(?=\n\n|\n[A-Z]|$)"
        matches = re.findall(section_pattern, text, re.IGNORECASE | re.DOTALL)
        
        if matches:
            # Cleanup and return first match
            complexity = matches[0].strip()
            # Look for Big O notation
            big_o_pattern = r"O\([^)]+\)"
            big_o_matches = re.findall(big_o_pattern, complexity)
            if big_o_matches:
                return big_o_matches[0]
            return complexity[:100]  # Limit length
        return None
    
    def _extract_suggestions(self, text: str) -> list:
        """Extract improvement suggestions from text."""
        suggestions = []
        
        # Look for suggestions section
        section_pattern = r"suggestions|improvements|could be improved|potential improvements"
        matches = re.findall(section_pattern, text, re.IGNORECASE)
        
        if matches:
            # Find the position of the first match
            pos = text.lower().find(matches[0])
            if pos != -1:
                # Extract text after this position until next major section
                suggestions_text = text[pos:]
                # Split by lines and look for bullet points or numbered items
                lines = suggestions_text.split('\n')
                for line in lines:
                    # Look for bullet points, numbers, or dashes
                    if re.match(r'^\s*[\-\*\d\.\)\•]\s+', line):
                        suggestions.append(line.strip())
        
        # If we couldn't find structured suggestions, try to find sentences containing suggestion keywords
        if not suggestions:
            suggestion_patterns = [
                r"you could\s+([^\.]+)",
                r"consider\s+([^\.]+)",
                r"try\s+([^\.]+)",
                r"recommend\s+([^\.]+)"
            ]
            
            for pattern in suggestion_patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                for match in matches:
                    suggestions.append(match.strip())
        
        # Limit number of suggestions
        return suggestions[:5] 