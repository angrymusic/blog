import { createContentLoader, defineLoader } from "vitepress";

export type Section = "reads" | "writes" | "thoughts";
export interface RecentItem {
  section: Section;
  url: string;
  title: string;
  description: string;
  date?: string;
}

/** 여기서 data의 타입을 명시적으로 “선언”해주면 TS가 data를 배열로 인식 */
declare const data: RecentItem[];
export { data };

export default defineLoader({
  // 소스 루트(docs/) 기준 glob
  watch: ["reads/*.md", "writes/*.md", "thoughts/*.md"],
  async load() {
    const raw = await createContentLoader(
      ["reads/*.md", "writes/*.md", "thoughts/*.md"],
      {
        excerpt: true, // description 없을 때 폴백으로 씀(첫 문단)
        render: false,
        includeSrc: false, // 원문 문자열은 싣지 않음 → 번들 가벼움
        transform(items) {
          return (
            items
              // index.md 제외: url이 보통 `/reads/`처럼 슬래시로 끝남
              .filter((i) => !i.url.endsWith("/"))
              .map<RecentItem>((i) => {
                const fm = i.frontmatter || {};
                const section = (i.url.split("/")[1] || "") as Section; // '/reads/foo.html' → 'reads'
                const title = fm.title || i.url;
                const date = fm.date as string | undefined;
                const description =
                  fm.description ||
                  (i.excerpt || "")
                    .replace(/\n+/g, " ")
                    .replace(/[#>*_~`]/g, "")
                    .slice(0, 140);

                return { section, url: i.url, title, description, date };
              })
              // 날짜 내림차순 (YYYY-MM-DD 권장)
              .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
          );
        },
      }
    ).load();

    return raw;
  },
});
