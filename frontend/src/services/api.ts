import axios, { AxiosInstance } from 'axios';
import CryptoJS from 'crypto-js';

// Constants for local storage keys
const API_ENDPOINT_KEY = 'api_endpoint_url';
const API_KEY_KEY = 'api_key';
const MODEL_NAME_KEY = 'model_name';

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
  private _settingsChanged: boolean;

  constructor() {
    this.api = axios.create({
      baseURL: `${BASE_URL}/interviews`,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.lastActivityTime = Date.now();
    this.isSessionActive = true;
    this._settingsChanged = false;
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

  // Get custom API settings from local storage
  getCustomApiSettings(): { endpointUrl: string | null; apiKey: string | null; modelName: string | null } {
    const endpointUrl = localStorage.getItem(API_ENDPOINT_KEY);
    const apiKey = localStorage.getItem(API_KEY_KEY);
    const modelName = localStorage.getItem(MODEL_NAME_KEY);
    
    // Only return non-empty strings
    return { 
      endpointUrl: endpointUrl && endpointUrl.trim() ? endpointUrl : null, 
      apiKey: apiKey && apiKey.trim() ? apiKey : null,
      modelName: modelName && modelName.trim() ? modelName : null
    };
  }

  // Called when API settings have been changed
  onSettingsChanged(): void {
    // On settings change, we'll make sure the backend reinitializes the client
    // on the next API call by setting a flag
    this._settingsChanged = true;
    
    // Validate the new settings
    this.checkHealth();
  }

  // Check API health
  async checkHealth(): Promise<boolean> {
    return this.handleApiCall(async () => {
      try {
        const { endpointUrl } = this.getCustomApiSettings();
        const healthCheckUrl = endpointUrl ? 
          `${BASE_URL}/health?custom_endpoint=${encodeURIComponent(endpointUrl)}` :
          `${BASE_URL}/health`;
        
        await axios.get(healthCheckUrl, { timeout: 5000 });
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
      const { endpointUrl, apiKey, modelName } = this.getCustomApiSettings();
      const forceReinitialize = this._settingsChanged;
      
      // Reset the flag
      this._settingsChanged = false;
      
      const response = await this.api.post('/sessions', {
        candidate_name: candidateName,
        role,
        difficulty,
        custom_endpoint: endpointUrl,
        custom_api_key: apiKey,
        custom_model_name: modelName,
        force_reinitialize: forceReinitialize
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
      const { endpointUrl, apiKey, modelName } = this.getCustomApiSettings();
      const forceReinitialize = this._settingsChanged;
      
      // Reset the flag
      this._settingsChanged = false;
      
      const apiResponse = await this.api.post(`/sessions/${sessionId}/respond`, {
        response,
        custom_endpoint: endpointUrl,
        custom_api_key: apiKey,
        custom_model_name: modelName,
        force_reinitialize: forceReinitialize
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
      const { endpointUrl, apiKey, modelName } = this.getCustomApiSettings();
      const forceReinitialize = this._settingsChanged;
      
      // Reset the flag
      this._settingsChanged = false;
      
      const response = await this.api.post(`/sessions/${sessionId}/code`, {
        code,
        language,
        problem_statement: problemStatement,
        custom_endpoint: endpointUrl,
        custom_api_key: apiKey,
        custom_model_name: modelName,
        force_reinitialize: forceReinitialize
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
      const { endpointUrl, apiKey, modelName } = this.getCustomApiSettings();
      const forceReinitialize = this._settingsChanged;
      
      // Reset the flag
      this._settingsChanged = false;
      
      const response = await this.api.post(`/sessions/${sessionId}/evaluate-code`, {
        code,
        language,
        problem_statement: problemStatement,
        custom_endpoint: endpointUrl,
        custom_api_key: apiKey,
        custom_model_name: modelName,
        force_reinitialize: forceReinitialize
      });
      return response.data;
    });
  }

  // Get final evaluation
  async getFinalEvaluation(
    sessionId: number
  ): Promise<{ evaluation: string | FinalEvaluationResponse; session: InterviewSession }> {
    return this.handleApiCall(async () => {
      const { endpointUrl, apiKey, modelName } = this.getCustomApiSettings();
      const forceReinitialize = this._settingsChanged;
      
      // Reset the flag
      this._settingsChanged = false;
      
      const response = await this.api.post(`/sessions/${sessionId}/final-evaluation`, {
        custom_endpoint: endpointUrl,
        custom_api_key: apiKey,
        custom_model_name: modelName,
        force_reinitialize: forceReinitialize
      });
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

  // Verify custom API settings
  async verifyCustomApiSettings(
    endpointUrl: string | null, 
    apiKey: string | null,
    modelName: string | null
  ): Promise<{ valid: boolean; message: string; settings?: any }> {
    return this.handleApiCall(async () => {
      try {
        const response = await axios.get(
          `${BASE_URL}/health/check-custom-endpoint`, 
          { 
            params: {
              custom_endpoint: endpointUrl,
              custom_api_key: apiKey,
              custom_model_name: modelName
            },
            timeout: 10000 
          }
        );
        return response.data;
      } catch (error) {
        console.error('Error verifying custom API settings:', error);
        return { 
          valid: false, 
          message: 'Failed to verify custom API settings. Please check your connection and try again.' 
        };
      }
    });
  }

  // Get current API settings information
  async getCurrentApiSettings(): Promise<{ 
    isCustom: boolean; 
    isMixed: boolean; 
    settings: { 
      endpoint: string; 
      apiKey: string; 
      model: string 
    } 
  }> {
    const { endpointUrl, apiKey, modelName } = this.getCustomApiSettings();
    const isCustomEndpoint = !!endpointUrl;
    const isCustomApiKey = !!apiKey;
    const isCustomModel = !!modelName;
    
    // Check if we're using custom settings
    const isCustom = isCustomEndpoint || isCustomApiKey || isCustomModel;
    
    // Check if we're using a mix of custom and default settings
    const isMixed = isCustom && (!isCustomEndpoint || !isCustomApiKey || !isCustomModel);
    
    try {
      // Get information about current settings from backend
      const result = await this.verifyCustomApiSettings(endpointUrl, apiKey, modelName);
      
      if (result.valid && result.settings) {
        return {
          isCustom,
          isMixed,
          settings: result.settings
        };
      }
      
      // Fallback if settings not returned
      return {
        isCustom,
        isMixed,
        settings: {
          endpoint: endpointUrl ? `${endpointUrl} (custom)` : 'Using default from environment',
          apiKey: apiKey ? 'Using custom API key' : 'Using default from environment',
          model: modelName ? `${modelName} (custom)` : 'Using default from environment'
        }
      };
    } catch (error) {
      console.error('Error getting current API settings:', error);
      // Fallback
      return {
        isCustom,
        isMixed,
        settings: {
          endpoint: endpointUrl ? `${endpointUrl} (custom)` : 'Using default from environment',
          apiKey: apiKey ? 'Using custom API key' : 'Using default from environment',
          model: modelName ? `${modelName} (custom)` : 'Using default from environment'
        }
      };
    }
  }
}

// Create and export a singleton instance
export const interviewAPI = new InterviewAPI();
