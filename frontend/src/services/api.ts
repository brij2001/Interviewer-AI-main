import axios, { AxiosInstance } from 'axios';
import CryptoJS from 'crypto-js';

// Use the environment variable for the API URL
const BASE_URL = process.env.REACT_APP_API_URL || 'https://interviewer-ai-main-710553458071.us-east1.run.app/api/v1'


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

// Interface for session token
export interface SessionToken {
  session_id: number;
  token: string;
  created_at: string;
  expires_at: string;
}

class InterviewAPI {
  private api: AxiosInstance;
  private lastActivityTime: number;
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
  private isSessionActive: boolean;

  constructor() {
    this.api = axios.create({
      baseURL: `${BASE_URL}/interviews`,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.lastActivityTime = Date.now();
    this.isSessionActive = true;
    this.setupActivityListeners();
  }

  private setupActivityListeners() {
    // Update last activity time on user interaction
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, () => this.updateLastActivity());
    });
  }

  private updateLastActivity() {
    this.lastActivityTime = Date.now();
    this.isSessionActive = true;
  }

  private checkSessionTimeout() {
    const currentTime = Date.now();
    const timeSinceLastActivity = currentTime - this.lastActivityTime;
    
    if (timeSinceLastActivity >= this.SESSION_TIMEOUT) {
      this.isSessionActive = false;
      return true;
    }
    return false;
  }

  private async handleApiCall<T>(apiCall: () => Promise<T>): Promise<T> {
    if (this.checkSessionTimeout()) {
      throw new Error('Session has expired due to inactivity. Please refresh the page to continue.');
    }
    return apiCall();
  }

  // Check API health
  async checkHealth(): Promise<boolean> {
    return this.handleApiCall(async () => {
      try {
        await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
        return true;
      } catch (error) {
        try {
          await axios.get(`${BASE_URL}/interviews`, { timeout: 5000 });
          return true;
        } catch (error) {
          return false;
        }
      }
    });
  }

  // Create a new interview session
  async createSession(
    candidateName: string,
    role: string,
    difficulty: string = 'medium'
  ): Promise<{ session_id: number; response: string; stage: string }> {
    return this.handleApiCall(async () => {
      const response = await this.api.post('/sessions', {
        candidate_name: candidateName,
        role,
        difficulty,
      });
      
      await this.generateSessionToken(response.data.session_id);
      
      return response.data;
    });
  }

  // Generate a session token based on browser and device information
  private async generateSessionToken(sessionId: number): Promise<void> {
    // Get browser and device information
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const language = navigator.language;
    
    // Create a unique fingerprint from browser data
    const fingerprint = `${userAgent}|${platform}|${language}|${sessionId}|${Date.now()}`;
    
    // Generate SHA-256 hash
    const token = CryptoJS.SHA256(fingerprint).toString(CryptoJS.enc.Hex);
    
    // Store the token
    localStorage.setItem(`interview_token_${sessionId}`, token);
    
    // Send the token to backend for storage
    await this.api.post(`/sessions/${sessionId}/token`, {
      token,
      device_info: {
        user_agent: userAgent,
        platform: platform,
        language: language
      }
    });
  }
  
  // Validate a session token
  async validateSessionToken(sessionId: number): Promise<boolean> {
    // Get the stored token
    const storedToken = localStorage.getItem(`interview_token_${sessionId}`);
    
    if (!storedToken) {
      return false;
    }
    
    try {
      // Verify token with backend
      const response = await this.api.post(`/sessions/${sessionId}/verify-token`, {
        token: storedToken
      });
      
      return response.data.valid === true;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  // Send candidate's response and get next interview action
  async sendResponse(
    sessionId: number,
    response: string
  ): Promise<{ response: string; stage: string }> {
    return this.handleApiCall(async () => {
      const apiResponse = await this.api.post(`/sessions/${sessionId}/respond`, {
        response,
      });
      return apiResponse.data;
    });
  }

  // Submit code for evaluation
  async submitCode(
    sessionId: number,
    code: string,
    language: string,
    problemStatement: string
  ): Promise<{ evaluation: string | EvaluationResponse; submission_id: number }> {
    return this.handleApiCall(async () => {
      const response = await this.api.post(`/sessions/${sessionId}/code`, {
        code,
        language,
        problem_statement: problemStatement,
      });
      return response.data;
    });
  }

  // Evaluate code from the IDE
  async evaluateCode(
    sessionId: number,
    code: string,
    language: string,
    problemStatement: string
  ): Promise<{ evaluation: string | EvaluationResponse; submission_id: number }> {
    return this.handleApiCall(async () => {
      const response = await this.api.post(`/sessions/${sessionId}/evaluate-code`, {
        code,
        language,
        problem_statement: problemStatement,
      });
      return response.data;
    });
  }

  // Get final evaluation
  async getFinalEvaluation(
    sessionId: number
  ): Promise<{ evaluation: string | FinalEvaluationResponse; session: InterviewSession }> {
    return this.handleApiCall(async () => {
      const response = await this.api.get(`/sessions/${sessionId}/final-evaluation`);
      return response.data;
    });
  }

  // Get session details
  async getSession(sessionId: number): Promise<InterviewSession> {
    return this.handleApiCall(async () => {
      const response = await this.api.get(`/sessions/${sessionId}`);
      return response.data;
    });
  }

  // List all sessions
  async listSessions(): Promise<InterviewSession[]> {
    return this.handleApiCall(async () => {
      const response = await this.api.get('/sessions');
      return response.data;
    });
  }
}

// Create and export a singleton instance
export const interviewAPI = new InterviewAPI();
