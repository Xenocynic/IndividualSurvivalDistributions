from celery import shared_task
from django.core.files import File
from .models import Predictor
import time
import os

@shared_task
def retrain_predictor_task(predictor_id, settings, features, replace=False):
    """Run retraining asynchronously."""
    try:
        predictor = Predictor.objects.get(id=predictor_id)
    except Predictor.DoesNotExist:
        return {"status": "failed", "reason": "Predictor not found"}

    # Simulate heavy model training
    time.sleep(5)  # placeholder for long training process

    # Example: generate a dummy model file
    output_path = f"/tmp/model_{predictor_id}.pkl"
    with open(output_path, "wb") as f:
        f.write(b"dummy trained model data")

    accuracy = 0.92  # pretend we computed this
    model_name = f"predictor_{predictor_id}_trained.pkl"

    # Save or create new predictor
    if replace:
        predictor.model_artifact.save(model_name, File(open(output_path, "rb")))
        predictor.metrics = {"accuracy": accuracy}
        predictor.save()
        return {"status": "completed", "predictor_id": predictor.id, "action": "replaced"}

    # Otherwise, create new predictor
    new_predictor = Predictor.objects.create(
        name=f"{predictor.name} (Re-trained)",
        owner=predictor.owner,
        dataset=predictor.dataset,
        settings=settings,
        features=features,
        metrics={"accuracy": accuracy},
        base_predictor=predictor
    )
    new_predictor.model_artifact.save(model_name, File(open(output_path, "rb")))
    new_predictor.save()

    return {"status": "completed", "predictor_id": new_predictor.id, "action": "created"}
