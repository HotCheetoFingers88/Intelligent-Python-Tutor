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

### Instructor Features
- **Skills Management**: Create and organize programming skills in a learning sequence
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
- `NEON_NEON_DATABASE_URL` is automatically configured via Neon integration
- Optional: `ML_API_URL` for external ML service (e.g. `https://your-ml-service.railway.app`)
- `USE_ML=true` to enable ML features (defaults to rules-based)

**2. Initialize the database**
Run the SQL scripts in order:
```bash
# These scripts are in the /scripts folder
001-create-tables.sql
003-seed-from-json.sql
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
psql "$DATABASE_URL" -f scripts/001-create-tables.sql
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

### Case 1 – Adaptive Question Selection

**Purpose:** Show the student model holding the learner on their weakest skill until they achieve a clean solve.

- **Walkthrough**
    1. Open `/student/practice`. The pre-seeded weakest skill is **Loops**.
    2. Submit an incorrect answer twice. `/api/attempts` sends each attempt to `/ml/kt`, which drops Loops mastery.
    3. Observe the next question: the selector ( `app/api/questions/next/route.ts` ) keeps issuing Loops items (`selectionReason = repeat_until_mastered`).
    4. Submit the correct code on the third try. Mastery jumps via `/ml/kt` and the selector advances to the next weakest skill (Functions).
- **Models & Components**
    | Layer | Implementation |
    |---|---|
    | Student Model | `ml-service/main.py::knowledge_tracing` (pyBKT-style updates) + Prisma `Mastery` |
    | Domain Model | Prisma `Skill` & `Question` tables (seeded via `003-seed-from-json.sql`) |
    | Pedagogical Logic| `app/api/questions/next/route.ts` (streak-aware, ML-assisted selection) |
- **Tech Highlights**
      - FastAPI BKT heuristic backed by `pyBKT`-style math with safe fallbacks.
      - Next.js route blends mastery, accuracy, consecutive misses, and ML KNN suggestions.
      - React practice workspace (`components/practice-interface.tsx`) surfaces metadata (mastery %, strategy).

-----

### Case 2 – Feedback Personalization

**Purpose:** Demonstrate escalating support—hint, worked example, then praise—driven by a real ML classifier.

- **Walkthrough**
    1. Stay on the current skill. Submit an incorrect answer.
          - `/api/attempts` calls `/ml/feedback-style`; LogisticRegression returns `hint`.
          - UI shows a concise, skill-specific hint card.
    2. Submit another incorrect answer.
          - Classifier now predicts `worked_example`; the tutor reveals a full solution block and coaching.
    3. Submit the correct answer.
          - Feedback switches to praise; `nextAction` becomes `advance`.
- **Models & Components**
    | Layer | Implementation |
    |---|---|
    | Tutoring Model | `ml-service/main.py::feedback_personalization` (scikit-learn LogisticRegression) |
    | Student Context | Attempt history & timing assembled in `app/api/attempts/route.ts` |
    | UI Rendering | `components/practice-interface.tsx` feedback cards & code editor |
- **Tech Highlights**
      - Synthetic training data encodes last correctness, average response time, consecutive errors.
      - Next.js fallback logic only runs if the service is unreachable; with the ML API up you see the classifier’s messaging.
      - Prism-based code editor locks/unlocks based on tutor guidance to match LeetCode-like UX.

-----

### Case 3 – Mastery Dashboard & Recommendation

**Purpose:** Visualise mastery growth and ML-driven “what’s next” recommendations after a practice session.

- **Walkthrough**
    1. After running Case 1 & 2 interactions, open `/student/dashboard`.
    2. Progress bars reflect live mastery (updated by `/ml/kt`).
    3. Recommendation card shows the weakest skill with rationale from `/ml/recommend`.
    4. Return to practice, clear the recommended skill with a first-try correct submission.
    5. Refresh the dashboard; mastery and the recommendation update immediately.
- **Models & Components**
    | Layer | Implementation |
    |---|---|
    | Student Model | Prisma `Mastery` records + `app/api/mastery/route.ts` |
    | Recommendation ML | `ml-service/main.py::recommend_skill` (scikit-learn `NearestNeighbors`) |
    | Persistence | `app/api/recommendations/route.ts` stores ML output in Prisma `Recommendation` table |
    | Frontend | `components/dashboard-view.tsx` (cards, animated progress, CTA) |
- **Tech Highlights**
      - Pure scikit-learn KNN using a synthetic mastery matrix.
      - API writes recommendations to the database so subsequent loads (dashboard or practice) stay consistent.
      - Dashboard copies selection metadata so you can explain *why* a recommendation appeared.

-----

### Demo Day Checklist

- [ ] Database reseeded (`001-create-tables.sql`, `003-seed-from-json.sql`).
- [ ] `USE_ML=true` and `ML_API_URL` exported in both ML and Next.js shells.
- [ ] FastAPI running at `http://localhost:8000`.
- [ ] `npm run dev` serving `/student/practice` and `/student/dashboard`.
- [ ] (Optional) Clear learner history between cases with the SQL snippet.
