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

### Case 1 – Adaptive Question Selection

**Goal:** Show that the tutor keeps the learner on their weakest skill until they deliver a clean solve.

1. Navigate to `http://localhost:3000/student/practice`. The seeded weakest skill is **Loops**.
2. Submit an incorrect answer twice. The Next.js API calls `/api/ml/kt`, which lowers Loops mastery and sets `selectionReason=repeat_until_mastered`.
3. Observe that the next question is still a Loops question; you’re locked until mastery improves.
4. Submit the correct solution on the third try. Mastery jumps (via `/kt`), streak resets, and the selector advances to the next lowest mastery skill (Functions).

**Behind the scenes**
- `ml-service/main.py::knowledge_tracing` updates `p_known`.
- `app/api/questions/next/route.ts` prioritises streaked skills and only consults the KNN recommendation when no skill is in recovery mode.
- `components/practice-interface.tsx` displays the current skill, mastery %, and selection rationale.

### Case 2 – Feedback Personalisation

**Goal:** Demonstrate a tutor that escalates support based on recent attempts.

1. Stay on the current skill (Variables works well). Submit a wrong answer.
   - `/api/attempts` captures timing and streak data, then calls `/ml/feedback-style`.
   - LogisticRegression predicts `hint`; the practice UI shows a concise, contextual tip.
2. Submit another wrong answer.
   - Classifier predicts `worked_example`; the UI shows a full code solution with coaching.
3. Submit the correct answer.
   - Feedback switches to praise, `nextAction` becomes `advance`, and the selector is free to move on.

**Behind the scenes**
- `ml-service/main.py::feedback_personalization` returns `style: "hint"` or `"worked_example"` plus a message.
- `app/api/attempts/route.ts` stitches in the ML response and decides whether the learner should retry or move on.
- `components/practice-interface.tsx` renders the feedback cards, hint, and worked example.

### Case 3 – Mastery Dashboard & Recommendations

**Goal:** Visualise mastery changes and ML-guided next steps after practice.

1. Visit `http://localhost:3000/student/dashboard` after running Case 1 & 2.
2. Mastery bars reflect values stored in Prisma `Mastery` (populated by `/kt`).
3. A recommendation card appears (e.g., “Review Loops next”) sourced from `/ml/recommend`.
4. Return to practice, clear the recommended skill with a first-try correct submission.
5. Refresh the dashboard—mastery updates and the recommendation switches to the next weakest skill.

**Behind the scenes**
- `ml-service/main.py::recommend_skill` fits a scikit-learn `NearestNeighbors` model to synthetic mastery data, finds similar learners, and suggests the lowest mastery skill.
- `app/api/recommendations/route.ts` writes the recommendation to Prisma so the dashboard and practice view stay in sync.
- `components/dashboard-view.tsx` renders the progress cards and CTA.

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

## 5. Production Notes

- Deploy the service to Render, Railway, or another Python-friendly host.
- Set `ML_API_URL` in the Vercel project to point at the deployed FastAPI app.
- Keep the endpoint contract stable; the Next.js layer expects the JSON structures above.
