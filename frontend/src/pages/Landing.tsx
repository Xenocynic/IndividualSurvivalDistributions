// src/pages/Landing.tsx
import { Link } from "react-router-dom";

function FeatureChip({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-3 grid h-16 w-16 place-items-center rounded-xl bg-neutral-300 text-[11px] font-semibold text-neutral-700">
        (Proper graphic)
      </div>
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 max-w-[15rem] text-xs text-white/85">{text}</p>
    </div>
  );
}

export default function Landing() {
  return (
    <main className="mx-auto max-w-6xl px-4">
      {/* HERO -------------------------------------------------------------- */}
      <section className="grid gap-10 pb-10 pt-12 md:grid-cols-2">
        {/* Left copy */}
        <div className="pr-2">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">
            Personalized Survival Predictions for
            <br />
            Every Patient
          </h1>

          <div className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-neutral-700">
            <p>
              This website provides access to the PSSP codebase. You can either{" "}
              <Link to="/instruction" className="underline underline-offset-2">
                analyze your data set on this site
              </Link>
              , or{" "}
              <a
                href="https://example.com/pssp-cli" // TODO replace with real CLI link
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                download the source for the command-line PSSP tool
              </a>
              . To better understand PSSP, see the slides and presentation{" "}
              <a
                href="https://example.com/slides" // TODO replace
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                here
              </a>
              ; and how to use this website, see the{" "}
              <Link to="/instruction" className="underline underline-offset-2">
                Tutorial
              </Link>
              .
            </p>
            <p className="mt-2">
              You can also look at our publicly accessible predictors{" "}
              <Link to="/predictors" className="underline underline-offset-2">
                here
              </Link>
              .
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/demo" // TODO ensure route exists or use external URL
              className="inline-flex items-center justify-center rounded-[10px] bg-neutral-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black"
            >
              View the demo
            </Link>
            <Link
              to="/predictors"
              className="inline-flex items-center justify-center rounded-[10px] border border-black/10 bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-900 shadow-sm hover:bg-neutral-200"
            >
              Explore Predictors
            </Link>
          </div>
        </div>

        {/* Right graphic box */}
        <div className="flex items-center justify-center md:pl-6">
          <div className="grid aspect-[4/3] w-full max-w-[460px] place-items-center rounded-[18px] border border-black/10 bg-neutral-200 shadow-sm">
            <span className="px-4 text-center text-[12.5px] font-semibold text-neutral-700">
              Graphics or Graphs as applicable
            </span>
          </div>
        </div>
      </section>

      {/* Divider line */}
      <div className="h-px w-full bg-neutral-300" />

      {/* FEATURE BAND ------------------------------------------------------- */}
      <section className="rounded-none bg-neutral-700 px-6 py-12 text-white md:rounded-2xl md:mt-0 md:mb-0">
        <h2 className="mx-auto max-w-3xl text-center text-[20px] font-semibold leading-relaxed sm:text-[22px]">
          PSSP uses{" "}
          <span className="font-extrabold underline underline-offset-4">
            machine learning
          </span>{" "}
          to create{" "}
          <span className="font-extrabold underline underline-offset-4">
            personalized survival curves
          </span>{" "}
          based on each patient’s attributes
        </h2>

        <div className="mx-auto mt-10 grid max-w-5xl gap-10 sm:grid-cols-3">
          <FeatureChip
            title="Personalized survival distributions"
            text="Predictions tailored to individual patient attributes."
          />
          <FeatureChip
            title="Handle censored survival time"
            text="Naturally incorporates censoring into the modeling."
          />
          <FeatureChip
            title="Incorporates prognostic factors"
            text="Accounts for time-varying effects and clinical variables."
          />
        </div>
      </section>

      {/* HOW IT WORKS ------------------------------------------------------- */}
      <section className="py-12">
        <h3 className="text-center text-[22px] font-extrabold tracking-tight">
          How It Works
        </h3>

        <div className="mx-auto mt-8 grid max-w-4xl gap-10 sm:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-xl bg-neutral-300 text-[11px] font-semibold text-neutral-700">
              (Proper graphic)
            </div>
            <p className="mt-3 text-sm">
              1) Collect Patient attributes
            </p>
          </div>

          <div className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-xl bg-neutral-300 text-[11px] font-semibold text-neutral-700">
              (Proper graphic)
            </div>
            <p className="mt-3 text-sm">
              2) Apply PSSP machine
              <br className="hidden sm:block" /> learning model
            </p>
          </div>

          <div className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-xl bg-neutral-300 text-[11px] font-semibold text-neutral-700">
              (Proper graphic)
            </div>
            <p className="mt-3 text-sm">
              3) Generate individualized
              <br className="hidden sm:block" /> survival distribution
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/demo"
            className="inline-flex w-[220px] items-center justify-center rounded-[10px] bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-black"
          >
            View the demo
          </Link>
        </div>
      </section>
    </main>
  );
}