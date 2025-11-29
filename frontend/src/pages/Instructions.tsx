import type { JSX } from "react/jsx-runtime";
import { useState, useEffect } from "react";

export default function Instructions(): JSX.Element {
  const [activeSection, setActiveSection] = useState("user-account");

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  // Update active section based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        "user-account",
        "create-predictor",
        "retrain-predictor",
        "make-predictions",
        "pssp-tutorial",
      ];

      // Find the section that's currently in view
      let currentSection = sections[0];
      for (const sectionId of sections) {
        const element = document.getElementById(sectionId);
        if (element) {
          const rect = element.getBoundingClientRect();
          // Check if section is in the top portion of viewport
          if (rect.top <= 100) {
            currentSection = sectionId;
          }
        }
      }
      setActiveSection(currentSection);
    };

    window.addEventListener("scroll", handleScroll);
    // Call once to set initial state
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const sidebarItems = [
    { id: "user-account", label: "User Account Management" },
    { id: "create-predictor", label: "Create a Predictor" },
    { id: "retrain-predictor", label: "Retrain a predictor" },
    {
      id: "make-predictions",
      label: "Make Predictions using an Existing Predictor",
    },
    { id: "pssp-tutorial", label: "ISD Tutorial" },
  ];

  return (
    <div className='mx-auto flex min-h-screen'>
      {/* Sidebar - dedicated area */}
      <div className='w-64 p-4'>
        <div className='bg-black text-white p-4 rounded-lg sticky top-20 h-fit'>
          <nav className='space-y-1'>
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`block text-left px-3 py-2 text-sm rounded transition-all duration-200 w-full cursor-pointer ${
                  activeSection === item.id
                    ? "bg-gray-700 text-white font-medium"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className='flex-1 p-4 pt-4'>
        <div className='w-full space-y-6'>
          {/* Page Status Notice */}
          <div className='bg-neutral-200 border border-neutral-400 rounded-lg p-4 mb-6'>
            <h2 className='text-lg font-semibold text-neutral-1000 mb-2'>
              ✎𓂃 Instructions Page - In Development
            </h2>
            <p className='text-neutral-700 text-sm'>
              This page is currently in progress and will be updated with
              comprehensive instructions once the full website functionality is
              implemented. Check back soon for detailed guides on using all ISD
              features.
            </p>
          </div>

          {/* User Account Management Section */}
          <section id='user-account' className='scroll-mt-4'>
            <h2 className='text-2xl font-bold text-gray-900 mb-4'>
              User Account Management
            </h2>
            <p className='text-gray-600 mb-3 text-sm'>
              Learn how to manage your PSSP account, update profile settings,
              and configure preferences.
            </p>
            <p className='text-gray-500 italic text-sm mb-8'>
              Detailed instructions for account management will be available
              here once the user system is fully implemented.
            </p>
          </section>

          {/* Create a Predictor Section */}
          <section id='create-predictor' className='scroll-mt-4'>
            <h2 className='text-2xl font-bold text-gray-900 mb-4'>
              Create a Predictor
            </h2>
            <p className='text-gray-600 mb-3 text-sm'>
              Step-by-step guide on how to create your own protein secondary
              structure prediction model.
            </p>
            <p className='text-gray-500 italic text-sm mb-8'>
              Instructions for creating predictors will include data upload
              requirements, model configuration options, and training
              parameters.
            </p>
          </section>

          {/* Retrain a Predictor Section */}
          <section id='retrain-predictor' className='scroll-mt-4'>
            <h2 className='text-2xl font-bold text-gray-900 mb-4'>
              Retrain a Predictor
            </h2>
            <p className='text-gray-600 mb-3 text-sm'>
              Instructions for retraining existing predictors with new data or
              updated parameters.
            </p>
            <p className='text-gray-500 italic text-sm mb-8'>
              This section will cover how to improve model performance through
              retraining and fine-tuning techniques.
            </p>
          </section>

          {/* Make Predictions Section */}
          <section id='make-predictions' className='scroll-mt-4'>
            <h2 className='text-2xl font-bold text-gray-900 mb-4'>
              Make Predictions using an Existing Predictor
            </h2>
            <p className='text-gray-600 mb-3 text-sm'>
              Learn how to use trained predictors to analyze protein sequences
              and generate secondary structure predictions.
            </p>
            <p className='text-gray-500 italic text-sm mb-8'>
              Detailed workflow for inputting protein sequences, selecting
              appropriate predictors, and interpreting results will be provided
              here.
            </p>
          </section>

          {/* ISD Tutorial Section */}
          <section id='pssp-tutorial' className='scroll-mt-4'>
            <h2 className='text-2xl font-bold text-gray-900 mb-4'>
              PSSP Tutorial
            </h2>
            <p className='text-gray-600 mb-3 text-sm'>
              Comprehensive tutorial covering protein secondary structure
              prediction concepts and best practices.
            </p>
            <p className='text-gray-500 italic text-sm mb-8'>
              This tutorial will include background information on protein
              structure, prediction algorithms, and practical tips for getting
              the best results.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
