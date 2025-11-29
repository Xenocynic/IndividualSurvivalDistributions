// src/pages/About.tsx
// ISD About page — preserves the exact order of the client’s provided text
// Inline hyperlinks styled in blue as shown in the mock; figures labeled Fig 1–4.

import { useState } from "react";
import fig1 from "../assets/Fig_1.png";
import fig2 from "../assets/Fig_2.png";
import fig3_left from "../assets/Predicted_survival_curve_Patient_B.png";
import fig3_right from "../assets/Predicted_survival_curve_Patient_A.png";
import fig4 from "../assets/Fig_4.png";

const LINKS = {
  // Replace these with real URLs later
  analyzeSite: "http://localhost:5173/instructions",
  downloadCli: "http://pssp.srv.ualberta.ca/downloads/new",
  slides:
    "https://www.ualberta.ca/en/computing-science/resources/technical-support/your-web-presence/setting-up-your-web-space.html",
  tutorial:
    "https://docs.google.com/presentation/d/1QynSDJYSKZvB2mR8GBg5jH2fuVYr_QmlzXEN6q3QvpY/pub#slide=id.p",
  predictors: "http://localhost:5173/browse",
  demo: "http://pssp.srv.ualberta.ca/home/index",
  summary2025:
    "https://docs.google.com/document/d/1cgClW-OZOmlQdK_D7BGl00aaJLG0v9Jau0ES3T6hhdQ/edit?tab=t.0",
};

export default function About() {
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <main className="min-h-[calc(100vh-var(--app-nav-h,3.7rem))] bg-neutral-100">
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 text-neutral-900">
        {/* Page header */}
        <header className="mb-6 border-b border-neutral-200 pb-4">
          <h1 className="text-2xl font-extrabold leading-tight text-neutral-900 md:text-3xl">
            Individual Survival Distribution (ISD)
          </h1>
        </header>

        <div className="space-y-6">
          {/* Opening paragraphs + Fig 1 */}
          <section className="rounded-xl border border-neutral-200 bg-white/90 p-5 shadow-sm">
            <p className="leading-7 text-sm md:text-[15px]">
              A “survival prediction” model predicts the time to an event for
              each individual. While the standard example is “time to death” for
              a specific patient, there are many other applications – eg, in
              medicine, this could be the time to relapse, or the time to
              recovery; in business, this could be the time until a specific
              customer stops shopping at a particular store (customer churn); in
              engineering, the time until a part stops functioning; etc.
            </p>
            <p className="mt-4 leading-7 text-sm md:text-[15px]">
              Here, we provide a way to learn this survival prediction model
              from a “survival dataset”, which describes many previous
              subjects, including a specific time for each subject. This
              resembles regression, as we want to learn a real-valued function
              (mapping each subject to a non-negative real value) from a
              dataset, but differs as our dataset includes “censored instances”,
              which provides only a lower bound on the time. Consider, for
              example, a 5-year study that began in 1990. Over that 5-year
              interval, some patients died, but many were still alive when the
              study ended; others left the study before, and so were “lost to
              follow-up” – see left part of the following figure.
            </p>
            <figure className="mt-5">
              <img
                src={fig1}
                alt="Censoring timeline and patient table showing Time and Censored bit"
                className="mx-auto rounded-xl border border-gray-300 bg-white object-contain shadow-sm"
                onClick={() => setPreview(fig1)}
              />
              <figcaption className="mt-2 text-center text-xs text-neutral-600">
                Fig 1: …
              </figcaption>
            </figure>
          </section>

          {/* Censoring explanation + KM description + Fig 2 */}
          <section className="rounded-xl border border-neutral-200 bg-white/90 p-5 shadow-sm">
            <p className="leading-7 text-sm md:text-[15px]">
              These patients are considered “censored” – see the table on the
              right side of that figure, and note the “label” for every patient
              includes both a real-valued “Time”, and also a “Censored” bit: by
              convention, with “1” meaning uncensored [think “death”] and “0”
              for censored [meaning the time shown is a lower-bound on the
              time-to-death”]. If only a few percent were censored, we could
              easily just ignore those censored instances at training time.
              However, many datasets have many many censored instances – think
              &gt;80% !
            </p>
            <p className="mt-4 leading-7 text-sm md:text-[15px]">
              This means we cannot simply use the standard regression algorithms
              that require that the label be completely specified, which has
              forced the Survival Prediction community to develop different
              types of learned models. Some approaches instead learn “risk
              scores” – a number predicting who will die first (n.b., this
              number is typically not a time) – while others learn single-time
              probability – like a 25% chance of dying within 1 year. Note that
              neither of these describe a TIME to Death. Another approach
              produces a survival distribution for all patients (often using the
              Kaplan-Meier estimator) such as the curve shown in the figure
              below – here, for patients with Stage 4 Stomach Cancer. Each
              point on the line gives the probability that an individual will
              live (at least) this long – so here we see that 75% of these
              patients will live ≥ 9.5 months, 50% will live ≥ 20.5 months, and
              25%, ≥ 50 months. We can then use the median value (corresponding
              to the 50% probability) as our estimated time to the event – here,
              this is 20.5 months.
            </p>
            <figure className="mt-5">
              <img
                src={fig2}
                alt="Kaplan–Meier curve with median at 20.5 months"
                className="mx-auto rounded-xl border border-gray-300 bg-white object-contain shadow-sm"
                onClick={() => setPreview(fig2)}
              />
              <figcaption className="mt-2 text-center text-xs text-neutral-600">
                Fig 2: …
              </figcaption>
            </figure>
          </section>

          {/* ISD vs aggregate + Fig 3 (left, right) */}
          <section className="rounded-xl border border-neutral-200 bg-white/90 p-5 shadow-sm">
            <p className="leading-7 text-sm md:text-[15px]">
              The problem with this approach is that the graph, at each time,
              just reflects the probability, over a set of patients. Our
              "Individual Survival Distribution (ISD)” approach differs by
              providing truly personalized predictions of each patient’s
              survival times. Figure 3 shows the ISDs produced for 2 of these
              stage 4 stomach cancer patients. While the aggregated approach
              (Fig 2) shows that these patients, in general, would live around
              20.5 months, when considered individually, we see that their ISDs
              (accurately) predicted these patients to have very different
              survival curves – and hence, very different estimated survival
              times: 3 months for (left) and 18 months for (right).
            </p>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <img
                src={fig3_left}
                alt="ISD example — left patient (~3 months)"
                className="rounded-xl border border-gray-300 bg-white object-contain shadow-sm"
                onClick={() => setPreview(fig3_left)}
              />
              <img
                src={fig3_right}
                alt="ISD example — right patient (~18 months)"
                className="rounded-xl border border-gray-300 bg-white object-contain shadow-sm"
                onClick={() => setPreview(fig3_right)}
              />
            </div>
            <p className="mt-2 text-center text-xs text-neutral-600">
              Fig 3 (left, right)
            </p>
          </section>

          {/* Many ISDs + Fig 4 */}
          <section className="rounded-xl border border-neutral-200 bg-white/90 p-5 shadow-sm">
            <p className="leading-7 text-sm md:text-[15px]">
              Figure 4 shows many ISDs, to illustrate the wide range of curves
              – and range of expected survival times – for this single disease.
            </p>
            <figure className="mt-5">
              <img
                src={fig4}
                alt="Overlay of many predicted individual survival curves"
                className="mx-auto rounded-xl border border-gray-300 bg-white object-contain shadow-sm"
                onClick={() => setPreview(fig4)}
              />
              <figcaption className="mt-2 text-center text-xs text-neutral-600">
                Fig 4 …
              </figcaption>
            </figure>
          </section>

          {/* Links paragraph + CTA button + final paragraph with link */}
          <section className="rounded-xl border border-neutral-200 bg-white/90 p-5 shadow-sm">
            <p className="leading-7 text-sm md:text-[15px]">
              This website provides access to the ISD codebase. You can either{" "}
              <a
                href={LINKS.analyzeSite}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 underline-offset-2 hover:underline"
              >
                analyze your data set on this site
              </a>
              , or{" "}
              <a
                href={LINKS.downloadCli}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 underline-offset-2 hover:underline"
              >
                download the source for the command-line ISD tool
              </a>
              . To better understand ISD, see the slides and presentation{" "}
              <a
                href={LINKS.slides}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 underline-offset-2 hover:underline"
              >
                here
              </a>
              ; and how to use this website, see the{" "}
              <a
                href={LINKS.tutorial}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 underline-offset-2 hover:underline"
              >
                Tutorial
              </a>
              .
            </p>
            <p className="mt-4 leading-7 text-sm md:text-[15px]">
              You can also look at our publicly accessible predictors{" "}
              <a
                href={LINKS.predictors}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 underline-offset-2 hover:underline"
              >
                here
              </a>
              .
            </p>
            <div className="mt-5 flex justify-center">
              <a
                href={LINKS.demo}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-neutral-700 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
              >
                View The Demo
              </a>
            </div>
            <p className="mt-5 leading-7 text-sm md:text-[15px]">
              For more information about Survival Prediction in general, and
              about ISDs in particular, check out{" "}
              <a
                href={LINKS.summary2025}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 underline-offset-2 hover:underline"
              >
                Survival Prediction Summary (2025)
              </a>{" "}
              – which also includes tutorials, slides, and recent results.
            </p>
          </section>
        </div>
      </div>

      {/* Lightbox */}
      {preview && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] rounded-2xl border border-neutral-200 bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={preview}
              alt="Preview"
              className="max-h-[80vh] max-w-[85vw] rounded-lg object-contain"
            />
            <button
              className="absolute right-3 top-3 inline-flex items-center rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white shadow hover:bg-neutral-800"
              onClick={() => setPreview(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
