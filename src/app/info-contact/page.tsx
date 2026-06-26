import type { Metadata } from "next";
import { InfoContactContent } from "@/components/InfoContactContent";
import { InfoExperience } from "@/components/InfoExperience";

export const metadata: Metadata = {
  title: "Info",
  description:
    "About SKMNG — Hong Kong born, Tokyo based visual storyteller. Instagram, email, and prime lenses.",
  alternates: { canonical: "/info-contact" },
  openGraph: {
    title: "Info | SKMNG",
    description:
      "Biography, Instagram, email, and how to reach SKMNG in Tokyo.",
    url: "/info-contact",
    images: [{ url: "/assets/KURO.jpg", alt: "SKMNG — portrait" }],
  },
  twitter: {
    title: "Info | SKMNG",
    description:
      "Biography, Instagram, email, and how to reach SKMNG in Tokyo.",
  },
};

export default function InfoContactPage() {
  return (
    <main className="overflow-x-hidden overflow-y-hidden bg-background">
      <InfoExperience>
        <InfoContactContent />
      </InfoExperience>
    </main>
  );
}
