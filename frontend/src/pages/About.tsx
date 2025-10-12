// src/pages/About.tsx
// Wireframe-aligned About page + tweaks:
// - Centered team avatars/names
// - Bottom card uses a light gray background
// - Top-right 2x2 figure grid with click-to-zoom lightbox

import { useState } from "react";

import fig1 from "../assets/Kaplan_Meier_curve_for_Stage_4_stomach_cancer_patients.png";
import fig2 from "../assets/Predicted_survival_curve_Patient_A.png";
import fig3 from "../assets/Predicted_survival_curve_Patient_B.png";
import fig4 from "../assets/Predicted_survival_curves_for_many_subjects.png";

type Person = { id: string; name: string; subtitle: string; photoUrl?: string; href?: string };
type Figure = { id: string; caption: string; src: string; alt: string };

const TEAM: Person[] = [
  { id: "rg", name: "Russ Greiner",   subtitle: "Professor, Computing Science" },
  { id: "vb", name: "Vickie Baracos", subtitle: "Professor, Oncology" },
  { id: "cny", name: "Chun-Nam Yu",   subtitle: "Postdoctoral Fellow, Computing Science" },
];

const FIGURES: Figure[] = [
  { id: "fig1", caption: "Fig. 1", src: fig1, alt: "Kaplan–Meier curve for Stage 4 stomach cancer patients" },
  { id: "fig2", caption: "Fig. 2", src: fig2, alt: "Predicted survival curve – Patient A" },
  { id: "fig3", caption: "Fig. 3", src: fig3, alt: "Predicted survival curve – Patient B" },
  { id: "fig4", caption: "Fig. 4", src: fig4, alt: "Predicted survival curves for many subjects" },
];

const LINKS = {
  nipsPaper:
    "https://papersdb.cs.ualberta.ca/~papersdb/view_publication.php?pub_id=1060",
  nipsPoster:
    "https://papersdb.cs.ualberta.ca/~papersdb/uploaded_files/1060/additional_survival_poster.pdf",
};

function InitialsCircle({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
      {initials}
    </div>
  );
}

export default function About() {
  const [preview, setPreview] = useState<Figure | null>(null);

  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-8">
      {/* HERO: left copy, right figure grid in a box */}
      <section className="grid gap-8 md:grid-cols-2">
        {/* Left: copy */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            About Patient-Specific Survival Prediction (PSSP)
          </h1>

          <div className="mt-4 space-y-4 text-gray-700">
            <p>
              The most commonly used approach for predicting survival times is to create a survival curve for each
              category of patient (often using the Kaplan–Meier estimator) such as the curve shown in Figure 1.
            </p>
            <p>
              The problem with this approach is that it aggregates individual patient characteristics. Our system
              provides truly personalized predictions of patient survival times. Figures 2 and 3 show PSSP produced
              predicted survival times for 2 patients who would receive the same predicted survival time using an
              aggregated approach (as they were both stage 4 stomach cancer). However, when examined individually, we
              see that PSSP (accurately) predicted these patients to have very different survival curves. When looking
              at many patient survival curves at once (Figure 4), we can see that an aggregate approach would obscure
              the wide range of patient-specific survival curves.
            </p>
            <p>This website happens to be where you can access these tools.</p>
          </div>
        </div>

        {/* Right: graphs box with 2x2 grid of figures */}
        <div className="flex items-center justify-center">
          <div className="relative aspect-[4/3] w-full rounded-3xl border border-black/10 bg-gray-100 p-2 shadow-sm">
            <div className="grid h-full grid-cols-2 grid-rows-2 gap-2">
              {FIGURES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPreview(f)}
                  className="group relative overflow-hidden rounded-xl bg-white shadow-sm transition hover:shadow-md"
                  title="Click to enlarge"
                >
                  <img
                    src={f.src}
                    alt={f.alt}
                    className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                  <span className="pointer-events-none absolute bottom-1 right-2 rounded bg-white/80 px-1.5 text-[10px] font-medium text-gray-700 shadow">
                    {f.caption}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHO ARE WE */}
      <section>
        <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">Who are we?</h2>
        <p className="mt-2 max-w-3xl text-gray-700">
          PSSP was created by researchers at the University of Alberta who wanted to make survival predictions more
          accurate and personal. Our team combines expertise in computer science, oncology, and machine learning.
        </p>

        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {TEAM.map((p) => (
            <figure
              key={p.id}
              className="flex flex-col items-center text-center"
            >
              <div className="mx-auto">
                {/* Swap with a real headshot if available */}
                <InitialsCircle name={p.name} />
                {/* If you have headshots, use:
                <img src={p.photoUrl!} alt={p.name} className="h-16 w-16 rounded-full object-cover" />
                */}
              </div>
              <figcaption className="mt-3 text-center">
                <div className="font-medium leading-tight">{p.name}</div>
                <div className="text-sm text-gray-600">{p.subtitle}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* PAPER SUMMARY CARD (light gray) */}
      <section>
        <div className="rounded-2xl border border-black/10 bg-gray-50 p-6 shadow-sm md:p-8">
          <p className="text-gray-700">
            An accurate model of patient survival time can help in the treatment and care of patients. The common
            practice of providing survival time estimates based only on population averages for the site and stage of
            the disease ignores many important individual differences among patients. Here, we present a novel machine
            learning algorithm, PSSP (for “patient-specific survival predictor”), for learning patient-specific survival
            time distribution based on patient attributes, such as blood tests and clinical assessments. The predicted
            distribution can be regarded as a personalized version of Kaplan–Meier curve, and can be used as a tool for
            doctors to visualize the survival rate of individual patients. PSSP can also easily incorporate the
            time-varying effects of prognostic factors and handle censored survival times. When tested on a cohort of
            more than 2000 cancer patients from northern Alberta, our method gives survival time predictions that are
            much more accurate than popular survival analysis models such as the Cox and Aalen regression models. Our
            results show that using patient-specific attributes can reduce the prediction error on survival time by as
            much as 20% when compared to using cancer site and stage only. We anticipate this same technology can be
            used for learning and predicting personalized Kaplan–Meier curves for patients suffering from other
            diseases.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href={LINKS.nipsPaper}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-gray-50"
            >
              NIPS Paper (2011)
            </a>
            <a
              href={LINKS.nipsPoster}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-gray-50"
            >
              NIPS poster
            </a>
          </div>
        </div>
      </section>

      {/* Lightbox (click any figure) */}
      {preview && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
        >
          <figure
            className="max-h-[90vh] max-w-[90vw] rounded-2xl bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={preview.src}
              alt={preview.alt}
              className="max-h-[80vh] max-w-[85vw] object-contain"
            />
            <figcaption className="mt-2 text-center text-xs text-gray-600">
              {preview.caption} — {preview.alt}
            </figcaption>
          </figure>
          <button
            className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-medium shadow hover:bg-white"
            onClick={() => setPreview(null)}
          >
            Close
          </button>
        </div>
      )}
    </main>
  );
}
