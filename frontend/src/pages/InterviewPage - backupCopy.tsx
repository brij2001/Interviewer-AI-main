import React, { useState, useEffect, type FC, type ReactNode } from 'react';
import {
  Container,
  Grid,
  Typography,
  Paper,
  Button,
  Box,
  CircularProgress,
  Tooltip,
  Tabs,
  Tab,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import InfoIcon from '@mui/icons-material/Info';

import CodeEditor from '../components/CodeEditor';
import ChatInterface from '../components/ChatInterface';
import { interviewAPI } from '../services/api';
import type { EvaluationResponse } from '../services/api';

interface Message {
  sender: 'interviewer' | 'candidate';
  content: string;
  timestamp: string;
}

interface TabPanelProps {
  children?: ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      style={{ height: '100%', overflow: 'auto' }}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2, height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const InterviewPage: FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<string>('python');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentProblem, setCurrentProblem] = useState<string>('');
  const [currentEvaluation, setCurrentEvaluation] = useState<EvaluationResponse | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) return;
      
      try {
        const session = await interviewAPI.getSession(parseInt(sessionId));
        // Initialize chat with existing interview notes
        const chatMessages: Message[] = session.interview_notes.map((note: any) => ({
          sender: note.stage === 'candidate_response' ? 'candidate' : 'interviewer',
          content: note.content,
          timestamp: new Date().toISOString(),
        }));
        setMessages(chatMessages);
      } catch (error) {
        console.error('Error loading session:', error);
      }
    };

    loadSession();
  }, [sessionId]);

  // Function to format evaluation results in a more readable way
  const formatEvaluation = (evaluation: EvaluationResponse) => {
    return (
      <Box>
        {evaluation.correctness !== undefined && (
          <Box mb={2}>
            <Typography variant="subtitle1" fontWeight="bold">Correctness</Typography>
            <Typography variant="body1">{evaluation.correctness}/10</Typography>
          </Box>
        )}
        
        {evaluation.time_complexity && (
          <Box mb={2}>
            <Typography variant="subtitle1" fontWeight="bold">Time Complexity</Typography>
            <Typography variant="body1">{evaluation.time_complexity}</Typography>
          </Box>
        )}
        
        {evaluation.space_complexity && (
          <Box mb={2}>
            <Typography variant="subtitle1" fontWeight="bold">Space Complexity</Typography>
            <Typography variant="body1">{evaluation.space_complexity}</Typography>
          </Box>
        )}
        
        {evaluation.code_quality !== undefined && (
          <Box mb={2}>
            <Typography variant="subtitle1" fontWeight="bold">Code Quality</Typography>
            <Typography variant="body1">{evaluation.code_quality}/10</Typography>
          </Box>
        )}
        
        {evaluation.suggestions && evaluation.suggestions.length > 0 && (
          <Box mb={2}>
            <Typography variant="subtitle1" fontWeight="bold">Suggestions</Typography>
            <ul>
              {evaluation.suggestions.map((suggestion, index) => (
                <li key={index}>
                  <Typography variant="body1">{suggestion}</Typography>
                </li>
              ))}
            </ul>
          </Box>
        )}
        
        {evaluation.feedback && (
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">Detailed Feedback</Typography>
            <Typography variant="body1" style={{ whiteSpace: 'pre-line' }}>{evaluation.feedback}</Typography>
          </Box>
        )}
      </Box>
    );
  };

  // Function to check if a message indicates the user is done with coding
  const isCodeCompletionMessage = (message: string): boolean => {
    const completionPhrases = [
      "i have implemented my solution",
      "i'm done with the code",
      "i am done with the code",
      "could you evaluate my code",
      "evaluate my code",
      "check my code",
      "review my code",
      "my solution is ready",
      "done coding",
      "finished coding",
      "solution is complete",
      "i finished"
    ];
    
    const lowerCaseMessage = message.toLowerCase();
    return completionPhrases.some(phrase => lowerCaseMessage.includes(phrase));
  };

  const handleSendMessage = async (message: string) => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      // Add candidate's message
      const newMessage: Message = {
        sender: 'candidate',
        content: message,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMessage]);

      // Check if the message indicates code completion and there's code in the editor
      if (isCodeCompletionMessage(message) && code.trim() && currentProblem) {
        // If so, evaluate the code before getting the interviewer's response
        await handleCodeEvaluation();
      }

      // Get interviewer's response
      const response = await interviewAPI.sendResponse(parseInt(sessionId), message);

      // Add interviewer's response
      const interviewerMessage: Message = {
        sender: 'interviewer',
        content: response.response,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, interviewerMessage]);

      // Update problem statement if in coding stage
      if (response.stage === 'coding_problem' && response.response.includes('Problem:')) {
        setCurrentProblem(response.response);
        // Switch to Problem tab when a new problem is received
        setTabValue(0);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeEvaluation = async () => {
    if (!sessionId || !currentProblem || !code.trim()) return;

    setIsLoading(true);
    try {
      const result = await interviewAPI.evaluateCode(
        parseInt(sessionId),
        code,
        language,
        currentProblem
      );

      // Add code submission message to chat (without the evaluation)
      const submissionMessage: Message = {
        sender: 'candidate',
        content: `I've submitted my solution.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, submissionMessage]);

      // Process the evaluation result
      let evaluationResponse: EvaluationResponse = { feedback: "" };
      let evaluationContent = "Your code has been evaluated. Check the Evaluation tab below to see the results.";
      
      try {
        if (typeof result.evaluation === 'string') {
          // Try to parse the string as JSON first
          try {
            const parsedEvaluation = JSON.parse(result.evaluation);
            evaluationResponse = parsedEvaluation;
          } catch (jsonError) {
            // If it's not JSON, treat it as plain text feedback
            evaluationContent = result.evaluation;
            evaluationResponse = { feedback: result.evaluation };
          }
        } else if (result.evaluation && typeof result.evaluation === 'object') {
          evaluationResponse = result.evaluation as EvaluationResponse;
        } else {
          evaluationContent = "The code was submitted successfully, but there was an issue with the evaluation response format.";
          evaluationResponse = { feedback: evaluationContent };
        }
      } catch (error) {
        console.error('Error parsing evaluation result:', error);
        evaluationContent = "The code was submitted successfully, but there was an issue with the evaluation response.";
        evaluationResponse = { feedback: evaluationContent };
      }
      
      // Set the current evaluation for the tab panel
      setCurrentEvaluation(evaluationResponse);
      
      // Add simplified evaluation message to chat
      const evaluationMessage: Message = {
        sender: 'interviewer',
        content: evaluationContent,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, evaluationMessage]);
      
      // Switch to the Evaluation tab
      setTabValue(1);
    } catch (error) {
      console.error('Error evaluating code:', error);
      
      // Add error message to chat
      const errorMessage: Message = {
        sender: 'interviewer',
        content: "There was an error evaluating your code. Please try again or contact support if the issue persists.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
    
    return true;
  };

  const handleSubmitCode = handleCodeEvaluation; // Alias for backward compatibility

  const handleFinishInterview = async () => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      const result = await interviewAPI.getFinalEvaluation(parseInt(sessionId));
      
      // Add final evaluation message
      const evaluationMessage: Message = {
        sender: 'interviewer',
        content: result.evaluation,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, evaluationMessage]);
      
      // Navigate to results page or show final evaluation
    } catch (error) {
      console.error('Error getting final evaluation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ height: '100vh', py: 3 }}>
      <Grid container spacing={2} sx={{ height: '100%' }}>
        {/* Chat Section */}
        <Grid item xs={12} md={6} sx={{ height: '100%' }}>
          <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6">Interview Chat</Typography>
            </Box>
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
            />
          </Paper>
        </Grid>

        {/* Code Editor Section */}
        <Grid item xs={12} md={6} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Paper sx={{ flexGrow: 1, p: 2, mb: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
              Code Editor
            </Typography>
            <Box sx={{ flexGrow: 1 }}>
              <CodeEditor
                code={code}
                language={language}
                onChange={(value) => setCode(value || '')}
                onLanguageChange={setLanguage}
              />
            </Box>
            <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <Tooltip title="Click this button to evaluate your code, or simply type 'I'm done' or 'Evaluate my code' in the chat">
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleCodeEvaluation}
                  disabled={isLoading || !code.trim()}
                >
                  Evaluate Code
                </Button>
              </Tooltip>
              <Tooltip title="Information">
                <InfoIcon color="info" fontSize="small" sx={{ ml: 1 }} />
              </Tooltip>
              <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                Tip: You can also say "I'm done" in chat
              </Typography>
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleFinishInterview}
                disabled={isLoading}
              >
                Finish Interview
              </Button>
            </Box>
          </Paper>
          
          {/* Problem/Evaluation Tabs */}
          <Paper sx={{ flexGrow: 0, height: '30%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="problem and evaluation tabs">
                <Tab label="Problem" id="tab-0" aria-controls="tabpanel-0" />
                <Tab label="Evaluation" id="tab-1" aria-controls="tabpanel-1" />
              </Tabs>
            </Box>
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
              <TabPanel value={tabValue} index={0}>
                {currentProblem ? (
                  <div dangerouslySetInnerHTML={{ __html: currentProblem.replace(/\n/g, '<br>') }} />
                ) : (
                  <Typography>No problem statement yet. The interviewer will provide a coding problem.</Typography>
                )}
              </TabPanel>
              <TabPanel value={tabValue} index={1}>
                {currentEvaluation ? (
                  formatEvaluation(currentEvaluation)
                ) : (
                  <Typography>No evaluation available yet. Submit your code for evaluation first.</Typography>
                )}
              </TabPanel>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Loading Overlay */}
      {isLoading && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <CircularProgress />
        </Box>
      )}
    </Container>
  );
};

export default InterviewPage;
