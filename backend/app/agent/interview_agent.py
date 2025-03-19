from langchain.chat_models import ChatOpenAI
from langchain.chains import LLMChain
from langchain.memory import ConversationBufferMemory
from langchain.callbacks import get_openai_callback
from typing import Dict, List, Optional
import json

from ..core.config import settings
from .prompts import (
    INTRODUCTION_TEMPLATE,
    TECHNICAL_QUESTIONS_TEMPLATE,
    CODE_PROBLEM_TEMPLATE,
    CODE_EVALUATION_TEMPLATE,
    FINAL_EVALUATION_TEMPLATE,
    INTERVIEWER_PERSONA
)

class InterviewAgent:
    def __init__(
        self,
        model_name: str = "gpt-4",
        temperature: float = 0.7
    ):
        # Initialize the language model with configuration
        llm_config = {
            "model_name": settings.MODEL_NAME if model_name == "gpt-4" else model_name,
            "temperature": temperature,
            "openai_api_base": settings.MODEL_ENDPOINT,
            "openai_api_key": settings.OPENAI_API_KEY,
        }
        
        # Add Azure-specific configurations if using Azure
        if settings.AZURE_API_VERSION:
            llm_config.update({
                "openai_api_type": "azure",
                "openai_api_version": settings.AZURE_API_VERSION,
                "deployment_name": settings.AZURE_DEPLOYMENT_NAME,
                "openai_api_base": f"https://{settings.AZURE_RESOURCE_NAME}.openai.azure.com",
            })
        
        self.llm = ChatOpenAI(**llm_config)
        
        # Initialize conversation memory
        self.memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True,
            input_key="human",  # Standard key for human inputs
            output_key="text"  # Match LangChain's default output key
        )
        
        # Initialize different chains for different stages
        self.introduction_chain = LLMChain(
            llm=self.llm,
            prompt=INTRODUCTION_TEMPLATE,
            memory=self.memory,  # Use shared memory for introduction
            verbose=True
        )
        
        # Create shared memory for other chains to maintain conversation context
        shared_memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True,
            input_key="human",
            output_key="text"
        )
        
        self.technical_questions_chain = LLMChain(
            llm=self.llm,
            prompt=TECHNICAL_QUESTIONS_TEMPLATE,
            memory=shared_memory,  # Use shared memory
            verbose=True
        )
        
        self.code_problem_chain = LLMChain(
            llm=self.llm,
            prompt=CODE_PROBLEM_TEMPLATE,
            memory=shared_memory,  # Use shared memory
            verbose=True
        )
        
        self.code_evaluation_chain = LLMChain(
            llm=self.llm,
            prompt=CODE_EVALUATION_TEMPLATE,
            memory=shared_memory,  # Use shared memory
            verbose=True
        )
        
        self.final_evaluation_chain = LLMChain(
            llm=self.llm,
            prompt=FINAL_EVALUATION_TEMPLATE,
            memory=shared_memory,  # Use shared memory
            verbose=True
        )
        
        self.interview_notes = []
        self.current_stage = "introduction"
        
    def start_interview(self, candidate_name: str) -> str:
        """Start the interview with introduction."""
        response = self.introduction_chain.run(
            human=candidate_name
        )
        self.interview_notes.append({
            "stage": "introduction",
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
        self.current_stage = "technical_questions"
        response = self.technical_questions_chain.run(
            background=background,
            role=role,
            difficulty=difficulty
        )
        self.interview_notes.append({
            "stage": "technical_questions",
            "content": response
        })
        return response

    def present_coding_problem(
        self,
        difficulty: str,
        topic: str
    ) -> str:
        """Present a coding problem to the candidate."""
        self.current_stage = "coding_problem"
        response = self.code_problem_chain.run(
            difficulty=difficulty,
            topic=topic
        )
        self.interview_notes.append({
            "stage": "coding_problem",
            "content": response
        })
        return response

    def evaluate_code(
        self,
        code: str,
        problem_statement: str
    ) -> str:
        """Evaluate the candidate's code solution."""
        self.current_stage = "code_evaluation"
        response = self.code_evaluation_chain.run(
            code=code,
            problem_statement=problem_statement
        )
        self.interview_notes.append({
            "stage": "code_evaluation",
            "content": response
        })
        return response

    def get_final_evaluation(self) -> str:
        """Provide final evaluation of the candidate."""
        self.current_stage = "final_evaluation"
        interview_notes_str = json.dumps(self.interview_notes, indent=2)
        response = self.final_evaluation_chain.run(
            interview_notes=interview_notes_str
        )
        self.interview_notes.append({
            "stage": "final_evaluation",
            "content": response
        })
        return response

    def process_response(self, response: str) -> str:
        """Process candidate's response and determine next action."""
        # Add response to interview notes
        self.interview_notes.append({
            "stage": self.current_stage,
            "content": f"Candidate: {response}"
        })
        
        # Add to memory
        self.memory.save_context(
            {"human": response},
            {"text": "Interviewer: Processing response..."}
        )
        
        # Based on current stage, determine next action
        if self.current_stage == "introduction":
            return self.ask_technical_questions(
                background="",  # Will be filled from candidate's response
                role="Software Engineer",
                difficulty="medium"
            )
        elif self.current_stage == "technical_questions":
            return self.present_coding_problem(
                difficulty="medium",
                topic="algorithms"  # Can be customized based on previous responses
            )
        else:
            # Continue with current stage's conversation
            return self.llm.predict(response)

    def get_interview_notes(self) -> List[Dict]:
        """Return the complete interview notes."""
        return self.interview_notes
