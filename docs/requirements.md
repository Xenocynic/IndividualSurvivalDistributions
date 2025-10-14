# **Project Requirements**<br><br>

## Executive Summary

EZ Survival Prediction is best described as a brownfield project with large patches of green. To be precise, it is based on the existing PSSP site. The current website is 7–8 years old, slow, and difficult to navigate, and the existing tools for learning and evaluating ISD models are slow, cumbersome and lack extensive features. 

Our product will let machine learning researchers and other practitioners in the relevant fields upload survival datasets, train survival models with adjustable parameters using various learning tools, evaluate the models using various metrics and run predictions on new unlabeled instances, and obtain Individual Survival Distributions (ISDs) for new instances. The system will also allow the secure storage, search, and evaluation of datasets and models. 

Users will be able to:

* Upload a survival dataset (spreadsheet format) and train a survival model with adjustable parameters.

* View cross-validation and other evaluation metrics for the learned model.

* Run the trained model on new, unlabeled instances to obtain ISD predictions (time-probability distributions).

Our target users include medical researchers and clinicians, engineers, finance managers, and insurance agents who are familiar with spreadsheets but not with programming.

The system is web-based, initially running in a browser (focus on Chrome). If time permits, it may also be packaged as an Excel/Google-Sheet/SPSS add-on.<br><br>


## Project Glossary

* **ISD** - Individual Survival Distributions 

* **User** - A non-logged-in user. Can view public datasets.

* **LIU** - A logged-in user. Can view all public datasets, and any private datasets they are permitted to view. Can also upload new datasets and train models.

* **Superuser** - Admin with permission to view high-level statistics across all datasets/models (public and private). 

* **Uncensored Data** - Survival time that fully captures the patient’s entire lifespan (i.e., complete data).

* **Censored Data** - Incomplete survival time information, representing only a lower bound of a patient’s lifespan. Prevalent across datasets and an issue addressed by the client's research.

* **KM Curve (Kaplan-Meier)** - A standard survival function estimate used for comparisons.<br><br>


## User Stories

User stories must be prioritized using the MoSCoW method.

### 1. User Access 

#### US 1.1 - User Logging in / Out  (Storypoints: 3)
I want to create an account, log in, and log out securely using my email, username, and password,
so that I can access and save my datasets and predictions in my personal dashboard.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is on the account creation page, when they enter all required fields correctly, then a new account is created, and they are redirected to their dashboard.<br><br>
2. Given a user is on the account creation page, when they enter a password that does not meet security requirements, then an error message appears explaining the password rules.<br><br>
3. Given a user is on the login page, when they enter valid credentials and click “Log In,” then they are authenticated and redirected to their main dashboard.<br><br>
4. Given a user is on the login page, when they enter invalid credentials, then an error message is displayed stating that the username or password is incorrect.<br><br>
5. Given a user is logged in, when they click “Log Out,” then their session ends, and they are redirected to the landing page.<br><br>

</details><br>

>> #### US 1.1.1 - Change Password  (Storypoints: 3)
>> As a logged in user, I want to change my password and update my personal information (e.g., name), so that I can maintain my account security and keep my profile details accurate.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given a logged-in user navigates to “Profile Settings,” when they click “Change Password,” then they see fields for Current Password, New Password, and Confirm New Password.<br><br>
>> 2. Given the user enters the correct current password and a valid new password in both fields, when they click “Save Changes,” then a confirmation message “Password successfully changed” appears.<br><br>
>> 3. Given the user enters a new password that matches their old one, when they try to save, then an error message “New password cannot be the same as the old password” appears.<br><br>
>> 4. Given the user enters a new password that fails security requirements (e.g., too short, missing a number), when they try to save, then an error message appears explaining the rule violated.

</details><br> 

#### US 1.2 - Admin Logging In / Out  (Storypoints: 1)
As an admin, I want to log in, log out, and reset my password securely using my authorized credentials, so that I can access the admin dashboard to manage user datasets and predictions safely.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user with Superuser privileges is on the login page, when they sign in using their authorized credentials, then the system validates their Admin status in the database.<br><br>
2. Given an Admin is logged in, when they click “Log Out,” then their session ends, and they are redirected to the institutional sign-in page.<br><br>
3. Given an Admin clicks “Forgot Password,” when they enter their registered email, then a password reset link is sent to that email address.<br><br>
4. Given the Admin clicks the password reset link, when they enter and confirm a valid new password, then the password is successfully updated, and they can log in with the new credentials.

</details><br> 

#### US 1.3 - Logged-In User Dashboard  (Storypoints: 3)
As a logged-in user, I want to view all of my created predictors and folders in an organized dashboard, so that I can easily access, edit, or use them.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user successfully logs in, then they are automatically redirected to their personal Dashboard page.<br><br>
2. Given a user who is not logged in attempts to access the Dashboard URL directly, then they are redirected to the Login page.<br><br>
3. Given a logged-in user is on their Dashboard, then they can view a structured list of all predictors and folders they have created, including relevant details such as names and last modified dates.<br><br>
4. Given a logged-in user is on their Dashboard, when they click “About”, "Landing" or "Instruction" pages they are then redirected to the respective pages containing project and team information.

</details><br> 

>> #### US 1.3.1 - Verify a Dataset is Formatted Correctly  (Storypoints: 3)
>> As a logged-in user, I want to upload a dataset and verify that it is properly formatted, so that I can prevent errors during model training and ensure smooth predictor creation.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given the user selects a correctly formatted .csv file, when they upload it, then a “Validation Successful” message appears, and the dataset name is displayed in the form.<br><br>
>> 2. Given the user selects a .csv file with incorrect formatting (e.g., missing required columns or invalid data types), when they submit the file, then the system displays a detailed error message identifying the issue (e.g., “Error in row 15: Column ‘Time’ contains non-numeric data.”).

</details><br> 

>> #### US 1.3.2 - Upload a Dataset  (Storypoints: 3)
>> As a logged-in user, I want to upload a input data as spreadsheets and .csv files, so that it's easier to upload and use.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given a logged-in user is on the “Create New Predictor” page, when they click the “Upload Dataset” button, then a file selection dialog appears allowing them to choose a file from their device.<br><br>
>> 2. Given the user selects a file that is not a .csv file (e.g., .txt, .xlsx), when they attempt to upload it, then an error message appears stating “Invalid file type. Please upload a .csv file”.

</details><br> 

>> #### US 1.3.3 - Predictor Privacy  (Storypoints: 2)
>> As a logged-in user, I want to control which users can view or edit my private predictors and datasets by assigning permission levels, so that I can securely share my work while maintaining ownership and collaboration control.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given a logged-in user is creating or editing a predictor, then they can set its privacy level using a toggle or dropdown with options such as “Public” or “Private.”<br><br>
>> 2. Given a logged-in user visits the “Predictors” page, then they can view all public predictors as well as any private predictors or datasets to which they have been granted access.

</details><br> 

>>>> #### US 1.3.3.1 - Share Private Predictors / Datasets  (Storypoints: 5)
>>>> As a user, I want to control who can view or edit my private predictors and datasets, so that I can securely share access with specific people.

>>>> <details>
>>>> <summary>Acceptance Tests</summary><br> 

>>>> 1. Given a user is sharing a private predictor, when they assign permissions, then they can select either “Viewer” (can view only) or “Owner” (can edit, delete, or reshare).<br><br>
>>>> 2. Given a user has shared a private predictor with others, when they revisit the sharing settings, then they can view, modify, or revoke access for specific users.
>>>> 3. Given a user revokes another user’s access, then the revoked user immediately loses access to that private predictor or dataset.

</details><br> 

>> #### US 1.3.4 - Create a Predictor  (Storypoints: 3)
>> As a logged-in user, I want to create a new predictor using one of my uploaded datasets, so that I can train, save, and later view or use its predictions.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given a user has successfully uploaded a valid dataset, when they fill in the required fields (Name, Description) and click “Create Predictor,” then the predictor is created, stored under their account, and they are redirected to the predictor’s main page.<br><br>
>> 2. Given a user attempts to create a predictor without entering a required field (e.g., Name), when they click “Create Predictor,” then an error message “Predictor Name is required” appears, and the predictor is not created.<br><br>
>> 3. Given a user enters a predictor name that duplicates an existing predictor they already own, when they click “Create Predictor,” then an error message “A predictor with this name already exists” appears, and the action is prevented.<br><br>
>> 4. Given the predictor is successfully created, then it appears in the user’s dashboard list under their predictors section.

</details><br> 

>> #### US 1.3.5 - Edit a Predictor  (Storypoints: 1)
>> As a logged-in user, I want to edit the details of my predictors (e.g., name, description, dataset association), so that I can update or improve them over time.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given a user is on their Dashboard, when they click the “Edit” button for a predictor they own, then they are navigated to that predictor’s settings page where editable fields are displayed.<br><br>
>> 2. Given a user is viewing another user’s public predictor page, then the “Edit” option is hidden or disabled to prevent unauthorized modifications.<br><br>
>> 3. Given a user makes valid edits to their predictor details, when they click “Save Changes,” then the updates are saved successfully, and a confirmation message “Predictor updated successfully” is displayed.

</details><br> 

>> #### US 1.3.6 - Delete a Predictor  (Storypoints: 1)
>> As a user, I want to be able to delete a predictor I have made, so that I can get rid of bad or unwanted models.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given a user is on their Dashboard, when they click the “Delete” icon for a predictor they own, then a confirmation pop-up appears stating “Are you sure you want to delete this predictor?”<br><br>
>> 2. Given the confirmation pop-up is displayed, when the user clicks “Confirm,” then the predictor is permanently deleted from the system and removed from their dashboard list.<br><br>
>> 3. Given the confirmation pop-up is displayed, when the user clicks “Cancel,” then the pop-up closes, and the predictor remains unchanged.<br><br>
>> 4 Given a user attempts to delete a predictor they do not own, then the delete option is hidden or disabled to prevent unauthorized actions.

</details><br> 

>> #### US 1.3.7 - Pin Predictors  (Storypoints: 2)
>> As a user, I want to be able to pin predictors, so I can quickly access my most important or frequently used ones without searching.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given a user is viewing any predictor they have access to, when they click the “Pin” icon, then that predictor is added to the “Pinned Predictors” section on their Dashboard and sidebar for quick access.<br><br>
>> 2. Given a predictor is already pinned, when the user clicks the “Unpin” icon, then it is removed from the “Pinned Predictors” section immediately.<br><br>
>> 3. Given any user is browsing the Predictors page, then a set of three “universally pinned” (featured) predictors is always visible at the top of the page, and these cannot be unpinned or deleted by users.

</details><br> 

>> #### 1.3.8 - Save My Draft Predictors  (Storypoints: 3)
>> As a user, I want to be able to save my progress when I work on creating new predictors - essentially, I can create drafts - so that I can work on them incrementally and save my progress in case of a crash / Wi-Fi cut.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given a user is on the “Create Predictor” page and has entered at least the “Name” field, when they click “Save Draft,” then the system saves the current state as a private draft under their account.<br><br>
>> 2. Given a predictor is saved as a draft, then it appears only in the user’s Dashboard under a “Drafts” section and is not visible on the public “Predictors” page.<br><br>
>> 3. Given a user is viewing their “Drafts” section, then they have options to “Edit,” “Delete,” or “Publish” each draft.<br><br>
>> 4. Given a user resumes editing a saved draft, when they click “Publish,” then the draft is converted into a full predictor and appears in their main predictor list.

</details><br> 

#### US 1.4 - Display Predictors & Datasets  (Storypoints: 2)
As a logged-in user, I want to view all public predictors and the private ones I have permission to access, so that I can easily choose which ones to view, edit, or use for analysis.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a logged-in user navigates to the “Predictors” page, then a list of all predictors they can access (public and permitted private ones) is displayed, showing key details such as name, owner, and date modified.<br><br>
2. Given a user without login access visits the “Predictors” page, then only public predictors are visible.<br><br>
3. Given a user has “Viewer” permissions on a private predictor, then they can view it but not edit or delete it.<br><br>
4. Given a user has “Owner” permissions on a private predictor, then they can view, edit, delete, or share it with others.

</details><br> 

>> #### US 1.4.1 - Search for a Dataset / Predictor  (Storypoints: 1)
>> As a logged-in user, I want to search for datasets or predictors by name or keyword, so that I can quickly locate specific resources I want to view or edit.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given a user is on the “Predictors” page, when they type a keyword or name into the search bar and press “Enter,” then the list filters dynamically to show only predictors and datasets that match the search query.<br><br>
>> 2. Given search results are displayed, when the user clicks on a predictor or dataset from the list, then they are navigated to that item’s detailed page.<br><br>
>> 3. Given a search query returns no results, then a message “No predictors or datasets found” is displayed.<br><br>
>> 4. Given a user clears the search input, then the full unfiltered list of accessible predictors and datasets reappears.

</details><br> 

>> #### US 1.4.2 - Filter Predictors By Public / Private  (Storypoints: 1)
>> As a logged-in user, I want to filter predictors based on their visibility (Public or Private), so that I can easily manage and locate the predictors I want to view or work with.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given a user is on the "Predictors" page, then they can see filter options for "Public" and "Private".<br><br>
>> 2. Given a user selects the “Private” filter, when the list updates, then only private predictors they have access to are displayed.<br><br>
>> 3. Given a user enables both “Public” and “Private” filters, then all predictors they have permission to view appear in the list.<br><br>
>> 4. Given no predictors match the selected filters, then a message “No predictors found for this filter” is displayed.

</details><br> 

#### US 1.5 - Admin Access (Panel Set-Up)  (Storypoints: 1)
As a Superuser/Admin, I want to view and manage all public and private datasets and predictors across the platform, so that I can monitor usage trends and maintain system integrity.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given an Admin is logged in and navigates to the “Admin Panel,” then they can view a dashboard displaying system-wide statistics, such as total users, total predictors, and total datasets.<br><br>
2. Given an Admin is on the “Admin Panel,” then they can use a search bar to locate any dataset or predictor within the system by name or owner.<br><br>
3. Given a non-Admin user attempts to access the “Admin Panel” URL directly, then they are denied access and redirected to the login or dashboard page.<br><br>
4. Give an admin loses their credentials, they can make use of the "Forgot Password" feature to reset their password.

</details><br> 

#### US 1.6 - Create Folders   (Storypoints: 2)
As a user, I want to be able to create folders, so that I can organize my predictors.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is on their Dashboard, when they click the “Create Folder” button and enter a valid name, then a new folder is created and displayed in their folder list.<br><br>

2. Given a folder has been created, then it persists after the page is refreshed or the user logs back in.<br><br>

3. Given a user tries to create a folder without entering a name, then an error message “Folder Name is required” is displayed, and the folder is not created.


</details><br> 

>> #### US 1.6.1 - Delete Folders   (Storypoints: 1)
>> As a user, I want to be able to delete folders I have created, so that I can organize my predictors (and datasets) better.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given a user is on their Dashboard, when they click the “Delete” icon on a folder they own, then a confirmation dialog appears asking, “Are you sure you want to delete this folder?”<br><br>
>> 2. Given the confirmation dialog is visible, when the user clicks “Confirm,” then the folder and its structure are deleted (predictors remain accessible in the general list).<br><br>
>> 3. Given the confirmation dialog is visible, when the user clicks “Cancel,” then no changes are made and the folder remains.<br><br>
>> 4. (Potential enhancement) Given multiple folders are selected, when the user clicks “Delete Selected,” then a confirmation dialog appears for bulk deletion.

</details><br> 

>> #### US 1.6.2 - Toggle Folder Visibility   (Storypoints: 5)
>> As a user, I want to be able to set folders to public and private, so that I can control who sees my predictors.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given a user is creating or editing a folder they own, then they can toggle its visibility between “Public” and “Private.”<br><br>
>> 2. Given a folder is private but contains a public predictor, then others can view the predictor individually but not within the private folder.<br><br>
>> 3. Given a folder is public but contains a private predictor, then others can view the folder but not the private predictor inside it.<br>

</details><br> 

>> #### US 1.6.3 - Move Predictors Between Folders   (Storypoints: 5)
>> As a user, I want to be able to drag and drop predictors into folders, so that it's easy to organize everything.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given a user is on their Dashboard, when they click and drag a predictor onto a folder, then the predictor is moved into that folder.<br><br>
>> 2. Given a predictor has been successfully moved into a folder, then the updated organization is visible immediately and persists after a page refresh<br><br>
>> 3. Given a user drags a predictor to an invalid drop zone or the operation fails (e.g., network error), then the predictor returns to its original location, and an error message is displayed.<br><br>
>> 4. Given a user moves a predictor from one folder to another, then the change is reflected in both folders without requiring a page reload.<br>

</details><br> 

#### US 1.7 - Landing Page   (Storypoints: 2)
As a user, I want to access the landing page upon opening the website, so that I can easily navigate to key areas such as About, Instructions, Login, and Dashboard. 

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user opens the website URL, then the Landing Page is displayed with visible navigation links to “About,” “Instructions,” “Login,” and “Dashboard.” It should load automatically on site access.<br><br>
2. Given a user is on any other page, when they click the site logo in the navigation bar, then they are redirected to the Landing Page.

</details><br> 

#### US 1.8 - About Page   (Storypoints: 2)
As a user, I want to learn about the PSSP website, its research background, and contributors, so that I can understand its purpose and credibility.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is on any page, when they click the “About” link in the navigation bar, then they are redirected to the About Page displaying project, research, and contributor information.<br><br>
2. Given a user is on the About Page, when they click any embedded hyperlink, then the linked page opens correctly in a new browser tab.<br><br>
3. Given the About Page is loaded, then all images, graphics, and formatting are displayed correctly.

</details><br><br>  

### 2. Interface

#### US 2.1 - Recommendation System   (Storypoints: 8)
As a user, I want to use an interface that recommends suitable datasets, learning tools, and their hyperparameter configurations so that I can quickly select the best options without manual trial and error.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is on the “Train New Model” page, when they open the “Recommended Setup” panel, then the system automatically suggests an optimal dataset, learning tool, and hyperparameter configuration based on similar past predictors.<br><br>
2. Given the user selects a recommended configuration, when they click “Apply,” then the corresponding fields in the model setup form are auto-filled with the suggested values.

</details><br> 

>> #### US 2.1.2 - Save Predictors After Runs  (Storypoints: 3)
>> As a user, I want to train a selected learner on a dataset and automatically save the resulting model version securely, so that I can review, compare, and reuse my previous runs.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given a user trains a model in the “Train Model” tab, when training completes, then a new version with its parameters, metrics, and date is automatically saved and viewable in “Model History.”

</details><br> 

>> #### US 2.1.3 - Re-Train Predictors  (Storypoints: 2)
>> As a user, I want to retrain predictors on selected subsets of features, so I can optimize model performance.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given a user is on a predictor’s page, when they open the “Retrain Model” tab, then they can view all dataset features listed with selectable checkboxes.<br><br>
>> 2. Given the user selects or deselects certain features and clicks “Retrain,” then a progress indicator appears showing “Training new version…”<br><br>
>> 3. Given the retraining completes successfully, then a confirmation message “Training complete” appears, and a new version is added to the “Model Versions” list with updated parameters.<br><br>
>> 4. Given the retraining fails, then an error message appears, and no new model version is saved.

</details><br> 

>>>> #### US 2.1.3.1 - Search for Features  (Storypoints: 2)
>>>> As a user, I want to search for specific features in a long list, so that I can quickly find and select or deselect them during retraining.

>>>> <details>
>>>> <summary>Acceptance Tests</summary><br> 

>>>> 1. Given a user is on the “Retrain Model” page, when they type text into the feature search bar, then the feature list dynamically filters to show only matching names.<br><br>
>>>> 2. Given a user clears the search field, then the full feature list is displayed again.

</details><br> 

>>>> #### US 2.1.3.2 - Select and Deselect All Features  (Storypoints: 2)
>>>> As a user, I want to be able to deselect and select all features at a button's click, so I don't have to do this manually.

>>>> <details>
>>>> <summary>Acceptance Tests</summary><br> 

>>>> 1. Given a list of features is displayed, when the user clicks the "Select All" button, then all checkboxes for the currently visible features are checked.<br><br>
>>>> 2. Given a list of features is displayed, when the user clicks the "Deselect All" button, then all checkboxes for the currently visible features are unchecked.<br><br>
>>>> 3. Given the feature list is empty due to a search, then the "Select All" and "Deselect All" buttons are disabled.

</details><br> 

>>>> #### US 2.1.3.3 - Paginate Features  (Storypoints: 2)
>>>> As a user, I want to control how many feature entries are displayed per page and navigate between pages, so that I can browse large feature lists efficiently.

>>>> <details>
>>>> <summary>Acceptance Tests</summary><br> 

>>>> 1. Given the feature list is paginated, when the user changes the “Entries Per Page” value, then the list updates to show that number of features per page.<br><br>
>>>> 2. Given multiple pages exist, when the user clicks “Next” or “Previous,” then the corresponding page of features is displayed, with navigation arrows disabled appropriately when at the first or last page.

</details><br> 

#### US 2.2 - Implement Learning Tools  (Storypoints: 5)
As a user, I want the website to include multiple learning tools, each with its own configurable hyperparameters, so that I can efficiently generate predictions tailored to different models.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is on the “Train Model” page, when they select a learning tool from the dropdown, then the interface dynamically updates to display its corresponding hyperparameter fields.<br><br>
2. Given the user selects different tools (e.g., “Tool A” or “Tool B”), then each displays its unique parameter input fields (e.g., “Parameter X, Y” for Tool A and “Parameter Z, Alpha” for Tool B).<br><br>
3. Given a user changes the selected tool, then the previous parameters are cleared or replaced with the defaults for the new tool.

</details><br> 

#### US 2.3 - Cross-Validation Evaluation of Predictor  (Storypoints: 8)
As a user, I want to view the cross-validation evaluation metrics of my trained model, so that I can assess and compare its performance across different quality measures.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a model has been successfully trained, when the user navigates to its results page, then a “Cross-Validation Metrics” section is visible.<br><br>
2. Given the user is viewing this section, then a table or cards display key metrics such as Concordance Index, Brier Score, and MAE, along with their respective values.<br><br>
3. Given the user hovers over or clicks on a metric, then a tooltip or description appears explaining its meaning and relevance.

</details><br> 

### 3. Running

#### US 3.1 - Run Predictors on Unlabeled Data  (Storypoints: 2)
As a user, I want to run a trained survival model on unlabeled data, so that I can generate and view predictions for new instances.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is viewing a trained model’s results page, when they click “Predict on New Data”, then an interface appears allowing them to upload an unlabeled .csv file.<br><br>
2. Given the user uploads a valid unlabeled file and clicks “Generate Predictions”, then the system runs the model on the uploaded data and displays a results page with the generated predictions.<br><br>
3. Given the uploaded file is invalid (e.g., missing required columns or incorrect format), then an error message is displayed explaining the issue, and no predictions are generated.

</details><br> 

#### US 3.2 - Prediction Display Formats  (Storypoints: 5)
As a user, I want to view model predictions as interactive survival distribution (ISD) graphs showing [time, probability] pairs, so that I can easily interpret and store the results.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a prediction has been generated, then the results page displays an interactive ISD graph plotting time vs. survival probability.<br><br>
2. Given the user is viewing the ISD graph, when they interact with controls such as zoom or pan, then the graph dynamically updates to reflect the new view.

</details><br> 

#### US 3.3 - Quality Evaluation of Predictors  (Storypoints: 3)
As a user, I want to evaluate a trained model on a held-out labeled dataset and view key performance metrics, so that I can assess the model’s predictive quality.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user runs an evaluation on a held-out labeled dataset, when the evaluation completes, then a “Performance Metrics” section is displayed showing key metrics such as Concordance Index and Brier Score.

</details><br> 

#### US 3.4 - Dataset Metrics / Analysis  (Storypoints: 3)
As a user, I want to view key dataset statistics such as the number of features, number of instances, and censor rate, so that I can better understand and evaluate my uploaded datasets.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is viewing any predictor's main page, then a “Dataset Statistics” section is displayed, showing the number of features, number of instances, and the censor rate for the associated dataset.

</details><br> 

#### US 3.5 - Print Results  (Storypoints: 2)
As a user, I want to be able to print prediction outputs, evaluation metrics, or graphs, so that I can easily store, share, or include them in reports.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is on any results or metrics page, when they click the “Print” button, then the browser’s print dialog opens with a print-optimized layout showing all relevant content (e.g., graphs, tables, and metrics).<br><br>
2. Given the print view is open, then all charts, labels, and legends are clearly visible and properly formatted for both color and grayscale printing.<br><br>
3. Given the user completes the print action, then the selected section is successfully printed or saved as a PDF according to the user’s print settings.

</details><br> 

#### US 3.6 - Download Results  (Storypoints: 2)
As a user, I want to be able to download my results, so that I can save them on my local device.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is on a results or metrics page, when they click the “Download” button, then a .csv file containing the relevant data (e.g., predictions, evaluation metrics, or summary statistics) is downloaded to their device.<br><br>
2. Given a download attempt fails (e.g., network error), then an error notification is displayed with an option to retry.

</details><br> 

#### US 3.7 - Superuser-Specific Analysis Tools  (Storypoints: 5)
As a Superuser/Admin, I want to be able to view and analyze users’ datasets and predictors, so that I can monitor overall system usage and research activity.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given an Admin is on the “Admin Panel”, then they can view a dashboard displaying aggregate statistics such as total datasets, predictors, users, and training activity.<br><br>
2. Given an Admin selects a specific dataset or predictor from the dashboard, then a detailed view is displayed with its metadata, owner, and usage metrics.<br><br>
3. Given an Admin is analyzing data, then they can filter, search, and sort results by user, visibility (public/private), or activity date.

</details><br> 

### 4. Documentation 

#### US 4.1 - Instructions Page  (Storypoints: 1)
As a user, I want instructions and a tutorial on how to use the website, so that I can easily navigate the website. 

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user clicks on the “Help” or “Instructions” link in the navigation bar then they are directed to the Instructions Page.<br><br>
2. Given a user is on the Instructions Page, then a searchable written guide with step-by-step instructions and screenshots is available.

</details><br> 

>> #### US 4.1.1 - Hover Over Buttons / Tabs for Info  (Storypoints: 2)
>> As a user, I want to see helpful tooltips when hovering over buttons or tabs, so that I can quickly understand their purpose without needing to consult external documentation.

>> <details>
>> <summary>Acceptance Tests</summary><br> 

>> 1. Given a user hovers their cursor over any button, icon, or navigation tab that has an associated tooltip, then a small pop-up appears displaying a short description of its function.<br><br>
>> 2. Given the user moves the cursor away from the element, then the tooltip automatically disappears after a brief delay. <br><br>
>> 3. Given the tooltip text is displayed, then it should be concise, readable, and positioned clearly without obstructing other UI elements.

</details><br> 

#### US 4.2 - Guided Tour / Demo Implementation  (Storypoints: 3)
As a user, I want an interactive guided tour video that walks me through the website’s features and models, so I can quickly learn how to use them effecti

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user logs in for the first time, when the dashboard loads, then a modal appears prompting them to watch a short guided tour video explaining the platform’s main features.<br><br>
2. Given the user clicks “Play Tour,” then the embedded video plays in a modal or overlay without leaving the current page.<br><br>
3. Given the video is playing, when the user clicks “Next Section,” then the video skips to the relevant segment explaining that feature (e.g., Predictors, Datasets, or Dashboard).<br><br>

</details><br> 

### 5. Confirmed Optional Features

#### US 5.1 - PSSP Package Download  (Storypoints: 8)
As a user, I want to download or install a PSSP add-on for Excel, so I can use the prediction tools directly within my spreadsheets.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is on the "Downloads" or "Integrations" page, when they click "Download for Excel," then the PSSP Excel add-on installer begins downloading.<br><br>
2. Given the user installs the Excel add-on, when they open it for the first time, then a login prompt appears asking for their EZ Survival Prediction account credentials.<br><br>
3. Given the user logs in successfully, when they select a dataset within Excel and run a saved predictor using the add-on, then the prediction results are displayed in a new worksheet or a side panel within Excel.

</details><br> 

#### US 5.2 - Handle Censored Data  (Storypoints: 8)
As a user, I want the system to support active budgeted learning for “de-censoring” and handling left or interval-censored data, so that my model predictions are more accurate.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given a user is on the "Train Model" page, when they open the "Advanced Settings" section, then options for handling censored data (e.g., “Censoring Type” with 'Left', 'Right', 'Interval') are displayed.<br><br>
2. Given a user trains a model with specific censoring options, when training completes, then the model summary clearly lists the censoring type and de-censoring approach applied.

</details><br>

### 6. Selenium UI Testing

#### US 6.1 - Frontend Tests for Sprint 2  (Storypoints: 5)
Selenium testing for logging in/out and utilizing the forgot password feature as an admin.

<details>
<summary>Acceptance Tests</summary><br> 

1. Given the test suite runs, when Selenium navigates to the login page, then it verifies that a valid admin user can successfully log in and is redirected to the Dashboard.<br><br>
2. Given the admin is logged in, when Selenium triggers the logout action, then the user is logged out and redirected to the Login page.<br><br>
3. Given Selenium is on the login page, when an invalid email is submitted through the “Forgot Password” form, then an appropriate error message is displayed (e.g., “Invalid email”).<br><br>
4. Given Selenium is on the login page, when a valid admin email is submitted through the “Forgot Password” form, then a success message appears indicating a reset link has been sent.

</details><br>

#### US 6.2 - Frontend Tests for Sprint 3  (Storypoints: 5)
Selenium testing for user login/logout, forgot password, and navigation through the Landing, Instructions, and About pages, as well as creating, training, and saving predictors and folders.

<details>
<summary>Acceptance Tests</summary><br> 

1. Verify login/logout and forgot password flows function correctly.<br><br>
2. Verify the Landing, Instructions, and About pages load with expected content.<br><br>
3. Verify predictors can be created, trained, and saved successfully.<br><br>
4. Verify folders can be created, edited, and deleted, and updates persist after refresh.

</details><br>

#### US 6.3 - Frontend Tests for Sprint 4  (Storypoints: 5)
Selenium testing for predictor validation, usage, and evaluation from a user’s perspective, and metrics and usage analysis from an Admin’s perspective.

<details>
<summary>Acceptance Tests</summary><br> 

1. Verify users can validate, run, and view predictor results successfully.<br><br>
2. Verify metrics and evaluation results are displayed accurately after model runs.<br><br>
3. Verify Admins can access and analyze overall usage and performance metrics through the Admin Panel.

</details><br>

#### US 6.4 - Frontend Tests for Sprint 5  (Storypoints: 5)
Integration of all previous frontend Selenium tests to ensure seamless functionality and scalability for future features, with added coverage for instruction and tutorial pagess.

<details>
<summary>Acceptance Tests</summary><br> 

1. Verify all previous frontend tests (login, predictor creation, dataset handling, admin tools) run successfully without conflicts.<br><br>
2. Verify the instruction and tutorial pages load correctly and their elements function as expecte<br><br>
3. Confirm test scripts are modular and adaptable for future feature updates.

</details><br>

<br><br> 


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

US 1.4 - Display Predictors

US 1.4.1 - Search for a Dataset / Predictor

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

US 1.4.2 - Filter Predictors By Public / Private

US 1.6 - Create Folders

US 1.6.1 - Delete Folders 

US 1.6.2 - Toggle Folder Visibility

US 1.6.3 - Move Predictors Between Folders

US 1.7 - Landing Page

US 2.1.3.3 - Paginate Features

US 3.5 - Print Results

US 3.6 - Download Results

US 4.2 - Guided Tour / Demo Implementation


### Could Have
US 1.3.8 - Save My Draft Predictors


### Would Like But Won't Get
US 2.1 - Recommendation System

US 5.1 - PSSP Package Download

US 5.2 - Handle Censored Data<br><br><br>


## Similar products

1. <a href="https://mlconsole.com/" target="_blank">ML Console</a><br>
*Web-based platform for managing machine learning workflows.*<br>
> * Provides a clean dashboard interface for uploading datasets and visualizing model outputs.
> * Inspires our frontend design for displaying results and managing user data through an interactive UI.
> * Demonstrates secure handling of user-uploaded data, which we can mirror in our backend data management.

2. <a href="https://voxel51.com/landing/ml-datasets?utm_source=google&utm_medium=search&utm_campaign=ML_Datasets&utm_term=ml%20datasets&device=c&utm_source=google&utm_medium=cpc&utm_campaign=22835379762&utm_term=ml%20datasets&utm_content=184661742362&hsa_acc=7373578919&hsa_cam=22835379762&hsa_grp=184661742362&hsa_ad=766399187256&hsa_src=g&hsa_tgt=kwd-532915517679&hsa_kw=ml%20datasets&hsa_mt=p&hsa_net=adwords&hsa_ver=3&gad_source=1&gad_campaignid=22835379762&gbraid=0AAAAApQT94lRAgU_hSN23gQFoPXlkvTA6&gclid=Cj0KCQjw_rPGBhCbARIsABjq9ccSlWcC4PbVUiUcXcZKopEP72HyRifrKWRV_4DKS-1pqOuR8_NWuD4aAmaZEALw_wcB" target="_blank">FiftyOne</a><br>
*Open-source visualization tool for exploring datasets and model predictions.*<br>
> * Offers an interactive web interface for identifying edge cases, outliers, duplicates and mislabeled samples.
> * Provides inspiration for implementing dynamic data visualizations in our frontend.
> * Used for inpiration to clean the dataset before conducting predictions.

3. Kaplan–Meier online calculators (various web tools) as an inspiration for practical implementation techniques.<br>
*Commonly used in research to generate survival plots.*<br>
> * Inspires us to develop a modern, accessible, and responsive UI to visualize similar results through our web app.
> * Potentially useful for understanding frontend charting requirements and simplifying complex statistical outputs.
> * Demonstrates how to display survival analysis results to end users, but interfaces are often outdated.<br><br><br>


## Open-source products

1. <a href="https://github.com/shi-ang/MakeSurvivalCalibratedAgain/" target="_blank">MTLR model</a>  
*Provides the predictive model integrated into our system.*<br> 
> * We will serve this model through our Django backend API, ensuring predictions can be accessed from the web interface.
> * Helps define how backend–model integration and asynchronous data handling will work in production.<br>

2. <a href="https://github.com/Recedivies/django-react-template">Recedivies / django-react-template</a>  
*Boilerplate for a Django REST + React + PostgreSQL architecture.*<br> 
> * Provides a reference for full-stack project structure, including routing, authentication, and database connections.
> * Guides our Docker setup and CI/CD process for deployment and development efficiency.<br>

3. <a href="https://github.com/rudranag/Django-Vite-Boilerplate" target="_blank">Rudranag / Django-Vite-Boilerplate</a>  
*Integrates Vite with Django for optimized frontend builds.*<br> 
> * Helps streamline frontend development and enables hot module reloading.
> * Inspires efficient React + Django integration in our workflow.<br>

4. <a href="https://github.com/jazzband/djangorestframework-simplejwt" target="_blank">SimpleJWT (Django REST Framework JWT Authentication)</a>  
*Provides authentication and authorization mechanisms for Django REST APIs.*<br> 
> * Will be used to secure user sessions and API access for model predictions through tokens.
> * Guides our Docker setup and CI/CD process for deployment and development efficiency. 

5. <a href="https://github.com/SeleniumHQ/selenium" target="_blank">Selenium</a>  
*Browser automation framework for testing web apps.*<br> 
> * Used for end-to-end UI testing to verify data submission, result generation, and backend communication.
> * Ensures reliability and performance of critical workflows across frontend and backend.<br>

6. Other survival analysis libraries (R survival, Python lifelines)<br>
*Primarily for backend algorithmic reference rather than web features.*<br> 
> * Used to understand data handling and result computation before adapting methods to our Django API.
> * Used commonly but not nearly as user-friendly for non-tech-based professionals who may want to conduct further resarch in the field<br><br><br>


## Technical Resources

### Backend: Django + PostgreSQL
* > [Django Documentation](https://docs.djangoproject.com/en/5.2/) — core backend framework
* > [Django Rest Framework Tutorial](https://www.django-rest-framework.org/tutorial/quickstart/) — for building RESTful APIs
* > [Postgres Documentation](https://www.postgresql.org/docs/) — relational database used for data persistence
* > [Supabase Documentation](https://supabase.com/docs) - open-source backend service platform providing PostgreSQL hosting, authentication, and RESTful APIs for database access

### Frontend: React + TypeScript
* > [React + Typescript Setup](https://react.dev/learn/typescript) — frontend logic and component typing
* > [Vite Guide](https://vite.dev/guide/) — for fast build and development environment
* > [React Router Reference](https://reactrouter.com/start/modes#framework) — navigation and routing between pages
* > [Tailwind CSS Documentation](https://tailwindcss.com/docs/installation/framework-guides/react-router) — UI styling and responsiveness
* > [Zustand Tutorial](https://zustand.docs.pmnd.rs/getting-started/introduction) — state management for global data
* > [Selenium Documentation](https://django-selenium.readthedocs.io/en/latest/) — UI and integration testing

### Deployment:

*To be finalized in coordination with the client (likely Docker + cloud-based deployment).*
