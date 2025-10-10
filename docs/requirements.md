# Project Requirements

## Executive Summary

EZ Survival Prediction is best described as a brownfield project with large patches of green. To be precise, it is based on the existing PSSP site. The current website is 7–8 years old, slow, and difficult to navigate, and the existing tools for learning and evaluating ISD models are slow, cumbersome and lack extensive features. 

Our product will let machine learning researchers and other practitioners in the relevant fields upload survival datasets, train survival models with adjustable parameters using various learning tools, evaluate the models using various metrics and run predictions on new unlabeled instances, and obtain Individual Survival Distributions (ISDs) for new instances. The system will also allow the secure storage, search, and evaluation of datasets and models. 

Users will be able to:

* Upload a survival dataset (spreadsheet format) and train a survival model with adjustable parameters.

* View cross-validation and other evaluation metrics for the learned model.

* Run the trained model on new, unlabeled instances to obtain ISD predictions (time-probability distributions).

Our target users include medical researchers and clinicians, engineers, finance managers, and insurance agents who are familiar with spreadsheets but not with programming.

The system is web-based, initially running in a browser (focus on Chrome). If time permits, it may also be packaged as an Excel/G-Sheet/SPSS add-on.


## Project Glossary

* **ISD** - Individual Survival Distributions 

* **User** - A non-logged-in user. Can view public datasets.

* **LIU** - A logged-in user. Can view all public datasets, and any private datasets they are permitted to view. Can also upload new datasets and train models.

* **Superuser** - Admin with permission to view high-level statistics across all datasets/models (public and private). 

* **Uncensored Data** - Survival time that fully captures the patient’s entire lifespan (i.e., complete data).

* **Censored Data** - Incomplete survival time information, representing only a lower bound of a patient’s lifespan. Prevalent across datasets and an issue addressed by the client's research.

* **KM Curve (Kaplan-Meier)** - A standard survival function estimate used for comparisons.


## User Stories

User stories must be prioritized using the MoSCoW method.

### 1. User Access 

#### US 1.1 - User Logging in / Out
> SP: 3

> As a user, I want to log in and log out with an account, so that I can save my datasets and predictions. 

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is on the Login page, when they enter their correct credentials and click "Log In," then they are successfully authenticated and redirected to their main dashboard.<br>

2. Given a user is on the account creation page, when they enter a password that does not meet the security requirements (e.g., too short), then an error message outlining the requirements is displayed.<br>

3. Given a user is logged in, when they click the "Logout" button in their profile menu, then they are successfully logged out and redirected to the landing page.<br>



</details><br> 

>> #### US 1.1.1 - Change Password
>> SP: 1

>>> As a user, I want to be able to change my password, so that I can keep my account secure.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a logged-in user navigates to their "Profile Settings" page, when they click on the "Change Password" option, then they are presented with fields for "Current Password," "New Password," and "Confirm New Password."<br>

2. Given the user enters their correct current password and a valid new password in both fields, when they click "Save Changes," then they receive a "Password successfully changed" confirmation message.<br>

3. Given the user enters a new password that is identical to their old one, when they try to save, then an error message "New password cannot be the same as the old password" is displayed.<br>

4. Given the user enters a new password that does not meet the security requirements (e.g., too short, no number), when they try to save, then a specific error message is displayed (e.g., "Password must be at least 8 characters and contain one number").<br>

</details><br> 

#### US 1.2 - Superuser / Admin Logging In / Out
> SP: 1

> As a Superuser/Admin, I want to log in and log out using my UAlberta credentials, so that I can view others' datasets and predictions. 

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user with Superuser privileges is on the login page, when they sign in with their authorized UAlberta Google Account, then the system validates their Admin status in the database.<br>

2. Given the user's Admin status is validated, when they are redirected to the dashboard, then a permanent "Admin Panel" link is visible in the main navigation bar.<br>

3. Given a non-Admin user logs in, then the "Admin Panel" link is not visible.<br>

4. Given an Admin is on the "Admin Panel," when they click on a user's name, then they can view a list of all datasets and predictors owned by that user.<br>

</details><br> 

#### US 1.3 - Logged-In User Dashboard
> SP: 3

> As a user, I want to be able to see all of my created predictors and folders, so that I can edit or use them.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user successfully logs in, then they are automatically navigated to their Dashboard page.<br>

2. Given a user who is not logged in attempts to access the dashboard URL directly, then they are redirected to the Login page.<br>

3. Given a user is on their Dashboard, then they can see a clear, organized list of all the predictors and folders they have created.<br>

4. Given the user is on their Dashboard, when they click the "Create New Predictor" button, then they are navigated to the predictor creation page.<br>

</details><br> 

>> #### US 1.3.1 - Upload a Dataset
>> SP: 3

>>> As a user, I want to upload a dataset and verify it is formatted correctly, so that I can avoid errors in model training. 

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a logged-in user is on the "Create New Predictor" page, when they click the "Upload Dataset" button, then a file selection dialog appears.<br>

2. Given the user selects a correctly formatted .csv file, when they submit the file, then they receive a "Validation Successful" message and the dataset name appears in the form.<br>

3. Given the user selects a file that is not a .csv file (e.g., .txt, .xlsx), when they attempt to upload it, then the system displays an error message stating "Invalid file type. Please upload a .csv file."<br>

4. Given the user selects a .csv file with incorrect formatting (e.g., missing required columns), when they submit the file, then the system displays a specific error message detailing the issues found (e.g., "Error in row 15: Column 'Time' contains non-numeric data.").<br>

</details><br> 

>> #### US 1.3.3 - Predictor Privacy & Sharing
>>> SP: 2

>>> As a user, I want to be able to make a dataset / predictor private or public and share it, so that I can control its access.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is creating or editing a predictor, then they can see a privacy option (e.g., a toggle for "Public" or "Private").<br>

2. Given a user is not logged in, when they visit the "Predictors" page, then they can only see predictors that have been set to "Public".<br>

3. Given a logged-in user visits the "Predictors" page, then they see all public predictors and any private predictors they have been granted access to.<br>

4. Given a user is editing a private predictor, when they enter another user's valid email into the "Share with" field and click "Add," then that user is added to the list of authorized viewers.<br>

</details><br> 

>>> #### US 1.3.3.2 - (Optional) - Manage User Permissions on Private Predictor
>>>> SP: 5

>>>> As a user, I want to be able to decide which users can view my private predictor, so that I can let them use it too.

<details>
<summary>Acceptance Tests</summary><br> 

1. User can add accounts to share datasets / predictors with while creating or editing them<br>

</details><br> 

>> #### US 1.3.4 - Create a Predictor
>>> SP: 3

>>> As a user, I want to be able to create a predictor using a dataset, so that I can save it and view its predictions.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user has successfully uploaded a valid dataset, when they fill in the required fields (Name, Description) and click "Create Predictor," then the predictor is created, and they are redirected to the predictor's main page.<br>

2. Given the user tries to create a predictor without filling in the "Name" field, when they click the create button, then an error message "Predictor Name is required" is displayed, and creation fails.<br>

3. Given the user enters a name that is identical to another predictor they already own, when they click the create button, then an error message "A predictor with this name already exists" is displayed.<br>

</details><br> 

>> #### US 1.3.5 - Edit a Predictor
>>> SP: 3

>>> As a user, I want to be able to edit the details of my predictor, so that I can make it better.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is on their Dashboard, when they click the "Edit" button for a predictor they own, then they are navigated to the predictor's settings page.<br>

2. Given a user is on another user's public predictor page, then the "Edit" button is not visible or is disabled.<br>

3. Given the user is on the edit page and removes the predictor's name, when they click "Save," then a save failure error is shown with the message "Predictor Name is required".<br>

</details><br> 

>> #### US 1.3.6 - Delete a Predictor
>>> SP: 1

>>> As a user, I want to be able to delete a predictor I have made, so that I can get rid of bad or unwanted models.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is on their Dashboard, when they click the "Delete" icon for a predictor they own, then a confirmation pop-up appears with the message "Are you sure you want to delete this predictor?".<br>

2. Given the confirmation pop-up is visible, when the user clicks "Confirm," then the predictor is permanently removed and no longer appears on the dashboard.<br>

3. Given the confirmation pop-up is visible, when the user clicks "Cancel," then the pop-up disappears, and no change is made.<br>

</details><br> 

>> #### US 1.3.7 - Pin Predictors
>>> SP: 2

>>> As a user, I want to be able to pin predictors, so I can easily access them without needing to search them up.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is viewing any predictor, when they click the "Pin" icon, then that predictor is added to a "Pinned Predictors" panel on their Dashboard and sidebar.<br>

2. Given a predictor is already pinned, when the user clicks the "Unpin" icon, then it is removed from the "Pinned Predictors" panel.<br>

3. Given any user is on the site, then a set of three "universally pinned" predictors is always visible at the top of the main Predictors page and cannot be unpinned or deleted.<br>

</details><br> 

>> #### 1.3.8 (Optional) - Save My Draft Predictors
>>> SP: 3

>>> As a user, I want to be able to save my progress when I work on creating new predictors - essentially, I can create drafts - so that I can work on them incrementally and save my progress in case of a crash / Wi-Fi cut.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user has filled in the "Name" field on the creation page, when they click "Save Draft," then the predictor is saved as a private draft.<br>

2. Given a predictor is saved as a draft, then it is only visible on the creator's Dashboard and not on the public "Predictors" page.<br>

3. Given a draft has not been updated for a set period (e.g., 30 days), then it is automatically deleted from the system.<br>

4. Given a user is viewing their drafts on the Dashboard, then they have options to edit or delete each draft.<br>

</details><br> 

#### US 1.4.1 - Display and Search for a Predictor
> SP: 2

> As a user, I want to be able to see and search for all public and private predictors (that I have the permissions to view or edit), so that I can decide which ones to work with.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user navigates to the "Predictors" page, then a list of all viewable predictors is displayed.<br>

2. Given a user is on the "Predictors" page, when they type a query into the search bar and press Enter, then the list is filtered to show only predictors matching the query.<br>

3. Given a list of search results, when the user clicks on a predictor, then they are navigated to that predictor's page.<br>

</details><br> 

>> #### US 1.4.3 - Filter Predictors By Public / Private
>>> SP: 1

>>> As a user, I can filter predictors by whether they are public or private, so that it is easier to view or work with.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is on the "Predictors" page, then they can see filter options for "Public" and "Private".<br>

2. Given the user checks the "Private" filter, when the page updates, then only private predictors they have access to are shown.<br>

3. Given the user checks only the "Public" filter, when the page updates, then only public predictors are shown.<br>

4. Given the user checks both "Public" and "Private" filters, then all predictors they have access to are shown.<br>

</details><br> 

#### US 1.5 
> SP: 8

> As a Superuser/Admin, I want to be able to view all of the public/private datasets/models, so that I can collect general statistics regarding model training and usage. 

<details>
<summary>Acceptance Tests</summary><br> 

1. Given an Admin is on the "Admin Panel", then they can use a search bar to find any dataset or predictor in the system.<br>

2. Given an Admin is on the "Admin Panel", then they can view a dashboard with aggregate statistics (e.g., total users, total predictors).<br>

3. Given an Admin has located a specific dataset or predictor, then they have options to view, modify, or delete it.<br>

</details><br> 

#### US 1.6
> SP: 2

> As a user, I want to be able to create and delete folders, so that I can organize my predictors better.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is on their Dashboard, when they click "Create Folder," enter a name, and confirm, then a new, empty folder appears in their folder list.<br>

2. Given a user is on their Dashboard, when they click the "Delete" icon next to a folder they created, then a confirmation modal appears.<br>

3. Given the user confirms the deletion, then the folder is removed, and any predictors that were inside it now appear outside the folder in the main list.<br>

4. Given a user is viewing a folder not created by them, then the "Delete" icon is not visible.<br>

</details><br> 

>> #### US 1.6.1 - Toggle Folder Visibility
>>> SP: 5

>>> As a user, I want to be able to set folders to public and private, so that I can control who sees my predictors.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is editing a folder they own, then they can see a toggle for "Public" and "Private" visibility.<br>

2. Given a folder is marked "Private" and contains a "Public" predictor, when another user views the "Predictors" page, then they can see the predictor listed individually but not within the private folder.<br>

3. Given a folder is marked "Public" and contains a "Private" predictor, when another user views the public folder, then the private predictor is not visible inside it.<br>

</details><br> 

>> #### US 1.6.2 - Move Predictors Between Folders
>>> SP: 5

>>> As a user, I want to be able to drag and drop predictors into folders, so that it's easy to organize everything.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is on their Dashboard, when they click and drag a predictor onto a folder, then the predictor is moved into that folder.<br>

2. Given a predictor has been moved to a new folder, then the change is immediately visible on the Dashboard and persists after a page refresh.<br>

3. Given a drag-and-drop operation fails (e.g., due to a network error), when the user releases the mouse button, then an error notification is displayed, and the predictor returns to its original location.<br>

</details><br> 

#### US 1.7 - Landing Page
> SP: 2

> As a user, I want to be able to access the landing page the moment I open the website, so I can quickly navigate anywhere.

<details>
<summary>Acceptance Tests</summary><br> 

1. User can navigate to the Landing Page<br>

</details><br> 

#### US 1.8 - About Page
> SP: 2

> As a user, I want to be able to read about the PSSP website, the research behind the tools available, and those who worked on it, so I can better understand what the purpose of the website is.

<details>
<summary>Acceptance Tests</summary><br> 

1. User can navigate to the About Page<br>

2. User can navigate to the hyperlinked pages from the About page and view graphics<br>

</details><br> 

### 2. Interface

#### US 2.1.1 (Optional) - Recommendation System
> SP: 8

> As a user, I want an interface that allows me to identify an accessible dataset, a specific learning tool, and a specification of that learner’s hyperparameter, so that I can save time in choosing manually. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can see available learning tools on a dataset's information page<br>

2. Interface displays information about which learning tool was used for each dataset<br>

</details><br> 

>> #### US 2.1.2 
>>> SP: 3

>>> As a user, I want to run this specific learner on that dataset, and save the resulting trained model securely, so that I can save my runs. 

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is on a predictor's page, when they navigate to the "Train Model" tab, then they can select a learning tool from a dropdown menu.<br>

2. Given a model training process completes successfully, then a new, versioned entry is added to the "Model History" list for that predictor.<br>

3. Given a predictor has multiple model versions, when the user clicks on a specific version, then they are shown the results and metrics for that version.<br>



</details><br> 

>> #### US 2.1.3 - Re-Train Predictors
>>> SP: 2

>>> As a user, I want to be able to retrain predictors on subsets of features, so I can improve its predictions.

<details>
<summary>Acceptance Tests</summary><br> 

1. User can retrain predictors<br>

2. Interface updates with a visual confirmation of training, and the success / failure<br>

</details><br> 

>>> #### US 2.1.3.1 - Search for Features
>>>> SP: 2

>>>> As a user, I want to be able to search for features in a list of them, so that I can select and deselect them as needed without needing to scroll through hundreds of them.

<details>
<summary>Acceptance Tests</summary><br> 

1. User can click on the search bar and search for specific features based on name<br>

2. If the substring matches, results are pulled up - the table size reduces to accomodate queried results<br>

</details><br> 

>>> #### US 2.1.3.2 - Select and Deselect All Features
>>>> SP: 2

>>>> As a user, I want to be able to deselect and select all features at a button's click, so I don't have to do this manually.

<details>
<summary>Acceptance Tests</summary><br> 

1. User can click on the Select All button to select all features onscreen and beyond<br>

2. User can click on the Deelect All button to deselect all features onscreen and beyond<br>

2. If there are none onscreen due to searches, this will fail with an error message<br>

</details><br> 

>>> #### US 2.1.3.3 - Paginate Features
>>>> SP: 2

>>>> As a user, I want to be able to decide how many feature entries exist on one page and navigate through the pages, so that I don't have to view hundreds of them at once.

<details>
<summary>Acceptance Tests</summary><br> 

1. User can click on the Entries Per Page box and enter / increase or decrease the number per page [using the arrows]<br>

2. User can navigate pages using arrow buttons, and see what page they are at<br>

2. Arrows do not exist to go beyond the last page of results or befor ethe first.<br>

</details><br> 

#### US 2.2 - Implement Learning Tools
> SP: 5-8

> As a user, I want the website to include several learning tools, each with its own set of parameters, so I can save time generating separate predictions for each metric. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can select betwen different learning tools on dataset information page<br>

2. Website displays all learning tools with their own required parameters<br>

</details><br> 

#### US 2.3 
> SP: 8

> As a user, I want the interface to show the show the (cross-validation) evaluation of the quality of this learned model, in terms of several metrics, so that I can cross-validate. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can see cross-validation evaluation for learned models on a dataset information page<br>

2. User can view a variety of metrics of the model's cross-validation<br>

</details><br> 

### 3. Running

#### US 3.1 - Run Predictors on Unlabeled Data
> SP: 2

> As a user, I want to run an accessible learned survival model on one or more unlabeled instances, so that I can generate predictions using my trained models. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can run learned survival models on unlabeled instances using the database information page<br>

</details><br> 

#### US 3.2 - Prediction Display Formats
> SP: 5

> As a user, I want to receive predictions as ISD, like perhaps a graph of [time, probability] pairs, so that I can store them easily. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can view ISD predictions on the prediction information page<br>

2. User can view generated graphs and tweak graph settings<br>

3. User can easily download and store graphs<br>

</details><br> 

#### US 3.3 - Quality Evaluation of Predictors
> SP: 3

> As a user, I want facilities for showing the quality of an accessible learned model, on a held-out (labelled) dataset, in terms of several metrics, so that I can understand outputted predictions easily. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can view all metrics of learned models on the prediction information page<br>

</details><br> 

#### US 3.4 - Dataset Metrics / Analysis
> SP: 3

> As a user, I want #features, #instances and censor rate for each dataset, so that I can evaluate my uploaded dataset more easily. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can view the features, instancse, and censor rates for each dataset on the dataset information page<br>

</details><br> 

#### US 3.5 - Print Results
> SP: 2

> As a user, I want to be able to print diagrams or predictions, so that I can store them or use them.

<details>
<summary>Acceptance Tests</summary><br> 

1. User can print diagrams or statistics using the print option<br>

2. User can toggle diagrams or statistics for printing using toggles - they will be formatted nicely in the print screen view<br>

</details><br> 

#### US 3.6 - Download Results
> SP: 2

> As a user, I want to be able to download my results, so that I can save them on my local device.

<details>
<summary>Acceptance Tests</summary><br> 

1. User can download diagrams or statistics using the dowload option<br>

2. User can find downloaded materials in their Downloads directory on their local device.<br>

</details><br> 

#### US 3.7 - Superuser-Specific Analysis Tools
> SP: 5

> As a Superuser/Admin, I want to be able to view and analyze others' datasets, so that I can understand general usage. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can view others' dataset usage on an admin panel<br>

2. User can view all dataset usage statistics<br>

</details><br> 

### 4. Documentation 

#### US 4.1.1 - Instructions Page
> SP: 1

> As a user, I want instructions and a tutorial on how to use the website, so that I can easily navigate the website. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User will be able to watch a guided video on the "help" page of the website<br>

2. User will also be able to read more detailed instructions on this help page<br>

</details><br> 

>> #### US 4.1.2 - Hover Over Buttons / Tabs for Info
>>> SP: 2

>>> As a user, I want to be able to see what a button does or page shows by hovering over it, so I can navigate the website and use its tools more effectively.

<details>
<summary>Acceptance Tests</summary><br> 

1. User will be able to hover over buttons<br>

2. User will also be able to read the text on the popup that appears which will explain what the button or page does<br>

</details><br> 

#### US 4.2 - Guided Tour / Demo Implementation
>>> SP: 3

> As a user, I want a guided tour, so that I can get familiar using the different features and models on the website. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User will be prompted to start a guided tour when visiting the website for the first time on their google account<br>

2. Various buttons and sections of the website will be highlighted<br>

3. Text will describe what each section is for and how to use it<br>

</details><br> 

### 5. Confirmed Optional Features

#### US 5.1 - PSSP Package Download
> SP: 8

> As a user, I want the website to also be an add-on package for excel, SPSS, so that I may use it directly from my spreadsheets. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User will be able to download an excel/SPSS add-on from their respective tooling services

2. The add-on will assist in displaying information to the user

</details><br> 

#### US 5.2 - Handle Censored Data
> SP: 8

> As a user, I want to an active budgeted learning for “de-censoring”, and dealing with left and interval-censoring, so that I may generate more precise predictions. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can change specific settings regarding "de-censoring"<br>

2. User can generate more precise predictions by specifying censoring information<br>

</details><br> 


## MoSCoW

### Must Have
US 1.1 - User Logging in / Out

US 1.2 - Superuser / Admin Logging In / Out

US 1.3 - Logged-In User Dashboard

US 1.3.1 - Upload a Dataset

US 1.3.3 - Predictor Privacy

US 1.3.3.1 - Share Private Predictors

US 1.3.4 - Create a Predictor

US 1.3.5 - Edit a Predictor

US 1.3.6 - Delete a Predictor

US 1.4.1 - Display Predictors

US 1.4.2 - Search for a Dataset / Predictor

US 1.5 - Superuser / Admin Access (Panel Set-Up)

US 1.8 - About Page

US 2.1.2 - Save Predictors After Runs

US 2.1.3 - Re-Train Predictors

US 2.1.3.1 - Search for Features

US 2.1.3.2 - Select and Deselect All Features

US 2.2 - Implement Learning Tools

US 2.3 - Cross-Validation Evaluation of Predictor

US 3.1 - Run Predictors on Unlabeled Data

US 3.2 - Prediction Display Formats

US 3.3 - Quality Evaluation of Predictors

US 3.4 - Dataset Metrics / Analysis

US 3.7 - Superuser-Specific Analysis Tools

US 4.1.1 - Instructions Page

US 4.1.2 - Hover Over Buttons / Tabs for Info


### Should Have
US 1.1.1 - Change Password

US 1.3.2 - Upload Formatted Datasets

US 1.3.7 - Pin Predictors

US 1.4.3 - Filter Predictors By Public / Private

US 1.6.1 - Create Folders

US 1.6.2 - Delete Folders 

US 1.6.3 - Toggle Folder Visibility

US 1.6.4 - Move Predictors Between Folders

US 1.7 - Landing Page

US 2.1.3.3 - Paginate Features

US 3.5 - Print Results

US 3.6 - Download Results

US 4.2 - Guided Tour / Demo Implementation


### Could Have
US 1.3.8 - Save My Draft Predictors


### Would Like But Won't Get
US 2.1.1 - Recommendation System

US 5.1 - PSSP Package Download

US 5.2 - Handle Censored Data<br>





## Similar products

1. <a href="https://mlconsole.com/" target="_blank">ML Console</a>
> * Builds AI models by using uploaded dataset
> * Secure data and predictions
> * Used for inspiration to produce model predictions

2. <a href="https://voxel51.com/landing/ml-datasets?utm_source=google&utm_medium=search&utm_campaign=ML_Datasets&utm_term=ml%20datasets&device=c&utm_source=google&utm_medium=cpc&utm_campaign=22835379762&utm_term=ml%20datasets&utm_content=184661742362&hsa_acc=7373578919&hsa_cam=22835379762&hsa_grp=184661742362&hsa_ad=766399187256&hsa_src=g&hsa_tgt=kwd-532915517679&hsa_kw=ml%20datasets&hsa_mt=p&hsa_net=adwords&hsa_ver=3&gad_source=1&gad_campaignid=22835379762&gbraid=0AAAAApQT94lRAgU_hSN23gQFoPXlkvTA6&gclid=Cj0KCQjw_rPGBhCbARIsABjq9ccSlWcC4PbVUiUcXcZKopEP72HyRifrKWRV_4DKS-1pqOuR8_NWuD4aAmaZEALw_wcB" target="_blank">FiftyOne</a> 
> * Identifies edge cases, outliers, duplicates and mislabeled samples
> * Visualizes images, video, 3D in an interactive UI
> * Used for inpiration to clean the dataset before conducting predictions

3. Other survival analysis libraries (R survival, Python lifelines) for algorithm inspiration.
> * Used commonly but not nearly as user-friendly for non-tech-based professionals who may want to conduct further resarch in the field
> * Functionality may be of interest to us for the development of the backend, as stated

4. Kaplan–Meier online calculators (various web tools) as an inspiration for practical implementation techniques.<br>
> * Similar issue - used commonly but not nearly as user-friendly for non-tech-based professionals who may want to conduct further resarch in the field, but in the sense that it is only as insightful as the user knows it to be.
> * May be of interest to us for the development of how to display results on the frontend


## Open-source products

1. <a href="https://github.com/shi-ang/SurvivalEVAL" target="_blank">MAE-PO (SurvivalEVAL)</a>

2. <a href="https://github.com/shi-ang/MakeSurvivalCalibratedAgain" target="_blank">CSD/CiPOT (MakeSurvivalCalibratedAgain)</a>

3. <a href="https://github.com/shi-ang/BNN-ISD" target="_blank">BNN-ISD</a>

## Technical resources

### Brownfield Documentation
>- <a href="https://docs.google.com/document/d/1DmFf9IDluLoiTbr6PEhBdytxpxbRrxwnVw2zilON0GE/edit?usp=sharing" target="_blank">PSSP User Guide</a> (provided by client) 
>- <a href="https://papers.nips.cc/paper_files/paper/2011/file/1019c8091693ef5c5f55970346633f92-Paper.pdf" target="_blank">NIPS paper on Cancer Research</a>
>- Presentations and papers on the research being supported by the project. (provided by client)
>- 

### Backend: 

Ruby on Rails + C++ / R; MySQL

### Frontend: 

React / Vite + TypeScript + Tailwind CSS + Zustand + React Router

### Deployment:

TBD - to be communicated to us by the client at a later date