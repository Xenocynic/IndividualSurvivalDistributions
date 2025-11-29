import { Link } from "react-router-dom";
import type { JSX } from "react/jsx-runtime";
import { useState, useEffect } from "react";

export default function Instructions(): JSX.Element {
  const [activeSection, setActiveSection] = useState("overview");

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  // All subsection IDs in one list
  const sectionIds = [

    // Getting Started
    "getting-started",
    "overview",
    "edit-profile",
    "dashboard-basics",

    // Working with Datasets
    "datasets",
    "upload-dataset",
    "folder-management",

    // Building Predictors
    "predictors",
    "save-draft",
    "train-predictor",
    "retrain-predictor",
    "predictor-detail",

    // Using Predictors
    "using-predictors",
    "use-predictor",
    "filter-search",

    // Help
    "help",
    "troubleshooting",
    "glossary",
  ];

  useEffect(() => {
    const handleScroll = () => {
      let current = sectionIds[0];
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 100) current = id;
        }
      }
      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Sidebar structure
  const sidebarItems = [
    {
      title: "Getting Started",
      id: "getting-started",
      children: [
        { id: "overview", label: "Video Walkthrough" },
        { id: "edit-profile", label: "Account Details" },
        { id: "dashboard-basics", label: "Dashboard Basics" },
      ],
    },
    {
      title: "Datasets and Folders",
      id: "datasets",
      children: [
        { id: "upload-dataset", label: "Upload a Dataset" },
        { id: "folder-management", label: "Folder Management" },
      ],
    },
    {
      title: "Building Predictors",
      id: "predictors",
      children: [
        { id: "save-draft", label: "Save Draft Predictor" },
        { id: "train-predictor", label: "Train a Predictor" },
        { id: "retrain-predictor", label: "Retrain a Predictor" },
        { id: "predictor-detail", label: "Predictor Detail Page" },
      ],
    },
    {
      title: "Using Predictors",
      id: "using-predictors",
      children: [
        { id: "use-predictor", label: "Make Predictions" },
        { id: "filter-search", label: "Filtering & Search" },
      ],
    },
    {
      title: "Help & Support",
      id: "help",
      children: [
        { id: "troubleshooting", label: "Troubleshooting" },
        { id: "glossary", label: "Glossary" },
      ],
    },
  ];

  return (
    <div className="mx-auto flex min-h-screen">
      {/* Sidebar */}
      <div className="w-64 p-4">
        <div className="bg-black text-white p-4 rounded-lg sticky top-20 h-fit">
          <h2 className="text-sm font-semibold mb-3 tracking-wide uppercase">
            Instructions
          </h2>

          {sidebarItems.map((section) => (
            <div key={section.id} className="mb-4">
              {/* Main Section Title */}
              <button
                onClick={() => scrollToSection(section.id)}
                className={`w-full text-left font-semibold text-sm mb-1 px-2 py-1 rounded ${section.children.some((c) => c.id === activeSection) ||
                  activeSection === section.id
                  ? "bg-gray-700 text-white"
                  : "text-gray-200 hover:bg-gray-800"
                  }`}
              >
                {section.title}
              </button>

              {/* Subsections */}
              <div className="ml-3 space-y-1">
                {section.children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => scrollToSection(child.id)}
                    className={`block w-full text-left text-xs px-2 py-1 rounded transition ${activeSection === child.id
                      ? "bg-gray-600 text-white"
                      : "text-gray-400 hover:bg-gray-700 hover:text-white"
                      }`}
                  >
                    {child.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 pt-4">
        <div className="w-full space-y-10">

          {/* Overview Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-blue-800 mb-2">
              How to Use This Website
            </h2>
            <p className="text-blue-700 text-sm">
              Please watch the overview video for a quick walkthrough or follow
              the step-by-step sections below to set up your account, upload
              datasets, train predictors, and make Survival Analysis Predictions.
            </p>
          </div>

          {/* Getting Started    */}
          <section id="getting-started" className="scroll-mt-20">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Getting Started
            </h1>
            <p className="text-sm text-gray-600 mb-6">Basic introduction to using the website.</p>
          </section>

          {/* Subsections */}
          <section id="overview" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Video Walkthrough
            </h2>

            <p className="text-gray-600 text-sm mb-4">
              Please begin with this short video walkthrough of the website. It covers
              uploading datasets, training predictors, and running predictions.
            </p>

            <div className="w-full max-w-3xl aspect-video bg-black/80 rounded-xl flex items-center justify-center text-gray-200 text-sm mb-6">
              <span>Embed tutorial video here.</span>
            </div>
          </section>

          <section id="edit-profile" className="scroll-mt-20">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Account Details
            </h2>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              <li><Link to="/signup" className="text-blue-500 underline">
                Sign Up
              </Link> for an account.</li>
              <li><Link to="/signup" className="text-blue-500 underline">
                Sign in
              </Link> using your account.</li>
              <li>Please reach out to the <a href="mailto:rgreiner@ualberta.ca,asgarian@ualberta.ca" className="text-blue-500 underline">
                administrators
              </a> to recieve Superuser or Admin access beyond the general User access.</li>
              <li>Click{" "}
                <Link to="/reset" className="text-blue-500 underline">
                  Forgot Password?
                </Link> to reset your password if you cannot login.</li>
              <li>Please use{" "}
                <Link to="/settings" className="text-blue-500 underline">
                  Settings
                </Link> to edit your primary account details or change your password while logged in.</li>
            </ul>
          </section>

          <section id="dashboard-basics" className="scroll-mt-20">
            <h2 className="text-xl font-semibold mb-2">Dashboard Basics</h2>
            <p className="text-sm text-gray-600">
              The Dashboard displays all predictors/datasets/folders that you have created. Learn how to navigate the dashboard.
            </p><br />
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              <li> The <Link to="/dashboard" className="text-blue-500 underline">
                Dashboard
              </Link> displays all <Link to="/dashboard?tab=predictors" className="text-blue-500 underline">
                  predictors
                </Link>/<Link to="/dashboard?tab=datasets" className="text-blue-500 underline">
                  datasets
                </Link>/<Link to="/dashboard?tab=folders" className="text-blue-500 underline">
                  folders
                </Link> that you have created or have been granted access to.</li>
              <li> You may drag and drop predictors, and datasets into the sidebar of folders to organize them.</li>
              <li> Click on an item’s card to view, edit, or delete it using the action buttons that appear.</li>
            </ul>
          </section>

          {/* Working with Datasets */}
          <section id="datasets" className="scroll-mt-20">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Datasets and Folders
            </h1>
            <p className="text-sm text-gray-600">
              Upload datasets, organize them into folders, and manage stored data.
            </p>
          </section>

          <section id="upload-dataset" className="scroll-mt-20">
            <h2 className="text-xl font-semibold mb-3">Upload a Dataset</h2>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              <li>You can <Link to="/datasets/new" className="text-blue-500 underline">
                upload a dataset
              </Link> using the Create button in the Dashboard</li>
              <li>Customize the dataset name and description as needed.</li>
              <li>Please ensure that your dataset file is in a supported format (e.g., .csv) and that there are no missing values.
                Otherwise, the upload may fail or produce incorrect results.</li>
              <li>After uploading, open the Datasets tab and click the dataset’s card to view or manage it.</li>
            </ul>
          </section>

          <section id="folder-management" className="scroll-mt-20">
            <h2 className="text-xl font-semibold mb-3">Folder Management</h2>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              <li>You may create new folders using the Create button in the Dashboard.</li>
              <li>You may organize datasets and predictors into folders by drag-and-drop,
                when uploading a dataset or even when creating a folder.</li>
            </ul>
          </section>

          {/* Creating Predictors       */}
          <section id="predictors" className="scroll-mt-20">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Building Predictors
            </h1>
            <p className="text-sm text-gray-600">
              Learn how to train, retrain, and manage predictive models for survival prediction analyses.
            </p>
          </section>

          <section id="save-draft" className="scroll-mt-20">
            <h2 className="text-xl font-semibold mb-3">Save Draft Predictor</h2>
            <p className="text-sm text-gray-600">
              When creating a new predictor, you can save it as a draft without training.
              This allows you to set up the predictor configuration and return later to train it.
            </p><br />
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              <li>Proceed to create a predictor as you normally would but instead click the 'Back' button and choose to
                'Save as Draft' when prompted.</li>
              <li>However, if a dataset is not selected, you cannot save the predictor as a draft and will be prompted to choose one.</li>
              <li>You may now return to the Predictors on the Dashboard tab to view, train or manage your draft predictors.</li>
              <li>All draft predictors are private by default until trained after which the predictor can be made public</li>
            </ul>
          </section>

          <section id="train-predictor" className="scroll-mt-20">
            <h2 className="text-xl font-semibold mb-3">Train a Predictor</h2>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              <li>A predictor is trained on a selected dataset and can use multiple features depending on customised configuration.</li>
              <li>A predictor can be trained and saved during creation or can be saved as a draft to train later.</li>
              <li>The website currently supports the MTLR model. However, more models can be added with the discretion of the administrators.</li>
            </ul>
          </section>

          <section id="retrain-predictor" className="scroll-mt-20">
            <h2 className="text-xl font-semibold mb-3">Retrain a Predictor</h2>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              <li>A trained predictor can be retrained with a new configuration of features.</li>
              <li>A newly retrained predictor may be saved as a new predictor or overwrite the existing one as requested during the retraining.</li>
            </ul>
          </section>

          <section id="predictor-detail" className="scroll-mt-20">
            <h2 className="text-xl font-semibold mb-3">Predictor Detail Page</h2>
            <p className="text-sm text-gray-600">
              Includes metrics, training history, permissions, and prediction interface. You may view detailed information about each predictor on its detail page such as:
            </p><br />
            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
              <li>General Statistics of the dataset</li>
              <li>Feature Correlations in the dataset</li>
              <li>Event Time Histogram & Predicted Survival Histogram</li>
              <li>Advanced Settings for training/retraining the predictor</li>
              <li>Numerous Cross Validations</li>
            </ol>
          </section>

          {/* Using Predictors          */}
          <section id="using-predictors" className="scroll-mt-20">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Using Predictors
            </h1>
            <p className="text-sm text-gray-600">
              Survival Analysis Predictions
            </p>
          </section>

          <section id="use-predictor" className="scroll-mt-20">
            <h2 className="text-xl font-semibold mb-3">Make Predictions</h2>
          </section>

          <section id="filter-search" className="scroll-mt-20">
            <h2 className="text-xl font-semibold mb-3">Filtering & Search</h2>

          </section>

          {/* Help and Support */}
          <section id="help" className="scroll-mt-20">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Help & Support
            </h1>
            <p className="text-sm text-gray-600">
              Get answers to common issues and learn key terminology.
            </p>
          </section>

          <section id="troubleshooting" className="scroll-mt-20">
            <h2 className="text-xl font-semibold mb-3">Troubleshooting</h2>
            <p className="text-sm">
              Common issues and their solutions.
            </p><br />
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              <li>Please ensure that your datasets do not have missing values. If they do, the dataset verification will fail.</li>
              <li>Please reach out to the <a href="mailto:rgreiner@ualberta.ca,asgarian@ualberta.ca" className="text-blue-500 underline">
                administrators
              </a> for help in resolving any further issues.</li>
            </ul>
          </section>

          <section id="glossary" className="scroll-mt-20 mb-10">
            <h2 className="text-xl font-semibold mb-3">Glossary</h2>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              <li><strong>ISD</strong> - Individual Survival Distributions</li>
              <li><strong>Uncensored Data</strong> – Survival time that fully captures a patient’s entire lifespan (i.e., complete data).</li>
              <li><strong>Censored Data</strong> – Incomplete survival time information that represents only a lower bound of a patient’s lifespan. This is common in survival datasets and is a key challenge in the client’s research.</li>
              <li><strong>KM Curve (Kaplan–Meier)</strong> – A standard estimator of the survival function used for comparison.</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
}
