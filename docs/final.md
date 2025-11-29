# **Project Management**

## Deployment Instructions 

<br><br><br>

## User Manual

This user manual is designed for clinicians, medical researchers, engineers, analysts, and other professionals who work with spreadsheets but may not have programming experience. The goal is to provide clear, task-oriented steps to help you upload survival datasets, build predictive models, and generate Individual Survival Distributions (ISDs) using the EZ Survival Prediction platform.

If you need assistance beyond what is covered here, contact the system administrators or refer to the support section.

---

### 1. Getting Started

#### 1.1 Creating an Account
To begin using the system, you must create a user account.

**How to Sign Up?**

1. Open the website in your browser.  
2. Select the **Sign Up** option.  
3. Enter your name, email address, and a password.  
4. Submit the form.  
5. Log in using the credentials you just created.

If you require higher-level access (such as superuser or admin privileges), please contact the system administrators.

#### 1.2 Logging In and Resetting Your Password
If you already have an account:

**How to log in?**

1. Open the website.  
2. Select **Log In** and enter your username and password.  

**Oops! I forgot my password.**

1. Select **Forgot Password?**  
2. Enter your registered email address.  
3. Check your inbox for a reset link.  
4. Choose a new password and log in again.

#### 1.3 Updating Your Account Information
You can change your name, email, or password while logged in.

**How to update personal details?**

1. Navigate to your **Settings** page.  
2. Update any field you wish to change.  
3. Save your changes before leaving the page.

---

### 2. Managing Data

EZ Survival Prediction is built around survival datasets that you upload. The system supports spreadsheets in CSV format and is designed for users familiar with typical spreadsheet tools.

#### 2.1 Preparing Your Dataset
Before uploading, ensure your dataset includes:
- A survival time column  
- An event indicator (e.g., 0 for censored, 1 for event)  
- Predictor features (age, treatment type, lab results, etc.)  

Avoid missing values. They may prevent the model from training properly.

#### 2.2 Uploading a Dataset

**How to add data to the system?**

1. Go to the **Datasets** section.  
2. Select the option to **Create a New Dataset**.  
3. Provide a name and (optionally) a description.  
4. Choose the correct time unit (e.g., years, months).  
5. Select your CSV file.  
6. Choose who can view the dataset:<br>
   - **Private:** only you and users you grant access to  
   - **Public:** all users  
7. Save the dataset.

Once uploaded, the dataset becomes available for training predictors.

#### 2.3 Organizing Data with Folders
You can group datasets into folders to keep large projects organized.

**How to use the Folder System?**

1. Create a new folder if needed.  
2. Drag datasets into the folder or assign them when creating or editing.  

Folders do not affect the behavior of datasets. They simply help you stay organized.

---

### 3. Building Predictive Models

The system allows you to create **predictors**, which are machine-learning models trained on your datasets.

#### 3.1 Creating a New Predictor

**How to create a predictor?**

1. Navigate to the **Predictors** section.  
2. Select **Create Predictor**.  
3. Enter a name and optional notes.  
4. Choose which dataset the predictor will use.  
5. Choose whether the predictor should be public or private.  

At this point, you may train the model or save your work as a draft for later.

#### 3.2 Saving a Predictor as a Draft
A draft predictor allows you to set up model configuration without training it immediately.

**How to save a draft?**

1. Begin creating a predictor.  
2. Instead of training, click **Back** and then choose the option to **Save as Draft**.  
3. Return to drafts later to complete training or edit the details or dataset selected.

Drafts are always private until they have been trained.

#### 3.3 Training a Predictor
Training builds the model using the dataset and selected parameters.

**How to train a predictor?**

1. Choose **Train & Save** while creating a predictor, **or** open a draft predictor and select **Train**.  
2. Adjust training settings if required (e.g., which features to include).  
3. Start the training process.  

The platform currently supports the **MTLR (Multi-Task Logistic Regression)** survival model. Administrators may add more model types later.

After training completes, the predictor becomes fully usable.

#### 3.4 Retraining an Existing Predictor
You can improve or update a predictor by retraining it.

**How to retrain a predictor?**

1. Open the predictor you wish to retrain.  
2. Update any settings or parameters.  
3. Start retraining.  
4. Choose whether to replace the existing predictor or save the retrained version as a new one.

You may not change the dataset while retraining, only the paginated features.

---

### 4. Making Predictions

Predictors allow you to generate **Individual Survival Distributions (ISDs)** for new individuals.

#### 4.1 Performing Survival Analysis Predictions
1. You may now use your trained model on labelled and unlabelled datasets to perform survival analysis predictions.
2. The results will be saved for further research. 

#### 4.2 Viewing Predictor Details
Every predictor includes:<br>
- Dataset summary  
- Feature correlations  
- Event time and survival histograms  
- Cross-validation metrics  
- Training configurations  

Review these details to understand model performance.

#### 4.3 Searching and Filtering Predictors
If you work with many predictors or datasets, use:<br>
- The search bar to find items by name  
- Filters to view items you own or items shared with you  

These tools make it easier to manage large research projects.

---

### 5. Help and Support

#### 5.1 Troubleshooting Common Issues

**Dataset upload fails**  
- Check for missing values or unsupported formats.  
- Ensure all required columns exist.

**Predictor training fails**  
- Verify that your dataset contains only valid numeric values.  
- Try simplifying the model configuration.  
- The ML service may be temporarily unavailable. Please try again later.

**Prediction fails**  
- Ensure all required feature fields are filled in properly.

#### 5.2 Glossary of Key Terms

**ISD (Individual Survival Distribution):**  
A probability curve showing the likelihood of survival over time for a specific individual.

**Censored Data:**  
Data where the complete survival time is unknown. Common when patients are lost to follow-up.

**Uncensored Data:**  
Data where the full survival time is observed.

**Kaplan–Meier Curve:**  
A statistical method used to estimate survival probability from observed data.<br><br><br>

## Job description

### Full-Stack Developer — EZ Survival Prediction Platform

**Position:** Full-Stack Developer  
**Project:** EZ Survival Prediction / ISD Web Application  
**Type:** Full-time or Part-time Contract  
**Location:** Remote or On-site  

---

#### Overview

EZ Survival Prediction is a modern, full-stack platform that enables researchers and professionals to upload survival datasets, train machine-learning survival models, evaluate results, and generate Individual Survival Distributions (ISDs).

The system replaces the older PSSP site and consists of:

- A **React / TypeScript / Vite** frontend  
- A **Django REST Framework** backend  
- A **Python / Flask** machine-learning microservice  

We are seeking a developer to support, maintain, and extend this system after its initial release. The ideal candidate is comfortable working across the stack, deploying applications, and communicating with non-technical stakeholders.

---

#### Responsibilities

- Deploy, configure, and maintain the full system (frontend, backend, ML service) on Linux servers or cloud environments.  
- Monitor system health, troubleshoot issues, and resolve bugs to ensure stability.  
- Manage datasets, models, user permissions, authentication flows, and backend components.  
- Implement new features, model types, and UI improvements based on client and research needs.  
- Improve usability and accessibility for non-technical users.  
- Collaborate with machine-learning researchers to integrate new survival analysis tools or datasets.  
- Maintain security practices, including handling private datasets, JWT authentication, and CORS settings.  
- Update technical documentation and contribute to long-term maintainability.

---

#### Required Skills

- Strong proficiency in **Python**, including **Django** and **Django REST Framework**.  
- Experience with **React**, **TypeScript**, **Vite**, and component-based frontend development.  
- Knowledge of relational databases (PostgreSQL preferred).  
- Experience building and consuming REST APIs.  
- Understanding of **JWT authentication** and modern web security.  
- Ability to deploy applications using:
  - Linux servers  
  - Nginx / Gunicorn / Uvicorn  
  - Docker (preferred but not required)  
- Familiarity with machine-learning workflows; survival analysis experience is an asset.  
- Experience with Python ML libraries (pandas, NumPy, scikit-learn; PyTorch optional).

---

#### Nice-to-Have Skills

- Knowledge of survival analysis models (MTLR, Cox, DeepSurv).  
- Experience designing or maintaining microservices.  
- CI/CD experience using **GitHub Actions**.  
- Testing experience (pytest, Selenium, Django tests).  
- UI/UX experience, especially for research-focused tools.

---

#### Personal Qualities

- Strong communication skills when working with non-technical users.  
- Ability to work independently, prioritize tasks, and explain technical decisions clearly.  
- Organized, reliable, and committed to long-term system stability.
