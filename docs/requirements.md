# Project Requirements

## Executive Summary

This project's aim is to design and implement a website from the ground up that allows users to easily learn, evaluate and use Individual Survival Distributions (ISD). The current website has access issues, and the existing tools for learning and evaluating ISD models are slow, cumbersome and lack extensive features. The new website is intended for researchers and will provide functionality to upload a survival dataset, train models with adjustable parameters, evaluate the models using various metrics and run predictions on new unlabeled instances. 

## Project Glossary

* **ISD** - Individual Survival Distributions 

* **LIU** - Logged-in user

## User Stories

For each user story, you must formulate detailed acceptance tests.

User stories must be prioritized using the MoSCoW method.

### 1. User Access 

#### US 1.1 

> As a user, I want to log in and log out using my Google account, so that I can save my datasets and predictions. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can click the button "Sign In With Google Account"<br>

2. User is prompted with a pop-up to choose their Google Account<br>

3. User can not sign up without a Google Account<br>

</details><br> 

#### US 1.2 

> As a Superuser/Admin, I want to log in and log out using my UAlberta credentials, so that I can view others' datasets and predictions. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User is given the option to sign in using their UAlberta credentials Google Account<br>

2. User is validated in the database to be a Superuser/Admin<br>

3. User is given access to a separate Superuser/Admin tab<br>

4. With this tab, the Superuser/Admin can view all datasets and select them to view predictions<br>

</details><br> 

#### US 1.3 

> As a user, I want to upload a dataset and verify it is formatted correctly, so that I can avoid errors in model training. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can navigate to an "upload dataset" button<br>

2. User can upload their dataset using a file upload for .csv files<br>

3. Tests to ensure all columns / rows are formatted in accordance to the machine learning model's requirements<br>

4. User is prompted with the detected errors, if there are any<br>

5. User is allowed to continue if no errors are detected<br>

</details><br> 

>> #### US 1.3.1 

>>> As a user, I want to be able to make a dataset private or public, so that I can control its access. 

<details>
<summary>Acceptance Tests</summary><br> 

1. When uploading or viewing their datasets, user can select privacy<br>

2. User can select other Google Accounts to share datasets when private<br>

3. User can share the link of the dataset to other users when public<br>

</details><br> 

#### US 1.4 

> As a user, I want to search for a stored dataset/model that I have created or been granted access to, so that I can use it for my own predictions. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can search for datasets using the search tab<br>

2. User can filter datasets by Owned, Shared, and Public<br>

3. Website searches and filters datasets based on user's filters<br>

4. User can select and view queried datasets<br>

</details><br> 

#### US 1.5 

> As a Superuser/Admin, I want to be able to view all of the public/private datasets/models, so that I can collect general statistics regarding model training and usage. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can search through all datasets<br>

2. When searching, Superuser/Admin can add a filter to search for all datasets<br>

3. Statistics are automatically collected by the<br>

</details><br> 

### 2. Interface

#### US 2.1 

> As a user, I want an interface that allows me to identify an accessible dataset, a specific learning tool, and a specification of that learner’s hyperparameter, so that I can save time in choosing manually. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can see available learning tools on a dataset's information page<br>

2. Interface displays information about which learning tool was used for each dataset<br>

</details><br> 

>> #### US 2.1.1 

>>> As a user, I want to run this specific learner on that dataset, and save the resulting trained model securely, so that I can save my runs. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can select learners for different datasets<br>

2. System automatically saves trained models in "versions"<br>

3. User can access different versions of learners on the dataset's page<br>

</details><br> 

#### US 2.2 

> As a user, I want the website to include several learning tools, each with its own set of parameters, so I can save time generating separate predictions for each metric. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can select betwen different learning tools on dataset information page<br>

2. Website displays all learning tools with their own required parameters<br>

</details><br> 

#### US 2.3 

> As a user, I want the interface to show the show the (cross-validation) evaluation of the quality of this learned model, in terms of several metrics, so that I can cross-validate. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can see cross-validation evaluation for learned models on a dataset information page<br>

2. User can view a variety of metrics of the model's cross-validation<br>

</details><br> 

### 3. Running

#### US 3.1 

> As a user, I want to upload input data as spreadsheets and .csv files, so that it's easier to upload and use. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can upload .csv files using an "upload dataset" button<br>

2. Website will validate and ensure the file is formatted properly<br>

</details><br> 

#### US 3.2 

> As a user, I want to run an accessible learned survival model on one or more unlabeled instances, so that I can generate predictions using my trained models. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can run learned survival models on unlabeled instances using the database information page<br>

</details><br> 

#### US 3.3 

> As a user, I want to receive predictions as ISD, like perhaps a graph of [time, probability] pairs, so that I can store them easily. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can view ISD predictions on the prediction information page<br>

2. User can view generated graphs and tweak graph settings<br>

3. User can easily download and store graphs<br>

</details><br> 

#### US 3.4 

> As a user, I want facilities for showing the quality of an accessible learned model, on a held-out (labelled) dataset, in terms of several metrics, so that I can understand outputted predictions easily. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can view all metrics of learned models on the prediction information page<br>

</details><br> 

#### US 3.5 

> As a Superuser/Admin, I want to be able to analyze others' datasets, so that I can understand general usage. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can view others' dataset usage on an admin panel<br>

2. User can view all dataset usage statistics<br>

</details><br> 

#### US 3.6 

> As a user, I want #features, #instances and censor rate for each dataset, so that I can evaluate my uploaded dataset more easily. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can view all feature, instance, and censor rate for each dataset on the dataset information page<br>

2. User can download information and statistics using this page<br>

</details><br> 

### 4. Documentation 

#### US 4.1 

> As a user, I want instructions and a tutorial on how to use the website, so that I can easily navigate the website. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User will be able to watch a guided video on the "help" page of the website<br>

2. User will also be able to read more detailed instructions on this help page<br>

</details><br> 

#### US 4.2 

> As a user, I want a guided tour, so that I can get familiar using the different features and models on the website. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User will be prompted to start a guided tour when visiting the website for the first time on their google account<br>

2. Various buttons and sections of the website will be highlighted<br>

3. Text will describe what each section is for and how to use it<br>

</details><br> 

### 5. Optional 

#### US 5.1 

> As a user, I want to be able to download my results, so that I can save them on my local device. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User will be able to download results/graphs/statistics on the prediction information page<br>

</details><br> 

#### US 5.2 

> As a user, I want to an active budgeted learning for “de-censoring”, and dealing with left and interval-censoring, so that I may generate more precise predictions. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User can change specific settings regarding "de-censoring"<br>

2. User can generate more precise predictions by specifying censoring information<br>

</details><br> 

#### US 5.3 

> As a user, I want the website to also be an add-on package for excel, SPSS, so that I may use it directly from my spreadsheets. 

<details>
<summary>Acceptance Tests</summary><br> 

1. User will be able to download an excel/SPSS add-on from their respective tooling services

2. The add-on will assist in displaying information to the user

</details><br> 

## Similar products

1. <a href="https://mlconsole.com/" target="_blank">ML Console</a>
> * Builds AI models by using uploaded dataset
> * Secure data and predictions
> * Used for inspiration to produce model predictions

2. <a href="https://voxel51.com/landing/ml-datasets?utm_source=google&utm_medium=search&utm_campaign=ML_Datasets&utm_term=ml%20datasets&device=c&utm_source=google&utm_medium=cpc&utm_campaign=22835379762&utm_term=ml%20datasets&utm_content=184661742362&hsa_acc=7373578919&hsa_cam=22835379762&hsa_grp=184661742362&hsa_ad=766399187256&hsa_src=g&hsa_tgt=kwd-532915517679&hsa_kw=ml%20datasets&hsa_mt=p&hsa_net=adwords&hsa_ver=3&gad_source=1&gad_campaignid=22835379762&gbraid=0AAAAApQT94lRAgU_hSN23gQFoPXlkvTA6&gclid=Cj0KCQjw_rPGBhCbARIsABjq9ccSlWcC4PbVUiUcXcZKopEP72HyRifrKWRV_4DKS-1pqOuR8_NWuD4aAmaZEALw_wcB" target="_blank">FiftyOne</a> 
> * Identifies edge cases, outliers, duplicates and mislabeled samples
> * Visualizes images, video, 3D in an interactive UI
> * Used for inpiration to clean the dataset before conducting predictions

## Open-source products

1. <a href="https://github.com/shi-ang/SurvivalEVAL" target="_blank">MAE-PO (SurvivalEVAL)</a>

2. <a href="https://github.com/shi-ang/MakeSurvivalCalibratedAgain" target="_blank">CSD/CiPOT (MakeSurvivalCalibratedAgain)</a>

3. <a href="https://github.com/shi-ang/BNN-ISD" target="_blank">BNN-ISD</a>

## Technical resources

### Backend: 

TBD

### Frontend: 

TBD

### Deployment:

TBD