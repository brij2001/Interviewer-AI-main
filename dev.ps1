# Interviewer-AI Development Script
# This script starts both the frontend and backend development servers

Write-Host "Starting Interviewer-AI development environment..." -ForegroundColor Cyan

# Function to check if a command exists
function Test-Command {
    param (
        [string]$Command
    )
    
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# Check if Python is installed
if (-not (Test-Command "python")) {
    Write-Host "Python is not installed or not in PATH. Please install Python 3.10+ and try again." -ForegroundColor Red
    exit 1
}

# Check if Node.js is installed
if (-not (Test-Command "node")) {
    Write-Host "Node.js is not installed or not in PATH. Please install Node.js and try again." -ForegroundColor Red
    exit 1
}

# Check if pnpm is installed
$usePnpm = Test-Command "pnpm"
$packageManager = if ($usePnpm) { "pnpm" } else { "npm" }

# Start the backend server
Write-Host "Starting backend server..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD/backend
    
    # Create virtual environment if it doesn't exist
    if (-not (Test-Path "venv")) {
        Write-Host "Creating virtual environment..." -ForegroundColor Magenta
        python -m venv venv
    }
    
    # Activate virtual environment
    Write-Host "Activating virtual environment..." -ForegroundColor Magenta
    & ./venv/Scripts/Activate.ps1
    
    # Install dependencies
    Write-Host "Installing backend dependencies..." -ForegroundColor Magenta
    pip install -r requirements.txt
    
    # Run the backend server with development environment
    Write-Host "Starting backend server on http://localhost:8000/api/v1" -ForegroundColor Green
    $env:PYTHONPATH = "$using:PWD/backend"
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --env-file .env.development
}

# Start the frontend server
Write-Host "Starting frontend server..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD/frontend
    
    # Install dependencies
    Write-Host "Installing frontend dependencies..." -ForegroundColor Magenta
    & $using:packageManager install
    
    # Run the frontend server
    Write-Host "Starting frontend server on http://localhost:3000" -ForegroundColor Green
    & $using:packageManager run dev
}

try {
    # Display output from both jobs
    Write-Host "Development servers starting..." -ForegroundColor Cyan
    Write-Host "Frontend will be available at: http://localhost:3000" -ForegroundColor Green
    Write-Host "Backend API will be available at: http://localhost:8000/api/v1" -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop both servers" -ForegroundColor Red
    
    # Keep the script running and display logs
    while ($true) {
        Receive-Job -Job $backendJob
        Receive-Job -Job $frontendJob
        Start-Sleep -Seconds 1
    }
}
finally {
    # Clean up jobs when the script is terminated
    Write-Host "Stopping development servers..." -ForegroundColor Cyan
    Stop-Job -Job $backendJob
    Stop-Job -Job $frontendJob
    Remove-Job -Job $backendJob
    Remove-Job -Job $frontendJob
} 