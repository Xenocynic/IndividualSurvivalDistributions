# ISD Project

A Django REST API project for managing users, datasets, predictors, and permissions with automatic API documentation.

## 🚀 Quick Start

1. **Clone and setup**
   ```bash
   cd isd
   python -m venv .venv
   source .venv/bin/activate  # On macOS/Linux
   pip install -r requirements.txt
   ```

2. **Run the application**
   ```bash
   python manage.py migrate
   python manage.py runserver
   ```

3. **Access the application**
   - **API Documentation**: http://127.0.0.1:8000/api/docs/
   - **Admin Interface**: http://127.0.0.1:8000/admin/
   - **API Root**: http://127.0.0.1:8000/api/

## 📁 Project Structure

The project follows a modular app-based architecture:

```
isd/
├── manage.py              # Django management script
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── authapp/              # Authentication & User management
│   ├── models.py         # Uses Django's built-in User + Groups for roles
│   ├── views.py          # Auth views + UserViewSet
│   ├── serializers.py    # User serializers with JWT support
│   ├── urls.py           # Auth routes (/api/auth/*)
│   └── admin.py          # Enhanced User admin
├── dataset/              # Dataset management
│   ├── models.py         # Dataset and DatasetPermission models
│   ├── views.py          # Dataset API views with documentation
│   ├── serializers.py    # Dataset serializers with help text
│   ├── urls.py           # Dataset routes (/api/dataset/*)
│   └── admin.py          # Dataset admin configuration
├── predictors/           # Predictor management
│   ├── models.py         # Predictor and PredictorPermission models
│   ├── views.py          # Predictor API views
│   ├── serializers.py    # Predictor serializers
│   ├── urls.py           # Predictor routes (/api/predictor/*)
│   └── admin.py          # Predictor admin configuration
├── core/                 # Shared utilities
│   ├── views.py          # Health check & API root views
│   ├── serializers.py    # Base serializer classes
│   └── urls.py           # Core routes (/api/)
└── isd/                  # Project settings
    ├── settings.py       # Django configuration with PostgreSQL
    └── urls.py           # Main URL configuration + API docs
```

## 📚 API Documentation

The API documentation is **automatically generated** from your code and available at:

- **Interactive Docs (Swagger)**: http://127.0.0.1:8000/api/docs/
- **Clean Docs (ReDoc)**: http://127.0.0.1:8000/api/redoc/
- **Raw Schema**: http://127.0.0.1:8000/api/schema/

## 🔗 API Endpoints

### **Core (`/api/`)**
- `GET /api/` - API overview and available endpoints
- `GET /api/health/` - Health check endpoint

### **Authentication (`/api/auth/`)**
- `POST /api/auth/register/` - Register new user (Django User)
- `POST /api/auth/login/` - Login and get JWT tokens
- `POST /api/auth/token/refresh/` - Refresh JWT access token
- `POST /api/auth/logout/` - Logout and blacklist refresh token
- `GET|POST|PUT|DELETE /api/auth/users/` - User management (CRUD)

### **Datasets (`/api/dataset/`)**
- `GET|POST /api/dataset/` - List/Create datasets
- `GET|PUT|PATCH|DELETE /api/dataset/{id}/` - Dataset operations
- `GET|POST /api/dataset/permissions/` - Manage dataset access permissions
- `GET|PUT|PATCH|DELETE /api/dataset/permissions/{id}/` - Permission operations

### **Predictors (`/api/predictor/`)**
- `GET|POST /api/predictor/` - List/Create ML predictors
- `GET|PUT|PATCH|DELETE /api/predictor/{id}/` - Predictor operations
- `GET|POST /api/predictor/permissions/` - Manage predictor access permissions
- `GET|PUT|PATCH|DELETE /api/predictor/permissions/{id}/` - Permission operations

### **Admin Interface**
- `GET /admin/` - Django admin interface for data management

## 🗄️ Database Schema

### **Authentication System**
- **Django User** - Built-in user model with username, email, password
- **Django Groups** - Used for role-based access (e.g., "data_scientist", "admin")
- **JWT Tokens** - Access and refresh tokens for API authentication

### **Core Models**
- **Dataset** - Dataset information with name and owner
- **Predictor** - ML predictors linked to datasets and owners
- **DatasetPermission** - Controls which users can access specific datasets
- **PredictorPermission** - Controls which users can access specific predictors

### **Relationships**
```
User (Django) ──┬── owns ──→ Dataset ──┬── contains ──→ Predictor
                │                      │
                └── has access ──→ DatasetPermission
                │
                └── has access ──→ PredictorPermission
```

- Users can own multiple datasets and predictors
- Predictors belong to one dataset and one owner
- Permission models enable sharing datasets/predictors with other users
- Roles are managed through Django Groups

## 🛠️ Development Setup

### **Prerequisites**
- Python 3.8+ (currently using 3.11)
- pip (Python package installer)
- PostgreSQL database (Supabase configured)

### **Installation Steps**

1. **Clone and navigate to project**
   ```bash
   git clone <repository-url>
   cd isd
   ```

2. **Create virtual environment**
   ```bash
   python -m venv .venv
   
   # Activate (macOS/Linux)
   source .venv/bin/activate
   
   # Activate (Windows)
   .venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Database setup**
   ```bash
   # Apply migrations
   python manage.py migrate
   
   # Create admin user (optional)
   python manage.py createsuperuser
   ```

5. **Start development server**
   ```bash
   python manage.py runserver
   ```

### **Access Points**
- **API Documentation**: http://127.0.0.1:8000/api/docs/
- **API Root**: http://127.0.0.1:8000/api/
- **Admin Panel**: http://127.0.0.1:8000/admin/
- **Health Check**: http://127.0.0.1:8000/api/health/

## 🔄 Development Workflow

### **Making Model Changes**
```bash
# 1. Modify models in any app (authapp, dataset, predictors)
# 2. Create migration files
python manage.py makemigrations

# 3. Apply migrations to database
python manage.py migrate

# 4. Verify everything works
python manage.py check
```

### **Adding New Features**
1. **Models**: Add/modify in appropriate app's `models.py`
2. **Serializers**: Update serializers with new fields and validation
3. **Views**: Add business logic and API endpoints
4. **URLs**: Register new endpoints in app's `urls.py`
5. **Documentation**: Add descriptions using `@extend_schema` decorators

### **Testing Your Changes**
```bash
# Run development server
python manage.py runserver

# Check API documentation
open http://127.0.0.1:8000/api/docs/

# Test endpoints interactively in Swagger UI
# Or use curl/Postman with the documented endpoints
```