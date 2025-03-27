import axios, { AxiosInstance } from 'axios';

// Use the environment variable for the API URL
const BASE_URL = process.env.REACT_APP_API_URL || 'https://interviewer-ai-710553458071.us-central1.run.app/api/v1'


interface InterviewSession {
  id: number;
  candidate_name: string;
  role: string;
  difficulty: string;
  current_stage: string;
  interview_notes: any[];
  final_evaluation: string | null;
  created_at: string;
  updated_at: string;
}

// Change to export the interface so it can be used elsewhere
export interface CodeSubmission {
  id: number;
  session_id: number;
  problem_statement: string;
  code: string;
  language: string;
  evaluation: string | null;
  submitted_at: string;
}

// Interface for code evaluation response
export interface EvaluationResponse {
  feedback?: string;
  correctness?: number;
  time_complexity?: string;
  space_complexity?: string;
  code_quality?: number;
  suggestions?: string[];
  [key: string]: any;
}

// Interface for final evaluation response
export interface FinalEvaluationResponse {
  technical_skill?: number;
  problem_solving?: number;
  communication?: number;
  overall_rating?: number;
  detailed_feedback?: string;
  strengths?: string[];
  areas_for_improvement?: string[];
  recommendation?: {
    decision?: string;
    confidence?: string;
  };
  [key: string]: any;
}

class InterviewAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${BASE_URL}/interviews`,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Check API health
  async checkHealth(): Promise<boolean> {
    try {
      // Try the health endpoint first
      await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
      return true;
    } catch (error) {
      // If the health endpoint doesn't exist, try the interviews endpoint
      try {
        await axios.get(`${BASE_URL}/interviews`, { timeout: 5000 });
        return true;
      } catch (error) {
        return false;
      }
    }
  }

  // Create a new interview session
  async createSession(
    candidateName: string,
    role: string,
    difficulty: string = 'medium'
  ): Promise<{ session_id: number; response: string; stage: string }> {
    const response = await this.api.post('/sessions', {
      candidate_name: candidateName,
      role,
      difficulty,
    });
    return response.data;
  }

  // Send candidate's response and get next interview action
  async sendResponse(
    sessionId: number,
    response: string
  ): Promise<{ response: string; stage: string }> {
    const apiResponse = await this.api.post(`/sessions/${sessionId}/respond`, {
      response,
    });
    return apiResponse.data;
  }

  // Submit code for evaluation
  async submitCode(
    sessionId: number,
    code: string,
    language: string,
    problemStatement: string
  ): Promise<{ evaluation: string | EvaluationResponse; submission_id: number }> {
    const response = await this.api.post(`/sessions/${sessionId}/code`, {
      code,
      language,
      problem_statement: problemStatement,
    });
    return response.data;
  }

  // Evaluate code from the IDE
  async evaluateCode(
    sessionId: number,
    code: string,
    language: string,
    problemStatement: string
  ): Promise<{ evaluation: string | EvaluationResponse; submission_id: number }> {
    const response = await this.api.post(`/sessions/${sessionId}/evaluate-code`, {
      code,
      language,
      problem_statement: problemStatement,
    });
    return response.data;
  }

  // Get final evaluation
  async getFinalEvaluation(
    sessionId: number
  ): Promise<{ evaluation: string | FinalEvaluationResponse; session: InterviewSession }> {
    const response = await this.api.get(`/sessions/${sessionId}/final-evaluation`);
    return response.data;
  }

  // Get session details
  async getSession(sessionId: number): Promise<InterviewSession> {
    const response = await this.api.get(`/sessions/${sessionId}`);
    return response.data;
  }

  // List all sessions
  async listSessions(): Promise<InterviewSession[]> {
    const response = await this.api.get('/sessions');
    return response.data;
  }
}

// Create and export a singleton instance
export const interviewAPI = new InterviewAPI();
