import React, { useState, useEffect } from 'react';
import { Box, Tooltip, Typography, keyframes, IconButton, Badge} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { interviewAPI } from '../services/api';
import APISettingsDialog from './APISettingsDialog';

// Keyframes for the pulsing green glow effect
const pulseGreenGlow = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
  }
  70% {
    box-shadow: 0 0 0 5px rgba(76, 175, 80, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
  }
`;

// Keyframes for the pulsing red glow effect
const pulseRedGlow = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.7);
  }
  70% {
    box-shadow: 0 0 0 5px rgba(244, 67, 54, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0);
  }
`;

const APIStatusIcon: React.FC = () => {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasCustomSettings, setHasCustomSettings] = useState(false);
  const [settingsType, setSettingsType] = useState<'default' | 'custom' | 'mixed'>('default');

  // Check if custom settings are configured
  const checkForCustomSettings = () => {
    const hasEndpoint = !!localStorage.getItem('api_endpoint_url');
    const hasApiKey = !!localStorage.getItem('api_key');
    const hasModelName = !!localStorage.getItem('model_name');
    
    // Determine if we're using all custom, all default, or a mix
    if (hasEndpoint && hasApiKey && hasModelName) {
      setSettingsType('custom');
    } else if (!hasEndpoint && !hasApiKey && !hasModelName) {
      setSettingsType('default');
    } else {
      setSettingsType('mixed');
    }
    
    setHasCustomSettings(hasEndpoint || hasApiKey || hasModelName);
  };

  // Check API health
  const checkAPIHealth = async () => {
    try {
      const healthStatus = await interviewAPI.checkHealth();
      setIsHealthy(healthStatus);
    } catch (error) {
      setIsHealthy(false);
    } finally {
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    // Check API health on component mount
    checkAPIHealth();
    checkForCustomSettings();

    // Set up interval to check API health every 60 seconds
    const intervalId = setInterval(() => {
      checkAPIHealth();
    }, 60000);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  // Open API settings dialog
  const handleOpenSettings = (event: React.MouseEvent) => {
    event.stopPropagation();
    setSettingsOpen(true);
  };

  // Close API settings dialog and recheck health
  const handleCloseSettings = () => {
    setSettingsOpen(false);
    // Check for custom settings
    checkForCustomSettings();
    // Recheck API health after settings change
    setTimeout(() => {
      checkAPIHealth();
    }, 500);
  };

  // Get config badge color
  const getConfigBadgeColor = () => {
    switch (settingsType) {
      case 'custom':
        return 'primary';
      case 'mixed':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip
          title={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                API Status: {isHealthy === null ? 'Checking...' : isHealthy ? 'Healthy' : 'Unavailable'}
              </Typography>
              <Typography variant="caption">
                Last checked: {lastChecked.toLocaleTimeString()}
              </Typography>
              
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'info.main' }}>
                {settingsType === 'default' ? (
                  'Using default API settings from environment'
                ) : settingsType === 'custom' ? (
                  'Using custom API settings'
                ) : (
                  'Using a mix of custom and default API settings'
                )}
              </Typography>
              
              {localStorage.getItem('model_name') && (
                <Typography variant="caption" sx={{ display: 'block', color: 'info.main' }}>
                  Model: {localStorage.getItem('model_name')}
                </Typography>
              )}
              
              {!isHealthy && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                  The application might experience issues connecting to the backend.
                </Typography>
              )}
            </Box>
          }
          open={tooltipOpen}
          onOpen={() => setTooltipOpen(true)}
          onClose={() => setTooltipOpen(false)}
          arrow
        >
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: isHealthy === null ? 'grey.500' : isHealthy ? 'success.main' : 'error.main',
              animation: isHealthy 
                ? `${pulseGreenGlow} 2s infinite` 
                : isHealthy === false 
                  ? `${pulseRedGlow} 1.5s infinite` 
                  : 'none',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'scale(1.2)',
              },
            }}
            onClick={() => checkAPIHealth()}
          />
        </Tooltip>
        
        <Badge
          color={getConfigBadgeColor()}
          variant="dot"
          invisible={!hasCustomSettings}
        >
          <IconButton 
            size="small" 
            onClick={handleOpenSettings}
            sx={{ 
              padding: 0.5,
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Badge>
      </Box>
      
      <APISettingsDialog
        open={settingsOpen}
        onClose={handleCloseSettings}
      />
    </>
  );
};

export default APIStatusIcon; 