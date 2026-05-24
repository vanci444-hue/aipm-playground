<script setup>
import { ref, computed } from 'vue'

// 预设：模型对 "中国的首都是" 之后下一个词的原始概率分布（T=1 时）
const baseTokens = [
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

const temperature = ref(1.0)
const topP = ref(1.0)

// Temperature 调整：softmax(logits / T)
// T<<1 锐化分布（更确定），T>>1 软化分布（更发散）
function applyTemperature(probs, T) {
  if (T <= 0.05) {
    // 边界：T→0 退化为 argmax（最大概率词概率=1，其他=0）
    const maxIdx = probs.indexOf(Math.max(...probs))
    return probs.map((_, i) => (i === maxIdx ? 1 : 0))
  }
  // log 把原始概率转回 logit
  const logits = probs.map(p => Math.log(Math.max(p, 1e-10)))
  const scaled = logits.map(l => l / T)
  // 减去最大值避免溢出
  const maxL = Math.max(...scaled)
  const exps = scaled.map(l => Math.exp(l - maxL))
  const sumExp = exps.reduce((s, e) => s + e, 0)
  return exps.map(e => e / sumExp)
}

// 经过 Temperature 调整后的概率（保持原顺序，对应 baseTokens）
const tempAdjusted = computed(() => {
  const newProbs = applyTemperature(baseTokens.map(t => t.prob), temperature.value)
  return baseTokens.map((t, i) => ({
    ...t,
    origProb: t.prob,
    adjustedProb: newProbs[i]
  }))
})

// 按调整后概率降序排序，并应用 Top-P 截断
const annotated = computed(() => {
  const sorted = [...tempAdjusted.value].sort((a, b) => b.adjustedProb - a.adjustedProb)
  let cumProb = 0
  let topPCutoffIdx = sorted.length
  // Top-P：累加直到达到 P，包含第一个使累加达标的词
  for (let i = 0; i < sorted.length; i++) {
    cumProb += sorted[i].adjustedProb
    if (cumProb >= topP.value) {
      topPCutoffIdx = i + 1
      break
    }
  }
  if (topP.value >= 0.9999) topPCutoffIdx = sorted.length

  let runningSum = 0
  return sorted.map((t, i) => {
    runningSum += t.adjustedProb
    const cutByP = i >= topPCutoffIdx
    return {
      ...t,
      rank: i + 1,
      cutByP,
      kept: !cutByP,
      cumProb: runningSum,
      probChange: t.adjustedProb - t.origProb
    }
  })
})

// 候选词统计
const stats = computed(() => {
  const kept = annotated.value.filter(t => t.kept)
  const totalProb = kept.reduce((s, t) => s + t.adjustedProb, 0)
  return {
    keptCount: kept.length,
    totalProb,
    cutCount: baseTokens.length - kept.length
  }
})

// 重新归一化后的概率（用于实际采样）
const renormalized = computed(() => {
  const total = stats.value.totalProb
  if (total === 0) return []
  return annotated.value
    .filter(t => t.kept)
    .map(t => ({ ...t, normProb: t.adjustedProb / total }))
})

// 最大概率（用于柱状图宽度归一化）
const maxAdjustedProb = computed(() =>
  Math.max(...annotated.value.map(t => t.adjustedProb))
)

// "模拟采样 100 次"
const sampleResults = ref(null)
const sampling = ref(false)

function runSampling() {
  if (renormalized.value.length === 0) {
    sampleResults.value = null
    return
  }
  sampling.value = true
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

// 场景预设
const scenarios = [
  { label: '🔓 默认（T=1, P=1）', t: 1.0, p: 1.0 },
  { label: '🔒 严格事实问答（T=0）', t: 0, p: 1.0 },
  { label: '⚖️ 业界推荐（T=0.7, P=0.9）', t: 0.7, p: 0.9 },
  { label: '💡 创作发散（T=1.2, P=0.95）', t: 1.2, p: 0.95 },
  { label: '🎨 极端发散（T=1.8）', t: 1.8, p: 1.0 }
]

function applyScenario(s) {
  temperature.value = s.t
  topP.value = s.p
  sampleResults.value = null
}

// 帮助函数：格式化概率显示（小于 0.1% 显示为 <0.1%）
function fmtProb(p) {
  if (p < 0.001) return '<0.1%'
  return (p * 100).toFixed(1) + '%'
}
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1>🎲 Temperature / Top-P 采样 · 交互演示</h1>
      <a class="home-link" href="../">← 回首页</a>
    </header>

    <p class="lead">
      LLM 每生成一个词，都是从词表的<b>概率分布</b>里"采样"一个词输出。
      <b>Temperature</b> 调整分布的"软硬"，<b>Top-P</b> 截掉长尾的离谱词——
      这是搭工作流（Coze / Dify / OpenAI API）时最常调的两个旋钮。
      <br />
      <span class="muted">下面用真实场景（"中国的首都是"）演示两个旋钮怎么影响输出。</span>
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
            <div class="control-title">Temperature</div>
            <div class="control-desc">
              <b>软化 / 锐化</b>整个概率分布
              <br /><span class="muted">T=0 → 永远选最大；T 越大越发散</span>
            </div>
          </div>
          <div class="control-value">{{ temperature.toFixed(2) }}</div>
        </div>
        <input type="range" min="0" max="2" step="0.05" v-model.number="temperature" />
        <div class="control-scale">
          <span>0（完全确定）</span>
          <span>1（原始）</span>
          <span>2（极端发散）</span>
        </div>
      </div>

      <div class="control-card">
        <div class="control-header">
          <div>
            <div class="control-title">Top-P</div>
            <div class="control-desc">
              从最高概率<b>累加到 P 为止</b>，后面全砍
              <br /><span class="muted">P=0.9 → 只从覆盖 90% 概率的候选里挑</span>
            </div>
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
        <span class="badge badge-kept">保留</span> 通过 Top-P；
        <span class="badge badge-cut">被砍</span> 累计概率超出 P；
        小箭头显示<b>概率被 Temperature 改变的方向</b>（↑ 锐化、↓ 软化）
      </p>

      <div class="bars">
        <div v-for="t in annotated" :key="t.word" class="bar-row" :class="{ cut: !t.kept }">
          <div class="bar-rank">#{{ t.rank }}</div>
          <div class="bar-word">{{ t.word }}</div>
          <div class="bar-track">
            <div
              class="bar-fill"
              :class="{ 'kept': t.kept, 'cut-p': t.cutByP }"
              :style="{ width: (t.adjustedProb / Math.max(maxAdjustedProb, 0.001) * 100) + '%' }"
            >
              <span class="bar-label">{{ fmtProb(t.adjustedProb) }}</span>
            </div>
          </div>
          <div class="bar-change">
            <span class="orig-prob">原 {{ fmtProb(t.origProb) }}</span>
            <span v-if="Math.abs(t.probChange) > 0.001" class="change-arrow"
                  :class="t.probChange > 0 ? 'up' : 'down'">
              {{ t.probChange > 0 ? '↑' : '↓' }}
              {{ (Math.abs(t.probChange) * 100).toFixed(1) }}%
            </span>
            <span v-else class="change-arrow same">不变</span>
          </div>
          <div class="bar-cum">累计 {{ (t.cumProb * 100).toFixed(1) }}%</div>
        </div>
      </div>

      <!-- 统计 -->
      <div class="stats">
        <div class="stat">
          <div class="stat-label">最终候选词数</div>
          <div class="stat-val">{{ stats.keptCount }} / {{ baseTokens.length }}</div>
        </div>
        <div class="stat">
          <div class="stat-label">候选词覆盖概率</div>
          <div class="stat-val">{{ (stats.totalProb * 100).toFixed(1) }}%</div>
        </div>
        <div class="stat">
          <div class="stat-label">Top-P 砍掉</div>
          <div class="stat-val">{{ stats.cutCount }} 个</div>
        </div>
        <div class="stat">
          <div class="stat-label">最大概率词</div>
          <div class="stat-val">{{ annotated[0]?.word }} · {{ fmtProb(annotated[0]?.adjustedProb || 0) }}</div>
        </div>
      </div>
    </div>

    <!-- 模拟采样 -->
    <div class="card sampling-card">
      <h2>模拟采样 100 次</h2>
      <p class="muted">
        基于上面候选词（重新归一化后的概率），随机采样 100 次，看实际会"挑"到哪些词。
        <b>T 越低 / P 越小 → 输出越确定；T 越高 / P 越大 → 输出越多样。</b>
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
        ⚠️ 当前设置过严，无候选词可采样。
      </p>
    </div>

    <!-- PM 应用指南 -->
    <div class="card pm-notes">
      <h2>PM 视角：工作流里怎么调？</h2>
      <table>
        <thead>
          <tr><th>场景</th><th>Temperature</th><th>Top-P</th></tr>
        </thead>
        <tbody>
          <tr><td>事实问答 / 信息抽取 / 代码</td><td><b>0 ~ 0.3</b></td><td>0.9</td></tr>
          <tr><td>标准客服 / 翻译 / 摘要</td><td>0.3 ~ 0.5</td><td>0.9</td></tr>
          <tr><td>创作 / 改写 / 头脑风暴</td><td>0.7 ~ 0.9</td><td>0.95</td></tr>
        </tbody>
      </table>
      <div class="pitfall">
        <b>⚠️ 实操坑</b>：很多工作流平台 Temperature 默认 <b>0.7</b>——
        跑事实类任务（RAG 问答、信息抽取）会出幻觉。<b>新建节点的第一件事就是把 Temperature 拉到 0 ~ 0.3。</b>
      </div>
      <div class="pitfall" style="margin-top: 0.6rem;">
        <b>💡 业界惯例</b>：固定 Top-P=0.9，<b>只调 Temperature</b>——这俩同时大幅调整会互相干扰。
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
  gap: 0.75rem;
}

.control-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.3rem;
}
.control-desc {
  font-size: 0.85rem;
  color: var(--fg);
  line-height: 1.5;
}
.control-desc .muted { font-size: 0.78rem; }

.control-value {
  font-size: 1.8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
  line-height: 1;
  flex-shrink: 0;
}

.control-scale {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
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
.badge-cut { background: var(--warning); color: #fff; }

.bars {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin: 1rem 0 1.25rem;
}

.bar-row {
  display: grid;
  grid-template-columns: 36px 60px 1fr 130px 100px;
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
  min-width: 3.5em;
}
.bar-fill.kept { background: var(--success); }
.bar-fill.cut-p { background: var(--warning); }

.bar-label {
  color: #fff;
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.bar-change {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  align-items: flex-start;
}
.orig-prob {
  color: var(--fg-muted);
  font-size: 0.7rem;
}
.change-arrow {
  font-weight: 600;
  padding: 0.05em 0.4em;
  border-radius: 3px;
}
.change-arrow.up { background: rgba(16, 185, 129, 0.15); color: var(--success); }
.change-arrow.down { background: rgba(239, 68, 68, 0.15); color: var(--danger); }
.change-arrow.same { color: var(--fg-muted); font-weight: 400; }

.bar-cum {
  font-size: 0.78rem;
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

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
  .bar-change { display: none; }
}
</style>
