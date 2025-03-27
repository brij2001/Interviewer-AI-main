import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
// import InfoIcon from '@mui/icons-material/Info';
import ReactMarkdown from 'react-markdown';

import CodeEditor from '../components/CodeEditor';
import ChatInterface from '../components/ChatInterface';
import APIStatusIcon from '../components/APIStatusIcon';
import { interviewAPI } from '../services/api';
import { EvaluationResponse, FinalEvaluationResponse } from '../services/api';

interface Message {
  sender: 'interviewer' | 'candidate';
  content: string;
  timestamp: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      style={{ height: '100%', overflowY: 'auto', padding: '16px' }}
      {...other}
    >
      {value === index && (
        <Box sx={{ height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const InterviewPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<string>('python');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isValidating, setIsValidating] = useState<boolean>(true);
  const [isAccessDenied, setIsAccessDenied] = useState<boolean>(false);
  const [currentProblem, setCurrentProblem] = useState<string>('');
  const [currentEvaluation, setCurrentEvaluation] = useState<EvaluationResponse | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  useEffect(() => {
    const validateSession = async () => {
      if (!sessionId) {
        navigate('/');
        return;
      }

      setIsValidating(true);
      
      try {
        // Check if the token is valid
        const isValid = await interviewAPI.validateSessionToken(parseInt(sessionId));
        
        if (!isValid) {
          console.error('Access denied: Invalid session token');
          setIsAccessDenied(true);
          setIsValidating(false);
          return;
        }
        
        // If valid, load the session
        await loadSession();
      } catch (error) {
        console.error('Error validating session:', error);
        setIsAccessDenied(true);
      } finally {
        setIsValidating(false);
      }
    };

    const loadSession = async () => {
      if (!sessionId) return;

      try {
        const session = await interviewAPI.getSession(parseInt(sessionId));
        // Initialize chat with existing interview notes
        const chatMessages: Message[] = session.interview_notes.map((note: any) => {
          let content = note.content;
          let sender: 'interviewer' | 'candidate' = 'interviewer';

          // Check if it's a candidate message (which starts with "Candidate: ")
          if (note.content.startsWith('Candidate: ')) {
            content = note.content.substring('Candidate: '.length);
            sender = 'candidate';
          } else if (note.stage === 'candidate_response') {
            sender = 'candidate';
          }

          return {
            sender,
            content,
            timestamp: new Date().toISOString(),
          };
        });

        setMessages(chatMessages);
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    validateSession();
  }, [sessionId, navigate]);

  // Function to format evaluation results in a more readable way
  const formatEvaluation = (evaluation: EvaluationResponse) => {
    // For debugging
    console.log('Formatting evaluation:', evaluation);

    // If we have no evaluation or empty evaluation object, show a message
    if (!evaluation || Object.keys(evaluation).length === 0) {
      return (
        <Box>
          <Typography>Unable to display evaluation. The response was empty or invalid.</Typography>
        </Box>
      );
    }

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

        {/* Always display feedback section, with fallback for missing feedback */}
        <Box>
          <Typography variant="subtitle1" fontWeight="bold">Detailed Feedback</Typography>
          <Typography variant="body1" style={{ whiteSpace: 'pre-line' }}>
            {evaluation.feedback || 'No detailed feedback was provided for this evaluation.'}
          </Typography>
        </Box>
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

  // Function to extract just the coding problem from the interviewer's message
  const extractProblemStatement = (fullMessage: string): string => {
    // Look for key markers that indicate the problem statement
    const problemMarker = "Problem:";
    const problemIndex = fullMessage.indexOf(problemMarker);

    if (problemIndex === -1) {
      // If we don't find "Problem:", return the whole message
      return fullMessage;
    }

    // Extract from "Problem:" to the end (or to the next major section)
    let endIndex = fullMessage.length;

    // Look for possible end markers like "Example Input:" or "Constraints:"
    const possibleEndMarkers = ["Note:", "Good luck"];
    for (const marker of possibleEndMarkers) {
      const markerIndex = fullMessage.indexOf(marker, problemIndex + problemMarker.length);
      if (markerIndex !== -1 && markerIndex < endIndex) {
        endIndex = markerIndex;
      }
    }

    // Get the problem statement and add any examples/constraints that follow
    let problemStatement = fullMessage.substring(problemIndex);

    // Format the result with appropriate spacing and line breaks
    return problemStatement.trim();
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
        setCurrentProblem(extractProblemStatement(response.response));
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
    if (!sessionId || !code.trim()) return;

    // If we don't have a current problem, get it from the messages
    if (!currentProblem) {
      // Try to find a problem statement in the messages
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message.sender === 'interviewer' && message.content.includes('Problem:')) {
          setCurrentProblem(extractProblemStatement(message.content));
          break;
        }
      }
    }

    setIsLoading(true);
    try {
      // Ensure we have a problem statement to submit
      const problemToSubmit = currentProblem || "Code evaluation request";

      const result = await interviewAPI.evaluateCode(
        parseInt(sessionId),
        code,
        language,
        problemToSubmit
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

      // Log the raw evaluation for debugging
      console.log('Raw evaluation result:', result.evaluation);

      try {
        if (typeof result.evaluation === 'string') {
          // Try to parse the string as JSON first
          try {
            // Sometimes the string might have extra content before or after the JSON
            // Try to extract just the JSON part using regex
            const jsonMatch = result.evaluation.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
              const jsonStr = jsonMatch[0];
              const parsedEvaluation = JSON.parse(jsonStr);
              evaluationResponse = parsedEvaluation;

              // Extract a summary for the chat interface
              if (parsedEvaluation.feedback) {
                // Get the first few sentences of the feedback for the chat message
                const sentences = parsedEvaluation.feedback.split(/[.!?]+\s+/).filter(Boolean);
                if (sentences.length > 0) {
                  evaluationContent = sentences.slice(0, 2).join('. ') + '.';
                  evaluationContent += " Check the Evaluation tab for full details.";
                }
              }
            } else {
              // If we couldn't find a JSON object, use the string as feedback
              evaluationContent = result.evaluation;
              evaluationResponse = { feedback: result.evaluation };
            }
          } catch (jsonError) {
            console.error('Error parsing JSON from evaluation:', jsonError);
            // If it's not JSON, treat it as plain text feedback
            evaluationContent = result.evaluation;
            evaluationResponse = { feedback: result.evaluation };
          }
        } else if (result.evaluation && typeof result.evaluation === 'object') {
          evaluationResponse = result.evaluation as EvaluationResponse;

          // Extract a summary for the chat interface
          if (evaluationResponse.feedback) {
            // Get the first few sentences of the feedback for the chat message
            const sentences = evaluationResponse.feedback.split(/[.!?]+\s+/).filter(Boolean);
            if (sentences.length > 0) {
              evaluationContent = sentences.slice(0, 2).join('. ') + '.';
              evaluationContent += " Check the Evaluation tab for full details.";
            }
          }
        } else {
          evaluationContent = "The code was submitted successfully, but there was an issue with the evaluation response format.";
          evaluationResponse = { feedback: evaluationContent };
        }
      } catch (error) {
        console.error('Error parsing evaluation result:', error);
        evaluationContent = "The code was submitted successfully, but there was an issue with the evaluation response.";
        evaluationResponse = { feedback: evaluationContent };
      }

      // Make sure evaluation response is not null or undefined
      if (!evaluationResponse) {
        evaluationResponse = { feedback: "Unable to process evaluation response." };
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

  const handleFinishInterview = async () => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      const result = await interviewAPI.getFinalEvaluation(parseInt(sessionId));

      // Log the raw evaluation data for debugging
      console.log('Final evaluation result:', result.evaluation);

      // Process the evaluation data
      let evaluationContent = '';
      let evaluationData: EvaluationResponse = { feedback: '' };

      // Process the evaluation result
      if (typeof result.evaluation === 'string') {
        // Try to parse the string as JSON if it is one
        try {
          const jsonMatch = result.evaluation.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsedEvaluation = JSON.parse(jsonMatch[0]) as FinalEvaluationResponse;
            evaluationData = {
              ...parsedEvaluation,
              feedback: parsedEvaluation.detailed_feedback || result.evaluation
            };
            evaluationContent = parsedEvaluation.detailed_feedback || result.evaluation;
          } else {
            evaluationContent = result.evaluation;
            evaluationData = { feedback: result.evaluation };
          }
        } catch (error) {
          console.error('Error parsing final evaluation JSON:', error);
          evaluationContent = result.evaluation;
          evaluationData = { feedback: result.evaluation };
        }
      } else if (result.evaluation && typeof result.evaluation === 'object') {
        // If it's already an object
        const evalObj = result.evaluation as FinalEvaluationResponse;
        evaluationData = {
          ...evalObj,
          feedback: evalObj.detailed_feedback || ''
        };
        evaluationContent = evalObj.detailed_feedback ||
          "Thank you for completing the interview. Please check the Evaluation tab for your assessment.";
      } else {
        evaluationContent = "Thank you for completing the interview. The evaluation could not be processed.";
        evaluationData = { feedback: evaluationContent };
      }

      // Add final evaluation message to chat
      const evaluationMessage: Message = {
        sender: 'interviewer',
        content: evaluationContent,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, evaluationMessage]);

      // Set the current evaluation for the tab panel
      setCurrentEvaluation(evaluationData);

      // Switch to the Evaluation tab
      setTabValue(1);

    } catch (error) {
      console.error('Error getting final evaluation:', error);

      // Add error message to chat
      const errorMessage: Message = {
        sender: 'interviewer',
        content: "There was an error generating the final evaluation. Please try again or contact support.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Render loading state or access denied state
  if (isValidating) {
    return (
      <Container maxWidth="xl" sx={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Box textAlign="center">
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Validating session...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (isAccessDenied) {
    return (
      <Container maxWidth="sm" sx={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1" paragraph>
            You don't have permission to access this interview session. This may be because:
          </Typography>
          <Typography component="ul" sx={{ pl: 2 }}>
            <li>You are trying to access from a different device or browser</li>
            <li>The session token has expired</li>
            <li>The session does not exist</li>
          </Typography>
          <Button 
            variant="contained" 
            color="primary" 
            fullWidth 
            onClick={() => navigate('/')} 
            sx={{ mt: 2 }}
          >
            Return to Home
          </Button>
        </Paper>
      </Container>
    );
  }

  // Render the actual interview UI
  return (
    <Container maxWidth="xl" sx={{ height: '100vh', py: 3, position: 'relative' }}>

      <Grid container spacing={2} sx={{ height: '100%' }}>
        {/* Chat Section */}
        <Grid item xs={12} md={6} sx={{ height: '100%' }}>
          <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6">Interview Chat</Typography>
              <APIStatusIcon />
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
              <Button
                variant="contained"
                color="success"
                onClick={handleCodeEvaluation}
                disabled={isLoading || !code.trim()}
                sx={{ ml: 1 }}
              >
                Submit Code
              </Button>

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
                  <Box sx={{ whiteSpace: 'pre-wrap' }}>
                    <ReactMarkdown>
                      {currentProblem}
                    </ReactMarkdown>
                  </Box>
                ) : (
                  <Typography>No problem statement yet. The interviewer will provide a coding problem.</Typography>
                )}
              </TabPanel>
              <TabPanel value={tabValue} index={1}>
                {currentEvaluation ? (
                  <Box sx={{ maxHeight: '100%', overflowY: 'auto' }}>
                    {formatEvaluation(currentEvaluation)}
                  </Box>
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
