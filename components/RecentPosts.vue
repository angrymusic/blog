<script setup lang="ts">
import { withBase } from "vitepress";
type Section = "reads" | "writes" | "thoughts";

const props = withDefaults(
  defineProps<{ limit?: number; sections?: Section[] }>(),
  {
    limit: 6,
    sections: () => ["reads", "writes", "thoughts"],
  }
);

// 로더 출력(JSON)을 import
import { data } from "../.vitepress/theme/recent.data";
const top = data
  .filter((i) => props.sections.includes(i.section))
  .slice(0, props.limit);
</script>

<template>
  <!-- VitePress 기본 홈의 features 스타일과 비슷한 마크업 -->
  <div class="recent-post-title">최근 글</div>
  <section class="MyFeatures">
    <div class="container">
      <div class="items">
        <a
          v-for="it in top"
          :key="it.url"
          class="item"
          :href="withBase(it.url)"
        >
          <article class="box">
            <div class="eyebrow">
              {{ it.section + (it.subSection ? " • " + it.subSection : "") }}
            </div>
            <h3 class="title">{{ it.title }}</h3>
            <p class="desc">{{ it.description }}</p>
          </article>
        </a>
      </div>
    </div>
  </section>
</template>
<style scoped lang="scss">
.recent-post-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 12px;
}
.MyFeatures .container {
  padding-top: 8px;

  .items {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 14px;
  }
  .item {
    text-decoration: none;
    color: inherit;
  }
  .box {
    height: 100%;
    background-color: var(--vp-c-bg-soft);
    border: 1px solid var(--vp-c-divider);
    border-radius: 12px;
    padding: 16px;
    transition: border-color 0.15s ease;
  }
  .item:hover .box {
    border-color: var(--vp-c-brand-1);
  }
  .eyebrow {
    font-size: 12px;
    opacity: 0.75;
    margin-bottom: 6px;
    text-transform: capitalize;
  }
  .title {
    margin: 0 0 6px;
    font-size: 16px;
    line-height: 1.35;
  }
  .desc {
    margin: 0;
    opacity: 0.9;
  }
}
</style>
