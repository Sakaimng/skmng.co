"use client";

import { forwardRef, memo, useImperativeHandle, useLayoutEffect } from "react";
import { gsap } from "gsap";

import {
  WORK_PROJECT_TITLE_BUTTON_CLASS,
  WORK_PROJECT_TITLE_TEXT_CLASS,
} from "@/lib/workProjectTitle";
import type { WorkTitlePins } from "@/lib/workTitlePin";
import type { WorkProject } from "@/lib/works";

const WORK_CLIP_VISIBLE = "inset(0% 0% 0% 0%)";
/** Pre-reveal hidden state — clipped from the top (slides up on reveal). Opacity
 *  stays 1 so it's hidden purely by the clip, matching the reveal animation and
 *  avoiding any opacity flicker. */
const WORK_CLIP_REVEAL_HIDDEN = "inset(100% 0% 0% 0%)";

export type WorkPinnedTitlesHandle = {
  getTitle: (slug: string) => HTMLElement | undefined;
};

type WorkPinnedTitlesProps = {
  projects: WorkProject[];
  pins: WorkTitlePins;
  activeSlug: string;
  titleRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  interactive?: boolean;
  onSelect?: (slug: string) => void;
  onHover?: (slug: string | null) => void;
  clipHidden?: boolean;
  titleRevealInProgress?: boolean;
};

export const WorkPinnedTitles = memo(
  forwardRef<WorkPinnedTitlesHandle, WorkPinnedTitlesProps>(
    function WorkPinnedTitles({
      projects,
      pins,
      activeSlug,
      titleRefs,
      interactive = false,
      onSelect,
      onHover,
      clipHidden = false,
      titleRevealInProgress = false,
    },
    ref) {
      useImperativeHandle(ref, () => ({
        getTitle: (slug) => titleRefs.current.get(slug),
      }));

      const activeProject = projects.find((project) => project.slug === activeSlug);
      const pin = activeProject ? pins[activeProject.slug] : null;

      useLayoutEffect(() => {
        const el = titleRefs.current.get(activeSlug);
        if (!el) return;

        if (clipHidden || titleRevealInProgress) {
          if (gsap.isTweening(el)) return;
          gsap.killTweensOf(el);
          gsap.set(el, {
            clipPath: WORK_CLIP_REVEAL_HIDDEN,
            autoAlpha: 1,
            visibility: "visible",
            willChange: "clip-path",
          });
          return;
        }

        gsap.killTweensOf(el);
        gsap.set(el, {
          clipPath: WORK_CLIP_VISIBLE,
          autoAlpha: 1,
          visibility: "visible",
          clearProps: "willChange",
        });
      }, [activeSlug, clipHidden, titleRevealInProgress, titleRefs]);

      if (!activeProject || !pin) return null;

      const pinStyle = {
        top: pin.top,
        left: pin.left,
      };

      return (
        <div
          className={`work-chrome-difference fixed m-0 w-fit ${
            interactive ? "z-40 cursor-pointer" : "pointer-events-none z-20"
          }`}
          style={pinStyle}
        >
          <button
            type="button"
            ref={(node) => {
              if (node) titleRefs.current.set(activeProject.slug, node);
              else titleRefs.current.delete(activeProject.slug);
            }}
            data-work-slug={activeProject.slug}
            className={`${WORK_PROJECT_TITLE_BUTTON_CLASS}${
              interactive ? " pointer-events-auto" : " pointer-events-none"
            }`}
            tabIndex={interactive ? 0 : -1}
            onClick={interactive ? () => onSelect?.(activeProject.slug) : undefined}
            onPointerEnter={
              interactive ? () => onHover?.(activeProject.slug) : undefined
            }
            onPointerLeave={interactive ? () => onHover?.(null) : undefined}
            onFocus={interactive ? () => onHover?.(activeProject.slug) : undefined}
            onBlur={interactive ? () => onHover?.(null) : undefined}
          >
            <span className={WORK_PROJECT_TITLE_TEXT_CLASS}>
              {activeProject.title}
            </span>
          </button>
        </div>
      );
    },
  ),
);
