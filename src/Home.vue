<script setup>
const demos = [
  {
    path: './cosine/',
    title: '余弦相似度',
    en: 'Cosine Similarity',
    desc: '拖动箭头改变夹角，实时观察两个向量的余弦相似度。理解 RAG 检索为什么能找到"意思相近"的内容。',
    tags: ['Embedding', 'RAG', '向量检索'],
    emoji: '📐'
  },
  {
    path: './sampling/',
    title: 'Top-K 与 Top-P 采样',
    en: 'Top-K / Top-P Sampling',
    desc: '调整 Top-K 和 Top-P 滑块，实时看模型从概率分布里"砍掉"哪些词、保留哪些词。理解搭工作流为什么要调这俩参数。',
    tags: ['采样参数', '工作流', 'LLM'],
    emoji: '🎲'
  }
]
</script>

<template>
  <div class="home">
    <header class="hero">
      <h1>AI PM Playground</h1>
      <p class="subtitle">给产品经理的 AI 概念游乐场——飞书卡片讲不清楚的，亲手玩一遍就懂了。</p>
    </header>

    <main class="grid">
      <a v-for="d in demos" :key="d.path" :href="d.path" class="demo-card">
        <div class="emoji">{{ d.emoji }}</div>
        <div class="content">
          <div class="titles">
            <h2>{{ d.title }}</h2>
            <span class="en">{{ d.en }}</span>
          </div>
          <p class="desc">{{ d.desc }}</p>
          <div class="tags">
            <span v-for="t in d.tags" :key="t" class="tag">{{ t }}</span>
          </div>
        </div>
        <div class="arrow">→</div>
      </a>
    </main>

    <footer class="footer">
      <span>© Evan · AI PM Handbook</span>
    </footer>
  </div>
</template>

<style scoped>
.home {
  max-width: 900px;
  margin: 0 auto;
  padding: 4rem 1.5rem 3rem;
}

.hero {
  text-align: center;
  margin-bottom: 3rem;
}

.hero h1 {
  font-size: 2.4rem;
  font-weight: 700;
  margin: 0 0 0.6rem;
  letter-spacing: -0.02em;
}

.subtitle {
  color: var(--fg-muted);
  font-size: 1.05rem;
  margin: 0;
  line-height: 1.6;
}

.grid {
  display: grid;
  gap: 1.25rem;
}

.demo-card {
  display: flex;
  gap: 1.25rem;
  align-items: center;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem 1.75rem;
  text-decoration: none;
  color: inherit;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  box-shadow: var(--shadow);
}

.demo-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--accent);
}

.emoji {
  font-size: 2.6rem;
  line-height: 1;
  flex-shrink: 0;
}

.content {
  flex: 1;
  min-width: 0;
}

.titles {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  flex-wrap: wrap;
}

.titles h2 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.en {
  color: var(--fg-muted);
  font-size: 0.85rem;
  font-weight: 400;
}

.desc {
  margin: 0.5rem 0 0.75rem;
  color: var(--fg-muted);
  font-size: 0.92rem;
  line-height: 1.55;
}

.tags {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.tag {
  background: var(--bg-subtle);
  color: var(--fg-muted);
  font-size: 0.75rem;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
}

.arrow {
  font-size: 1.4rem;
  color: var(--fg-muted);
  flex-shrink: 0;
  transition: transform 0.15s ease, color 0.15s ease;
}
.demo-card:hover .arrow {
  transform: translateX(4px);
  color: var(--accent);
}

.footer {
  margin-top: 3.5rem;
  text-align: center;
  color: var(--fg-muted);
  font-size: 0.85rem;
}

@media (max-width: 600px) {
  .hero h1 { font-size: 1.9rem; }
  .demo-card { padding: 1.25rem; gap: 1rem; }
  .emoji { font-size: 2rem; }
  .titles h2 { font-size: 1.05rem; }
}
</style>
