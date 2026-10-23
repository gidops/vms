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
  heroCaption,
  logo,
  title,
  description,
  footer,
  children,
  className,
}: AuthLayoutProps) {
  return (
    <main className={cn("flex min-h-screen flex-col lg:flex-row", className)}>
      <section className="relative flex h-44 shrink-0 items-center justify-center overflow-hidden bg-emphasis px-6 text-center text-emphasis-fg lg:h-auto lg:flex-1 lg:text-start">
        {/* Photo, muted so the type does the talking. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-40 saturate-50 contrast-110"
          style={{ backgroundImage: `url(${heroSrc})` }}
        />
        {/* Depth: dark wash, brand glows, hairline grid. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-emphasis)_8%,transparent_75%),radial-gradient(70%_55%_at_15%_105%,color-mix(in_oklab,var(--color-accent)_28%,transparent),transparent),radial-gradient(60%_50%_at_95%_0%,color-mix(in_oklab,var(--color-primary)_45%,transparent),transparent)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 hidden bg-[linear-gradient(to_right,color-mix(in_oklab,var(--color-emphasis-fg)_6%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-emphasis-fg)_6%,transparent)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_30%_80%,black,transparent_70%)] lg:block"
        />

        {/* Golden ratio: block top sits at 61.8% of the height, inset 14.6% (phi^-4);
            subtitle is title / phi^3, caption gap is gap * phi^2. */}
        <div className="relative flex max-w-xl flex-col gap-4 lg:absolute lg:start-[14.6%] lg:top-[61.8%]">
          <h2 className="bg-gradient-to-b from-emphasis-fg to-emphasis-fg/60 bg-clip-text text-4xl font-semibold tracking-tighter text-transparent lg:text-7xl">
            {heroTitle}
          </h2>
          {heroSubtitle ? (
            <p className="text-sm text-emphasis-fg/70 lg:text-[1.0625rem]">
              {heroSubtitle}
            </p>
          ) : null}
          {heroCaption ? (
            <p className="mt-[1.6rem] hidden items-center gap-2 text-xs text-emphasis-fg/50 lg:flex">
              <span className="size-1.5 rounded-full bg-accent" />
              {heroCaption}
            </p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center bg-canvas bg-[radial-gradient(60%_40%_at_50%_0%,var(--color-primary-subtle),transparent)] p-4 sm:p-8">
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
