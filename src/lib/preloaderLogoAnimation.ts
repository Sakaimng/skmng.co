import { gsap } from "gsap";

/** GPU-friendly transforms only — no filters, clip-path, or SVG attribute tweens. */
const GPU = { force3D: true } as const;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function buildPreloaderLogoIntro(
  logoRoot: HTMLElement,
  options: { delay?: number; counterDuration?: number },
): gsap.core.Timeline {
  const reducedMotion = prefersReducedMotion();

  const strokes = [
    ...logoRoot.querySelectorAll<SVGPathElement>("[data-preloader-letter-stroke]"),
  ];
  const fillShifts = [
    ...logoRoot.querySelectorAll<SVGGElement>("[data-preloader-letter-fill-shift]"),
  ];

  if (!strokes.length || strokes.length !== fillShifts.length) {
    return gsap.timeline();
  }

  strokes.forEach((path) => {
    const len = path.getTotalLength();
    const dash = len > 0 ? len : 1;
    path.style.strokeDasharray = `${dash}`;
    path.style.strokeDashoffset = `${dash}`;
  });

  fillShifts.forEach((g) => {
    gsap.set(g, { transformOrigin: "50% 100%", y: 34, opacity: 0, ...GPU });
  });

  gsap.set(logoRoot, { autoAlpha: 0, visibility: "hidden" });

  const introTl = gsap.timeline({
    delay: options.delay ?? 0,
    onStart: () => {
      gsap.set(logoRoot, { autoAlpha: 1, visibility: "visible" });
    },
  });

  if (reducedMotion) {
    strokes.forEach((p) => {
      gsap.set(p, { strokeDashoffset: 0, opacity: 0 });
    });
    introTl.to(fillShifts, {
      y: 0,
      opacity: 1,
      duration: 0.36,
      stagger: 0.065,
      ease: "power2.out",
      ...GPU,
      onComplete: () => {
        fillShifts.forEach((g) => gsap.set(g, { clearProps: "transform" }));
      },
    });
  } else {
    introTl.set(strokes, { opacity: 1 }, 0);

    introTl.to(strokes, {
      strokeDashoffset: 0,
      duration: 0.56,
      stagger: { each: 0.11, from: "end" },
      ease: "power2.inOut",
    });

    introTl.to(
      fillShifts,
      {
        y: 0,
        opacity: 1,
        duration: 0.64,
        stagger: { each: 0.09, from: "start" },
        ease: "back.out(1.34)",
        ...GPU,
        onComplete: () => {
          fillShifts.forEach((g) => gsap.set(g, { clearProps: "transform" }));
        },
      },
      "-=0.4",
    );

    introTl.to(
      strokes,
      {
        opacity: 0,
        duration: 0.35,
        stagger: { each: 0.06, from: "start" },
        ease: "power2.inOut",
      },
      "-=0.45",
    );
  }

  const counterDuration = options.counterDuration ?? 0;
  const innerDur = introTl.duration();
  if (innerDur > 0 && counterDuration > 0) {
    introTl.timeScale(innerDur / counterDuration);
  }

  return introTl;
}

/** Per-letter lift with random stagger when counter hits 100%. */
export function buildPreloaderLogoOutro(logoRoot: HTMLElement): gsap.TweenVars | null {
  const letters = [...logoRoot.querySelectorAll<SVGGElement>("[data-preloader-letter]")];
  if (!letters.length) {
    return {
      y: -10,
      autoAlpha: 0,
      duration: 0.46,
      ease: "power2.inOut",
      ...GPU,
    };
  }

  gsap.set(letters, { transformOrigin: "50% 100%", ...GPU });
  return {
    y: -18,
    opacity: 0,
    rotation: (i: number) => (i % 2 === 0 ? -2.2 : 2.2),
    duration: 0.46,
    stagger: { each: 0.036, from: "random" },
    ease: "power3.in",
    ...GPU,
  };
}
