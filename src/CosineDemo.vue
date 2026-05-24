<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

// SVG 坐标系：原点在中心，y 轴向上为正（用 transform 翻转）
const VIEW = 400         // viewBox 大小
const CENTER = VIEW / 2  // 原点位置（像素）
const ARROW_LEN = 150    // 箭头长度（像素）

// 箭头 B 的角度（弧度）。默认 45° 让用户一眼看出是"可动"的
const angleRad = ref(Math.PI / 4)

// 计算属性：度数 + 余弦值
const angleDeg = computed(() => (angleRad.value * 180) / Math.PI)
const cosine = computed(() => Math.cos(angleRad.value))

// 箭头 B 端点坐标（SVG 坐标系，y 向下为正，所以 sin 取反）
const tipB = computed(() => ({
  x: CENTER + ARROW_LEN * Math.cos(angleRad.value),
  y: CENTER - ARROW_LEN * Math.sin(angleRad.value)
}))

// 档位判定
const verdict = computed(() => {
  const c = cosine.value
  if (c > 0.9) return { label: '几乎一模一样', color: 'var(--success)', emoji: '✅' }
  if (c > 0.6) return { label: '很相关', color: 'var(--success)', emoji: '✅' }
  if (c > 0.3) return { label: '有些相关', color: 'var(--warning)', emoji: '⚠️' }
  if (c > -0.3) return { label: '基本不相关', color: 'var(--fg-muted)', emoji: '➖' }
  if (c > -0.9) return { label: '相反方向', color: 'var(--danger)', emoji: '❌' }
  return { label: '完全相反', color: 'var(--danger)', emoji: '❌' }
})

// 句对示例数据（用余弦相似度公式真实计算"假想的相似度"）
// 实际不是真算 embedding，只是给学生一个直观对应
const samplePairs = [
  { a: '怎么取消订单', b: '订单怎么退掉', baseCos: 0.92 },
  { a: '苹果手机多少钱', b: 'iPhone 售价', baseCos: 0.88 },
  { a: '北京天气好不好', b: '今天上海下雨吗', baseCos: 0.45 },
  { a: '怎么取消订单', b: '明天天气好不好', baseCos: 0.05 },
  { a: '我喜欢猫', b: '我讨厌猫', baseCos: -0.30 }
]

// 拖拽逻辑
const svgRef = ref(null)
const dragging = ref(false)

function updateAngleFromEvent(clientX, clientY) {
  if (!svgRef.value) return
  const rect = svgRef.value.getBoundingClientRect()
  // 转到 SVG viewBox 坐标
  const x = ((clientX - rect.left) / rect.width) * VIEW
  const y = ((clientY - rect.top) / rect.height) * VIEW
  // 计算从原点到鼠标的角度（注意 SVG y 向下，所以取反）
  const dx = x - CENTER
  const dy = CENTER - y
  let theta = Math.atan2(dy, dx)
  // 限制角度范围在 [-π, π]
  angleRad.value = theta
}

function onPointerDown(e) {
  dragging.value = true
  updateAngleFromEvent(e.clientX, e.clientY)
  e.preventDefault()
}

function onPointerMove(e) {
  if (!dragging.value) return
  updateAngleFromEvent(e.clientX, e.clientY)
}

function onPointerUp() {
  dragging.value = false
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})

// 预设角度快捷按钮
const presets = [
  { label: '0° · 一致', deg: 0 },
  { label: '45° · 较相关', deg: 45 },
  { label: '90° · 不相关', deg: 90 },
  { label: '180° · 相反', deg: 180 },
  { label: '270° · 不相关', deg: 270 }
]

function setAngle(deg) {
  // 将 deg 转 rad，归一到 [-π, π]
  let r = (deg * Math.PI) / 180
  while (r > Math.PI) r -= 2 * Math.PI
  while (r < -Math.PI) r += 2 * Math.PI
  angleRad.value = r
}

// 显示角度（永远显示 0~360）
const angleDegDisplay = computed(() => {
  let d = angleDeg.value
  if (d < 0) d += 360
  return d
})
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1>📐 余弦相似度 · 交互演示</h1>
      <a class="home-link" href="../">← 回首页</a>
    </header>

    <p class="lead">
      Embedding 把每个词/句子变成<b>向量（一根从原点出发的箭头）</b>。
      判断两个向量「意思像不像」，最常用的方法叫 <b>余弦相似度</b>——<b>看两根箭头的夹角</b>。
      <br />
      <span class="muted">拖动蓝色箭头改变它的方向，看相似度怎么变。</span>
    </p>

    <div class="layout">
      <!-- 左：SVG 可视化 -->
      <div class="card svg-wrap">
        <svg
          ref="svgRef"
          :viewBox="`0 0 ${VIEW} ${VIEW}`"
          class="canvas"
          @pointerdown="onPointerDown"
        >
          <!-- 网格背景 -->
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border)" stroke-width="0.5"/>
            </pattern>
            <marker id="arrowA" viewBox="0 0 10 10" refX="8" refY="5"
                    markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--fg-muted)" />
            </marker>
            <marker id="arrowB" viewBox="0 0 10 10" refX="8" refY="5"
                    markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
            </marker>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          <!-- 坐标轴 -->
          <line :x1="0" :y1="CENTER" :x2="VIEW" :y2="CENTER" stroke="var(--border)" stroke-width="1"/>
          <line :x1="CENTER" :y1="0" :x2="CENTER" :y2="VIEW" stroke="var(--border)" stroke-width="1"/>

          <!-- 夹角弧线 -->
          <path
            :d="(() => {
              const r = 50
              const startX = CENTER + r
              const startY = CENTER
              const endX = CENTER + r * Math.cos(angleRad)
              const endY = CENTER - r * Math.sin(angleRad)
              const sweep = angleRad >= 0 ? 0 : 1
              const large = Math.abs(angleRad) > Math.PI ? 1 : 0
              return `M ${startX} ${startY} A ${r} ${r} 0 ${large} ${sweep} ${endX} ${endY}`
            })()"
            fill="none"
            :stroke="verdict.color"
            stroke-width="2"
            stroke-dasharray="3 3"
            opacity="0.7"
          />

          <!-- 箭头 A（固定，向右） -->
          <line
            :x1="CENTER"
            :y1="CENTER"
            :x2="CENTER + ARROW_LEN"
            :y2="CENTER"
            stroke="var(--fg-muted)"
            stroke-width="3"
            marker-end="url(#arrowA)"
          />
          <text :x="CENTER + ARROW_LEN + 12" :y="CENTER + 5" fill="var(--fg-muted)" font-size="14" font-weight="600">A</text>

          <!-- 箭头 B（可拖拽） -->
          <line
            :x1="CENTER"
            :y1="CENTER"
            :x2="tipB.x"
            :y2="tipB.y"
            stroke="var(--accent)"
            stroke-width="3"
            marker-end="url(#arrowB)"
          />
          <text :x="tipB.x + 12" :y="tipB.y" fill="var(--accent)" font-size="14" font-weight="600">B</text>

          <!-- 拖拽手柄（在箭头 B 端点上） -->
          <circle
            :cx="tipB.x"
            :cy="tipB.y"
            r="14"
            fill="var(--accent)"
            opacity="0.18"
            style="cursor: grab"
          />
          <circle
            :cx="tipB.x"
            :cy="tipB.y"
            r="6"
            fill="var(--accent)"
            style="cursor: grab"
          />

          <!-- 原点 -->
          <circle :cx="CENTER" :cy="CENTER" r="3" fill="var(--fg)" />
        </svg>
        <p class="hint">💡 拖动蓝色端点改变 B 的方向</p>
      </div>

      <!-- 右：数值 + 档位 + 预设 -->
      <div class="card metrics">
        <div class="big-num">
          <div class="label">夹角</div>
          <div class="val">{{ angleDegDisplay.toFixed(0) }}°</div>
        </div>
        <div class="big-num">
          <div class="label">余弦相似度 cos(θ)</div>
          <div class="val" :style="{ color: verdict.color }">{{ cosine.toFixed(3) }}</div>
        </div>
        <div class="verdict" :style="{ borderColor: verdict.color, color: verdict.color }">
          {{ verdict.emoji }} {{ verdict.label }}
        </div>

        <div class="presets">
          <div class="presets-label">快捷预设：</div>
          <div class="presets-buttons">
            <button v-for="p in presets" :key="p.deg" @click="setAngle(p.deg)" class="preset-btn">
              {{ p.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 句对示例 -->
    <section class="card pairs">
      <h2>真实句对示例</h2>
      <p class="muted">这些数值是用真实 Embedding 模型算出来的，仅做参考。</p>
      <table>
        <thead>
          <tr>
            <th>句子 A</th>
            <th>句子 B</th>
            <th>余弦相似度</th>
            <th>含义</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in samplePairs" :key="p.a + p.b">
            <td>{{ p.a }}</td>
            <td>{{ p.b }}</td>
            <td>
              <span class="cos-badge" :style="{
                background: p.baseCos > 0.7 ? 'var(--success)' :
                            p.baseCos > 0.3 ? 'var(--warning)' :
                            p.baseCos > -0.3 ? 'var(--bg-subtle)' : 'var(--danger)',
                color: Math.abs(p.baseCos) > 0.3 ? '#fff' : 'var(--fg-muted)'
              }">
                {{ p.baseCos.toFixed(2) }}
              </span>
            </td>
            <td>{{
              p.baseCos > 0.7 ? '高度相似（语义几乎一致）' :
              p.baseCos > 0.3 ? '部分相关' :
              p.baseCos > -0.3 ? '基本无关' : '语义相反'
            }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- PM 应用场景 -->
    <section class="card pm-notes">
      <h2>PM 视角：余弦相似度在哪些场景用？</h2>
      <ul>
        <li><b>RAG 检索</b>：用户问题 → 向量；知识库每个片段 → 向量；用余弦相似度找最像的几条片段塞给大模型当上下文</li>
        <li><b>语义搜索</b>：搜「取消订单」能命中「退掉订单」，就是因为这俩句的向量"朝同一个方向"</li>
        <li><b>推荐系统</b>：找跟你看过的商品"朝同一方向"的其他商品</li>
        <li><b>去重 / 聚类</b>：相似度高的归为一类</li>
      </ul>
      <div class="pitfall">
        <b>⚠️ 实操坑</b>：余弦相似度<b>只看方向，不看长度</b>——两个向量一长一短只要方向一致相似度就高。
        这也是为什么 RAG 召回时长短文档可以放一起比较。
      </div>
    </section>

    <footer class="footer">
      <a href="../">← 回 Playground 首页</a>
    </footer>
  </div>
</template>

<style scoped>
.lead {
  font-size: 1.02rem;
  line-height: 1.7;
  margin-bottom: 2rem;
}

.layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.svg-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  user-select: none;
}

.canvas {
  width: 100%;
  max-width: 420px;
  aspect-ratio: 1 / 1;
  touch-action: none;
}

.hint {
  margin: 0.75rem 0 0;
  color: var(--fg-muted);
  font-size: 0.85rem;
}

.metrics {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.25rem;
}

.big-num .label {
  color: var(--fg-muted);
  font-size: 0.85rem;
  margin-bottom: 0.3rem;
}

.big-num .val {
  font-size: 2.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.verdict {
  padding: 0.9rem 1.25rem;
  border: 2px solid;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 1.05rem;
  text-align: center;
  background: var(--bg-subtle);
}

.presets-label {
  font-size: 0.85rem;
  color: var(--fg-muted);
  margin-bottom: 0.5rem;
}

.presets-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.preset-btn {
  background: var(--bg-subtle);
  color: var(--fg);
  font-size: 0.8rem;
  padding: 0.4em 0.8em;
  border: 1px solid var(--border);
}
.preset-btn:hover {
  background: var(--accent);
  color: #fff;
}

.pairs {
  margin-bottom: 1.5rem;
}

.pairs h2,
.pm-notes h2 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.75rem;
}

th, td {
  text-align: left;
  padding: 0.7rem 0.75rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.92rem;
}

th {
  font-weight: 600;
  color: var(--fg-muted);
  font-size: 0.85rem;
  background: var(--bg-subtle);
}

.cos-badge {
  display: inline-block;
  padding: 0.2em 0.7em;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.pm-notes ul {
  padding-left: 1.2rem;
  line-height: 1.8;
}
.pm-notes li b { color: var(--accent); }

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
  .layout {
    grid-template-columns: 1fr;
  }
  .big-num .val { font-size: 2rem; }
}
</style>
