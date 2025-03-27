FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Set environment variables for Cloud Run
ENV PORT=8080
ENV HOST=0.0.0.0
ENV PYTHONUNBUFFERED=1
ENV CORS_ORIGINS=https://interviewer.im-brij.com

# Command to run the application
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT} 