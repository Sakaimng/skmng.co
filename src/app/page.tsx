import { getAssetImages } from "@/lib/assets";
import { HomeExperience } from "@/components/HomeExperience";

export const revalidate = 5;

export default async function Home() {
  const images = (await getAssetImages()).slice(0, 12);

  return <HomeExperience images={images} />;
}
