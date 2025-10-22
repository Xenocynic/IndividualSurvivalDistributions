from celery import shared_task
from django.core.files import File
from .models import Predictor
from django.contrib.auth.models import User
from dataset.models import Dataset
import time

@shared_task
def train_predictor_task(dataset_id, owner_id, name, description, settings=None, features=None):
    """Train a new predictor asynchronously and create a Predictor object."""
    settings = settings or {}
    features = features or []

    try:
        dataset = Dataset.objects.get(id=dataset_id)
        owner = User.objects.get(id=owner_id)
    except (Dataset.DoesNotExist, User.DoesNotExist):
        return {"status": "failed", "reason": "Invalid dataset or owner"}

    # --- Simulate heavy model training ---
    time.sleep(5)  # Placeholder for real model training

    accuracy = 0.90  # Placeholder for actual computed metric

    # --- Create Predictor object ---
    predictor = Predictor.objects.create(
        name=name,
        description=description,
        dataset=dataset,
        owner=owner,
        metrics={"accuracy": accuracy},
        is_private=settings.get("is_private", False)
    )

    model_name = f"predictor_{predictor.predictor_id}_trained.pkl"
    output_path = f"/tmp/{model_name}"

    with open(output_path, "wb") as f:
        f.write(b"dummy trained model data")

    # --- Step 3: Attach model artifact ---
    with open(output_path, "rb") as f:
        predictor.model_artifact.save(model_name, File(f))

    predictor.save()

    # TODO: store 'features' somewhere if your schema supports it

    return {
        "status": "completed",
        "predictor_id": predictor.predictor_id,
        "name": predictor.name,
        "action": "created",
        "accuracy": accuracy,
    }


@shared_task
def retrain_predictor_task(predictor_id, settings, features, replace=False):
    """Run retraining asynchronously and create or replace predictor."""
    try:
        predictor = Predictor.objects.get(id=predictor_id)
    except Predictor.DoesNotExist:
        return {"status": "failed", "reason": "Predictor not found"}

    # --- Simulate heavy model training ---
    time.sleep(5)  # placeholder for actual training logic

    # --- Generate a dummy model file ---
    output_path = f"/tmp/model_{predictor_id}.pkl"
    with open(output_path, "wb") as f:
        f.write(b"dummy trained model data")
    accuracy = 0.92  # placeholder for training metric
    model_name = f"predictor_{predictor_id}_trained.pkl"

    # --- Replace original predictor ---
    if replace:
        predictor.model_artifact.save(model_name, File(open(output_path, "rb")))
        predictor.metrics = {"accuracy": accuracy}

        # Update advanced fields from settings JSON if provided
        advanced_fields = [
            "time_unit", "num_time_points", "regularization", "objective_function",
            "marginal_loss_type", "cox_feature_selection", "mrmr_feature_selection",
            "mtlr_predictor", "standardize_features", "run_cross_validation",
            "tune_parameters", "use_smoothed_log_likelihood", "use_predefined_folds",
            "allow_admin_access"
        ]
        for field in advanced_fields:
            if field in settings:
                setattr(predictor, field, settings[field])

        predictor.save()
        return {"status": "completed", "predictor_id": predictor.id, "action": "replaced"}

    # --- Otherwise, create a new predictor based on original ---
    predictor_fields = {
        "name": f"{predictor.name} (Re-trained)",
        "owner": predictor.owner,
        "dataset": predictor.dataset,
        "metrics": {"accuracy": accuracy},
        "base_predictor": predictor,
    }

    # Map advanced fields
    for field in advanced_fields:
        predictor_fields[field] = settings.get(field, getattr(predictor, field))

    new_predictor = Predictor.objects.create(**predictor_fields)

    # Save the model file
    new_predictor.model_artifact.save(model_name, File(open(output_path, "rb")))
    new_predictor.save()

    # TODO: Store features somewhere if your schema supports it

    return {"status": "completed", "predictor_id": new_predictor.id, "action": "created"}
