# ISD Project

A Django REST API project for managing users, datasets, predictors, and permissions.

## Getting Started

### Prerequisites

- Python 3.8 or higher
- pip (Python package installer)

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv .venv
   ```

3. **Activate the virtual environment**
   
   On macOS/Linux:
   ```bash
   source .venv/bin/activate
   ```
   
   On Windows:
   ```bash
   .venv\Scripts\activate
   ```

4. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

5. **Run initial migrations**
   ```bash
   python manage.py migrate
   ```

6. **Create a superuser (optional)**
   ```bash
   python manage.py createsuperuser
   ```

7. **Start the development server**
   ```bash
   python manage.py runserver
   ```

The API will be available at `http://127.0.0.1:8000/`

## API Endpoints

- **Users**: `/api/users/`
- **Datasets**: `/api/datasets/`
- **Predictors**: `/api/predictors/`
- **Dataset Permissions**: `/api/dataset-permissions/`
- **Predictor Permissions**: `/api/predictor-permissions/`
- **Admin Interface**: `/admin/`

## Database Schema

### Models

- **User**: Manages user accounts with roles
- **Dataset**: Stores dataset information with ownership
- **Predictor**: Machine learning predictors linked to datasets
- **DatasetPermission**: Controls user access to datasets
- **PredictorPermission**: Controls user access to predictors

### Relationships

- Users can own multiple datasets and predictors
- Predictors belong to one dataset and one owner
- Permission models enable sharing datasets/predictors with other users

## Making Model Changes

When you modify the models in `core/models.py`, follow these steps:

### 1. Create Migration Files

After making changes to your models, generate migration files:

```bash
python manage.py makemigrations
```

This creates migration files in `core/migrations/` that describe the changes.

### 2. Review Migration Files (Optional)

Check the generated migration file to ensure it captures your intended changes:

```bash
python manage.py showmigrations
```

### 3. Apply Migrations

Apply the migrations to update your database schema:

```bash
python manage.py migrate
```

### 4. Verify Changes

Check that your changes were applied correctly:

```bash
python manage.py check
```

### Common Migration Scenarios

#### Adding a new field
```python
# In models.py
class User(models.Model):
    # existing fields...
    created_at = models.DateTimeField(auto_now_add=True)  # new field
```

Then run:
```bash
python manage.py makemigrations
python manage.py migrate
```

#### Renaming a field
```python
# In models.py - rename user_name to username
class User(models.Model):
    username = models.CharField(max_length=150, unique=True)  # renamed field
```

Django will prompt you about the rename during `makemigrations`.

#### Removing a field
Simply delete the field from your model and run the migration commands.

### Migration Best Practices

1. **Always backup your database** before running migrations in production
2. **Test migrations** on a copy of your data first
3. **Review migration files** before applying them
4. **Never edit migration files manually** unless you know what you're doing
5. **Commit migration files** to version control along with model changes

### Troubleshooting Migrations

If you encounter migration issues:

1. **Check migration status**:
   ```bash
   python manage.py showmigrations
   ```

2. **Reset migrations** (development only - will lose data):
   ```bash
   # Remove migration files (keep __init__.py)
   rm core/migrations/0*.py
   
   # Create fresh migrations
   python manage.py makemigrations
   python manage.py migrate
   ```

3. **Fake migrations** (if schema already matches):
   ```bash
   python manage.py migrate --fake
   ```

## Development Workflow

1. Make changes to models
2. Create migrations: `python manage.py makemigrations`
3. Apply migrations: `python manage.py migrate`
4. Test your changes: `python manage.py runserver`
5. Commit both model changes and migration files

## Testing

Run the Django development server to test your API:

```bash
python manage.py runserver
```

Visit the admin interface at `http://127.0.0.1:8000/admin/` to manage data through the web interface.

## Project Structure

```
isd/
├── core/                   # Main app
│   ├── migrations/         # Database migrations
│   ├── models.py          # Database models
│   ├── views.py           # API views
│   ├── serializers.py     # API serializers
│   ├── urls.py            # App URLs
│   └── admin.py           # Admin configuration
├── isd/                   # Project settings
│   ├── settings.py        # Django settings
│   └── urls.py            # Main URL configuration
├── manage.py              # Django management script
└── requirements.txt       # Python dependencies
```