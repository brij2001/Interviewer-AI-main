import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import { interviewAPI } from '../services/api';

interface ApiSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const API_ENDPOINT_KEY = 'api_endpoint_url';
const API_KEY_KEY = 'api_key';
const MODEL_NAME_KEY = 'model_name';

const APISettingsDialog: React.FC<ApiSettingsDialogProps> = ({ open, onClose }) => {
  const [endpointUrl, setEndpointUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [currentSettings, setCurrentSettings] = useState<any>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Load saved settings when dialog opens
  useEffect(() => {
    if (open) {
      const savedEndpoint = localStorage.getItem(API_ENDPOINT_KEY) || '';
      const savedApiKey = localStorage.getItem(API_KEY_KEY) || '';
      const savedModelName = localStorage.getItem(MODEL_NAME_KEY) || '';
      setEndpointUrl(savedEndpoint);
      setApiKey(savedApiKey);
      setModelName(savedModelName);
      setSaveSuccess(false);
      setSaveError(null);
      
      // Load current settings information
      loadCurrentSettings();
    }
  }, [open]);
  
  // Load current settings info from the backend
  const loadCurrentSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const settingsInfo = await interviewAPI.getCurrentApiSettings();
      setCurrentSettings(settingsInfo);
    } catch (error) {
      console.error('Error loading current settings:', error);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleSave = async () => {
    // Reset states
    setSaveSuccess(false);
    setSaveError(null);
    setIsValidating(true);
    
    try {
      // Validate settings if provided
      if (endpointUrl || apiKey || modelName) {
        const validationResult = await interviewAPI.verifyCustomApiSettings(endpointUrl, apiKey, modelName);
        
        if (!validationResult.valid) {
          setSaveError(validationResult.message);
          setIsValidating(false);
          return;
        }
      }
      
      // Store settings in localStorage
      const previousEndpoint = localStorage.getItem(API_ENDPOINT_KEY);
      const previousApiKey = localStorage.getItem(API_KEY_KEY);
      const previousModelName = localStorage.getItem(MODEL_NAME_KEY);
      
      // Check if settings have changed
      const settingsChanged = 
        previousEndpoint !== endpointUrl || 
        previousApiKey !== apiKey || 
        previousModelName !== modelName;
      
      if (endpointUrl) {
        localStorage.setItem(API_ENDPOINT_KEY, endpointUrl);
      } else {
        localStorage.removeItem(API_ENDPOINT_KEY);
      }
      
      if (apiKey) {
        localStorage.setItem(API_KEY_KEY, apiKey);
      } else {
        localStorage.removeItem(API_KEY_KEY);
      }
      
      if (modelName) {
        localStorage.setItem(MODEL_NAME_KEY, modelName);
      } else {
        localStorage.removeItem(MODEL_NAME_KEY);
      }

      // If settings have changed, notify the API service
      if (settingsChanged) {
        interviewAPI.onSettingsChanged();
      }

      setSaveSuccess(true);
      
      // Auto-close after saving
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (error) {
      console.error('Error saving API settings:', error);
      setSaveError('An unexpected error occurred while saving settings.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleReset = () => {
    setEndpointUrl('');
    setApiKey('');
    setModelName('');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>API Settings</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure custom API endpoint URL, API key, and model name. These settings will be saved in your browser.
            Leave fields empty to use the default values from environment variables.
          </Typography>

          {/* Show loading indicator while fetching current settings */}
          {isLoadingSettings && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Loading current settings...
              </Typography>
            </Box>
          )}

          {saveSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Settings saved successfully!
            </Alert>
          )}

          {saveError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {saveError}
            </Alert>
          )}

          {!isLoadingSettings && currentSettings && (
            <Box sx={{ mb: 3, bgcolor: 'background.paper', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" gutterBottom>
                Current Settings:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Endpoint:</strong> {currentSettings.settings.endpoint}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>API Key:</strong> {currentSettings.settings.apiKey}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Model:</strong> {currentSettings.settings.model}
              </Typography>
            </Box>
          )}
          
          <TextField
            label="API Endpoint URL"
            placeholder="https://api.openai.com/v1"
            fullWidth
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            margin="normal"
            helperText="Leave empty to use the default endpoint from environment"
            disabled={isValidating || isLoadingSettings}
          />

          <TextField
            label="API Key"
            fullWidth
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            margin="normal"
            type="password"
            helperText="Leave empty to use the default API key from environment"
            disabled={isValidating || isLoadingSettings}
          />

          <TextField
            label="Model Name"
            placeholder="gpt-4"
            fullWidth
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            margin="normal"
            helperText="Leave empty to use the default model from environment"
            disabled={isValidating || isLoadingSettings}
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" color="text.secondary">
            When fields are left empty, the system will use the default settings from the server's environment variables.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleReset} color="inherit" disabled={isValidating || isLoadingSettings}>
          Reset
        </Button>
        <Button onClick={onClose} disabled={isValidating || isLoadingSettings}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          color="primary"
          disabled={isValidating || isLoadingSettings}
          startIcon={isValidating ? <CircularProgress size={16} /> : null}
        >
          {isValidating ? 'Validating...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default APISettingsDialog;