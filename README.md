# 研途 · Scholar Rail

一个 360px 宽的学术检索侧边栏。输入一次搜索内容，点击不同网站按钮，用系统默认浏览器继续检索；也可单独预览和复制 URL。技术栈为 Tauri 2、React、TypeScript、Vite、Tailwind CSS；Rust 层只注册官方插件，没有自定义原生命令。

## 立即启动

在项目根目录运行：

```powershell
npm ci
npm run tauri dev
```

依赖已安装时只运行第二条。Vite 开发端口固定为 `1420`；如果之前单独启动了 `npm run dev`，先在该终端按 Ctrl+C，避免端口冲突。

只检查界面、不启动原生窗口：

```powershell
npm run dev
```

访问 `http://127.0.0.1:1420`。浏览器模式使用独立的 localStorage 演示保存；窗口置顶、贴边、原生文件对话框和原生 JSON 存储需在桌面模式验证。

## 使用

- 顶部填写共享搜索内容；点击网站小卡片的名称区域直接打开，不需要先选中网站再按搜索。连续点击不同网站时，内容保持原样。
- 官网入口位于搜索框下方、中间偏上的位置，使用居中的正方形快捷按钮，默认一排四个，显示图标和名称。下方是网站筛选及搜索卡片；搜索卡片默认双列，加宽后显示三至四列。两组共用名称、分类、收藏和最近筛选，分别保留组内排序。
- 主界面不再常驻底部面板。卡片和入口按钮均保留眼睛预览及星标收藏；预览内可复制 URL、查看验证依据。入口小按钮只打开官网，不携带或清空搜索内容，由用户进入站内填写检索条件。
- 有多条规则时在卡片内切换检索方式；展开“其他条件”时卡片自动占满一行，方便填写日期等条件，各网站、各规则分别保留。缺少必填内容时提示补填，不打开无效链接。
- `Ctrl+K` / macOS `⌘K` 聚焦共享搜索框；框内 Enter 换行，Tab 移至网站按钮后 Enter 打开。`Esc` 关闭链接预览；其他情况下关闭设置并清除网站筛选文字，不清空搜索内容。清空搜索内容需点击“清空”，或确认应用规则更新。
- 顶部图钉控制置顶，收起按钮缩为窄栏，窄栏箭头恢复；设置入口也在顶部。需要手动定位窗口时，在设置中选择“贴靠当前显示器右侧”。现有外部贴边隐藏方式不受影响。
- 窗口可自由拖动和调整宽度；保存宽度、主题、置顶、收藏、排序和最近使用。窗口不占用系统 Dock 区域，也不会隐藏到无法恢复的位置。
- 设置提供主题、规则来源及版本、手动检查规则更新、只读 JSON 导出和网站顺序调整。

**内置规则直接读取 `rules/search-rules.json`，这是唯一维护源。**当前文件包含知网、万方、维普、PubMed、IEEE Conferences、arXiv。PubMed 的 `term` 依据[官方帮助](https://pubmed.ncbi.nlm.nih.gov/help/#get-a-permalink-to-bookmark-or-share-your-search)；IEEE 支持关键词与日期范围，已人工验证。知网和万方分别直接打开用户指定的[知网高级检索页](https://kns.cnki.net/kns8s/AdvSearch)和[万方高级检索页](https://s.wanfangdata.com.cn/advanced-search/paper)，由用户在站内填写条件；维普和 arXiv 仅提供官网入口。保存有效规则到维护文件后，开发时自动刷新，下次打包纳入快照。机构登录及网站内检索由用户操作；PubMed 使用须遵守 [NCBI 政策](https://www.ncbi.nlm.nih.gov/home/about/policies/)。

## 云端规则更新

客户端只读公共规则，不提供个人编辑或任意文件导入，也没有账户或规则同步服务。

默认地址已配置为 [公共规则 JSON](https://rule.andys1114.cc.cd/search-rules.json)，保存在项目 `.env` 中；启动时后台检查，也可在设置中点击“检查规则更新”。2026-10-17 接入时，远端文件为 r1，低于内置 r4，因此保留 r4，不会降级。维护者下次发布应使用 r5 或更高版本。

1. 维护 `rules/search-rules.json`。保留网站与规则 ID，每次发布增加 `revision`。
2. 运行校验：

   ```powershell
   npm run validate:rules
   npm run validate:rules -- D:\rules\search-rules.json
   ```

3. 将完整 JSON 发布到上面的公共 HTTPS 地址。客户端不跟随重定向，地址必须直接返回 JSON；发布后确认远端 `revision` 和内容已更新。
4. 更换来源时，将 `.env.example` 复制为 `.env.local`，修改 `VITE_RULES_URL`，然后重新启动开发进程或构建应用。地址为构建期配置，不能通过普通用户界面替换。显式留空可禁用在线检查。

桌面应用使用 Tauri 官方 HTTP 插件。浏览器预览的跨域下载还需要托管端允许 CORS。

规则加载顺序为有效缓存与内置快照中内容版本较新的一份；无缓存、缓存损坏或不兼容时使用内置快照。启动后台检查，也可以手动检查。远端更高版本通过完整校验后仅提示，用户点击“应用”才写入有效缓存并重新加载表单；有未完成输入时通过原生确认框提示清空。失败保留旧版本，待应用版本不会在重启时偷偷生效。

规则请求不携带关键词、筛选条件或个人设置。用户打开搜索链接后，查询参数会交给目标网站。

## 检查与构建

```powershell
npm test
npm run typecheck
npm run validate:rules
npm run build
npm run tauri build
```

Windows 默认生成当前用户安装的 NSIS 安装包：

```text
src-tauri/target/release/scholar-rail.exe
src-tauri/target/release/bundle/nsis/Scholar Rail_0.1.0_x64-setup.exe
```

构建的安装包尚未签名，Windows 可能提示未知发布者。开发阶段不需购买签名服务。目标 Windows 电脑需要 WebView2；安装包沿用 Tauri 的 WebView2 引导安装策略，没有捆绑完整离线运行时。MSI 不是初版默认产物，需要时另行检查 VBScript 功能并使用 `--bundles msi`。

Windows 开发需要 Node 24 LTS、Rust stable MSVC、C++ Build Tools、Windows SDK 和 WebView2。本机 Rust 工具链与 Cargo 缓存位于 `D:\DevTools\Rust`，终端通过用户环境变量定位。

## macOS 与双平台 CI

在 Mac 上准备 Node 24、Rust stable 和 Xcode Command Line Tools；仅做桌面应用可运行 `xcode-select --install` 安装命令行工具，不需要 iOS 工具链。

```bash
npm ci
npm run tauri dev
npm run tauri build -- --config src-tauri/tauri.macos.conf.json
```

输出 `.app` 应用和 `.dmg`，位置在 `src-tauri/target/release/bundle`；指定 `--target` 时会多一层目标架构目录。当前配置使用 ad-hoc 签名，仅适合开发和测试，不包含 Developer ID 或公证。正式站外分发前应在 macOS 上处理 Developer ID 签名、公证和验签；不在 Windows 上交叉打包 macOS。参见 [Tauri macOS 签名指南](https://v2.tauri.app/distribute/sign/macos/)。

`.github/workflows/desktop-build.yml` 为手动触发的 Windows x64、macOS Apple Silicon、macOS Intel 构建矩阵。上传仓库后，从 Actions 手动运行；默认使用同一公共规则地址，仓库变量 `RULES_URL` 可覆盖来源。工作流只上传安装包到 Actions Artifacts，不创建 Release、不发布软件、不配置付费签名。**目前没有实际运行远端 CI 或 macOS 构建。** macOS 构建、打包、Apple 签名与公证使用 Mac 或 macOS runner；窗口、Dock、多显示器和 DPI 行为仍需在目标设备实测。

## 代码位置

```text
src/domain/        规则结构校验、URL 构造、版本选择和更新提交
rules/             公共规则唯一维护源，同时作为随包快照
src/platform/      Tauri JSON 存储、原子缓存替换、浏览器与窗口操作
src/components/    小型通用 UI 组件
src/App.tsx        检索与设置界面
src-tauri/         原生插件注册、窗口配置、权限与安装包配置
scripts/           维护者规则校验入口
docs/              规则规范、架构决策与测试记录
```

个人配置使用 Tauri `appConfigDir`：Windows 为 `%APPDATA%\app.scholarrail.desktop`，macOS 为 `~/Library/Application Support/app.scholarrail.desktop`。`preferences.json` 保存个人状态；`rules-cache.json` 保存已应用规则，先写临时文件再重命名替换。当前输入、待应用更新仅存在于内存，不保存检索历史文本。

本工具不读取其他网页或考试题目，不使用 AI，不提取关键词、不抓取结果、不自动匹配或填写答案。规则格式详见 `docs/search-rules-v1.md`，后续优先将最新有效规则发布到云端、补充经过逐站验证的搜索规则，并进行 macOS 实测。
