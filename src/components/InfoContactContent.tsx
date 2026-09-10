"use client";

import { ContactEmailCopy } from "@/components/ContactEmailCopy";
import { ContactInstagramLink } from "@/components/ContactInstagramLink";
import { InfoLineReveal } from "@/components/InfoLineReveal";
import { InfoStagger } from "@/components/InfoStagger";
import { useLocale } from "@/components/LocaleProvider";

const INSTAGRAM_HREF = "https://www.instagram.com/skmng.co/";
const INSTAGRAM_HANDLE = "SKMNG.CO";
const CONTACT_EMAIL = "info@skmng.co";

/** Matches last bio paragraph stagger: (n - 1) * 0.14 + 0.06 */
const INFO_FOOTER_ANIM_DELAY_S = 0.34;

export function InfoContactContent() {
  const { messages } = useLocale();

  return (
    <div className="min-h-[85dvh] altPadding flex flex-col justify-between relative z-10 w-full gap-6 overflow-x-hidden overflow-y-auto pl-[clamp(1rem,5vw,4rem)] pr-0 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-7 sm:pl-8 min-[950px]:min-h-[calc(100vh-6vh)] min-[950px]:gap-8 min-[950px]:overflow-hidden min-[950px]:pl-0">
      <div className="info-bio-grid">
        <div className="navMLeft flex w-full min-w-0 flex-col gap-4 text-foreground max-[949px]:pr-[max(2vw,env(safe-area-inset-right))] sm:gap-5 min-[950px]:col-start-1 min-[950px]:items-end min-[950px]:gap-[1.25em]">
          {messages.info.bio.map((paragraph, index) => (
            <p
              key={index}
              className="info-para-fade w-full min-w-0 max-w-full leading-normal text-foreground break-normal min-[950px]:text-right"
              style={{ animationDelay: `${index * 0.14 + 0.06}s` }}
            >
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      <div className="info-footer-grid shrink-0 items-start">
        <div className="navMLeft col-start-1 flex flex-col items-start gap-6 self-start sm:gap-7 md:items-end md:gap-8">
            <div
              className="info-para-fade w-fit max-w-full"
              style={{ animationDelay: `${INFO_FOOTER_ANIM_DELAY_S}s` }}
            >
              <p className="m-0 leading-none text-left text-foreground md:text-right">
                {messages.info.role}
              </p>
            </div>

            <div className="w-fit max-w-full">
              <InfoLineReveal
                text={messages.info.contact}
                className="text-left leading-none text-foreground md:text-right"
                groupDelay={INFO_FOOTER_ANIM_DELAY_S - 0.06}
                lineStagger={0.085}
              />
              <InfoStagger
                delay={INFO_FOOTER_ANIM_DELAY_S}
                className="mt-[9px] leading-none text-foreground md:ml-auto [&_a]:leading-none [&_button]:leading-none"
              >
                <div className="inline-grid grid-cols-[auto_auto] items-baseline gap-x-[0.35em] gap-y-0.5 leading-none">
                  <span className="justify-self-start text-foreground md:justify-self-end">
                    {messages.info.emailLabel}
                  </span>
                  <div className="flex min-w-0 justify-start text-left md:justify-end md:text-right">
                    <ContactEmailCopy email={CONTACT_EMAIL} />
                  </div>
                  <span className="justify-self-start text-foreground md:justify-self-end">
                    {messages.info.instagramLabel}
                  </span>
                  <div className="flex min-w-0 justify-start text-left md:justify-end md:text-right">
                    <ContactInstagramLink href={INSTAGRAM_HREF} handle={INSTAGRAM_HANDLE} />
                  </div>
                </div>
              </InfoStagger>
            </div>
          </div>

        <p
          className="info-para-fade col-start-1 m-0 self-start leading-none text-left text-foreground max-md:pl-[2vw] md:col-start-3 md:row-start-1 md:justify-self-start"
          style={{ animationDelay: `${INFO_FOOTER_ANIM_DELAY_S}s` }}
        >
          {messages.info.siteCredit}
        </p>

        <p
          className="info-para-fade col-start-1 m-0 mt-6 self-start leading-none text-left text-foreground max-md:pl-[2vw] sm:mt-7 md:col-start-3 md:row-start-2 md:mt-6 md:justify-self-start min-[950px]:mt-8"
          style={{ animationDelay: `${INFO_FOOTER_ANIM_DELAY_S + 0.08}s` }}
        >
          {messages.info.copyright}
        </p>
      </div>
    </div>
  );
}
