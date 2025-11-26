"""
Offline training pipeline for the ML microservice.

Usage (from repo root):
  python ml-service/train_offline.py --attempts data/attempts.csv --questions data/questions.csv --output-dir ml-service/models

Inputs:
  - attempts: CSV/Parquet with columns: user_id, skill_id, question_id (optional), correct (bool/int), elapsed_ms (optional),
    difficulty (optional int 1-3), ts (timestamp for ordering).
  - questions: CSV/Parquet with columns: question_id, skill_id, base_difficulty (1-3) and any metadata you want to extend later.

Outputs (written to --output-dir, default ml-service/models):
  - bkt_params.json
  - feedback_model.joblib
  - difficulty_model.joblib
  - adaptive_model.joblib
  - recommendation.joblib  (neighbor + kmeans + mastery matrix + skill_ids)
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import MiniBatchKMeans
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.neighbors import NearestNeighbors


# ----------------------------
# BKT utilities (lightweight copy from the service for offline fitting)


@dataclass
class BKTParameters:
    p_init: float
    p_learn: float
    p_slip: float
    p_guess: float


def clamp_probability(value: float, min_value: float = 0.01, max_value: float = 0.99) -> float:
    return max(min_value, min(max_value, value))


def _emission_vector(correct: bool, slip: float, guess: float) -> np.ndarray:
    if correct:
        return np.array([guess, 1.0 - slip], dtype=float)
    return np.array([1.0 - guess, slip], dtype=float)


def _transition_matrix(p_learn: float) -> np.ndarray:
    p_learn = clamp_probability(p_learn, 0.001, 0.8)
    return np.array([[1.0 - p_learn, p_learn], [0.0, 1.0]], dtype=float)


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
        init_known = learn_num = learn_den = slip_num = slip_den = guess_num = guess_den = 0.0
        init_count = 0
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


def train_bkt(attempts: pd.DataFrame) -> Dict[str, BKTParameters]:
    params: Dict[str, BKTParameters] = {}
    if "ts" in attempts.columns:
        attempts = attempts.sort_values("ts")
    for skill_id, skill_df in attempts.groupby("skill_id"):
        sequences: List[List[bool]] = []
        for _, user_df in skill_df.groupby("user_id"):
            seq = [bool(v) for v in user_df["correct"].tolist()]
            if seq:
                sequences.append(seq)
        params[skill_id] = _fit_bkt_parameters(sequences)
    return params


# ----------------------------
# Feature builders


def _window(values: Iterable[bool], n: int) -> List[bool]:
    vals = list(values)
    return vals[-n:] if len(vals) > n else vals


def build_feedback_dataset(attempts: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
    features: List[List[float]] = []
    labels: List[int] = []
    attempts = attempts.copy()
    if "ts" in attempts.columns:
        attempts = attempts.sort_values("ts")

    for (user_id, skill_id), df in attempts.groupby(["user_id", "skill_id"]):
        recent: List[bool] = []
        running_acc = 0.6
        prev_running_acc = 0.6
        consecutive_errors = 0
        attempt_count = 0

        for _, row in df.iterrows():
            attempt_count += 1
            correct = bool(row.get("correct", False))
            elapsed = float(row.get("elapsed_ms", 60000.0))
            difficulty = int(row.get("difficulty", 2))

            recent = (_window(recent, 3) + [correct])[-3:]
            prev_running_acc = running_acc
            running_acc = 0.7 * running_acc + 0.3 * (1.0 if correct else 0.0)
            mastery_delta = running_acc - prev_running_acc
            consecutive_errors = consecutive_errors + 1 if not correct else 0

            if consecutive_errors >= 3 or mastery_delta < -0.08:
                label = 2  # needs_review
            elif consecutive_errors >= 1 or running_acc < 0.45 or (difficulty == 3 and not correct):
                label = 1  # needs_scaffold
            else:
                label = 0  # steady_progress

            avg_time_norm = min(elapsed / 135000.0, 1.5)
            consecutive_norm = min(consecutive_errors / 4.0, 1.0)
            mastery_delta_norm = (np.clip(mastery_delta, -0.25, 0.25) + 0.25) / 0.5
            attempt_norm = min(attempt_count / 15.0, 1.2)
            recent_accuracy = sum(recent) / len(recent) if recent else running_acc
            difficulty_norm = (difficulty - 1) / 2.0

            features.append(
                [
                    1 if (recent[-1] if recent else correct) else 0,
                    avg_time_norm,
                    consecutive_norm,
                    clamp_probability(running_acc),
                    mastery_delta_norm,
                    attempt_norm,
                    clamp_probability(recent_accuracy),
                    difficulty_norm,
                ]
            )
            labels.append(label)
    return np.array(features), np.array(labels)


def build_difficulty_dataset(attempts: pd.DataFrame, questions: pd.DataFrame | None) -> Tuple[np.ndarray, np.ndarray]:
    question_meta = {}
    if questions is not None and "question_id" in questions.columns:
        for _, row in questions.iterrows():
            question_meta[row["question_id"]] = {
                "skill_id": row.get("skill_id"),
                "base_difficulty": int(row.get("base_difficulty", 2)),
            }

    rows: List[List[float]] = []
    labels: List[int] = []
    if "question_id" not in attempts.columns:
        return np.empty((0, 7)), np.empty((0,))

    grouped = attempts.groupby("question_id")
    for qid, df in grouped:
        base_diff = int(question_meta.get(qid, {}).get("base_difficulty", df["difficulty"].median() if "difficulty" in df else 2))
        avg_time = float(df["elapsed_ms"].mean() if "elapsed_ms" in df else 60000.0)
        incorrect_attempts = int((~df["correct"]).sum())
        has_correct = int(df["correct"].any())
        mastery_level = clamp_probability(df["correct"].mean() if not df["correct"].empty else 0.6)
        consecutive_incorrect = int(df["correct"].value_counts().get(False, 0))
        skill_attempts = int(len(df))

        signal = (
            base_diff * 0.45
            + (avg_time / 150000.0) * 0.4
            + (incorrect_attempts / max(skill_attempts, 1)) * 0.65
            + consecutive_incorrect * 0.1
            + (1.0 - mastery_level) * 0.7
            - has_correct * 0.2
        )
        if signal < 1.2:
            label = 0
        elif signal < 2.0:
            label = 1
        else:
            label = 2

        rows.append(
            [
                (base_diff - 1) / 2.0,
                min(avg_time / 150000.0, 1.5),
                min(incorrect_attempts / 6.0, 1.0),
                1.0 if has_correct else 0.0,
                mastery_level,
                min(consecutive_incorrect / 5.0, 1.0),
                min(skill_attempts / 30.0, 1.5),
            ]
        )
        labels.append(label)

    return np.array(rows), np.array(labels)


def build_adaptive_dataset(attempts: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
    rows: List[List[float]] = []
    labels: List[int] = []
    if "ts" in attempts.columns:
        attempts = attempts.sort_values("ts")

    for (user_id, skill_id), df in attempts.groupby(["user_id", "skill_id"]):
        consecutive_incorrect = consecutive_correct = 0
        rolling_accuracy = 0.6

        for _, row in df.iterrows():
            correct = bool(row.get("correct", False))
            consecutive_incorrect = consecutive_incorrect + 1 if not correct else 0
            consecutive_correct = consecutive_correct + 1 if correct else 0
            rolling_accuracy = 0.7 * rolling_accuracy + 0.3 * (1.0 if correct else 0.0)
            mastery = clamp_probability(rolling_accuracy)
            baseline_difficulty = int(row.get("difficulty", 2))
            avg_time = float(row.get("elapsed_ms", 60000.0))

            if consecutive_incorrect >= 2 or mastery < 0.4:
                label = 0  # easy
            elif mastery > 0.78 and consecutive_correct >= 2:
                label = 2  # hard
            elif baseline_difficulty == 3 and not correct:
                label = 1
            else:
                score = baseline_difficulty + (mastery - rolling_accuracy) * 1.8 + (0.4 if correct else -0.4)
                if score >= 2.4:
                    label = 2
                elif score <= 1.3:
                    label = 0
                else:
                    label = 1

            rows.append(
                [
                    mastery,
                    min(consecutive_incorrect / 3.0, 1.0),
                    min(consecutive_correct / 3.0, 1.0),
                    clamp_probability(rolling_accuracy),
                    (baseline_difficulty - 1) / 2.0,
                    min(avg_time / 140000.0, 1.5),
                    1.0 if correct else 0.0,
                ]
            )
            labels.append(label)

    return np.array(rows), np.array(labels)


def build_recommendation_artifacts(attempts: pd.DataFrame) -> dict:
    mastery = attempts.groupby(["user_id", "skill_id"])["correct"].mean().unstack(fill_value=np.nan)
    # Fill per-skill medians for gaps
    mastery = mastery.apply(lambda col: col.fillna(col.median()), axis=0).fillna(0.5)
    mastery_matrix = mastery.values
    skill_ids = mastery.columns.tolist()

    kmeans = MiniBatchKMeans(n_clusters=min(4, len(mastery_matrix)), random_state=42, batch_size=32)
    kmeans.fit(mastery_matrix)
    neighbor_model = NearestNeighbors(metric="cosine", n_neighbors=min(6, len(mastery_matrix)))
    neighbor_model.fit(mastery_matrix)

    return {
        "user_vectors": mastery,
        "skill_ids": skill_ids,
        "neighbor_model": neighbor_model,
        "kmeans_model": kmeans,
        "cluster_labels": getattr(kmeans, "labels_", None),
    }


# ----------------------------
# I/O helpers


def load_table(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(path)
    if path.suffix.lower() in {".parquet", ".pq"}:
        return pd.read_parquet(path)
    return pd.read_csv(path)


def save_bkt_params(params: Dict[str, BKTParameters], output_dir: Path) -> None:
    payload = {skill: vars(p) for skill, p in params.items()}
    (output_dir / "bkt_params.json").write_text(json.dumps(payload, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Train ML microservice models on real telemetry.")
    parser.add_argument("--attempts", required=True, type=Path, help="CSV/Parquet of attempts")
    parser.add_argument("--questions", type=Path, help="CSV/Parquet of questions (optional but recommended)")
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parent / "models")
    args = parser.parse_args()

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    attempts = load_table(args.attempts)
    questions = load_table(args.questions) if args.questions else None

    bkt_params = train_bkt(attempts)
    save_bkt_params(bkt_params, output_dir)

    feedback_X, feedback_y = build_feedback_dataset(attempts)
    if len(feedback_X):
        feedback_model = RandomForestClassifier(n_estimators=200, random_state=42, max_depth=6)
        feedback_model.fit(feedback_X, feedback_y)
        joblib.dump(feedback_model, output_dir / "feedback_model.joblib")

    difficulty_X, difficulty_y = build_difficulty_dataset(attempts, questions)
    if len(difficulty_X):
        difficulty_model = GradientBoostingClassifier(random_state=42)
        difficulty_model.fit(difficulty_X, difficulty_y)
        joblib.dump(difficulty_model, output_dir / "difficulty_model.joblib")

    adaptive_X, adaptive_y = build_adaptive_dataset(attempts)
    if len(adaptive_X):
        adaptive_model = GradientBoostingClassifier(random_state=42)
        adaptive_model.fit(adaptive_X, adaptive_y)
        joblib.dump(adaptive_model, output_dir / "adaptive_model.joblib")

    if not attempts.empty:
        rec_artifacts = build_recommendation_artifacts(attempts)
        joblib.dump(rec_artifacts, output_dir / "recommendation.joblib")

    print(f"Saved artifacts to {output_dir}")


if __name__ == "__main__":
    main()
