import { ArchiveExperience } from "@/components/ArchiveExperience";
import { getAssetImages } from "@/lib/assets";

export const revalidate = 5;

export default async function ArchivePage() {
  const images = await getAssetImages();
  return <ArchiveExperience images={images} />;
}
