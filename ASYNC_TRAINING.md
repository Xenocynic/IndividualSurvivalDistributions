# Async Training with Progress Tracking

This document explains the asynchronous training implementation with real-time progress tracking.

## Overview

The predictor training system supports two modes of progress tracking:

1. **Log-based tracking** (accurate): Parses ML API logs in real-time for actual progress
2. **Time-based estimation** (fallback): Estimates progress based on elapsed time when logs are unavailable

## How It Works

### Backend (Django)

When a user creates a predictor:

1. **Predictor Creation** ([PredictorCreate.tsx](frontend/src/pages/PredictorCreate.tsx)):
   - Creates the predictor in the database immediately
   - Starts async training in a background thread
   - Returns control to the user (non-blocking)

2. **Async Training** ([training_tasks.py](isd/predictors/training_tasks.py)):
   - Records the current log file size at training start
   - Calls ML API in a background thread (non-blocking)
   - Updates predictor's `ml_training_progress` field every second
   - Only reads **new** log entries added after training started (prevents reading old progress)

3. **Progress Tracking Algorithm**:
   - **Log-based** (preferred):
     - Tracks file position in `.logs/ml_api.log`
     - Reads only new lines appended since training started
     - Parses trange experiment progress (e.g., "Experiment: 30% | 3/10")
     - Immune to old log entries from previous runs
   - **Estimation** (fallback):
     - Uses elapsed time with 4.0 seconds/experiment estimate
     - Only used if log file is unavailable

### Frontend (React)

The UI polls the training status endpoint every second:

- Displays progress bar (0-100%)
- Shows current fold (experiment) number (e.g., "Fold 3/10")
- Shows elapsed time
- Auto-redirects to predictor page when complete

## Configuration

### Enabling Log-Based Tracking

For accurate progress tracking, ensure:

1. ML API logs are written to:
   ```
   /home/ubuntu/f25project-DeptofComputingScience/.logs/ml_api.log  (primary)
   ```

2. The Django backend has read access to the log file

3. The ML API outputs trange progress bars (typically enabled by default)

### Log Format

The system parses trange output like:
```
Experiment:  30%|███       | 3/10 [00:15<00:35,  4.03s/it]
Experiment:  90%|█████████ | 9/10 [00:39<00:04,  4.03s/it]
Experiment: 100%|██████████| 10/10 [00:43<00:00,  4.33s/it]
```

Key parts:
- `3/10` = current experiment / total experiments
- Experiments correspond to cross-validation folds
- Progress is extracted via regex: `Experiment:.*?\|\s*(\d+)/(\d+)\s*\[`

## API Endpoints

### Start Async Training
```http
POST /api/datasets/{dataset_id}/ml/train-async/
Content-Type: application/json

{
  "predictor_id": 123,
  "parameters": {
    "n_epochs": 100,
    "dropout": 0.2,
    "neurons": [64, 64],
    "n_exp": 10
  }
}
```

**Response:**
```json
{
  "message": "Training started",
  "predictor_id": 123,
  "dataset_id": 456,
  "status": "training"
}
```

### Get Training Status
```http
GET /api/predictors/{predictor_id}/training-status/
```

**Response during training:**
```json
{
  "status": "training",
  "progress": {
    "current_experiment": 3,
    "total_experiments": 10,
    "status": "training",
    "message": "Training model (fold 3/10)...",
    "estimated_progress": 20,
    "elapsed_seconds": 15,
    "progress_source": "log"
  },
  "error": null,
  "model_id": null,
  "metrics": null,
  "trained_at": null
}
```

**Response when complete:**
```json
{
  "status": "trained",
  "progress": {
    "current_experiment": 10,
    "total_experiments": 10,
    "status": "completed",
    "message": "Training completed successfully!",
    "estimated_progress": 100,
    "elapsed_seconds": 43,
    "progress_source": "completed"
  },
  "error": null,
  "model_id": "mtlr_20251121_184840_5ecb62",
  "metrics": {
    "C-index": 0.72,
    "IBS": 0.15
  },
  "trained_at": "2025-11-21T18:49:23Z"
}
```

## Database Schema

### New Fields in `Predictor` Model

```python
ml_training_progress = JSONField(null=True, blank=True)
# Structure:
# {
#   "current_experiment": 3,
#   "total_experiments": 10,
#   "status": "training",  # or "preparing", "completed", "failed"
#   "message": "Training model (fold 3/10)...",
#   "estimated_progress": 20,  # percentage (0-100)
#   "elapsed_seconds": 15,
#   "progress_source": "log"  # or "estimated", "initializing", "completed"
# }

ml_training_error = TextField(null=True, blank=True)
# Stores error message if training fails
```

## Implementation Details

### File Position Tracking

The key innovation preventing "progress jumps to 90%" issues:

1. **Training Start**: Record current log file size
   ```python
   log_file_position = os.path.getsize(ml_log_path)
   ```

2. **Progress Loop**: Only read new bytes
   ```python
   f.seek(log_file_position)  # Start from last position
   new_lines = f.read()       # Read only new content
   log_file_position = f.tell()  # Update position
   ```

3. **Parse New Lines**: Extract experiment progress
   ```python
   pattern = r'Experiment:.*?\|\s*(\d+)/(\d+)\s*\['
   matches = re.finditer(pattern, new_lines)
   ```

This ensures we never read old log entries from previous training runs.

### Progress States

| State | `progress_source` | Description |
|-------|-------------------|-------------|
| Initializing | `"initializing"` | Predictor created, training not started yet (0%) |
| Training (log-based) | `"log"` | Reading actual progress from ML API logs |
| Training (estimated) | `"estimated"` | No logs available, using time-based estimate |
| Completed | `"completed"` | Training finished successfully (100%) |
| Failed | `"failed"` | Training encountered an error |

## Testing

### Test the Implementation

1. **Create a predictor via the UI**:
   - Go to predictor creation page
   - Fill in details and select a dataset
   - Click "Train and Save"

2. **Monitor progress**:
   - Progress bar should start at 0%
   - Updates every 1 second
   - Shows "Fold X of 10" during training
   - Should NOT jump to high percentages immediately

3. **Check Django logs**:
   ```bash
   tail -f /home/ubuntu/f25project-DeptofComputingScience/.logs/django.log
   ```
   Look for:
   ```
   INFO: Using log-based progress tracking from: /path/to/.logs/ml_api.log (starting at position 12345)
   INFO: Training completed successfully for predictor 123
   ```

4. **Verify ML API logs**:
   ```bash
   tail -f /home/ubuntu/f25project-DeptofComputingScience/.logs/ml_api.log
   ```
   Should show trange progress bars during training

### Manual Testing

```python
from isd.predictors.training_tasks import _parse_experiment_progress

# Test parsing
log_path = '/home/ubuntu/f25project-DeptofComputingScience/.logs/ml_api.log'
file_position = 0

# Simulate reading new progress
current, total, new_pos = _parse_experiment_progress(log_path, file_position)
print(f"Experiment {current}/{total}, new position: {new_pos}")
```

## Troubleshooting

### Progress starts at 90% immediately

**Fixed in current implementation!** The file position tracking ensures we only read new log entries.

If you still see this:
- Check that training_tasks.py uses the updated implementation
- Verify `log_file_position = os.path.getsize(ml_log_path)` is called at start

### Progress seems slow or stuck

**If using log-based tracking**:
- Verify ML API is actually training (check CPU usage)
- Check that trange progress bars are being written to logs
- Ensure log file has proper read permissions

**If using estimation**:
- Normal - estimation is approximate
- Default rate: 4 seconds/experiment
- Progress will sync when training completes

### Training completes but progress stuck

- Check Django logs for errors
- Backend thread may have crashed
- Model should still be saved correctly
- Try refreshing the page

### No progress updates at all

1. Check predictor `ml_training_status` field in database:
   ```python
   predictor = Predictor.objects.get(predictor_id=123)
   print(predictor.ml_training_status)  # Should be "training"
   print(predictor.ml_training_progress)
   ```

2. Verify background thread is running:
   ```bash
   ps aux | grep python
   ```

3. Check for errors in Django logs

### Log file not found

If you see:
```
INFO: Log file not found, using time-based estimation
```

Check that:
- ML API is running and logging to `.logs/ml_api.log`
- File path in `log_parser.py` matches actual location
- Django has read permissions on the log file

## Performance Notes

- **Polling interval**: 1 second (frontend and backend)
- **Log parsing overhead**: Minimal (~1ms per read)
- **File I/O**: Only reads new bytes (efficient for large logs)
- **Database updates**: Once per second per training job
- **Memory usage**: Negligible (only reads last chunk of logs)

## Future Improvements

1. **WebSocket streaming**: Real-time push instead of polling
2. **Epoch-level progress**: Track individual epochs within each fold
3. **ETA calculation**: Estimate time remaining based on actual fold timing
4. **Redis caching**: Store progress in Redis for multi-server deployments
5. **Progress history**: Track and display progress curve over time
6. **Cancellation support**: Allow users to cancel running training jobs
