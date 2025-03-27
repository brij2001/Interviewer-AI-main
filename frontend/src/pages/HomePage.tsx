import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { interviewAPI } from '../services/api';
import APIStatusIcon from '../components/APIStatusIcon';

const DIFFICULTY_LEVELS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const ROLES = [
  { value: 'software_engineer', label: 'Software Engineer' },
  { value: 'frontend_developer', label: 'Frontend Developer' },
  { value: 'backend_developer', label: 'Backend Developer' },
  { value: 'fullstack_developer', label: 'Full Stack Developer' },
];

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStartInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await interviewAPI.createSession(name, role, difficulty);
      navigate(`/interview/${response.session_id}`);
    } catch (error) {
      console.error('Error starting interview:', error);
      setError('Failed to start interview. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8, position: 'relative' }}>
      <Box sx={{ position: 'absolute', top: 16, right: -24 }}>
        <APIStatusIcon />
      </Box>
      <Paper
        elevation={3}
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom align="center">
          AI Coding Interview Platform
        </Typography>

        <Typography variant="body1" color="text.secondary" align="center">
          Practice coding interviews with our AI interviewer. Get real-time feedback
          and improve your skills.
        </Typography>

        <Box component="form" onSubmit={handleStartInterview} sx={{ mt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth required sx={{ mb: 2 }}>
            <InputLabel id="role-label">Role</InputLabel>
            <Select
              labelId="role-label"
              value={role}
              label="Role"
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLES.map((role) => (
                <MenuItem key={role.value} value={role.value}>
                  {role.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel id="difficulty-label">Difficulty</InputLabel>
            <Select
              labelId="difficulty-label"
              value={difficulty}
              label="Difficulty"
              onChange={(e) => setDifficulty(e.target.value)}
            >
              {DIFFICULTY_LEVELS.map((level) => (
                <MenuItem key={level.value} value={level.value}>
                  {level.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Coming soon: Resume Upload */}
          {/* add a coming soon section */}
          <Box sx={{ mt: 2 }}>
            <Typography color="gray" variant="h6" component="h2" gutterBottom>
              Coming Soon: resume upload
            </Typography>
          </Box>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={isLoading}
          >
            {isLoading ? 'Starting Interview...' : 'Start Interview'}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" align="center">
          The AI interviewer will adapt to your responses and provide personalized
          feedback throughout the session.
        </Typography>
      </Paper>
    </Container>
  );
};

export default HomePage;
