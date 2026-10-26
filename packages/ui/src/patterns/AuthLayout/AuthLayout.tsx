import * as React from "react";
import { cn } from "../../foundations/cn";

export interface AuthLayoutProps {
  /** Hero photo URL shown on the start side (top banner on small screens). */
  heroSrc: string;
  heroTitle: React.ReactNode;
  heroSubtitle?: React.ReactNode;
  /** Small line pinned to the bottom of the hero (desktop only). */
  heroCaption?: React.ReactNode;
  /** Brand lockup shown at the top of the form card. */
  logo?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Secondary actions under the form card body (links, SSO). */
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Split-screen sign-in shell: dark branded hero + clean centred form card. */
export function AuthLayout({
  heroSrc,
  heroTitle,
  heroSubtitle,
  // heroCaption: unused while the caption is hidden.
  logo,
  title,
  description,
  footer,
  children,
  className,
}: AuthLayoutProps) {
  return (
    <main className={cn("flex min-h-screen flex-col lg:flex-row", className)}>
      <section className="relative flex h-44 shrink-0 items-center justify-center overflow-hidden bg-emphasis px-6 text-center text-white lg:h-auto lg:flex-1">
        {/* Photo, shown unfiltered. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroSrc})` }}
        />
        {/* Even dark wash over the whole photo. */}
        <div aria-hidden className="absolute inset-0 bg-black/50" />
        {/* Gold hairline where the photo meets the form (desktop). */}
        <div
          aria-hidden
          className="absolute inset-y-0 end-0 hidden w-px bg-[linear-gradient(to_bottom,transparent,color-mix(in_oklab,var(--color-gold-400)_55%,transparent)_50%,transparent)] lg:block"
        />
        {/* Centred white type; subtitle is title / phi^3, caption gap is gap * phi^2. */}
        <div className="relative flex max-w-xl flex-col items-center gap-4">
          <h2 className="text-4xl font-semibold tracking-tighter text-white lg:text-7xl">
            {heroTitle}
          </h2>
          {heroSubtitle ? (
            <p className="text-sm text-white lg:text-[1.0625rem]">
              {heroSubtitle}
            </p>
          ) : null}
          {/* Caption hidden for now.
          {heroCaption ? (
            <p className="mt-[1.6rem] hidden text-xs text-white lg:block">
              {heroCaption}
            </p>
          ) : null}
          */}
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center bg-[#F2F6F9] p-4 sm:p-8 dark:bg-canvas">
        <div className="w-full max-w-[26rem] rounded-2xl border border-border bg-surface px-6 py-10 shadow-sm sm:px-9">
          {logo ? <div className="mb-7 flex justify-center">{logo}</div> : null}
          <h1 className="text-center text-2xl font-medium tracking-tight text-fg">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-center text-sm text-fg-muted">
              {description}
            </p>
          ) : null}
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </section>
    </main>
  );
}
