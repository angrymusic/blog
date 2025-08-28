---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "안녕하세요,\n이민재입니다 :)"
  text: "프론트엔드"
  tagline: 의 정점으로 달려갑니다. 🏃‍♂️,,
  image:
    src: /images/me.jpg
    alt: Hi, It's my photo
  actions:
    - theme: alt
      text: Thoughts
      link: /thoughts
    - theme: alt
      text: Writes
      link: /writes
    - theme: alt
      text: Reads
      link: /reads
---

<script setup lang="ts">
import RecentPosts from './components/RecentPosts.vue' // docs/index.md 기준 경로
</script>
<RecentPosts :limit="8" :sections="['reads','writes','thoughts']" />
