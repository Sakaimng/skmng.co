export type WorkCategory = "film" | "image" | "video-loop";

export type Work = {
  id: string;
  title: string;
  category: WorkCategory;
  description: string;
  videoSrc?: string;
  poster?: string;
  imageSrc?: string;
  loop?: boolean;
};

const filmTitles = [
  "RETINA",
  "BOB WILSON",
  "While the Night.",
  "Forbidden Fruit",
  "SUTURA.",
  "LALIGA",
  "METANOIA",
  "TO THE VOID",
  "ETE",
  "NO ENEMIES | S. Ingrosso & S. Angello.",
  "Aurum of Legends",
  "The Weeknd Teaser São Paulo.",
];

const imageTitles = [
  "No Way without a Loop.",
  "Prelude to Fire.",
  "Base Plate.",
  "Fragile Facade.",
  "No return.",
  "Darkness names me.",
  "Unresolved Scandals.",
  "Fragmented Times, History Blurred.",
  "XG.AWE.",
  "Ambiguity is the canvas.",
  "ATMAN.",
  "Tejidos.",
];

const videoLoopTitles = [
  "No Way without a Loop.",
  "SONGZIO",
  "Steps that leave no trace.",
  "The weight of the invisible.",
  "Nefelibata.",
  "Threshold of Freedom.",
  "Street Thinking.",
  "Parpadeo Revelado.",
  "Moments without faces.",
  "Passengers of the night.",
  "Contemplative Umbrella.",
  "Rodeo Lumínico.",
];

const videoPool = [
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
];

function makeWork(
  category: WorkCategory,
  title: string,
  index: number,
): Work {
  const seed = `${category}-${index + 1}`;
  const poster = `https://picsum.photos/seed/${seed}/1920/1080`;
  const shared = {
    id: seed,
    title,
    category,
    description:
      "Placeholder media for this recreation. Replace with the original project's assets, credits, and detail copy for a production-ready version.",
  };

  if (category === "image") {
    return {
      ...shared,
      imageSrc: poster,
    };
  }

  return {
    ...shared,
    poster,
    videoSrc: videoPool[index % videoPool.length],
    loop: category === "video-loop",
  };
}

export const works: Work[] = [
  ...filmTitles.map((title, index) => makeWork("film", title, index)),
  ...imageTitles.map((title, index) => makeWork("image", title, index)),
  ...videoLoopTitles.map((title, index) => makeWork("video-loop", title, index)),
];

export function worksByCategory(category: WorkCategory): Work[] {
  return works.filter((work) => work.category === category);
}

export function workById(id: string): Work | undefined {
  return works.find((work) => work.id === id);
}
