<script setup lang="ts">
import { computed } from "vue";
import { withBase } from "vitepress";
import { data, type RecentItem } from "../.vitepress/theme/recent.data";

type Section = "reads" | "writes" | "thoughts";

const props = withDefaults(
  defineProps<{ limit?: number; sections?: Section[] }>(),
  {
    limit: 6,
    sections: () => ["reads", "writes", "thoughts"],
  }
);

function toTimestamp(date?: string): number {
  if (!date) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

const top = computed(() =>
  [...data]
    .filter((item) => props.sections.includes(item.section))
    .sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date))
    .slice(0, props.limit)
);

function isNewest(item: RecentItem): boolean {
  return top.value[0]?.url === item.url;
}
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
          :class="{ 'is-new': isNewest(it) }"
          :href="withBase(it.url)"
        >
          <article class="box">
            <span v-if="isNewest(it)" class="new-badge">NEW</span>
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
    position: relative;
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
  .item.is-new .box {
    border-color: color-mix(in srgb, var(--vp-c-brand-1) 55%, var(--vp-c-divider));
  }
  .new-badge {
    position: absolute;
    top: 14px;
    right: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    border-radius: 999px;
    background: var(--vp-c-brand-1);
    color: var(--vp-c-bg);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1;
  }
  .item.is-new .eyebrow {
    padding-right: 56px;
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
