import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: "ko-KR",
  title: "이민재",
  description: "안녕하세요, 이민재입니다 :)",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Thoughts", link: "/thoughts" },
      { text: "posts", link: "/posts" },
    ],

    sidebar: {
      "/thoughts": [
        {
          text: "Thoughts",
          items: [
            { text: "Markdown Examples", link: "/markdown-examples" },
            { text: "Runtime API Examples", link: "/api-examples" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/vuejs/vitepress" },
    ],
  },
});
