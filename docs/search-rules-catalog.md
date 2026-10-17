# 公共规则清单：6 个网站、2 条搜索规则

维护文件：[rules/search-rules.json](../rules/search-rules.json)  
格式依据：[搜索规则存储规范 v1](search-rules-v1.md)  
核对日期：2026-10-17；`schemaVersion: 1`；`revision: 4`。

直接编辑维护文件即可补充网站；发布新内容时递增 `revision`，保留既有 ID。应用直接读取此文件作为内置快照，开发时自动刷新，重新打包后纳入安装包；尚未部署到公共地址。

## 现在可以使用什么

| 网站 ID | 网站 | 当前能力 | 核对依据 |
| --- | --- | --- | --- |
| `cnki` | 中国知网 | 打开高级检索页，站内手动填写条件 | 按用户指定使用[知网高级检索](https://kns.cnki.net/kns8s/AdvSearch)；本次页面读取超时，未确认 URL 搜索参数 |
| `wanfang` | 万方数据 | 打开高级检索页，站内手动填写条件 | 按用户指定使用[万方高级检索](https://s.wanfangdata.com.cn/advanced-search/paper)；浏览器已确认显示高级检索表单，未配置 URL 搜索参数 |
| `cqvip` | 维普网 | 打开官网 | [维普官网](https://www.cqvip.com/)；本次未确认 URL 搜索参数 |
| `pubmed` | PubMed | 输入关键词或完整检索式，映射到 `term` | [官方 URL 构造说明](https://pubmed.ncbi.nlm.nih.gov/help/#creating-a-url-linking-to-a-pubmed-search) |
| `ieee-conferences` | IEEE Conferences | 关键词 `q`、开始日期 `from`、结束日期 `to` | 用户提供的完整搜索链接经浏览器人工验证；[官方会议检索帮助](https://support.ieeemce.org/hc/en-us/articles/25213617875483-How-do-I-find-a-conference-on-the-IEEE-org-conference-search)说明 `*` 与自定义日期范围的用法 |
| `arxiv` | arXiv | 打开官网 | [arXiv 官网](https://arxiv.org/)、[高级检索页](https://arxiv.org/search/advanced)；本次普通搜索测试地址未能读取，保留入口 |

PubMed 的 `verified` 指通过官方文档确认地址与参数，`method` 为 `official-docs`；未做浏览器结果页的人工实测。IEEE 规则使用 `manual`，验证记录见下文。四个纯入口网站使用 `searchRules: []`，后续确认参数后可在原网站 ID 下增加规则。

## 试用一个输入

PubMed 的 `literature-search` 输入完整检索式：

```text
asthma[Title] AND review[Publication Type]
```

按规范构造的链接：

```text
https://pubmed.ncbi.nlm.nih.gov/?term=asthma%5BTitle%5D+AND+review%5BPublication+Type%5D
```

客户端只将输入作为单个参数的原始值编码，不追加字段标签，不组合检索式。网站如何解释检索式由其自身规则决定；PubMed 还可能沿用目标浏览器中已启用的筛选条件。

## IEEE：保留原链接参数，把关键词和日期变成输入

`conference-search` 将用户提供链接中的 `q`、`from`、`to` 分别映射为关键词、开始日期、结束日期；其余 14 个参数原值保留在 `fixedParams`，包括空值。关键词默认 `*`；起止日期必填且无默认值，不把示例中的 2025 年日期固定为每次搜索的条件。

2026-10-17 在浏览器人工核对：

- 原链接 `q=*`、`from=2025-01-01`、`to=2025-01-06` 显示日期筛选 `from 01-01-2025 to 06-01-2025`，返回 5 场会议。`date=all` 与日期范围可同时存在，不能据其名称删除起止日期或改成猜测的值。
- 使用项目现有 `buildSearchUrl`，输入 `IMCOM` 和同一日期范围后，生成链接在浏览器显示 `1 - 1 of 1 for IMCOM`，返回 2025 IMCOM，页面保留相同日期筛选。关键词与日期组合生效。
- 结果包含 1 月 6 日开始、1 月 8 日或 10 日结束的会议；此筛选不能解释为会议全程都落在所填区间内。

规则通过项目现有 `parseRules` 的 v1 完整校验。重建原链接时，17 个查询参数的名称与值全部一致；固定空值参数保留。缺少必填日期、关键词主动清空和非法日期均被 URL 构造器拒绝，中文与 `&`、`+`、`%` 编码后可还原为原值。

输入日期前后关系由用户确认；v1 通用格式不定义跨字段比较。地区、国家、赞助方、活动形式和排序保留原链接设置，本次不添加未核实的可选值。
