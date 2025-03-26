from typing import Dict, List, Any
import json
import re

from .base_agent import BaseAgent
from .prompts import FINAL_EVALUATION_TEMPLATE

class FinalEvaluatorAgent(BaseAgent):
    """Agent responsible for providing final evaluations of interview candidates."""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Initialize evaluation chain
        self.evaluation_chain = self.create_chain(
            FINAL_EVALUATION_TEMPLATE,
            memory=self.memory  # Use memory from BaseAgent
        )
    
    def evaluate_interview(
        self,
        interview_notes: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Evaluate the entire interview based on the interview notes.
        
        Args:
            interview_notes: List of dictionaries containing interview interactions
        
        Returns:
            Dictionary containing structured evaluation with:
            - technical_skill: score from 0-10
            - problem_solving: score from 0-10
            - communication: score from 0-10
            - overall_rating: score from 0-10
            - strengths: list of candidate's strengths
            - areas_for_improvement: list of areas where candidate can improve
            - recommendation: hire/no-hire recommendation with confidence level
            - detailed_feedback: comprehensive evaluation text
        """
        # Convert interview notes to a string format for the prompt
        interview_notes_str = json.dumps(interview_notes, indent=2)
        
        # Prepare input data including the required 'human' key for memory compatibility
        input_data = {
            "interview_notes": interview_notes_str,
            "human": "Please provide a final evaluation of this candidate based on their interview notes."
        }
        
        try:
            # Try running without memory first if there are issues
            try:
                # Run evaluation with memory
                evaluation_text = self.evaluation_chain.run(**input_data)
            except KeyError as e:
                if str(e) == "'human'":
                    # If 'human' key error occurs, try creating a new chain without memory
                    print("Memory 'human' key error detected, trying without memory...")
                    # Create a new chain without memory
                    temp_chain = self.create_chain(FINAL_EVALUATION_TEMPLATE, memory=None)
                    # Run without memory dependency
                    evaluation_text = temp_chain.run(interview_notes=interview_notes_str)
                else:
                    raise
            
            # Try to extract structured evaluation from the text
            # First try to find if there's a JSON structure in the response
            # More robust JSON extraction using regex to find anything that looks like a JSON object
            json_matches = re.findall(r'(\{[\s\S]*?\})', evaluation_text)
            
            if json_matches:
                # Try each match to find valid JSON
                for json_str in json_matches:
                    try:
                        evaluation = json.loads(json_str)
                        # If we found valid JSON with expected fields, use it
                        if any(key in evaluation for key in ["technical_skill", "overall_rating", "recommendation"]):
                            # Make sure required fields exist
                            if "detailed_feedback" not in evaluation or not evaluation["detailed_feedback"]:
                                evaluation["detailed_feedback"] = evaluation_text
                            return evaluation
                    except json.JSONDecodeError:
                        continue
            
            # If no JSON structure, create a semi-structured evaluation
            evaluation = {
                "technical_skill": self._extract_score(evaluation_text, "technical"),
                "problem_solving": self._extract_score(evaluation_text, "problem"),
                "communication": self._extract_score(evaluation_text, "communicat"),
                "overall_rating": self._extract_score(evaluation_text, "overall"),
                "strengths": self._extract_list(evaluation_text, "strength"),
                "areas_for_improvement": self._extract_list(evaluation_text, "improv"),
                "recommendation": self._extract_recommendation(evaluation_text),
                "detailed_feedback": evaluation_text
            }
        except Exception as e:
            # Log the error and provide a fallback evaluation
            print(f"Error in final evaluator: {str(e)}")
            evaluation = {
                "detailed_feedback": f"Unable to generate a complete evaluation due to a technical issue. The system encountered the following error: {str(e)}",
                "technical_skill": 5,
                "problem_solving": 5,
                "communication": 5,
                "overall_rating": 5,
                "strengths": ["Could not analyze strengths due to system error"],
                "areas_for_improvement": ["Could not analyze areas for improvement due to system error"],
                "recommendation": {"decision": "undecided", "confidence": "low"}
            }
        
        # Ensure detailed_feedback field is not empty
        if "detailed_feedback" not in evaluation or not evaluation["detailed_feedback"]:
            evaluation["detailed_feedback"] = "No detailed feedback could be generated for this interview."
            
        return evaluation
    
    def _extract_score(self, text: str, metric: str) -> int:
        """Attempt to extract a numerical score from the evaluation text."""
        try:
            # Simple heuristic to find something like "technical_skill: 8/10"
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
    
    def _extract_list(self, text: str, section_name: str) -> List[str]:
        """Extract a list of items from a section of the evaluation text."""
        items = []
        try:
            # Look for section with the given name
            lower_text = text.lower()
            section_idx = lower_text.find(section_name.lower())
            
            if section_idx >= 0:
                # Find the next section or end of text
                remaining_text = text[section_idx:]
                
                # Split by line or bullet points
                import re
                # Look for bullet points, numbered lists, or lines
                list_items = re.findall(r'(?:^|\n)(?:\d+\.|\*|\-)\s*(.*?)(?=\n|$)', remaining_text)
                
                if list_items:
                    items = [item.strip() for item in list_items]
                else:
                    # Try to find sentences in the section
                    sentences = re.split(r'[.!?]', remaining_text)
                    items = [s.strip() for s in sentences if len(s.strip()) > 10][:3]  # Take first 3 substantial sentences
            
            return items
        except:
            return []
    
    def _extract_recommendation(self, text: str) -> Dict[str, Any]:
        """Extract the hiring recommendation and confidence level."""
        try:
            # Look for recommendation keywords
            lower_text = text.lower()
            
            # Check for hire recommendation
            hire_keywords = ["hire", "recommend", "suitable", "qualified"]
            no_hire_keywords = ["not hire", "do not hire", "not recommend", "unsuitable", "not qualified"]
            
            is_hire = any(keyword in lower_text for keyword in hire_keywords)
            is_no_hire = any(keyword in lower_text for keyword in no_hire_keywords)
            
            # Handle conflicting signals
            if is_hire and is_no_hire:
                # Check which appears later or has more emphasis
                last_hire_idx = max([lower_text.rfind(kw) for kw in hire_keywords if kw in lower_text])
                last_no_hire_idx = max([lower_text.rfind(kw) for kw in no_hire_keywords if kw in lower_text])
                
                recommendation = "no_hire" if last_no_hire_idx > last_hire_idx else "hire"
            elif is_hire:
                recommendation = "hire"
            elif is_no_hire:
                recommendation = "no_hire"
            else:
                recommendation = None
            
            # Extract confidence level
            confidence_level = None
            confidence_keywords = ["confident", "confidence", "strongly", "hesitant", "uncertain"]
            
            for keyword in confidence_keywords:
                if keyword in lower_text:
                    # Find the sentence containing the confidence keyword
                    import re
                    sentences = re.split(r'[.!?]', text)
                    for sentence in sentences:
                        if keyword in sentence.lower():
                            if any(neg in sentence.lower() for neg in ["not ", "low ", "hesitant", "uncertain"]):
                                confidence_level = "low"
                            else:
                                confidence_level = "high"
                            break
            
            if confidence_level is None:
                confidence_level = "medium"  # Default
            
            return {
                "decision": recommendation,
                "confidence": confidence_level
            }
        except:
            return {
                "decision": None,
                "confidence": None
            } 