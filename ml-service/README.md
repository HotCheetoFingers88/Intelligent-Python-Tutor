# ML Microservice Demo Guide

This FastAPI app powers the intelligent behaviour in **ascend.py**. Use this guide to get the service running, understand what each endpoint does, and script the three demo cases that show the tutor adapting in real time.

---

## 1. Quickstart Commands

Run everything from the repository root (`/home/akshay/ascend`) unless otherwise noted.

### 1.1 Reset the database (fresh demo data)

```bash
export DATABASE_URL="postgresql://neondb_owner:npg_2MBoWPOhTL0Q@ep-orange-feather-aet7m8tw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
psql "$DATABASE_URL" -f scripts/001-create-tables.sql
psql "$DATABASE_URL" -f scripts/003-seed-from-json.sql
```

Optional reset between demos (wipes only the demo learner):

```bash
psql "$DATABASE_URL" <<'SQL'
DELETE FROM "Attempt"        WHERE "userId" = 'user_student_1';
DELETE FROM "Mastery"        WHERE "userId" = 'user_student_1';
DELETE FROM "Recommendation" WHERE "userId" = 'user_student_1';
SQL
```

### 1.2 Start the ML microservice

```bash
cd ml-service
python3 -m venv venv            # create venv (skip if you already have one)
source venv/bin/activate
pip install --upgrade pip wheel
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 1.3 Start the Next.js app (new terminal)

```bash
cd /home/akshay/ascend
export USE_ML=true
export ML_API_URL=http://localhost:8000
npm install
npm run dev
```

---

## 2. Endpoint Summary

| Endpoint              | Purpose                              | Tech stack                                  |
|-----------------------|---------------------------------------|---------------------------------------------|
| `POST /kt`            | Bayesian-style knowledge tracing      | pyBKT-inspired heuristic (safe fallback)    |
| `POST /feedback-style`| Personalised feedback classification  | scikit-learn LogisticRegression             |
| `POST /recommend`     | Next-skill recommendation              | scikit-learn NearestNeighbors (cosine KNN)  |
| `GET /health`         | Health check                          | FastAPI                                     |

Each endpoint accepts JSON payloads from the Next.js API layer and returns structured responses that drive the practice screen and dashboard. All heavy lifting happens in `ml-service/main.py`.

---

## 3. Demo Playbook

Follow these scripts after both servers are running.

### Case 1 – Adaptive Hints & Reinforcement (Conditionals)

**Goal:** Prove that the tutor escalates support (hint → worked example) and keeps the learner on a weak skill until mastery recovers.

1. Navigate to `http://localhost:3000/student/practice`. Conditionals is seeded as the lowest mastery skill.
2. Miss the first attempt. `/api/attempts` calls `/ml/feedback-style`, which returns a targeted hint.
3. Miss again. The classifier escalates to a worked example while `/api/ml/kt` keeps `selectionReason=repeat_until_mastered`.
4. Solve the problem; the tutor asks for one more Conditionals question to reinforce the concept.
5. Solve the follow-up correctly—only then does the selector move on to Loops.

**Behind the scenes**
- `ml-service/main.py::knowledge_tracing` updates `p_known` after every submission.
- `ml-service/main.py::feedback_personalization` (LogisticRegression) picks hint vs. worked example.
- `app/api/questions/next/route.ts` refuses to change skills until mastery rises above the threshold.

### Case 2 – Personalized Recommendation Loop (Dashboard → Loops)

**Goal:** Demonstrate the ML recommendation circuit and show the dashboard reacting after a successful practice session.

1. After Case 1, open `http://localhost:3000/student/dashboard`. Loops is now the weakest skill and appears on the recommendation card (result of `/ml/recommend`).
2. Click “Practice skill” for Loops. Solve the prompt correctly.
3. Return to the dashboard: Loops mastery jumps and Conditionals becomes the lowest again, generating a fresh recommendation.

**Behind the scenes**
- `ml-service/main.py::recommend_skill` (NearestNeighbors) compares mastery vectors against a synthetic cohort.
- `app/api/recommendations/route.ts` stores the recommendation so practice and dashboard stay in sync.
- `components/dashboard-view.tsx` surfaces the CTA and rationale text for narration.

### Case 3 – Targeted Practice & Dynamic Difficulty (Functions)

**Goal:** Show the learner intentionally drilling a strong skill and the tutor adjusting question difficulty (hard ⇄ medium) as mastery shifts.

1. From the dashboard, choose “Practice skill” for **Functions** (even if Lists is recommended).
2. Start with a hard Functions prompt (mastery ≈ 0.8). Miss it; `/api/ml/kt` drops mastery.
3. The next call to `/api/questions/next` picks a medium variant. Solve it correctly—mastery rebounds.
4. The following question returns to hard difficulty, proving the system adapts challenge level as streaks change.

**Behind the scenes**
- Difficulty tier combines mastery bands with consecutive correct/incorrect streaks (`app/api/questions/next/route.ts`).
- `/api/attempts` + `/api/ml/kt` handle mastery updates that drive those tier changes.
- `components/practice-interface.tsx` displays the difficulty pill so the escalation/retreat is obvious on screen.

---

## 4. Testing Individual Endpoints

With the service running on `http://localhost:8000`:

```bash
# Health check
curl http://localhost:8000/health

# Knowledge tracing sample
curl -X POST http://localhost:8000/kt \
  -H "Content-Type: application/json" \
  -d '{"user_id":"demo","attempts":[{"skill_id":"skill_loops","correct":false,"elapsed_ms":45000,"ts":"2025-01-15T10:30:00Z"}]}'

# Feedback styling sample
curl -X POST http://localhost:8000/feedback-style \
  -H "Content-Type: application/json" \
  -d '{"user_id":"demo","correct":false,"recent_performance":[true,false,false],"avg_time_ms":80000,"consecutive_errors":2}'

# Recommendation sample
curl -X POST http://localhost:8000/recommend \
  -H "Content-Type: application/json" \
  -d '{"user_id":"demo","mastery_data":[{"skill_id":"skill_loops","p_known":0.3},{"skill_id":"skill_functions","p_known":0.6}]}'
```

Each call should return JSON with mastery updates, feedback messaging, or the next skill suggestion - exactly what the Next.js app consumes.

---
