# SPEC — Kibarkan Bendera · Kata Arah（tahun1-bm-kataarah）

> 开发规划（主对话写，Sonnet 子代理实作，主对话验收）。老师 2026-10-13 在对话中已定：做法 A（周会排队）、风格＝**Q 版可爱卡通 × 45 度斜俯视的 2.5D**、署名 Cikgu Lee Xin Hui。
> 先读 `../tahun2-bm-kataarah/METHOD.md`（流程与踩坑）和本档；**判定机制、Voice、拖拽、反馈代码可参考 `../tahun2-bm-kataarah/`，但不要整份复制 app.js 后只改词**。冲突先问主对话，不要自行换机制。

## 1. 目标与依据
- 科目：Bahasa Melayu SJK Tahun 1（国文＝马来文）。DSKP **5.1.4(iii) kata arah**（KSSR 原版 SJK 通用版，`资料库/DSKP资料/KSSR2015/Bahasa-Melayu/SJK/TAHUN1.md`；该档「仅为截取，没有审核」）。
- 课本：Buku Teks BM Tahun 1 SJK，**BA 第 28 页（PDF 107）Kibarkan Bendera Malaysia**。原页图在 scratchpad（**仅对照，不得放进专案、不得 commit**）。
- 词：**只用 4 个：atas、bawah、belakang、hadapan**（老师定）。不放 kiri／kanan／tepi／dalam／luar／di sebelah。
- 学生困难假设：分不清「相对于谁」，以及「前／后」要看参照物面向哪边。所以**每一题、每一条口令都点明参照物**；场景里所有人**都面向舞台**，Kenali 第一句先说 *Semua murid menghadap pentas.*（朗读＋文字）。

## 2. 课本答案
| 句子（工具界面里的写法） | 答案 | 备注 |
|---|---|---|
| Murid-murid berkumpul di ___ guru. | **hadapan** | 学生站在老师（舞台）前面 |
| Nani berdiri di ___ Sin Ling. | **belakang** | ⚠️ **待对课本**：课本空格前没有 di，原图人名牌看不清；按图推断 Nani 在 Sin Ling 后面。交付时 handoff 要标「待老师核对」 |
| Cikgu Mohan berdiri di ___ pentas. | **atas** | |
| Rani berdiri di ___ pokok. | **bawah** | |
课文句（Kenali 用）：*Murid-murid berhimpun di **hadapan** pentas.*　*Zali berdiri di **belakang** Wei Han.*（出处：BA 28）

## 3. 语言
- **界面、口令、题目、反馈、朗读全部马来文，不加中文**。大字、短句。
- 朗读：edge-tts 预录 mp3，`ms-MY-YasminNeural`，语速 -10%；模板 `../tahun1-mt-pecahan/gen-voice.py`＋`SAY`＋`clipKey()`；浏览器 speechSynthesis 只当没音档的备案，排除搞怪声音。改了句子要重跑 gen-voice。
- 页面内不写创作者人名（署名只在 Hub：`creator.name = Cikgu Lee Xin Hui`，initial `L`）。角色名（Wei Han、Zali、Nani、Sin Ling、Rani、Cikgu Mohan）是课本人物，可以出现在口令与名牌上。

## 4. 视觉与 2.5D 做法
- **画风**：Q 版可爱卡通（2 头身、大圆脑袋、圆润深棕描边、糖果色）。场景＝45 度斜俯视的周会操场。**不用课本原图**。不用 emoji 当图示。UI 外壳（按钮、词标、进度）也走同一可爱卡通语言：圆角胶囊、饱和柔和的糖果色、深棕描边，不要做成「积木」（那是 tahun2 的风格）。
- **2.5D 规则（核心，四条都要做）**：
  1. **近大远小**：角色高度随脚点 y 线性缩放 `s(y)`（越靠近舞台越小），参数写进 `scenes.js`，实测调到舞台前的人约为最前排的 0.6。
  2. **前后遮挡**：所有角色按脚点 y 排序（y 大者盖在上）；站在树后（本工具只用「树下」，见 §7）、舞台后的遮挡不需要，但排队时后一位要盖住前一位下摆一点点。
  3. **脚下影子**：每个角色脚下椭圆影子；拖起时角色放大 1.05、影子变小变淡，松手弹回。
  4. **台面高度**：落在舞台台面上的角色整体上抬 `stageLift` 像素，并按舞台台面深度缩放（站台面中央时比站台前地面小一点点）。
- **场景图**（素材已定，不用重生）：`assets/raw/bg45-20261013-234854-1.png`（1536×1024）。构图：左上半圆形舞台＋三级台阶（台面空着）、右侧空旗杆、右上大树（树下有圆形花圃与树荫）、下半大片空地；背景图自带地砖纹路。**不画任何格子／区域框**。
- **角色素材**（已审过、已挑好，都在 `assets/raw/sel/`，白底角色表，要抠图成透明 WebP；其余废稿已搬走）：
  - `bg45.png`：场景（1536×1024）。
  - `chars-front.png`：6 个**正面**小人，从左到右 Wei Han、Zali（手里有国旗，**不要**：抠图时去掉旗子与旗杆，用不带旗的手臂；若去不干净就回报主对话，不要用 CSS 补画）、Nani、Sin Ling、Rani、Cikgu Mohan（拿麦克风）。**Cikgu Mohan 只用这套正面**。
  - `kids-back.png`：5 位学生的**背面**（面向舞台），从左到右 Wei Han、Zali、Nani、Sin Ling、Rani；**学生默认造型用背面**。
  - `crowd-a.png`、`crowd-b.png`、`crowd-c.png`：各 5 人、共 15 个背面群众学生（背景人群，不可拖）。
  - `teachers-seated.png`：4 位坐着的老师（正面，椅子上，坐在舞台后排，不可拖）。
  - `teachers-standing-back.png`：3 位站立老师背面（站在群众队伍两侧，不可拖）。
  - `flag.png`：校旗（宝蓝色＋黄星＋白条，旗杆连接边在左），升旗用。
  - 用到树下／面向我们的学生时（Rani 在树下）：**用正面造型**（`chars-a`），其余场合用背面。
- 抠图：PIL＋numpy（白色连通背景去除、边缘平滑、裁到包围盒留 4px），逐个命名（`weihan-back.webp`、`weihan-front.webp`…）。检查无白边、无裁切；若某张有缺陷（被裁、有字、人数不对）**回报主对话，不要用 CSS 补画**。场景图 ≤ 450 KB（WebP），单个角色 ≤ 60 KB。
- 字体嵌入 woff2（圆润字体如 Baloo 2／Fredoka，放 `fonts/`）；学校电脑 Windows＋Chrome。
- 目标尺寸：1366×768 下角色可点区域 ≥ 64px（以 `s(y)` 最小处也要满足；不够就整体放大角色基准高度）。

## 5. 场地上的人（要像真的周会）
- **群众学生 ≥ 20 人**：用 15 个群众背面素材＋水平翻转／微调缩放凑到 ≥ 20，**相邻不要出现同一张**。排成 4 排（每排 5–6 人）的班级队伍，**位置在场地左下（约 x 80–880、y 560–900，归一化坐标由子代理按最终画面定）**，所有人背对我们、面向舞台。
- **老师**：舞台后排坐 4 位（固定）；站立老师 3 位站在队伍两侧（固定）；Cikgu Mohan 是**可拖的角色**（Susun／Jawab 里被问到的人），初始在场地下方的候场区，Kenali 里站在台面前半部。
- **可拖角色 6 个**：Wei Han、Zali、Nani、Sin Ling、Rani、Cikgu Mohan。每个头顶有名牌（可爱胶囊，字白底深棕），**拖动时与被问到时显示**，平时可淡显。
- **候场区**：场地最下方一条带（约 y 910–1000）横排，队伍之外；Susun 开局所有可拖角色在这里。
- 保留给判定的空地（群众队伍不要占）：舞台台面前半部、舞台前地面带（`hadapan pentas`，约 y 350–520）、右中的「队列跑道」（约 x 950–1250、y 560–900，用于「谁在谁后面」）、树下。**群众队伍与这些区域的边界由子代理按最终画面定，回报时附一张叠框的验证图。**

## 6. 三个阶段（首页三个大按钮：Kenali／Jawab／Susun；进入后顶部有进度条可随时切换）

### 6.1 Kenali（认识）
- 画面＝完整周会场景（群众＋老师＋6 个角色摆在课本位置：Cikgu Mohan 在台上、群众在台前、Wei Han 与 Zali 前后站在跑道上、Rani 在树下、Nani 站在 Sin Ling 后面）。
- 4 个词是 4 块可爱词标，**位置标在对应的人旁边**：atas（Cikgu Mohan 旁）、hadapan（群众前方）、belakang（Zali／Wei Han 旁）、bawah（Rani 旁）。
- 点词标：朗读该词 → 对应角色跳一下并发光、参照物（舞台／树／Wei Han）轻闪 → 底部面板显示课本例句，该词高亮并朗读。点角色本身也触发同样演示。
- 「Main semua」：老师在大屏幕上一键依序自动演示 4 个词，**等朗读读完再停 1 秒才换下一个词**（`Voice.say(lines, done)`，不要固定秒数）；有「Henti／Sambung」。
- 开场第一句：*Semua murid menghadap pentas.*

### 6.2 Jawab（回答）
- 一题＝场景（只亮出被问的人＋参照物，其余群众淡一点）＋题句＋4 个词选项（大按钮）。
- **前 4 题就是 §2 的课本 4 句**（该题把场景布置成课本情境：Nani 站在 Sin Ling 正后方、Rani 在树下、Cikgu Mohan 在台上、群众在台前）。再补到 8 题，**补题只用下列可唯一判定的情境**：
  - *Zali berdiri di ___ Wei Han.*（belakang，课文句）
  - *Murid-murid berhimpun di ___ pentas.*（hadapan，课文句）
  - *Sin Ling berdiri di ___ Nani.*（hadapan：把 Sin Ling 布置在 Nani 正前方）
  - *Cikgu Mohan berdiri di ___ pentas.* 的变体不要重复；第 8 题自选一个可唯一判定的，写进回报。
- 选对：角色弹跳＋*Betul!*＋整句朗读。选错：参照物闪一下＋*Cuba lagi.*；同题第 2 次错：揭晓答案并说明（*Cikgu Mohan ada di atas pentas.*），进下一题。不扣分。每轮 8 题，选项顺序随机，同一词不连续超过 2 题。结束 *Tahniah!*＋可「Main lagi」。

### 6.3 Susun（拖放）：**小班长排周会**
- 玩家是「周会班长」。画面下方候场区有 6 个角色，屏幕出现**口令卡**（文字＋朗读，关键词高亮），例：*Cikgu Mohan berdiri di **atas** pentas.*
- **场景里不画任何格子／框**（老师担心学生靠框猜）。判定看相对参照物的位置（§7）。物件与位置**都要对**才算对。
- 三关（Level 1 → 3），过关才解锁下一关（家里自己玩也一样）：
  - **Level 1**：3 条独立口令，各一个参照物（pentas／pokok／群众里指定的同学）。
  - **Level 2**：4 条口令，包含 1 条「谁在谁前后」的人形参照。
  - **Level 3 排队**：一整队，口令连环（先放一位，再依他放下一位）：例：*Wei Han berdiri di hadapan pentas.* → *Zali berdiri di belakang Wei Han.* → *Nani berdiri di belakang Zali.* → *Sin Ling berdiri di hadapan Wei Han.*（这条 Sin Ling 站到 Wei Han 与舞台之间）
- **结局**：全部放对 → 校旗沿旗杆升到顶（≈3 秒缓动）、**彩带＋星星特效（用代码画）**、Cikgu Mohan 跳起来、朗读 *Tahniah! Kita kibarkan bendera!*。校旗是单独素材，旗杆是背景里的空杆，旗要在杆旁精确对位（实测）。
- 放对：角色吸附到合适位置（轻吸附，不对齐固定点）＋弹跳＋整句朗读。放错：弹回候场区，反馈**说出他实际放的位置**，如 *Kamu letak Zali di hadapan Wei Han. Cuba belakang.*；落点不属于任何词的区域就 *Cuba lagi.* 并让参照物闪一下。**同一条口令错 2 次后才亮提示光**（柔光圈在目标区域，之前不显示）。
- 每关每次从题库随机抽，不重复；「Mula semula」可随时重置本关。
- 拖拽用 Pointer Events（鼠标／触控／手写笔），拖拽元素 `touch-action:none`；拖起放大 1.05＋影子变化；不用 HTML5 drag-and-drop。**另外支持「点角色→点位置」两步放置**（家里手机竖屏更好用）；两种方式走同一个 `place(char, point)`。

## 7. 位置判定（核心，写成数据＋纯函数，可单元测试）
所有区域用**场景图归一化坐标 (0–1)** 写进 `scenes.js`，由 `classify(refId, footPoint)` 返回词或 null。判定点是**角色脚点**（底部中心）。`?debug=1` 描出所有区域（正式画面默认不显示）。

参照物与可考的词（**只有这些组合，其余不出题**，避免歧义）：
| 参照物 | atas | hadapan | bawah | belakang |
|---|---|---|---|---|
| **pentas** | 脚点落在台面（台面前半部）多边形内 | 脚点落在舞台前地面带多边形内 | — | — |
| **pokok** | — | — | 脚点落在树冠投影下、靠近树干／花圃的地面多边形内 | — |
| **某位同学 R**（面向舞台，脚点 r） | — | 同一纵列（`|dx| ≤ 0.6×R 的 s(y) 缩放宽度`）且脚点比 r **更靠舞台**（y 更小）超过 `gap`（≈0.5 个身高，随 s 缩放），不超过 2.5 个身高 | — | 同一纵列且脚点比 r **更靠近我们**（y 更大）超过 `gap`，不超过 2.5 个身高 |
- 因为所有人面向舞台，**「后面」＝离我们更近**（画面更靠下）。这一条要在 Kenali 用排队示意把它讲明白：Wei Han 前、Zali 后，画面上 Zali 在 Wei Han 下方，且盖住他的下摆一点点。
- **atas 与 hadapan 的台面／台前区域互不重叠**；舞台**下方**（台下）不作为任何词的区域，放进去判 null（别说 bawah，因为课本的 bawah 只配 pokok）。
- 落点不属于任何区域 → null。放错时，反馈用「他放到的实际词＋参照物」组句：若该落点恰是另一参照物的合法区域，就说那个（如放到树下却被问舞台：*Kamu letak dia di bawah pokok.*）。
- 容差通过实测调到「课本答案那个位置一定对、明显错的位置一定错」，每个区域至少测 10 个点。
- 群众队伍所占区域＝null，且角色**不可放到群众身上**（落点与群众碰撞就弹回，*Cuba lagi.*）。

## 8. 页面与入口
- 纯静态单页：`index.html`／`styles.css`／`app.js`／`scenes.js`／`audio/`／`assets/`／`fonts/`；无框架无 build；抄 `../tahun1-mt-pecahan` 骨架与 `gen-voice.py`，`make-assets.py` 抠图。
- `</head>` 前必须有：`<script src="https://kongsi-idea.vercel.app/data/track-use.js" data-slug="tahun1-bm-kataarah" defer></script>`。
- `<title>`：*Kibarkan Bendera · Kata Arah*；`<html lang="ms">`。
- 响应式：舞台固定 3:2 等比缩放居中；1366×768 横屏（班级大屏）与手机竖屏（家里，390×844）都能用；竖屏时舞台缩到宽度、词按钮与候场区在下方。1000×566、1280×720、1366×768、1920×1080 都无滚动条（tahun2 踩过的坑：卡片宽度用 `min(46vw,44vh,520px)`、图片 `height:auto`）。
- 不接 ClassCode、不存个人资料。
- 暴露 `window.__kataarah = { allVoiceLines, classify, scenes }` 供 gen-voice 与测试用。
- 按钮词用儿童懂的：**Henti**、**Sambung**，不用 Jeda。

## 9. 视觉 token
先写在 `styles.css` 顶部：暖奶油底、4 种语义色（主按钮／正确／提示／次按钮）各三阶、深棕描边色、圆角（胶囊 999px／卡片 18px）、两层投影。验 WCAG AA（文字对比 ≥ 4.5:1）。**不要撞 tahun1-mt-masa（深胡桃＋蓝／珊瑚）与 tahun2-bm-kataarah（积木）的配色。**

## 10. 验收标准（交付前逐项交证据）
1. 三个阶段能从头走到尾，三关都能过并看到升旗结局；控制台无红字。
2. §2 的 4 句课本题全部出现在 Jawab 前 4 题，答案与表一致；Jawab 共 8 题且都能唯一判定。
3. **classify 单元测试**：每个（参照物，词）至少 10 点，含课本位置（Cikgu Mohan 在台面、群众在台前带、Rani 在树下、Zali 在 Wei Han 正下方、Nani 在 Sin Ling 正下方）。
4. 正式画面无任何可见格子／框线（地砖是背景图自带纹路，不算）；`?debug=1` 才显示区域。
5. 放错的反馈真的说出实际位置；同一条错 2 次后才亮提示。
6. 触控拖拽（Chromium 触控模拟）：能拖、能放、不触发页面滚动；「点角色→点位置」两步放置同样通过。
7. 1366×768 横屏、390×844 竖屏各截一张，角色可点区域达标（≥64px／≥44px）；群众 ≥ 20 人、老师 8 位（舞台 4＋站立 3＋Cikgu Mohan）可数得出来。
8. `audio/` 每句都有 mp3；断网不报错。
9. 界面无中文、无创作者人名、无国旗。
10. `python3 test-e2e.py` 与 `python3 test-mobile.py` 全过。

## 11. 范围外
kiri／kanan／sebelah／tepi 等其他方位词；belakang pentas、belakang pokok（场景留白不足、与「树下」有歧义）；班级名单与成绩；多人对战；其他年级；课本原图；国旗（Jalur Gemilang）的绘制。

## 12. 回传
改动文件清单、素材清单与尺寸、`classify` 区域数据概览（附一张 `?debug=1` 叠框验证图的路径）、测试输出摘要、已知问题（例如 Zali 国旗怎么处理、第 8 题是什么、哪些位置容差较紧）。**不要 commit／push／部署**，主对话验收后再做。
