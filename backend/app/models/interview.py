from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Enum, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
import enum
from datetime import datetime

Base = declarative_base()

class InterviewStage(enum.Enum):
    INTRODUCTION = "introduction"
    TECHNICAL_QUESTIONS = "technical_questions"
    CODING_PROBLEM = "coding_problem"
    CODE_EVALUATION = "code_evaluation"
    FINAL_EVALUATION = "final_evaluation"

class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    candidate_name = Column(String(100), nullable=False)
    role = Column(String(100), nullable=False)
    difficulty = Column(String(50), default="medium")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    current_stage = Column(Enum(InterviewStage), default=InterviewStage.INTRODUCTION)
    interview_notes = Column(JSON, default=list)
    final_evaluation = Column(Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "candidate_name": self.candidate_name,
            "role": self.role,
            "difficulty": self.difficulty,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "current_stage": self.current_stage.value,
            "interview_notes": self.interview_notes,
            "final_evaluation": self.final_evaluation
        }

class CodeSubmissionModel(Base):
    __tablename__ = "code_submissions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey('interview_sessions.id'), nullable=False)
    problem_statement = Column(Text, nullable=False)
    code = Column(Text, nullable=False)
    language = Column(String(50), nullable=False)
    evaluation = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "problem_statement": self.problem_statement,
            "code": self.code,
            "language": self.language,
            "evaluation": self.evaluation,
            "submitted_at": self.submitted_at.isoformat()
        }
