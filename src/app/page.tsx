import type { Metadata } from "next";
import { HomeExperience } from "@/components/HomeExperience";
import { defaultOgImagePath } from "@/lib/site";
import { getHomeGalleryImages } from "@/lib/assets";

export const revalidate = 86400;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    images: [{ url: defaultOgImagePath, alt: "SKMNG — photography" }],
  },
};

export default async function Home() {
  const images = await getHomeGalleryImages();

  return <HomeExperience images={images} />;
}
