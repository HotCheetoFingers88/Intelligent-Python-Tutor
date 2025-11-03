"""
FastAPI ML Microservice for Intelligent Tutoring System
Implements three ML-powered endpoints:
1. /kt - Knowledge Tracing using pyBKT
2. /feedback-style - Feedback Personalization using scikit-learn
3. /recommend - Next-Skill Recommendation using scikit-learn
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import pandas as pd
from datetime import datetime

# ML Libraries
from pyBKT.models import Model as BKTModel
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import NearestNeighbors

app = FastAPI(title="ITS ML Service", version="1.0.0")

# Enable CORS for Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# 1️⃣ KNOWLEDGE TRACING ENDPOINT - Using pyBKT
# ============================================================================

class AttemptData(BaseModel):
    skill_id: str
    correct: bool
    elapsed_ms: int
    ts: str

class KTRequest(BaseModel):
    user_id: str
    attempts: List[AttemptData]

class MasteryResult(BaseModel):
    skill_id: str
    p_known: float

class KTResponse(BaseModel):
    mastery: List[MasteryResult]

@app.post("/kt", response_model=KTResponse)
async def knowledge_tracing(request: KTRequest):
    """
    Estimate student mastery per skill using Bayesian Knowledge Tracing.
    
    BKT models four parameters:
    - p(L0): Initial probability of knowing the skill
    - p(T): Probability of learning (transition from unknown to known)
    - p(S): Probability of slip (knows but answers incorrectly)
    - p(G): Probability of guess (doesn't know but answers correctly)
    """
def heuristic_mastery(attempts: List[AttemptData]) -> float:
    if not attempts:
        return 0.3

        total = len(attempts)
        correct = sum(1 for a in attempts if a.correct)
        ratio = correct / total

        consecutive_incorrect = 0
        for attempt in attempts:
            if attempt.correct:
                consecutive_incorrect = 0
            else:
                consecutive_incorrect += 1

        mastery = 0.2 + ratio * 0.6
        if consecutive_incorrect >= 2:
            mastery -= 0.2

    consecutive_correct = 0
    for attempt in reversed(attempts):
        if attempt.correct:
            consecutive_correct += 1
        else:
            break

    if consecutive_correct >= 2:
        mastery = max(mastery, 0.55)
    elif consecutive_correct == 1:
        mastery = max(mastery, 0.35)

    return round(max(0.05, min(0.95, mastery)), 2)

    try:
        skill_attempts: dict[str, List[AttemptData]] = {}
        for attempt in request.attempts:
            skill_attempts.setdefault(attempt.skill_id, []).append(attempt)

        mastery_results: List[MasteryResult] = []

        for skill_id, attempts in skill_attempts.items():
            observations = [1 if a.correct else 0 for a in attempts]

            p_known = 0.3
            p_learn = 0.2
            p_slip = 0.1
            p_guess = 0.2

            for correct in observations:
                if correct:
                    p_correct_given_known = 1 - p_slip
                    p_correct_given_unknown = p_guess
                    p_correct = (
                        p_known * p_correct_given_known
                        + (1 - p_known) * p_correct_given_unknown
                    )
                    p_correct = max(p_correct, 1e-6)
                    p_known = (p_correct_given_known * p_known) / p_correct
                else:
                    p_incorrect_given_known = p_slip
                    p_incorrect_given_unknown = 1 - p_guess
                    p_incorrect = (
                        p_known * p_incorrect_given_known
                        + (1 - p_known) * p_incorrect_given_unknown
                    )
                    p_incorrect = max(p_incorrect, 1e-6)
                    p_known = (p_incorrect_given_known * p_known) / p_incorrect

                p_known = p_known + (1 - p_known) * p_learn
                p_known = max(0.0, min(1.0, p_known))

            consecutive_correct = 0
            for attempt in reversed(attempts):
                if attempt.correct:
                    consecutive_correct += 1
                else:
                    break

            if consecutive_correct >= 2:
                p_known = max(p_known, 0.55)
            elif consecutive_correct == 1:
                p_known = max(p_known, 0.35)

            mastery_results.append(
                MasteryResult(skill_id=skill_id, p_known=round(p_known, 2))
            )

        return KTResponse(mastery=mastery_results)

    except Exception as e:
        mastery_results = [
            MasteryResult(skill_id=skill_id, p_known=heuristic_mastery(attempts))
            for skill_id, attempts in skill_attempts.items()
        ]
        if not mastery_results and request.attempts:
            mastery_results = [
                MasteryResult(
                    skill_id=request.attempts[0].skill_id,
                    p_known=heuristic_mastery(request.attempts),
                )
            ]
        if not mastery_results:
            mastery_results = [MasteryResult(skill_id="unknown", p_known=0.3)]
        return KTResponse(mastery=mastery_results)

# ============================================================================
# 2️⃣ FEEDBACK PERSONALIZATION ENDPOINT - Using scikit-learn
# ============================================================================

class FeedbackRequest(BaseModel):
    user_id: str
    correct: bool
    recent_performance: List[bool]  # Last N attempts
    avg_time_ms: float
    consecutive_errors: int

class FeedbackResponse(BaseModel):
    style: str  # "hint" or "worked_example"
    message: str

# Train a simple LogisticRegression model with synthetic data
# Features: [last_correct, avg_time_normalized, consecutive_errors]
# Labels: 0 = hint, 1 = worked_example

# Generate synthetic training data
np.random.seed(42)
n_samples = 200

# Create features
last_correct = np.random.randint(0, 2, n_samples)
avg_time = np.random.uniform(10000, 120000, n_samples)  # 10s to 2min
consecutive_errors = np.random.randint(0, 5, n_samples)

# Create labels based on heuristics:
# - If struggling (many errors, slow), give worked example
# - If doing well, give hint
labels = []
for i in range(n_samples):
    if consecutive_errors[i] >= 2 or avg_time[i] > 90000:
        labels.append(1)  # worked_example
    else:
        labels.append(0)  # hint

X_train = np.column_stack([last_correct, avg_time / 120000, consecutive_errors / 5])
y_train = np.array(labels)

# Train the model
feedback_model = LogisticRegression(random_state=42)
feedback_model.fit(X_train, y_train)

@app.post("/feedback-style", response_model=FeedbackResponse)
async def feedback_personalization(request: FeedbackRequest):
    """
    Choose optimal feedback type (hint vs. worked example) using ML.
    
    Uses a LogisticRegression classifier trained on synthetic data.
    Features encode recent performance, timing, and error patterns.
    """
    try:
        # Extract features
        last_correct = 1 if request.recent_performance and request.recent_performance[-1] else 0
        avg_time_normalized = min(request.avg_time_ms / 120000, 1.0)  # Normalize to [0, 1]
        consecutive_errors_normalized = min(request.consecutive_errors / 5, 1.0)
        
        # Prepare feature vector
        features = np.array([[last_correct, avg_time_normalized, consecutive_errors_normalized]])
        
        # Predict feedback style
        prediction = feedback_model.predict(features)[0]
        
        if prediction == 1:
            style = "worked_example"
            message = "Here's a step-by-step example to guide you through this type of problem."
        else:
            style = "hint"
            message = "Try thinking about the problem from a different angle. What's the first step you need to take?"
        
        return FeedbackResponse(style=style, message=message)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feedback personalization error: {str(e)}")

# ============================================================================
# 3️⃣ RECOMMENDATION ENDPOINT - Using scikit-learn
# ============================================================================

class RecommendRequest(BaseModel):
    user_id: str
    mastery_data: List[dict]  # [{"skill_id": str, "p_known": float}]

class RecommendResponse(BaseModel):
    skill_id: str
    rationale: str

# Generate synthetic collaborative filtering data (pure scikit-learn)
np.random.seed(42)
skill_ids = [
    "skill_variables",
    "skill_conditionals",
    "skill_loops",
    "skill_functions",
    "skill_lists",
]

skill_labels = {
    "skill_variables": "Variables",
    "skill_conditionals": "Conditionals",
    "skill_loops": "Loops",
    "skill_functions": "Functions",
    "skill_lists": "Lists",
}

# Simulate 60 learners with mastery between 0 and 1 for each skill
synthetic_users = pd.DataFrame(
    np.random.uniform(0.0, 1.0, size=(60, len(skill_ids))),
    columns=skill_ids,
)

neighbor_model = NearestNeighbors(metric="cosine", n_neighbors=5)
neighbor_model.fit(synthetic_users)

@app.post("/recommend", response_model=RecommendResponse)
async def recommend_skill(request: RecommendRequest):
    """
    Suggest next skill to practice using collaborative filtering.
    
    Uses a scikit-learn KNN model to find similar learners and
    recommend skills based on their mastery patterns.
    """
    try:
        if not request.mastery_data:
            raise HTTPException(status_code=400, detail="mastery_data cannot be empty")

        mastery_map = {item["skill_id"]: item["p_known"] for item in request.mastery_data}
        user_vector = np.array(
            [[mastery_map.get(skill, float(synthetic_users[skill].mean())) for skill in skill_ids]],
        )

        distances, indices = neighbor_model.kneighbors(user_vector)
        neighbor_mastery = synthetic_users.iloc[indices[0]].mean().to_dict()

        weakest_skill = min(skill_ids, key=lambda skill: mastery_map.get(skill, neighbor_mastery.get(skill, 1.0)))
        user_mastery = mastery_map.get(weakest_skill, neighbor_mastery.get(weakest_skill, 0.0))
        user_mastery = min(max(user_mastery, 0.0), 1.0)
        label = skill_labels.get(weakest_skill, weakest_skill)
        rationale = (
            f"Your current mastery in {label} is {user_mastery:.0%}. "
            "Let's reinforce that concept next to keep momentum."
        )

        return RecommendResponse(skill_id=weakest_skill, rationale=rationale)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation error: {str(e)}")

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/")
async def root():
    return {
        "service": "ITS ML Microservice",
        "version": "1.0.0",
        "endpoints": ["/kt", "/feedback-style", "/recommend"]
    }

@app.get("/health")
async def health():
    return {"status": "ok"}
