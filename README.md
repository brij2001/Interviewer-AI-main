# AI Coding Interview Platform

An interactive platform that uses AI to conduct coding interviews, providing real-time feedback and evaluation through a multi-agent architecture.

## Features

- Multi-agent AI system with specialized agents:
  - Interviewer Agent - Conducts the interview and communicates with the user
  - Code Evaluator Agent - Evaluates code submissions
  - Final Evaluator Agent - Provides comprehensive candidate assessment
  - Coordinator Agent - Orchestrates the interview process and agent communication
- Real-time code editor with syntax highlighting
- Interactive chat interface
- Multiple programming language support
- Adaptive difficulty levels
- Comprehensive interview feedback
- Session persistence

## Tech Stack

### Backend
- Python with FastAPI
- LangChain for AI interaction
- SQLite database
- Chroma vector store
- OpenAI GPT-4

### Frontend
- React with TypeScript
- Material-UI for components
- Monaco Editor for code editing
- React Router for navigation
- Axios for API calls

## Multi-Agent Architecture

The platform is built with a specialized multi-agent architecture:

1. **Interviewer Agent**: 
   - Conducts the interview directly with the candidate
   - Handles introductions, technical questions, and problem presentation
   - Only agent that communicates with the user

2. **Code Evaluator Agent**:
   - Specializes in evaluating code submissions
   - Analyzes code for correctness, efficiency, and style
   - Provides structured feedback on submissions

3. **Final Evaluator Agent**:
   - Provides comprehensive assessment of the candidate
   - Evaluates technical skills, problem-solving ability, and communication
   - Makes hiring recommendations

4. **Coordinator Agent**:
   - Orchestrates the entire interview process
   - Manages communication between specialized agents
   - Maintains context and ensures smooth transitions between interview stages

This architecture provides a seamless and natural interview experience while leveraging specialized capabilities of each agent behind the scenes.

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
- Copy .env.example to .env
- Add your OpenAI API key and other configurations

5. Start the backend server:
```bash
uvicorn app.main:app --reload
```

The backend server will run on http://localhost:8000

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The frontend application will run on http://localhost:3000

## API Documentation

Once the backend is running, visit http://localhost:8000/docs for complete API documentation.

### Main Endpoints

- POST /api/v1/interviews/sessions - Create new interview session
- POST /api/v1/interviews/sessions/{session_id}/respond - Send candidate response
- POST /api/v1/interviews/sessions/{session_id}/code - Submit code for evaluation
- GET /api/v1/interviews/sessions/{session_id}/final-evaluation - Get final evaluation

## Interview Flow

1. User starts a new interview session by selecting role and difficulty
2. Interviewer Agent conducts initial introduction
3. Technical discussion phase with adaptive questions
4. Coding challenge presentation
5. Code Evaluator Agent assesses code submissions
6. Final Evaluator Agent provides comprehensive evaluation

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── agent/
│   │   │   ├── base_agent.py
│   │   │   ├── interviewer_agent.py
│   │   │   ├── evaluator_agent.py
│   │   │   ├── final_evaluator_agent.py
│   │   │   ├── coordinator_agent.py
│   │   │   └── prompts.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── models/
│   │   │   └── interview.py
│   │   ├── routers/
│   │   │   └── interview.py
│   │   └── main.py
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── manifest.json
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatInterface.tsx
│   │   │   └── CodeEditor.tsx
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   └── InterviewPage.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── App.tsx
│   │   ├── index.tsx
│   │   └── index.css
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - feel free to use this project for any purpose.

## Support

For support or questions, please open an issue in the repository.
