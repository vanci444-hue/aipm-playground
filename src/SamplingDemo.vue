<script setup>
import { ref, computed } from 'vue'

// 预设：模型对 "中国的首都是" 之后下一个词的概率分布
const tokens = [
  { word: '北京', prob: 0.65 },
  { word: '上海', prob: 0.18 },
  { word: '成都', prob: 0.06 },
  { word: '洛阳', prob: 0.04 },
  { word: '武汉', prob: 0.03 },
  { word: '杭州', prob: 0.02 },
  { word: '南京', prob: 0.01 },
  { word: '西安', prob: 0.005 },
  { word: '重庆', prob: 0.003 },
  { word: '长沙', prob: 0.002 }
]

const topK = ref(tokens.length)   // 默认不截断
const topP = ref(1.0)             // 默认不截断

// 计算每个词的状态
const annotated = computed(() => {
  // 按概率降序（已排序，但保险起见）
  const sorted = [...tokens].sort((a, b) => b.prob - a.prob)
  let cumProb = 0
  let topPCutoffIdx = sorted.length // 第一个不满足 Top-P 的索引
  // Top-P 逻辑：从最大概率往下累加，直到累加值 >= top_p 为止；
  // 后面的词全部砍掉。注意：累加超过的那个词本身仍然保留（因为是它使累加达标的）
  for (let i = 0; i < sorted.length; i++) {
    cumProb += sorted[i].prob
    if (cumProb >= topP.value) {
      topPCutoffIdx = i + 1
      break
    }
  }
  // 边界：topP=1 时所有词都保留
  if (topP.value >= 0.9999) topPCutoffIdx = sorted.length

  return sorted.map((t, i) => {
    const cutByK = i >= topK.value
    const cutByP = i >= topPCutoffIdx
    const kept = !cutByK && !cutByP
    return {
      ...t,
      rank: i + 1,
      cutByK,
      cutByP,
      kept,
      cumProb: (i === 0 ? t.prob : (sorted.slice(0, i + 1).reduce((s, x) => s + x.prob, 0)))
    }
  })
})

// 候选词统计
const stats = computed(() => {
  const kept = annotated.value.filter(t => t.kept)
  const totalProb = kept.reduce((s, t) => s + t.prob, 0)
  const cutByKOnly = annotated.value.filter(t => t.cutByK && !t.cutByP).length
  const cutByPOnly = annotated.value.filter(t => t.cutByP && !t.cutByK).length
  const cutByBoth = annotated.value.filter(t => t.cutByK && t.cutByP).length
  return {
    keptCount: kept.length,
    totalProb,
    cutByKOnly,
    cutByPOnly,
    cutByBoth,
    totalCut: tokens.length - kept.length
  }
})

// 重新归一化后的概率（用于实际采样）
const renormalized = computed(() => {
  const total = stats.value.totalProb
  if (total === 0) return []
  return annotated.value
    .filter(t => t.kept)
    .map(t => ({ ...t, normProb: t.prob / total }))
})

// 最大概率（用于柱状图宽度归一化）
const maxProb = computed(() => Math.max(...tokens.map(t => t.prob)))

// "模拟采样 100 次"
const sampleResults = ref(null)
const sampling = ref(false)

function runSampling() {
  if (renormalized.value.length === 0) {
    sampleResults.value = null
    return
  }
  sampling.value = true
  // 简单动画：先清空，再延迟显示
  sampleResults.value = null
  setTimeout(() => {
    const counts = new Map()
    for (let i = 0; i < 100; i++) {
      const r = Math.random()
      let acc = 0
      for (const t of renormalized.value) {
        acc += t.normProb
        if (r < acc) {
          counts.set(t.word, (counts.get(t.word) || 0) + 1)
          break
        }
      }
    }
    const arr = Array.from(counts.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
    sampleResults.value = arr
    sampling.value = false
  }, 200)
}

// 预设场景
const scenarios = [
  { label: '🔓 完全不截断', k: 10, p: 1.0 },
  { label: '🎯 只看 Top-K=3', k: 3, p: 1.0 },
  { label: '🎯 只看 Top-P=0.9', k: 10, p: 0.9 },
  { label: '🔒 严格事实问答', k: 1, p: 1.0 },
  { label: '⚖️ 业界推荐 Top-P=0.9 + K=10', k: 10, p: 0.9 }
]

function applyScenario(s) {
  topK.value = s.k
  topP.value = s.p
  sampleResults.value = null
}
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1>🎲 Top-K / Top-P 采样 · 交互演示</h1>
      <a class="home-link" href="../">← 回首页</a>
    </header>

    <p class="lead">
      LLM 每生成一个词，都是从词表的<b>概率分布</b>里"采样"一个词输出。
      <b>Top-K</b> 和 <b>Top-P</b> 是控制"从哪些候选词里挑"的两个旋钮。
      <br />
      <span class="muted">下面用一个真实场景（"中国的首都是"）演示两个旋钮怎么"砍候选词"。</span>
    </p>

    <!-- Prompt 展示 -->
    <div class="prompt-box">
      <div class="prompt-label">Prompt</div>
      <div class="prompt-text">中国的首都是<span class="cursor">_</span></div>
    </div>

    <!-- 滑块控制 -->
    <div class="controls">
      <div class="control-card">
        <div class="control-header">
          <div>
            <div class="control-title">Top-K</div>
            <div class="control-desc">只保留概率最高的 <b>K</b> 个词，其他全砍</div>
          </div>
          <div class="control-value">{{ topK }}</div>
        </div>
        <input type="range" min="1" :max="tokens.length" step="1" v-model.number="topK" />
        <div class="control-scale">
          <span>1（最严）</span>
          <span>{{ tokens.length }}（不截断）</span>
        </div>
      </div>

      <div class="control-card">
        <div class="control-header">
          <div>
            <div class="control-title">Top-P</div>
            <div class="control-desc">从最高概率累加到 <b>P</b> 为止，后面全砍</div>
          </div>
          <div class="control-value">{{ topP.toFixed(2) }}</div>
        </div>
        <input type="range" min="0.05" max="1" step="0.01" v-model.number="topP" />
        <div class="control-scale">
          <span>0.05（最严）</span>
          <span>1.00（不截断）</span>
        </div>
      </div>
    </div>

    <!-- 场景预设 -->
    <div class="scenarios">
      <span class="scenarios-label">场景预设：</span>
      <button v-for="s in scenarios" :key="s.label" @click="applyScenario(s)" class="scenario-btn">
        {{ s.label }}
      </button>
    </div>

    <!-- 候选词可视化 -->
    <div class="card chart-card">
      <h2>候选词概率分布</h2>
      <p class="muted">
        <span class="badge badge-kept">保留</span> = 通过两道关；
        <span class="badge badge-cut-k">Top-K 砍</span> 排名超出 K；
        <span class="badge badge-cut-p">Top-P 砍</span> 累计概率超出 P；
        <span class="badge badge-cut-both">两者都砍</span>
      </p>

      <div class="bars">
        <div v-for="t in annotated" :key="t.word" class="bar-row" :class="{ cut: !t.kept }">
          <div class="bar-rank">#{{ t.rank }}</div>
          <div class="bar-word">{{ t.word }}</div>
          <div class="bar-track">
            <div
              class="bar-fill"
              :class="{
                'kept': t.kept,
                'cut-k': t.cutByK && !t.cutByP,
                'cut-p': t.cutByP && !t.cutByK,
                'cut-both': t.cutByK && t.cutByP
              }"
              :style="{ width: (t.prob / maxProb * 100) + '%' }"
            >
              <span class="bar-label">{{ (t.prob * 100).toFixed(1) }}%</span>
            </div>
          </div>
          <div class="bar-cum">累计 {{ (t.cumProb * 100).toFixed(1) }}%</div>
          <div class="bar-status">
            <span v-if="t.kept" class="status status-kept">✅ 保留</span>
            <span v-else-if="t.cutByK && t.cutByP" class="status status-cut">❌ 双双被砍</span>
            <span v-else-if="t.cutByK" class="status status-cut-k">❌ Top-K 砍</span>
            <span v-else-if="t.cutByP" class="status status-cut-p">❌ Top-P 砍</span>
          </div>
        </div>
      </div>

      <!-- 统计 -->
      <div class="stats">
        <div class="stat">
          <div class="stat-label">最终候选词数</div>
          <div class="stat-val">{{ stats.keptCount }} / {{ tokens.length }}</div>
        </div>
        <div class="stat">
          <div class="stat-label">候选词覆盖概率</div>
          <div class="stat-val">{{ (stats.totalProb * 100).toFixed(1) }}%</div>
        </div>
        <div class="stat">
          <div class="stat-label">Top-K 砍掉</div>
          <div class="stat-val">{{ stats.cutByKOnly + stats.cutByBoth }} 个</div>
        </div>
        <div class="stat">
          <div class="stat-label">Top-P 砍掉</div>
          <div class="stat-val">{{ stats.cutByPOnly + stats.cutByBoth }} 个</div>
        </div>
      </div>
    </div>

    <!-- 模拟采样 -->
    <div class="card sampling-card">
      <h2>模拟采样 100 次</h2>
      <p class="muted">
        基于上面候选词（重新归一化后的概率），随机采样 100 次，看实际会"挑"到哪些词。
        <b>候选越少 → 输出越确定；候选越多 → 输出越多样。</b>
      </p>
      <button @click="runSampling" :disabled="sampling || stats.keptCount === 0" class="run-btn">
        {{ sampling ? '采样中…' : '▶ 跑一次（100 次采样）' }}
      </button>

      <div v-if="sampleResults" class="sample-results">
        <div v-for="r in sampleResults" :key="r.word" class="sample-row">
          <div class="sample-word">{{ r.word }}</div>
          <div class="sample-track">
            <div class="sample-fill" :style="{ width: r.count + '%' }"></div>
          </div>
          <div class="sample-count">{{ r.count }} 次</div>
        </div>
      </div>
      <p v-if="stats.keptCount === 0" class="warn">
        ⚠️ 当前 Top-K / Top-P 设置过严，无候选词可采样。
      </p>
    </div>

    <!-- PM 应用指南 -->
    <div class="card pm-notes">
      <h2>PM 视角：工作流里怎么调？</h2>
      <table>
        <thead>
          <tr><th>场景</th><th>建议</th></tr>
        </thead>
        <tbody>
          <tr><td>事实问答 / 信息抽取 / 代码</td><td><b>Top-K=1</b> 或 <b>Top-P=0.1</b>，强制确定性</td></tr>
          <tr><td>标准客服 / 翻译 / 摘要</td><td>Top-P=0.9，业界默认</td></tr>
          <tr><td>创作 / 改写 / 头脑风暴</td><td>Top-P=0.95 + Temperature 高（其他演示）</td></tr>
        </tbody>
      </table>
      <div class="pitfall">
        <b>⚠️ 实操坑</b>：很多工作流平台 Top-K 和 Top-P 同时打开，
        实际上<b>两个一起用会互相干扰</b>——业界惯例是<b>二选一</b>，固定其中一个、只调另一个。
      </div>
    </div>

    <footer class="footer">
      <a href="../">← 回 Playground 首页</a>
    </footer>
  </div>
</template>

<style scoped>
.lead {
  font-size: 1.02rem;
  line-height: 1.7;
  margin-bottom: 1.5rem;
}

.prompt-box {
  background: var(--bg-card);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}
.prompt-label {
  font-size: 0.75rem;
  color: var(--fg-muted);
  font-weight: 600;
  letter-spacing: 0.05em;
}
.prompt-text {
  font-size: 1.15rem;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.cursor {
  animation: blink 1s steps(2, start) infinite;
  color: var(--accent);
}
@keyframes blink {
  to { visibility: hidden; }
}

.controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

.control-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem;
  box-shadow: var(--shadow);
}

.control-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.control-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.2rem;
}
.control-desc {
  font-size: 0.85rem;
  color: var(--fg-muted);
}

.control-value {
  font-size: 1.8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
  line-height: 1;
}

.control-scale {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--fg-muted);
  margin-top: 0.4rem;
}

.scenarios {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 1.5rem;
}
.scenarios-label {
  font-size: 0.85rem;
  color: var(--fg-muted);
}
.scenario-btn {
  background: var(--bg-subtle);
  color: var(--fg);
  font-size: 0.82rem;
  padding: 0.4em 0.85em;
  border: 1px solid var(--border);
}
.scenario-btn:hover {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.chart-card { margin-bottom: 1.5rem; }
.chart-card h2,
.sampling-card h2,
.pm-notes h2 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}

.badge {
  display: inline-block;
  padding: 0.1em 0.55em;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  margin: 0 0.15em;
}
.badge-kept { background: var(--success); color: #fff; }
.badge-cut-k { background: var(--danger); color: #fff; }
.badge-cut-p { background: var(--warning); color: #fff; }
.badge-cut-both { background: var(--fg-muted); color: #fff; }

.bars {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin: 1rem 0 1.25rem;
}

.bar-row {
  display: grid;
  grid-template-columns: 38px 60px 1fr 100px 110px;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0;
  transition: opacity 0.2s;
}
.bar-row.cut {
  opacity: 0.45;
}

.bar-rank {
  color: var(--fg-muted);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.bar-word {
  font-weight: 600;
  font-size: 1rem;
}

.bar-track {
  background: var(--bg-subtle);
  border-radius: 4px;
  height: 24px;
  overflow: hidden;
  position: relative;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding: 0 0.5em;
  transition: width 0.3s ease, background 0.2s;
  min-width: 3em;
}
.bar-fill.kept { background: var(--success); }
.bar-fill.cut-k { background: var(--danger); }
.bar-fill.cut-p { background: var(--warning); }
.bar-fill.cut-both { background: var(--fg-muted); }

.bar-label {
  color: #fff;
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.bar-cum {
  font-size: 0.78rem;
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.bar-status .status {
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.15em 0.55em;
  border-radius: 4px;
}
.status-kept { background: rgba(16, 185, 129, 0.15); color: var(--success); }
.status-cut { background: var(--bg-subtle); color: var(--fg-muted); }
.status-cut-k { background: rgba(239, 68, 68, 0.15); color: var(--danger); }
.status-cut-p { background: rgba(245, 158, 11, 0.15); color: var(--warning); }

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  margin-top: 0.5rem;
}
.stat-label {
  font-size: 0.78rem;
  color: var(--fg-muted);
  margin-bottom: 0.2rem;
}
.stat-val {
  font-size: 1.3rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.sampling-card { margin-bottom: 1.5rem; }
.run-btn {
  margin: 0.75rem 0 1rem;
  padding: 0.8em 1.4em;
  font-size: 1rem;
  font-weight: 600;
}
.run-btn:disabled {
  background: var(--bg-subtle);
  color: var(--fg-muted);
  cursor: not-allowed;
}

.sample-results {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.5rem;
}
.sample-row {
  display: grid;
  grid-template-columns: 70px 1fr 70px;
  align-items: center;
  gap: 0.75rem;
}
.sample-word { font-weight: 600; font-size: 0.95rem; }
.sample-track {
  background: var(--bg-subtle);
  height: 22px;
  border-radius: 4px;
  overflow: hidden;
}
.sample-fill {
  background: var(--accent);
  height: 100%;
  transition: width 0.4s ease;
}
.sample-count {
  font-size: 0.85rem;
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.warn {
  color: var(--warning);
  font-size: 0.9rem;
  margin-top: 1rem;
}

.pm-notes table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.75rem;
}
.pm-notes th, .pm-notes td {
  text-align: left;
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.92rem;
}
.pm-notes th {
  background: var(--bg-subtle);
  font-size: 0.85rem;
  color: var(--fg-muted);
}

.pitfall {
  margin-top: 1rem;
  padding: 0.9rem 1.1rem;
  background: rgba(245, 158, 11, 0.1);
  border-left: 3px solid var(--warning);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-size: 0.92rem;
  line-height: 1.6;
}

.footer {
  margin-top: 2.5rem;
  text-align: center;
}

@media (max-width: 800px) {
  .controls { grid-template-columns: 1fr; }
  .stats { grid-template-columns: repeat(2, 1fr); }
  .bar-row {
    grid-template-columns: 30px 50px 1fr 80px;
  }
  .bar-status { display: none; }
}
</style>
