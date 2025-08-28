import { createContentLoader, defineLoader } from "vitepress";

export type Section = "reads" | "writes" | "thoughts";
export interface RecentItem {
  section: Section;
  url: string;
  title: string;
  description: string;
  date?: string;
  subSection?: string;
}

declare const data: RecentItem[];
export { data };

/** frontmatter 필드 */
interface FM {
  title?: unknown;
  description?: unknown;
  date?: unknown; // ISO/yy-mm-dd 권장
  draft?: unknown;
}

/** section 런타임 가드 */
function isSection(v: unknown): v is Section {
  return v === "reads" || v === "writes" || v === "thoughts";
}

/** 안정적인 날짜 파서: 실패 시 -Infinity로 내려 정렬 후순위 */
function tsFromDate(d?: string): number {
  if (!d) return Number.NEGATIVE_INFINITY;
  const n = Date.parse(d);
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

type ContentItem = {
  url: string;
  frontmatter?: Record<string, unknown>;
  excerpt?: string;
};

export default defineLoader({
  // 소스 루트(docs/) 기준 glob — 하위 폴더 재귀 포함
  watch: ["reads/**/*.md", "writes/**/*.md", "thoughts/**/*.md"],
  async load(): Promise<RecentItem[]> {
    const loader = createContentLoader(
      ["reads/**/*.md", "writes/**/*.md", "thoughts/**/*.md"],
      {
        excerpt: true, // description 없을 때 폴백으로 씀(첫 문단)
        render: false,
        includeSrc: false, // 원문 문자열은 싣지 않음 → 번들 가벼움
        transform(items: ContentItem[]) {
          const results: RecentItem[] = [];

          for (const i of items) {
            // 1) index.md 제외: url이 보통 `/reads/`처럼 슬래시로 끝남
            if (i.url.endsWith("/")) continue;

            // 2) section 안전 파싱
            const seg = i.url.split("/")[1];
            if (!isSection(seg)) continue;

            const subSection = i.url.split("/")[3]
              ? i.url.split("/")[2]
              : undefined;

            // 3) frontmatter 안전 접근(unknown → 좁히기)
            const fm = (i.frontmatter ?? {}) as FM;

            const fmTitle = typeof fm.title === "string" ? fm.title : undefined;
            const fmDesc =
              typeof fm.description === "string" ? fm.description : undefined;
            const fmDate = typeof fm.date === "string" ? fm.date : undefined;
            const fmDraft = typeof fm.draft === "boolean" ? fm.draft : false;

            if (fmDraft) continue; // draft면 제외

            // 4) 제목/설명 폴백 처리
            const fallbackTitle =
              i.url.split("/").pop()?.replace(/\.md$/, "") ?? i.url;

            const excerpt = typeof i.excerpt === "string" ? i.excerpt : "";

            const description =
              fmDesc ??
              excerpt
                .replace(/\n+/g, " ")
                .replace(/[#>*_~`]/g, "")
                .trim()
                .slice(0, 140);

            results.push({
              section: seg,
              subSection,
              url: i.url,
              title: fmTitle ?? fallbackTitle,
              description,
              date: fmDate,
            });
          }

          // 5) 날짜 내림차순(유효한 날짜 우선, 없거나 파싱 실패는 후순위)
          results.sort((a, b) => tsFromDate(b.date) - tsFromDate(a.date));

          return results;
        },
      }
    );

    return loader.load();
  },
});
