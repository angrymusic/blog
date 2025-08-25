// .vitepress/config.mts
import { defineConfig } from "vitepress";
import { withSidebar } from "vitepress-sidebar";
export default defineConfig(
  withSidebar(
    {
      base: "/blog/",
      lang: "ko-KR",
      title: "<이민재 />",
      description: "안녕하세요, 이민재입니다 :)",
      themeConfig: {
        nav: [
          { text: "Thoughts", link: "/thoughts/" },
          { text: "Writes", link: "/writes/" },
          { text: "Reads", link: "/reads/" },
        ],
        socialLinks: [
          { icon: "github", link: "https://github.com/angrymusic" },
        ],
        outline: {
          level: [2, 3],
          label: "목차",
        },
      },
    },
    [
      {
        documentRootPath: "/", // .vitepress가 있는 루트
        scanStartPath: "thoughts", // 이 폴더만 스캔
        resolvePath: "/thoughts/", // /thoughts/* 에서 이 사이드바 사용
        useTitleFromFileHeading: true,
        hyphenToSpace: true,
        collapsed: false,
      },
      {
        documentRootPath: "/",
        scanStartPath: "writes",
        resolvePath: "/writes/",
        useTitleFromFileHeading: true,
        hyphenToSpace: true,
        collapsed: false,
      },
      {
        documentRootPath: "/",
        scanStartPath: "reads",
        resolvePath: "/reads/",
        useTitleFromFileHeading: true,
        hyphenToSpace: true,
        collapsed: false,
      },
    ]
  )
);
