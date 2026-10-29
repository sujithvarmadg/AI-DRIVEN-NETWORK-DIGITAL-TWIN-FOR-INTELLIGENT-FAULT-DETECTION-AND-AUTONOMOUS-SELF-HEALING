"""
ML Model Training — generates synthetic training data and trains:
  1. Isolation Forest for anomaly detection
  2. Random Forest for fault-type classification

Run standalone:  python -m ml.model_training
"""

import numpy as np
import pandas as pd
import os
import joblib
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report


# Feature columns used by both models
FEATURES = [
    "latency", "packet_loss", "throughput", "cpu_usage",
    "memory_usage", "jitter", "error_rate", "traffic_load",
]

FAULT_LABELS = [
    "normal", "link_failure", "router_failure",
    "congestion", "high_latency", "packet_loss", "server_failure",
]

MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_models")


def _ensure_model_dir():
    os.makedirs(MODEL_DIR, exist_ok=True)


# ──────────────────────────────────────────────
# Synthetic Data Generation
# ──────────────────────────────────────────────

def generate_normal_samples(n: int = 3000) -> pd.DataFrame:
    """Generate samples representing healthy network behaviour."""
    rng = np.random.default_rng(42)
    data = {
        "latency": rng.normal(22, 5, n).clip(5, 40),
        "packet_loss": rng.exponential(0.5, n).clip(0, 3),
        "throughput": rng.normal(88, 7, n).clip(60, 100),
        "cpu_usage": rng.normal(35, 10, n).clip(10, 65),
        "memory_usage": rng.normal(40, 8, n).clip(15, 60),
        "jitter": rng.normal(2.5, 1, n).clip(0.2, 6),
        "error_rate": rng.exponential(0.1, n).clip(0, 1),
        "traffic_load": rng.normal(35, 10, n).clip(10, 60),
    }
    df = pd.DataFrame(data)
    df["label"] = "normal"
    return df


def generate_fault_samples(fault: str, n: int = 500) -> pd.DataFrame:
    """Generate samples representing a specific fault type."""
    rng = np.random.default_rng(hash(fault) % 2**31)
    base = generate_normal_samples(n).drop(columns=["label"])

    if fault == "link_failure":
        base["packet_loss"] = rng.uniform(20, 50, n)
        base["latency"] = rng.uniform(120, 300, n)
        base["throughput"] = rng.uniform(5, 30, n)
        base["error_rate"] = rng.uniform(5, 20, n)

    elif fault == "router_failure":
        base["packet_loss"] = rng.uniform(40, 100, n)
        base["latency"] = rng.uniform(200, 500, n)
        base["throughput"] = rng.uniform(0, 15, n)
        base["cpu_usage"] = rng.choice([0, rng.uniform(90, 100, 1)[0]], n)
        base["error_rate"] = rng.uniform(10, 50, n)

    elif fault == "congestion":
        base["cpu_usage"] = rng.uniform(80, 99, n)
        base["memory_usage"] = rng.uniform(75, 98, n)
        base["latency"] = rng.uniform(80, 220, n)
        base["packet_loss"] = rng.uniform(8, 30, n)
        base["throughput"] = rng.uniform(15, 40, n)
        base["traffic_load"] = rng.uniform(80, 100, n)

    elif fault == "high_latency":
        base["latency"] = rng.uniform(100, 300, n)
        base["jitter"] = rng.uniform(20, 70, n)
        base["throughput"] = rng.uniform(25, 55, n)

    elif fault == "packet_loss":
        base["packet_loss"] = rng.uniform(15, 45, n)
        base["error_rate"] = rng.uniform(3, 15, n)
        base["throughput"] = rng.uniform(30, 60, n)

    elif fault == "server_failure":
        base["packet_loss"] = rng.uniform(30, 100, n)
        base["latency"] = rng.uniform(150, 400, n)
        base["throughput"] = rng.uniform(0, 20, n)
        base["cpu_usage"] = rng.choice([0, rng.uniform(95, 100, 1)[0]], n)

    base["label"] = fault
    return base


def generate_full_dataset() -> pd.DataFrame:
    """Build the complete training dataset (normal + all faults)."""
    frames = [generate_normal_samples(4000)]
    for fault in FAULT_LABELS[1:]:  # Skip "normal"
        frames.append(generate_fault_samples(fault, 800))
    df = pd.concat(frames, ignore_index=True)
    return df.sample(frac=1, random_state=42).reset_index(drop=True)


# ──────────────────────────────────────────────
# Training
# ──────────────────────────────────────────────

def train_anomaly_detector(df: pd.DataFrame) -> IsolationForest:
    """
    Train an Isolation Forest on NORMAL data only.
    The model learns the distribution of healthy metrics and flags deviations.
    """
    normal_data = df[df["label"] == "normal"][FEATURES]
    model = IsolationForest(
        n_estimators=200,
        contamination=0.04,
        random_state=42,
        max_samples="auto",
    )
    model.fit(normal_data)
    return model


def train_fault_classifier(df: pd.DataFrame) -> RandomForestClassifier:
    """
    Train a Random Forest classifier to predict the fault type.
    """
    X = df[FEATURES]
    y = df["label"]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=16,
        random_state=42,
        class_weight="balanced",
    )
    model.fit(X_train, y_train)

    # Print evaluation metrics
    y_pred = model.predict(X_test)
    print("\n-- Fault Classifier Evaluation --")
    print(classification_report(y_test, y_pred))

    return model


def train_and_save():
    """Generate data, train both models, and persist them to disk."""
    _ensure_model_dir()

    print("Generating synthetic training data...")
    df = generate_full_dataset()

    # Save dataset
    dataset_path = os.path.join(MODEL_DIR, "training_data.csv")
    df.to_csv(dataset_path, index=False)
    print(f"Dataset saved -> {dataset_path}  ({len(df)} samples)")

    print("\nTraining Isolation Forest (anomaly detector)...")
    iso_model = train_anomaly_detector(df)
    iso_path = os.path.join(MODEL_DIR, "isolation_forest.pkl")
    joblib.dump(iso_model, iso_path)
    print(f"Isolation Forest saved -> {iso_path}")

    print("\nTraining Random Forest (fault classifier)...")
    rf_model = train_fault_classifier(df)
    rf_path = os.path.join(MODEL_DIR, "random_forest_classifier.pkl")
    joblib.dump(rf_model, rf_path)
    print(f"Random Forest saved -> {rf_path}")

    print("\n[OK] All models trained and saved successfully.")
    return iso_model, rf_model


# ──────────────────────────────────────────────
# Loading
# ──────────────────────────────────────────────

def load_models():
    """Load persisted models (trains from scratch if missing)."""
    iso_path = os.path.join(MODEL_DIR, "isolation_forest.pkl")
    rf_path = os.path.join(MODEL_DIR, "random_forest_classifier.pkl")

    if os.path.exists(iso_path) and os.path.exists(rf_path):
        iso_model = joblib.load(iso_path)
        rf_model = joblib.load(rf_path)
        return iso_model, rf_model
    else:
        print("Pre-trained models not found — training from scratch...")
        return train_and_save()


# ──────────────────────────────────────────────
# CLI entry-point
# ──────────────────────────────────────────────

if __name__ == "__main__":
    train_and_save()
