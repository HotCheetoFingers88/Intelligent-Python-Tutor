# ascend.py - Intelligent Tutoring System

An adaptive learning platform for programming education built with Next.js, featuring personalized feedback, knowledge tracing, and intelligent recommendations.

## Team Information
- **Team name:** Group 7
- **Team members:** Hamza Irshad, Mobeen Qasim (QasMob), Gianna Casselli, Richard Milovanov, Mehak Sandhu, Abhay Brar, Akshay Rambarran, Adil Baig (adilbaig1217)

## Repository Conventions
- Update this README as the project evolves so onboarding teammates understand the current state.
- Place lab work in `labs/`.
- Document meetings in `docs/meeting_notes.md`.
- Capture requirements and design artifacts in `design.md`.
- Keep application code in `src/`, tests in `tests/`, and align Python dependencies in `requirements.txt`.

## Project Management Setup
- Primary planning board: Trello — https://trello.com/invite/68d18917fece63114145de3b/ATTI5b6d6e35fb1390fc4f46a6859895ab41F8981B17
- Share access with the course account `cis3750@socs.uoguelph.ca`.

## Project Overview

**ascend.py** follows a two-stage development approach:

### Stage 1: Rules-Based ITS (Foundation)
- JSON-based domain model for skills and questions
- CLI prototype demonstrating core tutoring logic
- Student model tracking (attempts, accuracy, timing)
- Simple if/else rules for feedback and question selection

### Stage 2: ML Upgrade (Advanced)
- Python FastAPI microservice with ML endpoints
- Bayesian Knowledge Tracing (pyBKT-inspired heuristic)
- Personalized feedback (scikit-learn)
- Collaborative filtering recommendations (scikit-learn KNN)

Both stages share the same domain model and can run independently or together.

## Features

### Student Features
- **Interactive Practice Flow**: Solve programming challenges with instant feedback
- **Adaptive Learning**: Questions selected based on your current mastery level
- **Progress Dashboard**: Track mastery across different programming skills
- **Personalized Recommendations**: Get AI-powered suggestions for what to learn next
- **Class Enrollments**: Join instructor-led classes via invite links and switch between personal or class practice sessions.
- **Full Authentication Flow**: Unique username/email signup, bcrypt-secured passwords, and dashboard/practice routes protected by server-side session checks.

### Instructor Features
- **Skills Management**: Create and organize programming skills in a learning sequence
- **Class Management**: Spin up classes with invite links, monitor enrollments, and author scoped questions per class
- **Question Bank**: Build a comprehensive library of practice questions
- **CRUD Operations**: Full control over skills and questions with an intuitive interface

### ML-Powered Features (Stage 2)
- **Knowledge Tracing**: Bayesian estimation of student mastery using pyBKT
- **Feedback Styling**: Personalized feedback using scikit-learn classification
- **Smart Recommendations**: Collaborative filtering using scikit-learn KNN

## Tech Stack

- **Frontend Framework:** Next.js 16 (React 18) with the App Router, fully typed in TypeScript
- **Styling & UI:** Tailwind CSS v4 + shadcn/ui (Radix UI primitives) + JetBrains Mono typography
- **Data Layer:** Prisma ORM backed by PostgreSQL (Neon managed instance)
- **ML Microservice:** Python FastAPI with pyBKT-inspired knowledge tracing heuristics and scikit‑learn (LogisticRegression, NearestNeighbors)
- **Runtime/Tooling:** Node.js 18+, pnpm/npm scripts, Uvicorn for the ML service

## Getting Started

### Prerequisites
- Node.js 18+ installed
- Neon database connected
- Python 3.10+ (for CLI and ML service)
- Docker (optional, for ML service deployment)

### Installation

**1. Set up environment variables**
- `DATABASE_URL` – your Neon (or Postgres) connection string
- `AUTH_SECRET` – long random string used to sign session cookies
- Optional: `ML_API_URL` if you are running the FastAPI service
- Optional: `USE_ML=true` to enable ML-driven question selection

**2. Initialize the database with Prisma**
```bash
npx prisma migrate deploy
npx prisma db seed   # optional, loads demo users/questions
```

**3. Try the CLI demo (Stage 1)**

```bash
python3 cli/main.py
```

This demonstrates the rules-based ITS with:

- JSON-based domain model
- Simple if/else tutoring logic
- Student state tracking in `cli/student_state.json`

**4. Start the web app**
The app will be available at your preview URL

### Testing

- `npm run test` – runs the Vitest unit suite (password hashing + uniqueness guards)
- `npm run test:e2e` – Playwright smoke test (Signup → Dashboard → Logout → Login).  
  Run `npx playwright install` once to download the browsers.

**5. Optional: Run the ML microservice (Stage 2)**

```bash
cd ml-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Domain Model (JSON-Based)

The system uses JSON files as the single source of truth for skills and questions:

**`content/skills.json`**

```json
[
  {
    "id": "skill_variables",
    "name": "Variables",
    "order": 1
  }
]
```

**`content/questions.json`**

```json
[
  {
    "id": "q_var_1",
    "skill_id": "skill_variables",
    "prompt": "Create a variable named 'age' and assign it the value 25",
    "answer": "age = 25",
    "difficulty": 1
  }
]
```

These JSON files feed both:

- The CLI demo (`cli/main.py`)
- The database seed script (`scripts/003-seed-from-json.sql`)
- Future ML training pipelines

## Student Model

We track learner performance with several metrics:

- Total attempts per skill
- Number correct per skill
- Accuracy ratio (correct ÷ total)
- Time spent per skill
- Mastery probability (`pKnown`, 0–1)

**Question selection logic**

1. Compute a combined score: `(mastery × 0.7) + (accuracy × 0.3)`
2. Select the skill with the lowest combined score
3. Serve a random question from that skill’s pool

**Storage**

- CLI demo: `cli/student_state.json`
- Web app: Prisma tables (`Attempt`, `Mastery`)

## Tutoring Logic

### Rules-Based (Stage 1)

- Simple string comparison for answer checking
- Difficulty-based feedback templates
- Lowest-performing skill prioritization

### ML-Enhanced (Stage 2)

- Bayesian Knowledge Tracing for mastery estimation
- Logistic regression for feedback personalization
- Collaborative filtering for recommendations

## Database Schema

- **User**: Student and instructor accounts
- **Skill**: Programming skills (Variables, Loops, Functions, etc.)
- **Question**: Practice questions with prompts, starter code, and answers
- **Attempt**: Student attempt records with correctness and timing
- **Mastery**: Skill mastery levels (pKnown: 0-1)
- **Recommendation**: Personalized learning recommendations

## ML Architecture (Stage 2)

A dedicated **Python FastAPI microservice** powers the adaptive features:

### Knowledge Tracing (`/kt`)

- **Library:** pyBKT-inspired heuristics
- **Purpose:** Estimate `pKnown` for each skill from attempt history
- **Approach:** Bayesian updates with tuned slip/guess/learn parameters

### Feedback Personalisation (`/feedback-style`)

- **Library:** scikit-learn (`LogisticRegression`)
- **Purpose:** Choose between hint or worked example after each attempt
- **Signals:** Recent correctness streak, average response time, consecutive errors

### Skill Recommendations (`/recommend`)

- **Library:** scikit-learn (`NearestNeighbors`)
- **Purpose:** Recommend the next skill using cosine-similarity KNN over synthetic mastery vectors
- **Output:** Skill identifier with a learner-centric rationale

### Deployment Options

**Option 1: Local Development**

```bash
cd ml-service
uvicorn main:app --reload --port 8000
# Set ML_API_URL=http://localhost:8000
```

## Testing the System

### Stage 1: Rules-Based ITS

**CLI Demo:**

```bash
python3 cli/main.py
```

- Answer 5 questions
- See rules-based feedback
- Check `cli/student_state.json` for tracking

**Web Demo (Rules-based):**

```bash
npm run dev
# Visit /student/practice
```

### Stage 2: ML Upgrade

**Local ML Testing:**

```bash
# Terminal 1: Start ML service
cd ml-service
uvicorn main:app --reload --port 8000

# Terminal 2: Start Next.js with ML enabled
export ML_API_URL=http://localhost:8000
export USE_ML=true
npm run dev
```

**Verify ML Integration:**

1. Open browser DevTools → Network tab
2. Go to `/student/practice` and answer questions
3. Look for requests to ML endpoints (`/api/ml/kt`, `/api/ml/feedback-style`)
4. Check console logs for debug messages

## Integration Demo

Run the complete system with:

```bash
bash scripts/integrate_demo.sh
```

This script:

1. Checks database seeding
2. Installs dependencies
3. Verifies environment variables
4. Provides commands to start all services

## Demo Accounts

- **Student**: `student@example.com` (ID: `user_student_1`)
- **Instructor**: `instructor@example.com` (ID: `user_instructor_1`)

## Customization

### Adding New Skills

1. Edit `content/skills.json`
2. Re-run seed script or use Instructor Console

### Adding Questions

1. Edit `content/questions.json`
2. Re-run seed script or use Instructor Console

### Toggling ML Features

Set environment variable:

- `USE_ML=true` → calls ML API
- `USE_ML=false` → uses rules-based logic

## Demo Guide

Use this checklist to run the three flagship demos that prove ascend.py’s adaptive intelligence.

### 0\. Demo Prep

```bash
# Terminal 1 — reset & seed the database
cd /home/akshay/ascend
export DATABASE_URL="postgresql://neondb_owner:npg_2MBoWPOhTL0Q@ep-orange-feather-aet7m8tw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
# Optional full reset
psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
# Apply current schema and seed demo data
npx prisma migrate deploy
psql "$DATABASE_URL" -f scripts/003-seed-from-json.sql

# Terminal 2 — start the ML microservice
cd /home/akshay/ascend/ml-service
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip wheel
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 3 — start the Next.js frontend
cd /home/akshay/ascend
export USE_ML=true
export ML_API_URL=http://localhost:8000
npm install
npm run dev

```

Optional between-demo reset (wipes just the learner’s progress):

```bash
psql "$DATABASE_URL" <<'SQL'
DELETE FROM "Attempt"        WHERE "userId" = 'user_student_1';
DELETE FROM "Mastery"        WHERE "userId" = 'user_student_1';
DELETE FROM "Recommendation" WHERE "userId" = 'user_student_1';
SQL
```

-----

### Case 1 – Adaptive Hints & Reinforcement on Conditionals

**Purpose:** Show the tutor keeping the learner on the weakest skill, escalating support, and requiring a clean solve before advancing.

- **Walkthrough**
    1. Open `/student/practice`. Conditionals is seeded as the lowest-mastery skill.
    2. Submit the first answer incorrectly. `/api/attempts` calls `/ml/feedback-style`, which returns a concise hint.
    3. Miss again. The classifier escalates to a worked example and `/ml/kt` keeps the learner on Conditionals (`selectionReason = repeat_until_mastered`).
    4. Solve it; the tutor asks for one more Conditionals question to confirm understanding.
    5. Solve the follow-up correctly. Mastery rises, streak resets, and the selector finally moves on.
- **Models & Components**
    | Layer | Implementation |
    |---|---|
    | Student Model | `ml-service/main.py::knowledge_tracing` (pyBKT-style updates) + Prisma `Mastery` |
    | Feedback ML | `ml-service/main.py::feedback_personalization` (scikit-learn LogisticRegression) |
    | Pedagogical Logic| `app/api/questions/next/route.ts` (streak-aware, ML-assisted selection) |
- **Tech Highlights**
      - ML-driven hints and worked examples surface automatically based on attempt history.
      - Knowledge tracing keeps the learner on the shaky skill even after a single correct attempt.
      - Reinforcement step demonstrates targeted repetition before switching topics.

-----

### Case 2 – Personalized Recommendation Loop

**Purpose:** Demonstrate the dashboard recommending the next skill and the system retargeting after a successful session.

- **Walkthrough**
    1. After Case 1, visit `/student/dashboard`. Loops is now the weakest skill, sourced from `/ml/recommend`.
    2. Click “Practice skill” on Loops. Solve the prompt correctly.
    3. Return to the dashboard; Loops mastery climbed, and Conditionals slides back to the lowest slot, generating a new recommendation.
- **Models & Components**
    | Layer | Implementation |
    |---|---|
    | Recommendation ML | `ml-service/main.py::recommend_skill` (scikit-learn `NearestNeighbors`) |
    | Student Model | Prisma `Mastery` + `app/api/mastery/route.ts` |
    | Frontend | `components/dashboard-view.tsx` (progress cards, CTA) |
- **Tech Highlights**
      - Cosine-similarity KNN recommends the next skill based on mastery vectors.
      - Recommendations persist in Prisma so the practice view and dashboard stay aligned.
      - Dashboard copy explains *why* a recommendation appears for easy narration.

-----

### Case 3 – Targeted Practice & Dynamic Difficulty on Functions

**Purpose:** Show a learner focusing a strong skill (Functions) and the tutor adapting the question difficulty (hard → medium → hard) based on streaks.

- **Walkthrough**
    1. From the dashboard, pick “Practice skill” on Functions—even though Lists may be recommended.
    2. Start with a hard Functions question (mastery ~0.8). Miss it and observe mastery dip.
    3. `/api/questions/next` lowers difficulty to a medium variant. Solve it correctly; mastery climbs again.
    4. The next question returns to hard difficulty, proving the tutor scales challenge up and down.
- **Models & Components**
    | Layer | Implementation |
    |---|---|
    | Difficulty Logic | `app/api/questions/next/route.ts` (mastery bands + correct/incorrect streaks) |
    | Student Model | `/api/attempts` + `/ml/kt` for mastery adjustments |
    | UI | `components/practice-interface.tsx` difficulty pill & sidebar summary |
- **Tech Highlights**
      - Difficulty tier blends mastery thresholds with consecutive streaks for natural challenge ramps.
      - Practice UI exposes the difficulty state so the shift is obvious during the demo.
      - Targeted practice entry points work for any skill via `skillId` query param.

-----
