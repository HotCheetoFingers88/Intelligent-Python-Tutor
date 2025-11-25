"""
FastAPI ML Microservice for Intelligent Tutoring System
Implements three ML-powered endpoints:
1. /kt - Knowledge Tracing using a trained Bayesian Knowledge Tracing model
2. /feedback-style - Feedback Personalization using scikit-learn
3. /recommend - Next-Skill Recommendation using scikit-learn
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Literal, Any
from dataclasses import dataclass
import ast
import json
import random
import re
import shutil
import subprocess
import tempfile
import textwrap
from pathlib import Path
import numpy as np
import pandas as pd
from datetime import datetime

# ML Libraries
from sklearn.linear_model import LogisticRegression
from collections import Counter
from sklearn.cluster import MiniBatchKMeans
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
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

# KNOWLEDGE TRACING UTILITIES (Custom BKT Implementation)

@dataclass
class BKTParameters:
    p_init: float
    p_learn: float
    p_slip: float
    p_guess: float


SKILL_IDS = [
    "skill_variables",
    "skill_conditionals",
    "skill_loops",
    "skill_functions",
    "skill_lists",
]

SYNTHETIC_SKILL_PRIORS = {
    "skill_variables": BKTParameters(0.7, 0.08, 0.03, 0.15),
    "skill_conditionals": BKTParameters(0.35, 0.18, 0.12, 0.22),
    "skill_loops": BKTParameters(0.45, 0.16, 0.09, 0.18),
    "skill_functions": BKTParameters(0.5, 0.12, 0.08, 0.16),
    "skill_lists": BKTParameters(0.55, 0.1, 0.07, 0.17),
}


def clamp_probability(value: float, min_value: float = 0.01, max_value: float = 0.99) -> float:
    return max(min_value, min(max_value, value))


def _emission_vector(correct: bool, slip: float, guess: float) -> np.ndarray:
    if correct:
        return np.array([guess, 1.0 - slip], dtype=float)
    return np.array([1.0 - guess, slip], dtype=float)


def _transition_matrix(p_learn: float) -> np.ndarray:
    p_learn = clamp_probability(p_learn, 0.001, 0.8)
    return np.array(
        [
            [1.0 - p_learn, p_learn],
            [0.0, 1.0],
        ],
        dtype=float,
    )


def _forward_backward(sequence: List[bool], params: BKTParameters):
    n = len(sequence)
    if n == 0:
        raise ValueError("Empty sequence supplied to forward_backward")

    transition = _transition_matrix(params.p_learn)
    alpha = np.zeros((n, 2), dtype=float)
    beta = np.zeros((n, 2), dtype=float)
    scales = np.zeros(n, dtype=float)

    prior = np.array([1.0 - params.p_init, params.p_init], dtype=float)
    alpha[0] = prior * _emission_vector(sequence[0], params.p_slip, params.p_guess)
    scales[0] = max(alpha[0].sum(), 1e-12)
    alpha[0] /= scales[0]

    for t in range(1, n):
        obs = _emission_vector(sequence[t], params.p_slip, params.p_guess)
        alpha[t] = (alpha[t - 1] @ transition) * obs
        scales[t] = max(alpha[t].sum(), 1e-12)
        alpha[t] /= scales[t]

    beta[-1] = np.ones(2, dtype=float)
    for t in range(n - 2, -1, -1):
        obs = _emission_vector(sequence[t + 1], params.p_slip, params.p_guess)
        beta[t] = transition @ (obs * beta[t + 1])
        beta[t] /= max(scales[t + 1], 1e-12)

    gamma = alpha * beta
    gamma /= np.clip(gamma.sum(axis=1, keepdims=True), 1e-12, None)

    xi = np.zeros((max(n - 1, 1), 2, 2), dtype=float)
    for t in range(n - 1):
        obs = _emission_vector(sequence[t + 1], params.p_slip, params.p_guess)
        numerator = np.outer(alpha[t], obs * beta[t + 1]) * transition
        denominator = max(numerator.sum(), 1e-12)
        xi[t] = numerator / denominator

    log_likelihood = float(np.sum(np.log(scales)))
    return gamma, xi[: max(n - 1, 0)], log_likelihood


def _fit_bkt_parameters(sequences: List[List[bool]], max_iters: int = 60, tol: float = 1e-4) -> BKTParameters:
    params = BKTParameters(0.4, 0.15, 0.12, 0.2)
    prev_loglik = float("-inf")
    if not sequences:
        return params

    for _ in range(max_iters):
        init_known = 0.0
        init_count = 0
        learn_num = 0.0
        learn_den = 0.0
        slip_num = 0.0
        slip_den = 0.0
        guess_num = 0.0
        guess_den = 0.0
        total_loglik = 0.0

        for sequence in sequences:
            if len(sequence) == 0:
                continue
            gamma, xi, loglik = _forward_backward(sequence, params)
            total_loglik += loglik
            init_known += gamma[0, 1]
            init_count += 1
            learn_num += xi[:, 0, 1].sum()
            learn_den += gamma[:-1, 0].sum()
            slip_num += np.sum(gamma[:, 1] * (1.0 - np.array(sequence, dtype=float)))
            slip_den += gamma[:, 1].sum()
            guess_num += np.sum(gamma[:, 0] * np.array(sequence, dtype=float))
            guess_den += gamma[:, 0].sum()

        if init_count == 0:
            break

        p_init = clamp_probability(init_known / init_count)
        p_learn = clamp_probability(learn_num / max(learn_den, 1e-6), 0.001, 0.8)
        p_slip = clamp_probability(slip_num / max(slip_den, 1e-6), 0.001, 0.4)
        p_guess = clamp_probability(guess_num / max(guess_den, 1e-6), 0.001, 0.45)

        new_params = BKTParameters(p_init, p_learn, p_slip, p_guess)
        delta = max(
            abs(new_params.p_init - params.p_init),
            abs(new_params.p_learn - params.p_learn),
            abs(new_params.p_slip - params.p_slip),
            abs(new_params.p_guess - params.p_guess),
        )

        params = new_params
        if delta < tol and abs(total_loglik - prev_loglik) < tol:
            break
        prev_loglik = total_loglik

    return params


def _simulate_skill_sequences(
    params: BKTParameters,
    learners: int,
    min_attempts: int,
    max_attempts: int,
    rng: random.Random,
) -> List[List[bool]]:
    sequences: List[List[bool]] = []
    for _ in range(learners):
        attempts = rng.randint(min_attempts, max_attempts)
        known = rng.random() < params.p_init
        seq: List[bool] = []
        for _ in range(attempts):
            if known:
                correct = rng.random() > params.p_slip
            else:
                correct = rng.random() < params.p_guess
            seq.append(bool(correct))
            if not known and rng.random() < params.p_learn:
                known = True
        sequences.append(seq)
    return sequences


def _generate_synthetic_training_data(
    skill_priors: dict[str, BKTParameters],
    learners_per_skill: int = 180,
) -> dict[str, List[List[bool]]]:
    rng = random.Random(2024)
    training_data: dict[str, List[List[bool]]] = {}
    for skill_id, params in skill_priors.items():
        training_data[skill_id] = _simulate_skill_sequences(params, learners_per_skill, 5, 18, rng)
    return training_data


def train_bkt_models() -> dict[str, BKTParameters]:
    training_sequences = _generate_synthetic_training_data(SYNTHETIC_SKILL_PRIORS)
    trained: dict[str, BKTParameters] = {}
    for skill_id, sequences in training_sequences.items():
        trained[skill_id] = _fit_bkt_parameters(sequences)
    return trained


TRAINED_BKT_MODELS = train_bkt_models()


def run_trained_bkt(skill_id: str, attempts: List["AttemptData"]) -> Optional[float]:
    params = TRAINED_BKT_MODELS.get(skill_id)
    if not params:
        return None

    observations = [1 if attempt.correct else 0 for attempt in attempts]
    if not observations:
        return round(params.p_init, 2)

    mastery = params.p_init
    for correct in observations:
        if correct:
            numerator = mastery * (1.0 - params.p_slip)
            denominator = numerator + (1.0 - mastery) * params.p_guess
        else:
            numerator = mastery * params.p_slip
            denominator = numerator + (1.0 - mastery) * (1.0 - params.p_guess)
        denominator = max(denominator, 1e-6)
        mastery = numerator / denominator
        mastery = mastery + (1.0 - mastery) * params.p_learn

    return round(clamp_probability(mastery, 0.01, 0.98), 2)

# KNOWLEDGE TRACING ENDPOINT

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


def heuristic_mastery(attempts: List[AttemptData]) -> float:
    if not attempts:
        return 0.35

    total = len(attempts)
    correct = sum(1 for a in attempts if a.correct)
    ratio = correct / max(total, 1)

    mastery = 0.25 + ratio * 0.6
    consecutive_incorrect = 0
    for attempt in attempts:
        if attempt.correct:
            consecutive_incorrect = 0
        else:
            consecutive_incorrect += 1

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
        mastery = max(mastery, 0.4)

    return round(clamp_probability(mastery, 0.05, 0.95), 2)


@app.post("/kt", response_model=KTResponse)
async def knowledge_tracing(request: KTRequest):
    """
    Estimate student mastery per skill using a trained Bayesian Knowledge Tracing model.
    """
    if not request.attempts:
        return KTResponse(mastery=[MasteryResult(skill_id="unknown", p_known=0.35)])

    skill_attempts: dict[str, List[AttemptData]] = {}
    for attempt in request.attempts:
        skill_attempts.setdefault(attempt.skill_id, []).append(attempt)

    mastery_results: List[MasteryResult] = []
    for skill_id, attempts in skill_attempts.items():
        try:
            p_known = run_trained_bkt(skill_id, attempts)
            if p_known is None:
                p_known = heuristic_mastery(attempts)
        except Exception:
            p_known = heuristic_mastery(attempts)

        mastery_results.append(MasteryResult(skill_id=skill_id, p_known=p_known))

    if not mastery_results:
        mastery_results = [MasteryResult(skill_id="unknown", p_known=0.35)]

    return KTResponse(mastery=mastery_results)

# FEEDBACK STATE & HINT LEVEL CLASSIFIER

HINT_STATES = ["steady_progress", "needs_scaffold", "needs_review"]
STATE_TO_HINT_LEVEL = {
    "steady_progress": "simple",
    "needs_scaffold": "scaffold",
    "needs_review": "worked_example",
}

STATE_RESPONSES = {
    "steady_progress": {
        "message": "Great momentum! Keep applying the strategy you just used.",
        "encouragement": "If you feel confident, take on the next challenge without extra hints.",
        "tone": "celebratory",
    },
    "needs_scaffold": {
        "message": "You're close—let's break the problem into smaller checkpoints.",
        "encouragement": "Focus on the first missing step, then rebuild the rest carefully.",
        "tone": "instructive",
    },
    "needs_review": {
        "message": "Let's walk through a guided example to reset this concept.",
        "encouragement": "Study each step of the worked example, then try to recreate it on your own.",
        "tone": "supportive",
    },
}


class FeedbackRequest(BaseModel):
    user_id: str
    correct: bool
    recent_performance: List[bool]
    avg_time_ms: Optional[float] = None
    consecutive_errors: Optional[int] = None
    mastery_level: Optional[float] = None
    mastery_delta: Optional[float] = None
    attempt_count: Optional[int] = None
    difficulty: Optional[int] = None


class FeedbackResponse(BaseModel):
    state: str
    hint_level: Literal["simple", "scaffold", "worked_example"]
    message: str
    encouragement: Optional[str] = None
    tone: Optional[str] = None
    confidence: Optional[float] = None


def _generate_feedback_training_data(n_samples: int = 900):
    rng = np.random.default_rng(2024)
    features = []
    labels = []
    for _ in range(n_samples):
        last_correct = rng.integers(0, 2)
        avg_time = rng.uniform(25000, 135000)
        consecutive_errors = rng.integers(0, 5)
        mastery_level = np.clip(rng.normal(0.6, 0.2), 0.05, 0.98)
        mastery_delta = rng.uniform(-0.2, 0.2)
        attempt_count = rng.integers(1, 16)
        difficulty = rng.integers(1, 4)
        recent_accuracy = np.clip(mastery_level + rng.normal(0, 0.18), 0.0, 1.0)

        if consecutive_errors >= 3 or mastery_delta < -0.08:
            label = "needs_review"
        elif (
            consecutive_errors >= 1
            or avg_time > 90000
            or mastery_level < 0.45
            or (difficulty == 3 and last_correct == 0)
        ):
            label = "needs_scaffold"
        else:
            label = "steady_progress"

        features.append(
            [
                last_correct,
                avg_time / 135000,
                consecutive_errors / 4,
                mastery_level,
                (mastery_delta + 0.2) / 0.4,
                attempt_count / 15,
                recent_accuracy,
                (difficulty - 1) / 2,
            ]
        )
        labels.append(HINT_STATES.index(label))

    return np.array(features), np.array(labels)


def _extract_feedback_features(request: FeedbackRequest) -> np.ndarray:
    recent_performance = request.recent_performance or []
    last_correct = 1 if (recent_performance[-1] if recent_performance else request.correct) else 0
    avg_time_ms = request.avg_time_ms if request.avg_time_ms is not None else 60000.0
    avg_time_normalized = min(avg_time_ms / 135000, 1.5)
    consecutive_errors = request.consecutive_errors if request.consecutive_errors is not None else 0
    consecutive_normalized = min(consecutive_errors / 4, 1.0)
    mastery_level = clamp_probability(request.mastery_level if request.mastery_level is not None else 0.55)
    mastery_delta = request.mastery_delta if request.mastery_delta is not None else 0.0
    mastery_delta_normalized = (np.clip(mastery_delta, -0.25, 0.25) + 0.25) / 0.5
    attempt_count = request.attempt_count if request.attempt_count is not None else 1
    attempt_normalized = min(attempt_count / 15, 1.2)
    recent_accuracy = (
        sum(1 for outcome in recent_performance if outcome) / len(recent_performance)
        if recent_performance
        else mastery_level
    )
    difficulty = request.difficulty if request.difficulty is not None else 2
    difficulty_normalized = (difficulty - 1) / 2

    return np.array(
        [
            [
                last_correct,
                avg_time_normalized,
                consecutive_normalized,
                mastery_level,
                mastery_delta_normalized,
                attempt_normalized,
                recent_accuracy,
                difficulty_normalized,
            ]
        ]
    )


feedback_X, feedback_y = _generate_feedback_training_data()
feedback_model = RandomForestClassifier(n_estimators=200, random_state=42, max_depth=6)
feedback_model.fit(feedback_X, feedback_y)


def _fallback_feedback(request: FeedbackRequest) -> FeedbackResponse:
    consecutive_errors = request.consecutive_errors if request.consecutive_errors is not None else 0
    mastery_level = clamp_probability(request.mastery_level if request.mastery_level is not None else 0.55)
    mastery_delta = request.mastery_delta if request.mastery_delta is not None else 0.0

    if consecutive_errors >= 3 or mastery_delta < -0.08:
        state = "needs_review"
    elif consecutive_errors >= 1 or mastery_level < 0.5:
        state = "needs_scaffold"
    else:
        state = "steady_progress"

    descriptor = STATE_RESPONSES[state]
    return FeedbackResponse(
        state=state,
        hint_level=STATE_TO_HINT_LEVEL[state],
        message=descriptor["message"],
        encouragement=descriptor["encouragement"],
        tone=descriptor["tone"],
        confidence=0.5,
    )


@app.post("/feedback-style", response_model=FeedbackResponse)
async def feedback_personalization(request: FeedbackRequest):
    """
    Classify the student's current state and suggest the most helpful hint level.
    """
    try:
        features = _extract_feedback_features(request)
        prediction = int(feedback_model.predict(features)[0])
        probabilities = feedback_model.predict_proba(features)[0]
        confidence = float(probabilities[prediction])
        state = HINT_STATES[prediction]
        hint_level = STATE_TO_HINT_LEVEL[state]
        descriptor = STATE_RESPONSES[state]

        return FeedbackResponse(
            state=state,
            hint_level=hint_level,  # type: ignore[arg-type]
            message=descriptor["message"],
            encouragement=descriptor["encouragement"],
            tone=descriptor["tone"],
            confidence=round(confidence, 2),
        )
    except Exception:
        return _fallback_feedback(request)

# QUESTION DIFFICULTY ESTIMATOR (Supervised)

DIFFICULTY_LABELS = ["easy", "medium", "hard"]


class DifficultySample(BaseModel):
    question_id: str
    base_difficulty: Literal["easy", "medium", "hard"]
    avg_time_ms: float
    incorrect_attempts: int
    has_correct: bool
    mastery_level: float
    consecutive_incorrect: int
    skill_attempts: int


class DifficultyEstimate(BaseModel):
    question_id: str
    difficulty: Literal["easy", "medium", "hard"]
    confidence: float


class DifficultyRequest(BaseModel):
    samples: List[DifficultySample]


class DifficultyResponse(BaseModel):
    predictions: List[DifficultyEstimate]


def _generate_difficulty_training_data(n_samples: int = 1200):
    rng = np.random.default_rng(2025)
    features = []
    labels = []
    for _ in range(n_samples):
        base_difficulty = int(rng.integers(1, 4))
        avg_time_ms = rng.uniform(25000, 150000)
        incorrect_attempts = int(rng.integers(0, 6))
        has_correct = rng.integers(0, 2)
        mastery_level = np.clip(rng.normal(0.6, 0.25), 0.05, 0.98)
        consecutive_incorrect = int(rng.integers(0, 5))
        skill_attempts = int(rng.integers(1, 30))
        signal = (
            base_difficulty * 0.45
            + (avg_time_ms / 150000) * 0.4
            + (incorrect_attempts / 6) * 0.65
            + consecutive_incorrect * 0.25
            + (1.0 - mastery_level) * 0.7
            - has_correct * 0.3
        )
        signal += rng.normal(0, 0.15)
        if signal < 1.2:
            label = 0
        elif signal < 2.0:
            label = 1
        else:
            label = 2

        features.append(
            [
                (base_difficulty - 1) / 2,
                avg_time_ms / 150000,
                incorrect_attempts / 6,
                has_correct,
                mastery_level,
                consecutive_incorrect / 5,
                skill_attempts / 30,
            ]
        )
        labels.append(label)

    return np.array(features), np.array(labels)


def _difficulty_features(sample: DifficultySample) -> np.ndarray:
    base_map = {"easy": 0.0, "medium": 0.5, "hard": 1.0}
    return np.array(
        [
            [
                base_map.get(sample.base_difficulty, 0.5),
                min(sample.avg_time_ms / 150000, 1.5),
                min(sample.incorrect_attempts / 6, 1.0),
                1.0 if sample.has_correct else 0.0,
                clamp_probability(sample.mastery_level),
                min(sample.consecutive_incorrect / 5, 1.0),
                min(sample.skill_attempts / 30, 1.5),
            ]
        ]
    )


difficulty_X, difficulty_y = _generate_difficulty_training_data()
difficulty_model = GradientBoostingClassifier(random_state=42)
difficulty_model.fit(difficulty_X, difficulty_y)


@app.post("/difficulty", response_model=DifficultyResponse)
async def estimate_question_difficulty(request: DifficultyRequest):
    """
    Predict question difficulty (easy/medium/hard) from practice telemetry.
    """
    if not request.samples:
        raise HTTPException(status_code=400, detail="samples cannot be empty")

    predictions: List[DifficultyEstimate] = []
    for sample in request.samples:
        try:
            features = _difficulty_features(sample)
            probs = difficulty_model.predict_proba(features)[0]
            idx = int(np.argmax(probs))
            predictions.append(
                DifficultyEstimate(
                    question_id=sample.question_id,
                    difficulty=DIFFICULTY_LABELS[idx],  # type: ignore[arg-type]
                    confidence=round(float(probs[idx]), 2),
                ),
            )
        except Exception:
            base_map = {"easy": 0, "medium": 1, "hard": 2}
            fallback_idx = base_map.get(sample.base_difficulty, 1)
            predictions.append(
                DifficultyEstimate(
                    question_id=sample.question_id,
                    difficulty=DIFFICULTY_LABELS[fallback_idx],  # type: ignore[arg-type]
                    confidence=0.5,
                ),
            )

    return DifficultyResponse(predictions=predictions)

# RECOMMENDATION ENDPOINT - Unsupervised clustering + neighbors

class RecommendRequest(BaseModel):
    user_id: str
    mastery_data: List[dict]


class RecommendResponse(BaseModel):
    skill_id: str
    rationale: str


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


def _generate_mastery_cohort(ids: List[str]):
    rng = np.random.default_rng(2025)
    segments = [
        ("foundation_gaps", [0.25, 0.35, 0.4, 0.45, 0.5], 80),
        ("loop_focus", [0.55, 0.45, 0.3, 0.6, 0.5], 60),
        ("function_focus", [0.6, 0.55, 0.65, 0.35, 0.6], 60),
        ("advanced_review", [0.75, 0.7, 0.78, 0.72, 0.68], 50),
    ]
    rows = []
    labels: List[str] = []
    for name, center, count in segments:
        center_arr = np.array(center)
        for _ in range(count):
            noise = rng.normal(0, 0.12, size=len(ids))
            vector = np.clip(center_arr + noise, 0.05, 0.98)
            rows.append(vector)
            labels.append(name)
    df = pd.DataFrame(rows, columns=ids)
    return df, labels


synthetic_users, synthetic_segments = _generate_mastery_cohort(skill_ids)
neighbor_model = NearestNeighbors(metric="cosine", n_neighbors=6)
neighbor_model.fit(synthetic_users)
kmeans_model = MiniBatchKMeans(n_clusters=4, random_state=42, batch_size=32)
kmeans_model.fit(synthetic_users)
cluster_labels = kmeans_model.labels_


def _cluster_descriptions(cluster_ids: np.ndarray, segments: List[str]):
    descriptions: dict[int, str] = {}
    pretty = {
        "foundation_gaps": "strengthen foundations",
        "loop_focus": "reinforce loops",
        "function_focus": "polish functions",
        "advanced_review": "maintain mastery",
    }
    for cluster_id in np.unique(cluster_ids):
        cluster_segments = [segments[i] for i, label in enumerate(cluster_ids) if label == cluster_id]
        if cluster_segments:
            common_segment = Counter(cluster_segments).most_common(1)[0][0]
            descriptions[int(cluster_id)] = pretty.get(common_segment, "balanced practice")
        else:
            descriptions[int(cluster_id)] = "balanced practice"
    return descriptions


cluster_descriptions = _cluster_descriptions(cluster_labels, synthetic_segments)

@app.post("/recommend", response_model=RecommendResponse)
async def recommend_skill(request: RecommendRequest):
    """Suggest a skill using cluster-aware collaborative filtering."""
    try:
        if not request.mastery_data:
            raise HTTPException(status_code=400, detail="mastery_data cannot be empty")

        mastery_map = {item["skill_id"]: item["p_known"] for item in request.mastery_data}
        user_vector = np.array(
            [[mastery_map.get(skill, float(synthetic_users[skill].mean())) for skill in skill_ids]],
        )

        cluster_id = int(kmeans_model.predict(user_vector)[0])
        cluster_mask = cluster_labels == cluster_id
        cluster_mean = synthetic_users.iloc[cluster_mask].mean().to_dict()

        distances, indices = neighbor_model.kneighbors(user_vector)
        neighbor_mean = synthetic_users.iloc[indices[0]].mean().to_dict()

        def score(skill: str) -> float:
            user_val = mastery_map.get(skill, neighbor_mean.get(skill, cluster_mean.get(skill, 0.6)))
            cluster_val = cluster_mean.get(skill, user_val)
            neighbor_val = neighbor_mean.get(skill, user_val)
            return user_val + 0.4 * (cluster_val - user_val) + 0.3 * (neighbor_val - user_val)

        weakest_skill = min(skill_ids, key=score)
        user_mastery = mastery_map.get(weakest_skill, neighbor_mean.get(weakest_skill, 0.0))
        label = skill_labels.get(weakest_skill, weakest_skill)
        cluster_reason = cluster_descriptions.get(cluster_id, "balanced practice")
        rationale = f"Your mastery in {label} is {user_mastery:.0%}. Let's focus on that next."

        return RecommendResponse(skill_id=weakest_skill, rationale=rationale)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation error: {str(e)}")

# QUESTION GROUPING VIA SUPERVISED CLASSIFICATION

class QuestionClusterRequest(BaseModel):
    questions: List[dict]


class QuestionClusterSummary(BaseModel):
    cluster_id: int
    size: int
    centroid: dict
    label: str


class QuestionClusterResponse(BaseModel):
    assignments: List[dict]
    clusters: List[QuestionClusterSummary]


QUESTION_GROUP_LABELS = {
    "foundation_easy": "Quick win practice",
    "loop_builder": "Loop fluency drill",
    "function_depth": "High-mastery challenge",
    "bridge_medium": "Concept bridge",
    "mixed_review": "Mixed review",
}


def _generate_question_training_data():
    rng = np.random.default_rng(2027)
    prototypes = {
        "foundation_easy": ([0.1, 0.3, 0.25, 0.2, 0.12, 0.8, 0.5], 120),
        "loop_builder": ([0.55, 0.55, 0.55, 0.5, 0.18, 0.55, 0.8], 80),
        "function_depth": ([0.75, 0.85, 0.85, 0.7, 0.25, 0.4, 0.9], 60),
        "bridge_medium": ([0.35, 0.6, 0.55, 0.35, 0.15, 0.6, 0.6], 90),
        "mixed_review": ([0.45, 0.5, 0.6, 0.4, 0.05, 0.7, 0.7], 70),
    }
    rows: List[List[float]] = []
    labels: List[str] = []
    for label, (prototype, count) in prototypes.items():
        base = np.array(prototype)
        for _ in range(count):
            noise = rng.normal(0, 0.08, size=base.shape[0])
            vector = np.clip(base + noise, 0.02, 1.2)
            rows.append(vector.tolist())
            labels.append(label)
    return np.array(rows), labels


question_train_X, question_train_labels = _generate_question_training_data()
question_group_model = RandomForestClassifier(n_estimators=250, random_state=42, max_depth=6)
question_group_model.fit(question_train_X, question_train_labels)


def _summarize_question_clusters(features: np.ndarray, labels: List[str]):
    summaries: List[QuestionClusterSummary] = []
    unique_labels = list(QUESTION_GROUP_LABELS.keys())
    for idx, key in enumerate(unique_labels):
        members = features[[i for i, lbl in enumerate(labels) if lbl == key]]
        if len(members) == 0:
            centroid = np.zeros(features.shape[1])
        else:
            centroid = members.mean(axis=0)
        summaries.append(
            QuestionClusterSummary(
                cluster_id=idx,
                size=int(members.shape[0]),
                centroid={
                    "skill_index": round(float(centroid[0]), 3),
                    "difficulty": round(float(centroid[1]), 3),
                    "avg_time": round(float(centroid[2]), 3),
                    "incorrect_rate": round(float(centroid[3]), 3),
                },
                label=QUESTION_GROUP_LABELS.get(key, key),
            ),
        )
    return summaries


question_cluster_summaries = _summarize_question_clusters(question_train_X, question_train_labels)


# ADAPTIVE DIFFICULTY RECOMMENDER (Supervised)

ADAPTIVE_LABELS = ["easy", "medium", "hard"]


class AdaptiveDifficultySample(BaseModel):
    skill_mastery: float
    consecutive_incorrect: int
    consecutive_correct: int
    rolling_accuracy: float
    baseline_difficulty: Literal["easy", "medium", "hard"]
    last_correct: bool
    avg_time_ms: float = 60000


class AdaptiveDifficultyResponse(BaseModel):
    difficulty: Literal["easy", "medium", "hard"]
    confidence: float


def _generate_adaptive_training_data(n_samples: int = 1400):
    rng = np.random.default_rng(2028)
    features = []
    labels = []
    for _ in range(n_samples):
        mastery = np.clip(rng.normal(0.6, 0.22), 0.05, 0.98)
        consecutive_incorrect = rng.integers(0, 4)
        consecutive_correct = rng.integers(0, 4)
        rolling_accuracy = np.clip(mastery + rng.normal(0, 0.15), 0.05, 0.98)
        baseline_difficulty = rng.choice([1, 2, 3], p=[0.3, 0.45, 0.25])
        last_correct = bool(rng.integers(0, 2))
        avg_time_ms = rng.uniform(30000, 140000)

        if consecutive_incorrect >= 2 or mastery < 0.4:
            label = 0
        elif mastery > 0.78 and consecutive_correct >= 2:
            label = 2
        elif baseline_difficulty == 3 and not last_correct:
            label = 1
        else:
            score = baseline_difficulty + (mastery - rolling_accuracy) * 1.8 + (0.4 if last_correct else -0.4)
            if score >= 2.4:
                label = 2
            elif score <= 1.3:
                label = 0
            else:
                label = 1

        features.append(
            [
                mastery,
                consecutive_incorrect / 3,
                consecutive_correct / 3,
                rolling_accuracy,
                (baseline_difficulty - 1) / 2,
                avg_time_ms / 140000,
                1.0 if last_correct else 0.0,
            ],
        )
        labels.append(label)

    return np.array(features), np.array(labels)


adaptive_X, adaptive_y = _generate_adaptive_training_data()
adaptive_model = GradientBoostingClassifier(random_state=42)
adaptive_model.fit(adaptive_X, adaptive_y)


def _adaptive_features(sample: AdaptiveDifficultySample) -> np.ndarray:
    baseline_map = {"easy": 0.0, "medium": 0.5, "hard": 1.0}
    return np.array(
        [
            [
                clamp_probability(sample.skill_mastery),
                min(sample.consecutive_incorrect / 3, 1.0),
                min(sample.consecutive_correct / 3, 1.0),
                clamp_probability(sample.rolling_accuracy),
                baseline_map.get(sample.baseline_difficulty, 0.5),
                min(sample.avg_time_ms / 140000, 1.5),
                1.0 if sample.last_correct else 0.0,
            ]
        ]
    )


@app.post("/adaptive-difficulty", response_model=AdaptiveDifficultyResponse)
async def adaptive_difficulty(request: AdaptiveDifficultySample):
    try:
        features = _adaptive_features(request)
        probs = adaptive_model.predict_proba(features)[0]
        idx = int(np.argmax(probs))
        return AdaptiveDifficultyResponse(difficulty=ADAPTIVE_LABELS[idx], confidence=round(float(probs[idx]), 2))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Adaptive difficulty error: {str(e)}")


def _question_feature_vector(question: dict) -> np.ndarray:
    skill_id = question.get("skillId") or question.get("skill_id") or "skill_variables"
    skill_index = skill_ids.index(skill_id) if skill_id in skill_ids else 0
    difficulty = question.get("difficulty")
    if isinstance(difficulty, str):
        diff_value = {"easy": 1, "medium": 2, "hard": 3}.get(difficulty, 2)
    else:
        diff_value = int(difficulty) if difficulty is not None else 2
    avg_time = question.get("avgTimeMs") or question.get("avg_time_ms") or 60000
    incorrect_attempts = question.get("incorrectAttempts") or question.get("incorrect_attempts") or 0
    mastery_gain = question.get("avgMasteryGain") or question.get("avg_mastery_gain") or 0.05
    solved_rate = question.get("solvedRate") or question.get("solved_rate") or 0.5
    entropy = question.get("responseEntropy") or question.get("response_entropy") or 0.8
    return np.array(
        [
            [
                skill_index / len(skill_ids),
                diff_value / 3,
                min(avg_time / 150000, 1.5),
                min(incorrect_attempts / 5, 1.0),
                mastery_gain + 0.1,
                clamp_probability(solved_rate),
                min(entropy, 1.5),
            ]
        ]
    )


@app.post("/question-groups", response_model=QuestionClusterResponse)
async def cluster_questions(request: QuestionClusterRequest):
    if not request.questions:
        raise HTTPException(status_code=400, detail="questions cannot be empty")

    assignments = []
    for question in request.questions:
        try:
            vector = _question_feature_vector(question)
            probs = question_group_model.predict_proba(vector)[0]
            label = question_group_model.predict(vector)[0]
            class_idx = list(question_group_model.classes_).index(label)
            cluster_index = list(QUESTION_GROUP_LABELS.keys()).index(label)
            assignments.append(
                {
                    "question_id": question.get("questionId") or question.get("id") or "unknown",
                    "cluster_id": cluster_index,
                    "label": QUESTION_GROUP_LABELS.get(label, label),
                    "confidence": round(float(probs[class_idx]), 2),
                }
            )
        except Exception:
            assignments.append(
                {
                    "question_id": question.get("questionId") or question.get("id") or "unknown",
                    "cluster_id": -1,
                    "label": "unknown",
                    "confidence": 0.0,
                }
            )

    return QuestionClusterResponse(assignments=assignments, clusters=question_cluster_summaries)

# PYTHON GRADING ENDPOINT

DEFAULT_TIMEOUT_MS = 2000
MIN_TIMEOUT_MS = 500
MAX_TIMEOUT_MS = 6000
MAX_OUTPUT_CHARS = 4000

SAFE_BUILTINS = [
    "abs",
    "all",
    "any",
    "ascii",
    "bin",
    "bool",
    "chr",
    "divmod",
    "enumerate",
    "filter",
    "float",
    "format",
    "globals",
    "int",
    "len",
    "list",
    "map",
    "max",
    "min",
    "pow",
    "print",
    "range",
    "round",
    "sorted",
    "locals",
    "str",
    "sum",
    "tuple",
    "zip",
    "set",
    "dict",
    "reversed",
]

ALLOWED_MODULES = {"math", "statistics", "random", "itertools", "functools"}

PYTHON_RUNNER_TEMPLATE = """
import builtins
import io
import json
import sys
import traceback

SAFE_BUILTINS = __SAFE_BUILTINS__
ALLOWED_MODULES = __ALLOWED_MODULES__


def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    root = name.split(".")[0]
    if root not in ALLOWED_MODULES:
        raise ImportError(f"Module {name} is not allowed")
    return __import__(name, globals, locals, fromlist, level)


def build_env():
    allowed = {}
    for name in SAFE_BUILTINS:
        if hasattr(builtins, name):
            allowed[name] = getattr(builtins, name)
    allowed["__import__"] = safe_import
    return {"__builtins__": allowed, "__name__": "__main__"}


def run():
    meta = json.loads(sys.argv[1])
    code_path = meta["code_path"]
    mode = meta.get("mode", "function")
    stdin_payload = meta.get("stdin")
    func_name = meta.get("function")
    args = meta.get("args", [])
    kwargs = meta.get("kwargs", {})
    injected_globals = meta.get("globals") or {}

    safe_globals = build_env()
    if isinstance(injected_globals, dict):
        safe_globals.update(injected_globals)
    with open(code_path, "r", encoding="utf-8") as handle:
        source = handle.read()

    stdout_buffer = io.StringIO()
    old_stdout = sys.stdout
    old_stdin = sys.stdin
    sys.stdout = stdout_buffer
    if stdin_payload is not None:
        sys.stdin = io.StringIO(stdin_payload)

    result = None
    error = None
    try:
        exec(compile(source, code_path, "exec"), safe_globals)
        if mode == "function":
            func = safe_globals.get(func_name)
            if func is None or not callable(func):
                raise NameError(f"Function {func_name} is not defined")
            result = func(*args, **kwargs)
        elif mode == "assert":
            expression = meta.get("expression")
            if not expression:
                raise ValueError("Missing assertion expression")
            stdout_snapshot = stdout_buffer.getvalue()
            local_context = {
                "stdout": stdout_snapshot,
                "stdout_lines": [
                    line.strip() for line in stdout_snapshot.strip().splitlines() if line.strip()
                ],
            }
            result = bool(eval(expression, safe_globals, local_context))
    except Exception:
        error = traceback.format_exc()
    finally:
        sys.stdout = old_stdout
        sys.stdin = old_stdin

    payload = {"result": result, "stdout": stdout_buffer.getvalue(), "error": error}
    print(json.dumps(payload))
    sys.exit(0 if error is None else 1)


if __name__ == "__main__":
    run()
"""

PYTHON_RUNNER_SOURCE = (
    textwrap.dedent(PYTHON_RUNNER_TEMPLATE)
    .replace("__SAFE_BUILTINS__", repr(SAFE_BUILTINS))
    .replace("__ALLOWED_MODULES__", repr(sorted(ALLOWED_MODULES)))
)


class GradeTestCase(BaseModel):
    input: str
    expectedOutput: str
    timeoutMs: Optional[int] = DEFAULT_TIMEOUT_MS


class GradeTestResult(BaseModel):
    index: int
    status: Literal["pass", "fail", "timeout", "error"]
    stdout: Optional[str]
    stderr: Optional[str]
    actual: Optional[str] = None
    expected: Optional[str] = None
    input_summary: Optional[str] = None


class GradeRequest(BaseModel):
    code: str
    language: str
    testCases: List[GradeTestCase]


class GradeResponse(BaseModel):
    passed: bool
    results: List[GradeTestResult]


def truncate_output(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    if len(value) > MAX_OUTPUT_CHARS:
        return value[:MAX_OUTPUT_CHARS] + "... (truncated)"
    return value


def safe_string(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed if len(trimmed) <= 200 else trimmed[:197] + "..."
    try:
        text = json.dumps(value)
        return text if len(text) <= 200 else text[:197] + "..."
    except Exception:
        return str(value)


def compare_values(expected, actual) -> bool:
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        return abs(float(expected) - float(actual)) <= 1e-6
    if isinstance(expected, list) and isinstance(actual, list):
        if len(expected) != len(actual):
            return False
        return all(compare_values(e, a) for e, a in zip(expected, actual))
    if isinstance(expected, dict) and isinstance(actual, dict):
        if set(expected.keys()) != set(actual.keys()):
            return False
        return all(compare_values(expected[key], actual[key]) for key in expected)
    return expected == actual


def build_runner(temp_dir: Path) -> Path:
    runner_path = temp_dir / "runner.py"
    runner_path.write_text(PYTHON_RUNNER_SOURCE, encoding="utf-8")
    return runner_path


def friendly_join(items: List[str]) -> str:
    cleaned = [item.strip() for item in items if item and item.strip()]
    if not cleaned:
        return ""
    if len(cleaned) == 1:
        return cleaned[0]
    if len(cleaned) == 2:
        return f"{cleaned[0]} and {cleaned[1]}"
    return ", ".join(cleaned[:-1]) + f", and {cleaned[-1]}"


def literal_preview(value: str) -> str:
    raw = value.strip()
    try:
        parsed = ast.literal_eval(raw)
    except Exception:
        return raw.strip("\"'")
    if isinstance(parsed, str):
        return f'"{parsed}"'
    if isinstance(parsed, (int, float, bool)):
        return str(parsed)
    if isinstance(parsed, (list, tuple)):
        rendered = ", ".join(str(item) for item in parsed[:5])
        if len(parsed) > 5:
            rendered += ", …"
        return f"[{rendered}]"
    return str(parsed)


def summarize_python_error(trace: Optional[str], stderr: Optional[str]) -> Optional[str]:
    candidate = trace or stderr
    if not candidate:
        return None
    lines = [line.strip() for line in candidate.splitlines() if line.strip()]
    if not lines:
        return None
    for line in reversed(lines):
        if line.startswith("File \""):
            continue
        return line
    return lines[-1]


def summarize_assertion(expression: str) -> str:
    expr = (expression or "").strip()
    if not expr:
        return "Expectation: the code should satisfy the described requirement."

    def quote_words(words: List[str]) -> List[str]:
        return [f'"{word}"' for word in words]

    words_not_in_stdout = re.findall(r"'([^']+)'\s+not\s+in\s+stdout\.lower\(\)", expr, re.IGNORECASE)
    if words_not_in_stdout:
        return f"Printed output should not mention {friendly_join(quote_words(words_not_in_stdout))}."

    words_in_stdout = re.findall(r"'([^']+)'\s+in\s+stdout\.lower\(\)", expr, re.IGNORECASE)
    if words_in_stdout:
        return f"Printed output should mention {friendly_join(quote_words(words_in_stdout))}."

    count_match = re.search(r"stdout\.lower\(\)\.count\(['\"](.+?)['\"]\)\s*==\s*(\d+)", expr, re.IGNORECASE)
    if count_match:
        term, count = count_match.group(1), int(count_match.group(2))
        times = "once" if count == 1 else f"{count} times"
        return f"Printed output should mention \"{term}\" {times}."

    equals_match = re.search(r"stdout\.strip\(\)\.lower\(\)\s*==\s*(.+)", expr, re.IGNORECASE)
    if equals_match:
        target = literal_preview(equals_match.group(1))
        return f"Printed output should equal {target} (case-insensitive)."

    first_line_match = re.search(r"stdout\.strip\(\)\.splitlines\(\)\[0\]\.lower\(\)\s*==\s*(.+)", expr, re.IGNORECASE)
    if first_line_match:
        target = literal_preview(first_line_match.group(1))
        return f"The first printed line should be {target}."

    last_line_match = re.search(r"stdout\.strip\(\)\.splitlines\(\)\[-1\](?:\.strip\(\))?\s*==\s*(.+)", expr, re.IGNORECASE)
    if last_line_match:
        target = literal_preview(last_line_match.group(1))
        return f"The last printed line should be {target}."

    tuple_match = re.search(r"stdout\.strip\(\)\.lower\(\)\s+in\s+\((.+)\)", expr, re.IGNORECASE)
    if tuple_match:
        options_raw = tuple_match.group(1)
        try:
            parsed = ast.literal_eval(f"({options_raw})")
            if isinstance(parsed, tuple):
                choices = friendly_join([f'"{choice}"' for choice in parsed])
                return f"Printed output should be either {choices}."
        except Exception:
            pass

    exact_lines_match = re.search(r"stdout_lines\s*==\s*(.+)", expr)
    if exact_lines_match:
        target = exact_lines_match.group(1)
        try:
            parsed = ast.literal_eval(target)
            if isinstance(parsed, list):
                preview = ", ".join(str(item) for item in parsed[:5])
                if len(parsed) > 5:
                    preview += ", …"
                return f"Printed lines should match: {preview}."
        except Exception:
            pass

    indexed_line_match = re.search(r"stdout_lines\[(?P<idx>-?\d+)\](?:\.strip\(\))?\s*==\s*(?P<value>.+)", expr)
    if indexed_line_match:
        idx = int(indexed_line_match.group("idx"))
        value = literal_preview(indexed_line_match.group("value"))
        if idx == 0:
            return f"The first printed line should be {value}."
        if idx == -1:
            return f"The last printed line should be {value}."
        return f"Line #{idx + 1} of the output should be {value}."

    len_lines_match = re.search(r"len\(stdout_lines\)\s*==\s*(\d+)", expr)
    if len_lines_match:
        count = int(len_lines_match.group(1))
        noun = "line" if count == 1 else "lines"
        return f"Program should print {count} {noun}."

    len_row_match = re.search(r"len\(globals\(\)\[['\"]([\w_]+)['\"]\]\.strip\(\)\.split\(\)\)\s*==\s*(\d+)", expr)
    if len_row_match:
        name, count = len_row_match.group(1), int(len_row_match.group(2))
        noun = "value" if count == 1 else "values"
        return f"{name} should contain {count} {noun}."

    row_entry_match = re.search(r"globals\(\)\[['\"]([\w_]+)['\"]\]\.strip\(\)\.split\(\)\[(\d+)\]\s*==\s*(.+)", expr)
    if row_entry_match:
        name = row_entry_match.group(1)
        position = int(row_entry_match.group(2)) + 1
        value = literal_preview(row_entry_match.group(3))
        return f"{name} entry #{position} should be {value}."

    globals_call_equality = re.findall(r"globals\(\)(?:\.get)?\(['\"]([\w_]+)['\"]\)\s*==\s*([^&|]+)", expr)
    globals_bracket_equality = re.findall(r"globals\(\)\[['\"]([\w_]+)['\"]\]\s*==\s*([^&|]+)", expr)
    globals_equality = globals_call_equality + globals_bracket_equality
    if globals_equality:
        parts = [f"{var} = {literal_preview(val)}" for var, val in globals_equality]
        return f"Ensure {friendly_join(parts)}."

    isinstance_match = re.search(r"isinstance\(globals\(\)\.get\(['\"]([\w_]+)['\"]\),\s*\(([^)]+)\)\)", expr)
    if isinstance_match:
        name = isinstance_match.group(1)
        types = isinstance_match.group(2).replace(" ", "")
        return f"{name} should be of type {types}."

    isinstance_simple = re.search(r"isinstance\(([\w_]+),\s*([\w_]+)\)", expr)
    if isinstance_simple:
        name, type_name = isinstance_simple.groups()
        return f"{name} should be a {type_name}."

    len_var_match = re.search(r"len\(([\w_]+)\)\s*>?=\s*(\d+)", expr)
    if len_var_match:
        name, count = len_var_match.group(1), int(len_var_match.group(2))
        qualifier = "at least " if ">=" in expr else ""
        noun = "item" if count == 1 else "items"
        return f"{name} should contain {qualifier}{count} {noun}."

    function_call_match = re.search(r"([A-Za-z_][\w]*)\((.*)\)\s*==\s*(.+)", expr)
    if function_call_match and not expr.startswith("len("):
        func, args, value = function_call_match.groups()
        return f"Calling {func}({args}) should return {literal_preview(value)}."

    direct_var_match = re.search(r"^([\w_]+)\s*==\s*(.+)$", expr)
    if direct_var_match:
        name, value = direct_var_match.groups()
        return f"{name} should equal {literal_preview(value)}."

    colors_match = re.search(r"'([^']+)'\s+in\s+([\w_]+)", expr)
    if colors_match:
        value, collection = colors_match.groups()
        return f"{collection} should include \"{value}\"."

    globals_presence = re.findall(r"'([\w_]+)'\s+in\s+globals\(\)", expr)
    if globals_presence:
        prefix = "variable" if len(globals_presence) == 1 else "variables"
        return f"Define {prefix} {friendly_join(globals_presence)}."

    return f"Expectation: {expr}"
def clamp_timeout(timeout_ms: Optional[int]) -> float:
    raw = timeout_ms or DEFAULT_TIMEOUT_MS
    bounded = max(MIN_TIMEOUT_MS, min(raw, MAX_TIMEOUT_MS))
    return bounded / 1000


def execute_test_case(
    runner_path: Path,
    code_path: Path,
    test_case: GradeTestCase,
    index: int,
) -> GradeTestResult:
    try:
        payload = json.loads(test_case.input)
    except json.JSONDecodeError:
        return GradeTestResult(
            index=index,
            status="error",
            stdout=None,
            stderr="Invalid testCase input JSON",
        )

    mode = payload.get("mode")
    if not mode:
        mode = "function" if payload.get("function") else "stdin"

    metadata = {
        "code_path": str(code_path),
        "mode": mode,
        "function": payload.get("function"),
        "args": payload.get("args", []),
        "kwargs": payload.get("kwargs", {}),
        "stdin": payload.get("stdin"),
        "expression": payload.get("expression"),
    }
    input_summary = None
    if mode == "function":
        args = ", ".join(safe_string(arg) or "…" for arg in metadata.get("args", []))
        kwargs = ", ".join(f"{key}={safe_string(value)}" for key, value in metadata.get("kwargs", {}).items())
        parts = [part for part in [args, kwargs] if part]
        joined = ", ".join(parts)
        input_summary = f"{metadata.get('function') or 'function'}({joined})"
    elif mode == "assert":
        expr = payload.get("expression")
        if expr:
            input_summary = summarize_assertion(expr)
    elif metadata.get("stdin"):
        snippet = safe_string(metadata["stdin"])
        input_summary = f"stdin: {snippet}"

    timeout_seconds = clamp_timeout(test_case.timeoutMs)

    try:
        completed = subprocess.run(
            ["python3", str(runner_path), json.dumps(metadata)],
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            env={
                "PYTHONUNBUFFERED": "1",
                "PYTHONIOENCODING": "utf-8",
            },
        )
    except subprocess.TimeoutExpired:
        return GradeTestResult(index=index, status="timeout", stdout=None, stderr="Execution timed out")
    except Exception as exc:
        return GradeTestResult(index=index, status="error", stdout=None, stderr=f"Runner failure: {exc}")

    try:
        runner_output = json.loads((completed.stdout or "").strip() or "{}")
    except json.JSONDecodeError:
        runner_output = {"error": "Unable to parse runner output", "stdout": completed.stdout}

    actual_stdout = truncate_output(runner_output.get("stdout"))
    stderr_text = truncate_output(completed.stderr.strip() or None)
    error_message = runner_output.get("error")

    try:
        expected_value = json.loads(test_case.expectedOutput)
    except json.JSONDecodeError:
        expected_value = test_case.expectedOutput

    if completed.returncode != 0 and not error_message:
        error_message = "Execution failed"

    actual_value = None
    expected_value_display = None
    if mode == "function":
        actual_value = runner_output.get("result")
        expected_value_display = expected_value
    elif mode == "assert":
        actual_value = runner_output.get("result")
        expected_value_display = expected_value
    else:
        actual_value = actual_stdout
        expected_value_display = expected_value

    if error_message:
        condensed_error = summarize_python_error(error_message, stderr_text)
        return GradeTestResult(
            index=index,
            status="error",
            stdout=actual_stdout,
            stderr=condensed_error,
            actual=safe_string(actual_value),
            expected=safe_string(expected_value_display),
            input_summary=input_summary,
        )

    if mode == "assert":
        result_value = runner_output.get("result")
        status = "pass" if result_value else "fail"
        return GradeTestResult(
            index=index,
            status=status,
            stdout=actual_stdout,
            stderr=stderr_text,
            actual=safe_string(result_value),
            expected=safe_string(expected_value_display),
            input_summary=input_summary,
        )

    status = "fail"
    if mode == "function":
        result_value = runner_output.get("result")
        if compare_values(expected_value, result_value):
            status = "pass"
        actual_value = result_value
        expected_value_display = expected_value
    else:
        expected_stdout = expected_value.get("stdout") if isinstance(expected_value, dict) else expected_value
        if isinstance(expected_stdout, str) and isinstance(actual_stdout, str):
            if actual_stdout.strip() == expected_stdout.strip():
                status = "pass"
        else:
            status = "fail"
        actual_value = actual_stdout
        expected_value_display = expected_stdout

    return GradeTestResult(
        index=index,
        status=status,
        stdout=actual_stdout,
        stderr=stderr_text,
        actual=safe_string(actual_value),
        expected=safe_string(expected_value_display),
        input_summary=input_summary,
    )


def grade_python_submission(code: str, test_cases: List[GradeTestCase]) -> GradeResponse:
    temp_dir = Path(tempfile.mkdtemp(prefix="grader_"))
    try:
        code_path = temp_dir / "submission.py"
        code_path.write_text(code, encoding="utf-8")
        runner_path = build_runner(temp_dir)

        results: List[GradeTestResult] = []
        for idx, test_case in enumerate(test_cases):
            results.append(execute_test_case(runner_path, code_path, test_case, idx))

        passed = all(result.status == "pass" for result in results)
        return GradeResponse(passed=passed, results=results)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@app.post("/grade", response_model=GradeResponse)
async def grade_submission(request: GradeRequest):
    """
    Execute untrusted Python code against instructor-provided test cases.
    """
    if not request.code or not request.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")

    if request.language.lower() != "python":
        raise HTTPException(status_code=400, detail="Only Python grading is supported.")

    if not request.testCases:
        raise HTTPException(status_code=400, detail="Provide at least one test case.")

    if len(request.testCases) > 10:
        raise HTTPException(status_code=400, detail="Limit test cases to 10 per submission.")

    response = grade_python_submission(request.code, request.testCases)
    return response

# HEALTH CHECK

@app.get("/")
async def root():
    return {
        "service": "ITS ML Microservice",
        "version": "1.0.0",
        "endpoints": ["/kt", "/feedback-style", "/recommend", "/grade"]
    }

@app.get("/health")
async def health():
    return {"status": "ok"}
