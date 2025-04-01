FROM python:3.10-slim

WORKDIR /app

COPY /app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Set environment variables for Cloud Run
ENV PORT=8080
ENV HOST=0.0.0.0
ENV PYTHONUNBUFFERED=1
ENV CORS_ORIGINS=https://interviewer.im-brij.com
ENV MODEL_ENDPOINT=https://chatapi.akash.network/api/v1
ENV MODEL_NAME=Meta-Llama-3-1-405B-Instruct-FP8

# Vector Store Configuration
ENV VECTORSTORE_PATH=/tmp/chroma_db
ENV ENVIRONMENT=production

# Interview Settings
MAX_INTERVIEW_DURATION=3600
DEFAULT_INTERVIEW_DIFFICULTY=medium 

# Command to run the application
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}