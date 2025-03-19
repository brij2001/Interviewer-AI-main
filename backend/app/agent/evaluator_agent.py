from typing import Dict, Any, Optional
import json

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
            start_idx = evaluation_text.find('{')
            end_idx = evaluation_text.rfind('}') + 1
            
            if start_idx >= 0 and end_idx > start_idx:
                json_str = evaluation_text[start_idx:end_idx]
                evaluation = json.loads(json_str)
            else:
                # If no JSON structure, create a semi-structured evaluation
                evaluation = {
                    "correctness": self._extract_score(evaluation_text, "correctness"),
                    "time_complexity": self._extract_complexity(evaluation_text, "time"),
                    "space_complexity": self._extract_complexity(evaluation_text, "space"),
                    "code_quality": self._extract_score(evaluation_text, "quality"),
                    "feedback": evaluation_text,
                    "suggestions": self._extract_suggestions(evaluation_text)
                }
        except Exception:
            # Fallback to unstructured evaluation
            evaluation = {
                "feedback": evaluation_text,
                "suggestions": [],
                "correctness": None,
                "time_complexity": None,
                "space_complexity": None,
                "code_quality": None
            }
            
        return evaluation
    
    def _extract_score(self, text: str, metric: str) -> Optional[int]:
        """Attempt to extract a numerical score from the evaluation text."""
        try:
            # Simple heuristic to find something like "correctness: 8/10"
            lower_text = text.lower()
            idx = lower_text.find(metric.lower())
            if idx >= 0:
                # Look for numbers after the metric
                sub_text = lower_text[idx:idx+100]  # Limit search space
                # Find digits followed by /10 or out of 10
                import re
                match = re.search(r'(\d+)(?:/10| out of 10)', sub_text)
                if match:
                    return int(match.group(1))
            return None
        except:
            return None
    
    def _extract_complexity(self, text: str, complexity_type: str) -> Optional[str]:
        """Attempt to extract complexity notation (e.g., O(n)) from the text."""
        try:
            # Look for big-O notation
            import re
            # Find patterns like O(n), O(n^2), O(log n), etc.
            match = re.search(r'O\([^)]+\)', text)
            if match:
                return match.group(0)
            return None
        except:
            return None
    
    def _extract_suggestions(self, text: str) -> list:
        """Extract suggestions for improvement from the evaluation text."""
        suggestions = []
        try:
            # Look for sections that mention improvements or suggestions
            lower_text = text.lower()
            keywords = ["suggest", "improv", "could be better", "recommendation", "consider"]
            
            # Find sentences containing these keywords
            import re
            sentences = re.split(r'[.!?]', text)
            for sentence in sentences:
                if any(keyword in sentence.lower() for keyword in keywords):
                    suggestions.append(sentence.strip())
                    
            return suggestions
        except:
            return [] 