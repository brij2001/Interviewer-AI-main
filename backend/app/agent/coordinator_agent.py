from typing import Dict, List, Any, Optional
import json
from enum import Enum

from .base_agent import BaseAgent
from .interviewer_agent import InterviewerAgent, InterviewStage
from .evaluator_agent import EvaluatorAgent
from .final_evaluator_agent import FinalEvaluatorAgent

class CoordinatorAgent:
    """
    Agent responsible for coordinating the interview process.
    Manages communication between specialized agents.
    """
    
    def __init__(self):
        # Create shared memory for the interview session
        self.interviewer = InterviewerAgent(coordinator=self)
        self.code_evaluator = EvaluatorAgent()
        self.final_evaluator = FinalEvaluatorAgent()
        
        # Track interview session context
        self.interview_context = {
            "candidate_name": None,
            "role": None,
            "difficulty": "medium",
            "background": None,
            "current_problem": None,
            "code_submissions": []
        }
    
    def start_interview(self, candidate_name: str, role: str = "Software Engineer", difficulty: str = "medium") -> str:
        """Start a new interview session."""
        self.interview_context["candidate_name"] = candidate_name
        self.interview_context["role"] = role
        self.interview_context["difficulty"] = difficulty
        
        # Delegate to interviewer agent
        return self.interviewer.start_interview(candidate_name)
    
    def process_response(self, current_stage: InterviewStage, response: str, interview_notes: List[Dict]) -> str:
        """
        Process a candidate's response and determine the next interview action.
        This is the core coordination method that routes to appropriate agents.
        """
        # Update interview context based on the response
        self._update_context_from_response(current_stage, response)
        
        # Handle different stages with appropriate agents
        if current_stage == InterviewStage.INTRODUCTION:
            # After introduction, move to technical questions
            # Extract background information from the candidate's response
            background = self._extract_background_from_response(response)
            self.interview_context["background"] = background
            
            # Transition to technical questions with a more natural flow
            return self.interviewer.ask_technical_questions(
                background=background,
                role=self.interview_context.get("role", "Software Engineer"),
                difficulty=self.interview_context.get("difficulty", "medium")
            )
        
        elif current_stage == InterviewStage.TECHNICAL_QUESTIONS:
            # After technical questions, move to coding problem
            # Extract topics of interest from the conversation
            topics = self._derive_topics_from_responses(interview_notes, response)
            
            # Provide context from the technical discussion to the coding problem
            technical_context = self._extract_technical_context(interview_notes, response)
            
            # Transition to coding problem with context from the discussion
            return self.interviewer.present_coding_problem(
                difficulty=self.interview_context.get("difficulty", "medium"),
                topic=topics[0] if topics else "algorithms",
                context=technical_context  # Pass context from the discussion
            )
        
        elif current_stage == InterviewStage.CODING_PROBLEM:
            # Check if response contains code submission
            if self._looks_like_code(response):
                # Store the code submission
                self.interview_context["current_code"] = response
                
                # Evaluate the code
                problem_statement = self._get_current_problem(interview_notes)
                if problem_statement:
                    self.interview_context["current_problem"] = problem_statement
                    
                # Use code evaluator agent
                evaluation = self.code_evaluator.evaluate_code(
                    code=response,
                    problem_statement=self.interview_context.get("current_problem", ""),
                    language=self._detect_language(response)
                )
                
                # Store evaluation
                self.interview_context["code_submissions"].append({
                    "problem": self.interview_context.get("current_problem", ""),
                    "code": response,
                    "evaluation": evaluation
                })
                
                # Add evaluation to interview notes
                evaluation_text = evaluation.get("feedback", "")
                self.interviewer.add_evaluation_to_notes(
                    evaluation=evaluation_text,
                    problem_statement=self.interview_context.get("current_problem", "")
                )
                
                return evaluation_text
            else:
                # Handle non-code response during coding stage with a more natural response
                prompt = f"""
                The candidate has responded to the coding problem but hasn't submitted code yet. 
                Their response was: "{response}"
                
                I should respond in a helpful and encouraging way, providing guidance if needed
                but not solving the problem for them. If they seem stuck, I can offer a hint.
                If they're asking clarification questions, I should answer them clearly.
                """
                return self.interviewer.llm.predict(prompt)
        
        elif current_stage == InterviewStage.CODE_EVALUATION:
            # After code evaluation, move to follow-up questions or final evaluation
            # Decide if we need more evaluation or finish the interview
            if len(self.interview_context.get("code_submissions", [])) < 1:
                # Present another coding problem or transition to final evaluation
                topics = self._derive_topics_from_responses(interview_notes)
                if len(topics) > 1:
                    transition_prompt = f"""
                    The candidate has finished the first coding problem. I should transition to a second problem
                    on {topics[1]} with a natural transition like "Great job with that problem. 
                    Let's explore another area with a different challenge." I should acknowledge 
                    their previous solution before presenting the new problem.
                    """
                    transition_message = self.interviewer.llm.predict(transition_prompt)
                    
                    # Then present the actual problem
                    return transition_message + "\n\n" + self.interviewer.present_coding_problem(
                        difficulty=self.interview_context.get("difficulty", "medium"),
                        topic=topics[1]  # Use second topic
                    )
                else:
                    return self._transition_to_final_evaluation()
            else:
                return self._transition_to_final_evaluation()
        
        elif current_stage == InterviewStage.FINAL_EVALUATION:
            # If we're already at final evaluation, just respond
            return self.interviewer.llm.predict(response)
        
        # Default response for unhandled stages
        return self.interviewer.llm.predict(response)
    
    def evaluate_code(self, code: str, problem_statement: str, language: Optional[str] = None) -> Dict[str, Any]:
        """Evaluate a code submission using the code evaluator agent."""
        # Use code evaluator agent
        evaluation = self.code_evaluator.evaluate_code(
            code=code,
            problem_statement=problem_statement,
            language=language
        )
        
        # Store evaluation in context
        self.interview_context["code_submissions"].append({
            "problem": problem_statement,
            "code": code,
            "language": language,
            "evaluation": evaluation
        })
        
        # Add evaluation to interview notes
        evaluation_text = evaluation.get("feedback", "")
        self.interviewer.add_evaluation_to_notes(
            evaluation=evaluation_text,
            problem_statement=problem_statement
        )
        
        return evaluation
    
    def get_final_evaluation(self) -> Dict[str, Any]:
        """Generate final evaluation using the final evaluator agent."""
        # Get interview notes from interviewer
        interview_notes = self.interviewer.get_interview_notes()
        
        # Use final evaluator agent
        evaluation = self.final_evaluator.evaluate_interview(interview_notes)
        
        # Add evaluation to interview notes
        self.interviewer.add_final_evaluation(evaluation.get("detailed_feedback", ""))
        
        return evaluation
    
    def get_interview_notes(self) -> List[Dict]:
        """Get complete interview notes."""
        return self.interviewer.get_interview_notes()
    
    def _update_context_from_response(self, current_stage: InterviewStage, response: str) -> None:
        """Extract and update relevant information from candidate's response."""
        if current_stage == InterviewStage.INTRODUCTION:
            # Try to extract background information
            self.interview_context["background"] = response
        
        # More context extraction could be added for other stages
    
    def _derive_topics_from_responses(self, interview_notes: List[Dict], response: str = "") -> List[str]:
        """Derive potential coding problem topics based on interview responses."""
        # Default topics
        default_topics = ["algorithms", "data structures", "system design", "concurrency"]
        
        # Try to extract topics from the conversation
        if interview_notes and len(interview_notes) > 0:
            conversation = "\n".join([note.get("content", "") for note in interview_notes])
            if response:
                conversation += f"\n{response}"
                
            prompt = f"""
            Based on this interview conversation:
            {conversation}
            
            Identify 3-4 technical topics that would be good for coding problems.
            Focus on topics that match the candidate's background and the discussion so far.
            Return them as a comma-separated list (e.g., "arrays, linked lists, sorting, recursion").
            """
            
            try:
                topics_text = self.interviewer.llm.predict(prompt)
                topics = [topic.strip() for topic in topics_text.split(",")]
                if topics and len(topics) > 0:
                    return topics + default_topics  # Combine with defaults
            except Exception as e:
                print(f"Error extracting topics: {e}")
                
        # Fallback to defaults
        return default_topics
    
    def _looks_like_code(self, text: str) -> bool:
        """Check if the response looks like code."""
        code_indicators = [
            "```", "def ", "function ", "class ", "import ", "from ", "#include",
            "public class", "int ", "const ", "let ", "var ", "for(", "for (",
            "while(", "if(", "else{", "return "
        ]
        
        return any(indicator in text for indicator in code_indicators)
    
    def _get_current_problem(self, interview_notes: List[Dict]) -> str:
        """Extract the current problem statement from interview notes."""
        # Look for the most recent coding problem in notes
        for note in reversed(interview_notes):
            if note.get("stage") == InterviewStage.CODING_PROBLEM:
                return note.get("content", "")
        return ""
    
    def _transition_to_final_evaluation(self) -> str:
        """Transition to final evaluation stage with a natural conclusion."""
        # Create a smooth transition
        transition_prompt = """
        The interview is coming to an end. I should thank the candidate for their time and 
        participation, and provide a natural conclusion to the interview. I should mention 
        that I'll be evaluating their performance across all aspects of the interview, including
        technical knowledge, problem-solving approach, and communication skills. I should let 
        them know what to expect next in the process.
        """
        
        conclusion_message = self.interviewer.llm.predict(transition_prompt)
        
        # Generate the actual evaluation
        evaluation = self.get_final_evaluation()
        
        # Return the conclusion followed by highlights from the evaluation
        detailed_feedback = evaluation.get("detailed_feedback", "")
        
        # Extract highlights if the feedback is long
        if len(detailed_feedback.split()) > 100:
            highlights_prompt = f"""
            Extract 3-4 key highlights from this detailed evaluation:
            {detailed_feedback}
            
            Focus on the most important points about their performance, both strengths and areas for improvement.
            Keep it concise and constructive.
            """
            highlights = self.interviewer.llm.predict(highlights_prompt)
            
            return f"{conclusion_message}\n\n{highlights}"
        else:
            return f"{conclusion_message}\n\n{detailed_feedback}"
    
    # Add new helper methods for better transitions
    
    def _extract_background_from_response(self, response: str) -> str:
        """Extract detailed background information from the candidate's introduction."""
        prompt = f"""
        Extract the key background information from this candidate response:
        "{response}"
        
        Focus on:
        - Technical skills
        - Experience
        - Projects
        - Education
        - Interests
        
        Provide a concise summary.
        """
        return self.interviewer.llm.predict(prompt)
    
    def _extract_technical_context(self, interview_notes: List[Dict], response: str) -> str:
        """Extract technical context from the discussion to use in the coding problem transition."""
        # Get the last few exchanges
        recent_exchanges = interview_notes[-4:] if len(interview_notes) >= 4 else interview_notes
        context = "\n".join([note.get("content", "") for note in recent_exchanges]) + f"\n{response}"
        
        prompt = f"""
        Based on this recent interview conversation:
        {context}
        
        Extract 1-2 key technical topics or concepts that were discussed that can be referenced
        when transitioning to a coding problem. Provide just the topics, not a full sentence.
        """
        return self.interviewer.llm.predict(prompt)
    
    def _detect_language(self, code: str) -> str:
        """Attempt to detect the programming language from the code snippet."""
        # Simple heuristic-based detection
        if "def " in code and ":" in code:
            return "python"
        elif "function" in code and "{" in code:
            return "javascript"
        elif "class" in code and "public" in code:
            return "java"
        elif "#include" in code:
            return "cpp"
        elif "import React" in code or "export" in code:
            return "typescript"
        else:
            return "unknown" 