# Project Requirements

## Executive Summary

EZ Survival Prediction is a brownfield project based on the existing PSSP survival prediction site. The current website is 7–8 years old, slow, and difficult to navigate, and the existing tools for learning and evaluating ISD models are slow, cumbersome and lack extensive features. Our product will let machine learning researchers and other practitioners in the relevant fields upload survival datasets, train survival models with adjustable parameters using various learning tools, evaluate the models using various metrics and run predictions on new unlabeled instances, and obtain Individual Survival Distributions (ISDs) for new instances. The system will also allow the secure storage, search, and evaluation of datasets and models. 

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

#### US 1.1 

> As a user, I want to log in and log out using my Google account, so that I can save my datasets and predictions. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

#### US 1.2 

> As a Superuser/Admin, I want to log in and log out using my UAlberta credentials, so that I can view others' datasets and predictions. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

#### US 1.3 

> As a user, I want to upload a dataset and verify it is formatted correctly, so that I can avoid errors in model training. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

>> #### US 1.3.1 

>>> As a user, I want to be able to make a dataset private or public, so that I can control its access. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

#### US 1.4 

> As a user, I want to search for a stored dataset/model that I have created or been granted access to, so that I can use it for my own predictions. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

#### US 1.5 

> As a Superuser/Admin, I want to be able to view all of the public/private datasets/models, so that I can collect general statistics regarding model training and usage. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

### 2. Interface

#### US 2.1 

> As a user, I want an interface that allows me to identify an accessible dataset, a specific learning tool, and a specification of that learner’s hyperparameter, so that I can save time in choosing manually. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

>> #### US 2.1.1 

>>> As a user, I want to run this specific learner on that dataset, and save the resulting trained model securely, so that I can save my runs. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

#### US 2.2 

> As a user, I want the website to include several learning tools, each with its own set of parameters, so I can save time generating separate predictions for each metric. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

#### US 2.3 

> As a user, I want the interface to show the show the (cross-validation) evaluation of the quality of this learned model, in terms of several metrics, so that I can cross-validate. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

### 3. Running

#### US 3.1 

> As a user, I want to upload input data as spreadsheets and .csv files, so that it's easier to upload and use. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

#### US 3.2 

> As a user, I want to run an accessible learned survival model on one or more unlabeled instances, so that I can generate predictions using my trained models. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

#### US 3.3 

> As a user, I want to receive predictions as ISD, like perhaps a graph of [time, probability] pairs, so that I can store them easily. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

#### US 3.4 

> As a user, I want facilities for showing the quality of an accessible learned model, on a held-out (labelled) dataset, in terms of several metrics, so that I can understand outputted predictions easily. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

#### US 3.5 

> As a Superuser/Admin, I want to be able to view and analyze others' datasets, so that I can understand general usage. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

#### US 3.6 

> As a user, I want #features, #instances and censor rate for each dataset, so that I can evaluate my uploaded dataset more easily. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

### 4. Documentation 

#### US 4.1 

> As a user, I want instructions and a tutorial on how to use the website, so that I can easily navigate the website. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

#### US 4.2 

> As a user, I want a guided tour, so that I can get familair using the different features and models on the website. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

### 5. Optional 

#### US 5.1 

> As a user, I want to be able to download my results, so that I can save them on my local device. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

#### US 5.2 

> As a user, I want to an active budgeted learning for “de-censoring”, and dealing with left and interval-censoring, so that I may generate more precise predictions. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 

#### US 5.3 

> As a user, I want the website to also be an add-on package for excel, SPSS, so that I may use it directly from my spreadsheets. 

<details>
<summary>Acceptance Tests</summary><br> 

...

</details><br> 


## MoSCoW

### Must Have

### Should Have

### Could Have

### Would Like But Won't Get<br>


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

4. Kaplan–Meier online calculators (various web tools) for practical implementation techniques.<br>


## Open-source products

- Client’s colleagues’ (Shi-ang Qi) GitHub repository with existing learning tools (will be provided soon).
- Public datasets from the “predictors” tab of old site (use as test data).aaaaaaaaaa<br>


## Technical resources

### Brownfield Documentation
>- <a href="https://docs.google.com/document/d/1DmFf9IDluLoiTbr6PEhBdytxpxbRrxwnVw2zilON0GE/edit?usp=sharing" target="_blank">PSSP User Guide</a> (provided by client) 
>- <a href="https://papers.nips.cc/paper_files/paper/2011/file/1019c8091693ef5c5f55970346633f92-Paper.pdf" target="_blank">NIPS paper on Cancer Research</a>
>- Presentations and papers on the research being supported by the project. (provided by client)

### Backend: 

Ruby on Rails + C++ / R

### Frontend: 

React / Vite + TypeScript + Tailwind CSS + Zustand + React Router

### Deployment:

TBD