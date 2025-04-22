from typing import Dict, List, Any, Optional
import json
from enum import Enum

from .base_agent import BaseAgent
from .prompts import (
    INTRODUCTION_TEMPLATE,
    TECHNICAL_QUESTIONS_TEMPLATE,
    CODE_PROBLEM_TEMPLATE,
    INTERVIEWER_PERSONA,
    RESUME_DISCUSSION_TEMPLATE
)

class InterviewStage(str, Enum):
    INTRODUCTION = "introduction"
    RESUME_DISCUSSION = "resume_discussion"
    TECHNICAL_QUESTIONS = "technical_questions"
    CODING_PROBLEM = "coding_problem"
    CODE_EVALUATION = "code_evaluation"
    FOLLOW_UP = "follow_up"
    FINAL_EVALUATION = "final_evaluation"

class InterviewerAgent(BaseAgent):
    """Agent responsible for conducting the interview and interacting with the user."""
    
    def __init__(self, coordinator=None, **kwargs):
        super().__init__(**kwargs)
        self.coordinator = coordinator
        self.interview_notes = []
        self.current_stage = InterviewStage.INTRODUCTION
        
        # Initialize chains for different interview stages
        self.introduction_chain = self.create_chain(INTRODUCTION_TEMPLATE)
        self.resume_discussion_chain = self.create_chain(RESUME_DISCUSSION_TEMPLATE)
        self.technical_questions_chain = self.create_chain(TECHNICAL_QUESTIONS_TEMPLATE)
        self.code_problem_chain = self.create_chain(CODE_PROBLEM_TEMPLATE)
    
    def start_interview(self, candidate_name: str) -> str:
        """Start the interview with introduction."""
        response = self.introduction_chain.run(
            human=candidate_name
        )
        self.interview_notes.append({
            "stage": self.current_stage,
            "content": response
        })
        return response
    
    def ask_technical_questions(
        self,
        background: str,
        role: str,
        difficulty: str = "medium"
    ) -> str:
        """Ask technical questions based on candidate's background."""
        self.current_stage = InterviewStage.TECHNICAL_QUESTIONS
        response = self.technical_questions_chain.run(
            human=f"Background: {background}, Role: {role}, Difficulty: {difficulty}",
            background=background,
            role=role,
            difficulty=difficulty
        )
        self.interview_notes.append({
            "stage": self.current_stage,
            "content": response
        })
        return response
    
    def present_coding_problem(
        self,
        difficulty: str,
        topic: str,
        context: str = None
    ) -> str:
        """Present a coding problem to the candidate."""
        self.current_stage = InterviewStage.CODING_PROBLEM
        
        # Use the context to create a more natural transition
        human_input = f"Difficulty: {difficulty}, Topic: {topic}"
        if context:
            human_input += f", Context from previous discussion: {context}"
            
        response = self.code_problem_chain.run(
            human=human_input,
            difficulty=difficulty,
            topic=topic
        )
        
        # Add some customization based on the context
        if context and not context.lower().startswith("i could not extract"):
            # If we have valid context, try to customize the response to reference it
            customized_intro = self.llm.predict(
                f"""
                The candidate and I were just discussing {context}.
                I want to transition smoothly to presenting this coding problem:
                {response}
                
                Rewrite just the introduction to this problem (first 1-2 sentences) to create a natural transition 
                that references our discussion about {context}. Keep the actual problem statement unchanged.
                """
            )
            
            # Only use the customized intro if it's not too long
            if len(customized_intro.split()) < 50:
                # Find where the problem statement begins
                problem_start = response.find("Problem:")
                if problem_start > 0:
                    # Replace just the introduction
                    response = customized_intro + "\n\n" + response[problem_start:]
        
        self.interview_notes.append({
            "stage": self.current_stage,
            "content": response
        })
        
        return response
    
    def handle_candidate_response(
        self, 
        response: str
    ) -> str:
        """
        Process the candidate's response and determine next action.
        This method delegates to the coordinator for complex processing.
        """
        # Add response to interview notes
        self.interview_notes.append({
            "stage": self.current_stage,
            "content": f"Candidate: {response}"
        })
        
        # Add to memory
        self.add_to_memory(response, "Processing response...")
        
        # Delegate to coordinator for processing if available
        if self.coordinator:
            print("PROCESSSING")
            return self.coordinator.process_response(self.current_stage, response, self.interview_notes)
        
        # Fallback handling if no coordinator is available
        if self.current_stage == InterviewStage.INTRODUCTION:
            return self.ask_technical_questions(
                background="",  # Will be filled from candidate's response
                role="Software Engineer",
                difficulty="medium"
            )
        elif self.current_stage == InterviewStage.TECHNICAL_QUESTIONS:
            return self.present_coding_problem(
                difficulty="medium",
                topic="algorithms"
            )
        else:
            # Continue with current stage's conversation
            return self.llm.predict(response)
    
    def get_interview_notes(self) -> List[Dict]:
        """Return the complete interview notes."""
        return self.interview_notes
    
    def add_evaluation_to_notes(self, evaluation: str, problem_statement: Optional[str] = None) -> None:
        """Add code evaluation results to the interview notes."""
        self.current_stage = InterviewStage.CODE_EVALUATION
        note = {
            "stage": self.current_stage,
            "content": evaluation
        }
        if problem_statement:
            note["problem_statement"] = problem_statement
            
        self.interview_notes.append(note)
    
    def add_final_evaluation(self, evaluation: str) -> None:
        """Add final evaluation to the interview notes."""
        self.current_stage = InterviewStage.FINAL_EVALUATION
        self.interview_notes.append({
            "stage": self.current_stage,
            "content": evaluation
        }) 
    
    def discuss_resume(self, resume_text: str) -> str:
        """Discuss the candidate's resume."""
        self.current_stage = InterviewStage.RESUME_DISCUSSION
        response = self.resume_discussion_chain.run(human=resume_text)
        self.interview_notes.append({"stage": self.current_stage, "content": response})
        return response