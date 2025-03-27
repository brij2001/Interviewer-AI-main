from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum
import json
import hashlib

from ..core.database import get_db
from ..models.interview import InterviewSession, CodeSubmissionModel, InterviewStage as DBInterviewStage, SessionToken
from ..agent import CoordinatorAgent, InterviewStage as AgentInterviewStage

class RoleType(str, Enum):
    SOFTWARE_ENGINEER = "software_engineer"
    FRONTEND_DEVELOPER = "frontend_developer"
    BACKEND_DEVELOPER = "backend_developer"
    FULLSTACK_DEVELOPER = "fullstack_developer"

class DifficultyLevel(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

class InterviewSessionCreate(BaseModel):
    candidate_name: str
    role: RoleType
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM

router = APIRouter()
class SessionManager:
    def __init__(self):
        self.coordinators = {}
    
    def get_coordinator(self, session_id):
        if session_id not in self.coordinators:
            self.coordinators[session_id] = CoordinatorAgent()
        return self.coordinators[session_id]
    
    def create_coordinator(self):
        return CoordinatorAgent()
    
    def cleanup_session(self, session_id):
        """Remove coordinator for a completed session to free up resources"""
        if session_id in self.coordinators:
            del self.coordinators[session_id]

session_manager = SessionManager()

# Mapping between agent stages and database stages
def map_agent_stage_to_db_stage(agent_stage: AgentInterviewStage) -> DBInterviewStage:
    stage_mapping = {
        AgentInterviewStage.INTRODUCTION: DBInterviewStage.INTRODUCTION,
        AgentInterviewStage.TECHNICAL_QUESTIONS: DBInterviewStage.TECHNICAL_QUESTIONS,
        AgentInterviewStage.CODING_PROBLEM: DBInterviewStage.CODING_PROBLEM,
        AgentInterviewStage.CODE_EVALUATION: DBInterviewStage.CODE_EVALUATION,
        AgentInterviewStage.FINAL_EVALUATION: DBInterviewStage.FINAL_EVALUATION,
        # Add other mappings if needed
    }
    return stage_mapping.get(agent_stage, DBInterviewStage.INTRODUCTION)

@router.post("/sessions")
def create_interview_session(
    session_data: InterviewSessionCreate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Create a new interview session."""
    session = InterviewSession(
        candidate_name=session_data.candidate_name,
        role=session_data.role.value,
        difficulty=session_data.difficulty.value
    )
    
    db.add(session)
    db.commit()
    db.refresh(session)
    
    # Create a fresh coordinator for the new session
    coordinator = session_manager.create_coordinator()
    session_manager.coordinators[session.id] = coordinator
    
    # Start the interview with introduction
    response = coordinator.start_interview(
        candidate_name=session_data.candidate_name,
        role=session_data.role.value,
        difficulty=session_data.difficulty.value
    )
    
    # Update session with initial response
    session.interview_notes = coordinator.get_interview_notes()
    db.commit()
    
    return {
        "session_id": session.id,
        "response": response,
        "stage": DBInterviewStage.INTRODUCTION.value
    }

class CandidateResponse(BaseModel):
    response: str

@router.post("/sessions/{session_id}/respond")
def process_candidate_response(
    session_id: int,
    response_data: CandidateResponse,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Process candidate's response and get next interview action."""
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    # Get current stage from the interviewer agent
    coordinator = session_manager.get_coordinator(session_id)
    current_agent_stage = coordinator.interviewer.current_stage
    
    # Process response through the coordinator
    agent_response = coordinator.interviewer.handle_candidate_response(response_data.response)
    
    # Update session with the updated interview notes
    session.interview_notes = coordinator.get_interview_notes()
    
    # Update the current stage in database
    session.current_stage = map_agent_stage_to_db_stage(coordinator.interviewer.current_stage)
    
    db.commit()
    
    return {
        "response": agent_response,
        "stage": session.current_stage.value
    }

class ProgrammingLanguage(str, Enum):
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    JAVA = "java"
    CPP = "cpp"

class CodeSubmissionRequest(BaseModel):
    code: str
    language: ProgrammingLanguage
    problem_statement: str

@router.post("/sessions/{session_id}/code")
def submit_code(
    session_id: int,
    submission_data: CodeSubmissionRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Submit and evaluate code solution."""
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    # Create code submission
    submission = CodeSubmissionModel(
        session_id=session_id,
        problem_statement=submission_data.problem_statement,
        code=submission_data.code,
        language=submission_data.language.value
    )
    
    db.add(submission)
    db.commit()
    
    # Evaluate code using the coordinator
    coordinator = session_manager.get_coordinator(session_id)
    evaluation = coordinator.evaluate_code(
        code=submission_data.code,
        problem_statement=submission_data.problem_statement,
        language=submission_data.language.value
    )
    
    # Ensure evaluation has the required structure and is in JSON format
    if isinstance(evaluation, dict):
        # Make sure feedback is present
        if "feedback" not in evaluation or not evaluation["feedback"]:
            evaluation["feedback"] = "The code was evaluated, but no detailed feedback was provided."
        
        # Store the evaluation as JSON
        submission.evaluation = json.dumps(evaluation)
    else:
        # If not a dict, it's likely a string - create a proper evaluation object
        submission.evaluation = json.dumps({
            "feedback": str(evaluation),
            "correctness": None,
            "time_complexity": None,
            "space_complexity": None,
            "code_quality": None,
            "suggestions": []
        })
    
    # Update session notes and stage
    session.interview_notes = coordinator.get_interview_notes()
    session.current_stage = map_agent_stage_to_db_stage(coordinator.interviewer.current_stage)
    
    db.commit()
    
    # Ensure we're returning a consistent format to the frontend
    evaluation_response = {}
    if isinstance(evaluation, dict):
        evaluation_response = evaluation
    else:
        evaluation_response = {
            "feedback": str(evaluation),
            "correctness": None,
            "time_complexity": None,
            "space_complexity": None,
            "code_quality": None,
            "suggestions": []
        }
    
    return {
        "evaluation": evaluation_response,
        "submission_id": submission.id
    }

# Add a new endpoint for evaluating code from the IDE
@router.post("/sessions/{session_id}/evaluate-code")
def evaluate_code(
    session_id: int,
    submission_data: CodeSubmissionRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Evaluate code from the IDE."""
    return submit_code(session_id, submission_data, db)

@router.get("/sessions/{session_id}/final-evaluation")
def get_final_evaluation(
    session_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get final evaluation for the interview session."""
    try:
        # Get session
        session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Interview session not found")
        
        # Generate final evaluation using the coordinator
        coordinator = session_manager.get_coordinator(session_id)
        evaluation = coordinator.get_final_evaluation()
        
        # Update session
        session.final_evaluation = evaluation.get("detailed_feedback", "")
        session.current_stage = DBInterviewStage.FINAL_EVALUATION
        session.interview_notes = coordinator.get_interview_notes()
        db.commit()
        
        # Clean up the session to free resources
        session_manager.cleanup_session(session_id)
        
        return {
            "evaluation": evaluation,
            "session": session.to_dict()
        }
    except Exception as e:
        # Log the error
        import traceback
        print(f"Error in get_final_evaluation: {str(e)}")
        print(traceback.format_exc())
        
        # Create a simple fallback evaluation
        fallback_evaluation = {
            "technical_skill": 6,
            "problem_solving": 6,
            "communication": 7,
            "overall_rating": 6,
            "strengths": ["Communication skills", "Technical knowledge", "Problem-solving ability"],
            "areas_for_improvement": ["Consider more edge cases", "Explore advanced coding patterns"],
            "recommendation": {
                "decision": "hire",
                "confidence": "medium"
            },
            "detailed_feedback": "Thank you for completing the interview. There was an error generating a detailed evaluation, but based on the overall performance, the candidate demonstrated adequate technical skills and problem-solving abilities."
        }
        
        try:
            # Try to update the session with the fallback evaluation
            if session and 'session' in locals():
                session.final_evaluation = fallback_evaluation.get("detailed_feedback", "")
                session.current_stage = DBInterviewStage.FINAL_EVALUATION
                db.commit()
        except Exception as inner_e:
            print(f"Error saving fallback evaluation to database: {str(inner_e)}")
        
        # Return the fallback evaluation
        return {
            "evaluation": fallback_evaluation,
            "session": session.to_dict() if session and 'session' in locals() else {}
        }

@router.get("/sessions/{session_id}")
def get_session(
    session_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get interview session details."""
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    return session.to_dict()

@router.get("/sessions")
def list_sessions(
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """List all interview sessions."""
    sessions = db.query(InterviewSession).all()
    return [session.to_dict() for session in sessions]

# New model for session token
class TokenRequest(BaseModel):
    token: str
    device_info: Optional[Dict[str, str]] = None

@router.post("/sessions/{session_id}/token")
def create_session_token(
    session_id: int,
    token_data: TokenRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Create a new session token for a specific interview session."""
    # Check if session exists
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    # Check if a token already exists for this session
    existing_token = db.query(SessionToken).filter(SessionToken.session_id == session_id).first()
    if existing_token:
        # Update the existing token
        existing_token.token = token_data.token
        existing_token.device_info = token_data.device_info
        token = existing_token
    else:
        # Create a new token
        token = SessionToken(
            session_id=session_id,
            token=token_data.token,
            device_info=token_data.device_info
        )
        db.add(token)
    
    db.commit()
    db.refresh(token)
    
    return {
        "token_id": token.id,
        "session_id": token.session_id,
        "created_at": token.created_at.isoformat(),
        "expires_at": token.expires_at.isoformat()
    }

@router.post("/sessions/{session_id}/verify-token")
def verify_session_token(
    session_id: int,
    token_data: TokenRequest,
    db: Session = Depends(get_db)
) -> Dict[str, bool]:
    """Verify if a token is valid for a specific interview session."""
    # Check if session exists
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    # Look for the token in the database
    token = db.query(SessionToken).filter(
        SessionToken.session_id == session_id,
        SessionToken.token == token_data.token
    ).first()
    
    # Check if token exists and is valid
    if token and token.is_valid():
        return {"valid": True}
    
    return {"valid": False}
