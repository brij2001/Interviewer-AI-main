import React, { useState, useEffect } from 'react';
import { Box, Tooltip, Typography, keyframes } from '@mui/material';
import { interviewAPI } from '../services/api';

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

    // Set up interval to check API health every 30 seconds
    const intervalId = setInterval(() => {
      checkAPIHealth();
    }, 60000);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            API Status: {isHealthy === null ? 'Checking...' : isHealthy ? 'Healthy' : 'Unavailable'}
          </Typography>
          <Typography variant="caption">
            Last checked: {lastChecked.toLocaleTimeString()}
          </Typography>
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
  );
};

export default APIStatusIcon; 