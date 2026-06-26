import { WorkChromeLayer } from "@/components/WorkChromeLayer";

export default function WorkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <WorkChromeLayer />
      {children}
    </>
  );
}
