# Trixon — Continuous Technical Intelligence

Trixon is a continuous codebase intelligence platform built for non-technical founders and modern software teams. Connect your repository once, and every commit gets analyzed, scored, and turned into actionable next steps.

## Features

- **Automated Snapshots:** Tracks health trends and compares codebase diffs across snapshots on every push.
- **Deep Technical Reports:** Automatically generates reports covering Executive Summaries, Architecture, Tech Debt, Security Risks, Scalability, Dev Onboarding, and Investor Summaries.
- **Action Items:** Extracts actionable tasks out of every analysis, scored by effort and impact, complete with ready-to-use prompts for AI coding assistants like Cursor and Claude.
- **AI Chat Advisor:** Ask questions directly about your codebase's history, architectural decisions, and current state.

## Tech Stack

### Frontend
- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS (v4)
- **Design System:** Trixon Two-Tone Premium Design System (Obsidian & Paper)
- **Icons:** Lucide React

### Backend
- **Framework:** FastAPI (Python)
- **Task Queue:** RQ (Redis Queue) / Celery
- **Caching & Broker:** Redis
- **Database / Auth:** Supabase (PostgreSQL)

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Docker & Docker Compose
- Supabase project (for authentication and database)

### Environment Variables
You'll need `.env` files for both the frontend and backend. See `.env.example` in their respective directories for the required keys (e.g., Supabase URLs, AI API Keys like Groq).

### Running Locally

1. **Start Redis:**
   ```bash
   docker-compose up -d redis
   ```

2. **Start the Backend server:**
   ```bash
   cd backend
   # Set up virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

3. **Start the Background Worker:**
   ```bash
   cd backend
   python -m worker
   ```

4. **Start the Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

The frontend will be available at `http://localhost:3000` and the backend API at `http://localhost:8000`.

## Design System

Trixon uses a custom-tailored two-tone UI built directly into `globals.css` using Tailwind v4. The color palette revolves around `obsidian` (dark) and `paper` (light), utilizing a subtle glow-based elevation system instead of flat shadows to give a premium, continuous-analysis feel.

## License
Proprietary
