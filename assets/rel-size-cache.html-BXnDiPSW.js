import{_ as t,r as o,o as r,c as d,d as s,a as n,w as e,e as u,b as l}from"./app-ClP3BR4q.js";const k="/PolarDB-for-PostgreSQL/assets/rsc-first-cache-y8Pfr0V9.png",v="/PolarDB-for-PostgreSQL/assets/rsc-second-cache-BqIyilzj.png",m={},b=n("h1",{id:"表大小缓存",tabindex:"-1"},[n("a",{class:"header-anchor",href:"#表大小缓存"},[n("span",null,"表大小缓存")])],-1),S={class:"table-of-contents"},h=u('<h2 id="背景介绍" tabindex="-1"><a class="header-anchor" href="#背景介绍"><span>背景介绍</span></a></h2><p>在 SQL 执行的过程中，存在若干次对系统表和用户表的查询。PolarDB for PostgreSQL 通过文件系统的 lseek 系统调用来获取表大小。频繁执行 lseek 系统调用会严重影响数据库的执行性能，特别是对于存储计算分离架构的 PolarDB for PostgreSQL 来说，在 PolarFS 上的 <strong>PFS lseek</strong> 系统调用会带来更大的 RTO 时延。为了降低 lseek 系统调用的使用频率，PolarDB for PostgreSQL 在自身存储引擎上提供了一层表大小缓存接口，用于提升数据库的运行时性能。</p><h2 id="术语" tabindex="-1"><a class="header-anchor" href="#术语"><span>术语</span></a></h2><ul><li>RSC (Relation Size Cache)：表大小缓存。</li><li>Smgr (Storage manager)：PolarDB for PostgreSQL 存储管理器。</li><li>SmgrRelation：PolarDB for PostgreSQL 存储侧的表级元信息。</li></ul><h2 id="功能介绍" tabindex="-1"><a class="header-anchor" href="#功能介绍"><span>功能介绍</span></a></h2><p>PolarDB for PostgreSQL 为了实现 RSC，在 smgr 层进行了重新适配与设计。在整体上，RSC 是一个 <strong>缓存数组 + 两级索引</strong> 的结构设计：一级索引通过内存地址 + 引用计数来寻找共享内存 RSC 缓存中的一个缓存块；二级索引通过共享内存中的哈希表来索引得到一个 RSC 缓存块的数组下标，根据下标进一步访问 RSC 缓存，获取表大小信息。</p><h2 id="功能设计" tabindex="-1"><a class="header-anchor" href="#功能设计"><span>功能设计</span></a></h2><h3 id="总体设计" tabindex="-1"><a class="header-anchor" href="#总体设计"><span>总体设计</span></a></h3><p>在开启 RSC 缓存功能后，各个 smgr 层接口将会生效 RSC 缓存查询与更新的逻辑：</p><ul><li><code>smgrnblocks</code>：获取表大小的实际入口，将会通过查询 RSC 一级或二级索引得到 RSC 缓存块地址，从而得到物理表大小。如果 RSC 缓存命中则直接返回缓存中的物理表大小；否则需要进行一次 lseek 系统调用，并将实际的物理表大小更新到 RSC 缓存中，并同步更新 RSC 一级与二级索引。</li><li><code>smgrextend</code>：表文件扩展接口，将会把物理表文件扩展一个页，并更新对应表的 RSC 索引与缓存。</li><li><code>smgrextendbatch</code>：表文件的预扩展接口，将会把物理表文件预扩展多个页，并更新对应表的 RSC 索引与缓存。</li><li><code>smgrtruncate</code>：表文件的删除接口，将会把物理表文件删除，并清空对应表的 RSC 索引与缓存。</li></ul><h3 id="rsc-缓存数组" tabindex="-1"><a class="header-anchor" href="#rsc-缓存数组"><span>RSC 缓存数组</span></a></h3><p>在共享内存中，维护了一个数组形式的 RSC 缓存。数组中的每个元素是一个 RSC 缓存块，其中保存的关键信息包含：</p><ul><li>表标识符</li><li>一个长度为 64 位的引用计数 <code>generation</code>：表发生更新操作时，这个计数会自增</li><li>表大小</li></ul><h3 id="rsc-一级索引" tabindex="-1"><a class="header-anchor" href="#rsc-一级索引"><span>RSC 一级索引</span></a></h3><p>对于每个执行用户操作的会话进程而言，其所需访问的表被维护在进程私有的 <code>SmgrRelation</code> 结构中，其中包含：</p><ul><li>一个指向 RSC 缓存块的指针，初始值为空，后续将被更新</li><li>一个长度为 64 位的 <code>generation</code> 计数</li></ul><p>当执行表访问操作时，如果引用计数与 RSC 缓存中的 <code>generation</code> 一致，则认为 RSC 缓存没有被更新过，可以直接通过指针得到 RSC 缓存，获得物理表的当前大小。RSC 一级索引整体上是一个共享引用计数 + 共享内存指针的设计，在对大多数特定表的读多写少场景中，这样的设计可以有效降低对 RSC 二级索引的并发访问。</p><p><img src="'+k+'" alt="rsc-first-cache"></p><h3 id="rsc-二级索引" tabindex="-1"><a class="header-anchor" href="#rsc-二级索引"><span>RSC 二级索引</span></a></h3><p>当表大小发生更新（例如 <code>INSERT</code>、<code>UPDATE</code>、<code>COPY</code> 等触发表文件大小元信息变更的操作）时，会导致 RSC 一级索引失效（<code>generation</code> 计数不一致），会话进程会尝试访问 RSC 二级索引。RSC 二级索引的形式是一个共享内存哈希表：</p><ul><li>Key 为表 OID</li><li>Value 为表的 RSC 缓存块在 RSC 缓存数组中的下标</li></ul><p>通过待访问物理表的 OID，查找位于共享内存中的 RSC 二级索引：如果命中，则直接得到 RSC 缓存块，取得表大小，同时更新 RSC 一级索引；如果不命中，则使用 lseek 系统调用获取物理表的实际大小，并更新 RSC 缓存及其一二级索引。RSC 缓存更新的过程可能因缓存已满而触发缓存淘汰。</p><p><img src="'+v+`" alt="rsc-second-cache"></p><h3 id="rsc-缓存更新与淘汰" tabindex="-1"><a class="header-anchor" href="#rsc-缓存更新与淘汰"><span>RSC 缓存更新与淘汰</span></a></h3><p>在 RSC 缓存被更新的过程中，可能会因为缓存总容量已满，进而触发缓存淘汰。RSC 实现了一个 SLRU 缓存淘汰算法，用于在缓存块满时选择一个旧缓存块进行淘汰。每一个 RSC 缓存块上都维护了一个引用计数器，缓存每被访问一次，计数器的值加 1；缓存被淘汰时计数器清 0。当缓存淘汰被触发时，将从 RSC 缓存数组上一次遍历到的位置开始向前遍历，递减每一个 RSC 缓存上的引用计数，直到找到一个引用计数为 0 的缓存块进行淘汰。遍历的长度可以通过 GUC 参数控制，默认为 8：当向前遍历 8 个块后仍未找到一个可以被淘汰的 RSC 缓存块时，将会随机选择一个缓存块进行淘汰。</p><h3 id="备节点的-rsc-缓存" tabindex="-1"><a class="header-anchor" href="#备节点的-rsc-缓存"><span>备节点的 RSC 缓存</span></a></h3><p>PolarDB for PostgreSQL 的备节点分为两种，一种是提供只读服务的共享存储 Read Only 节点（RO），一种是提供跨数据中心高可用的 Standby 节点。对于 Standby 节点，由于其数据同步机制采用传统流复制 + WAL 日志回放的方式进行，故 RSC 缓存的使用与更新方式与 Read Write 节点（RW）无异。但对于 RO 节点，其数据是通过 PolarDB for PostgreSQL 实现的 LogIndex 机制实现同步的，故需要额外支持该机制下 RO 节点的 RSC 缓存同步方式。对于每种 WAL 日志类型，都需要根据当前是否存在 New Page 类型的日志，进行缓存更新与淘汰处理，保证 RO 节点下 RSC 缓存的一致性。</p><h2 id="使用指南" tabindex="-1"><a class="header-anchor" href="#使用指南"><span>使用指南</span></a></h2><p>该功能默认生效。提供如下 GUC 参数控制：</p><ul><li><code>polar_nblocks_cache_mode</code>：是否开启 RSC 功能，取值为： <ul><li><code>scan</code>（默认值）：表示仅在 <code>scan</code> 顺序查询场景下开启</li><li><code>on</code>：在所有场景下全量开启 RSC</li><li><code>off</code>：关闭 RSC；参数从 <code>scan</code> 或 <code>on</code> 设置为 <code>off</code>，可以直接通过 <code>ALTER SYSTEM SET</code> 进行设置，无需重启即可生效；参数从 <code>off</code> 设置为 <code>scan</code> / <code>on</code>，需要修改 <code>postgresql.conf</code> 配置文件并重启生效</li></ul></li><li><code>polar_enable_replica_use_smgr_cache</code>：RO 节点是否开启 RSC 功能，默认为 <code>on</code>。可配置为 <code>on</code> / <code>off</code>。</li><li><code>polar_enable_standby_use_smgr_cache</code>：Standby 节点是否开启 RSC 功能，默认为 <code>on</code>。可配置为 <code>on</code> / <code>off</code>。</li></ul><h2 id="性能测试" tabindex="-1"><a class="header-anchor" href="#性能测试"><span>性能测试</span></a></h2><p>通过如下 Shell 脚本创建一个带有 1000 个子分区的分区表：</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code>psql <span class="token parameter variable">-c</span> <span class="token string">&quot;CREATE TABLE hp(a INT) PARTITION BY HASH(a);&quot;</span>
<span class="token keyword">for</span> <span class="token variable"><span class="token punctuation">((</span>i<span class="token operator">=</span><span class="token number">1</span><span class="token punctuation">;</span> i<span class="token operator">&lt;</span><span class="token number">1000</span><span class="token punctuation">;</span> i<span class="token operator">++</span><span class="token punctuation">))</span></span><span class="token punctuation">;</span> <span class="token keyword">do</span>
    psql <span class="token parameter variable">-c</span> <span class="token string">&quot;CREATE TABLE hp<span class="token variable">$i</span> PARTITION OF hp FOR VALUES WITH(modulus 1000, remainder <span class="token variable">$i</span>);&quot;</span>
<span class="token keyword">done</span>
</code></pre></div><p>此时分区子表无数据。接下来借助一条在所有子分区上的聚合查询，来验证打开或关闭 RSC 功能时，lseek 系统调用所带来的时间性能影响。</p><p>开启 RSC：</p><div class="language-sql line-numbers-mode" data-ext="sql" data-title="sql"><pre class="language-sql"><code><span class="token keyword">ALTER</span> SYSTEM <span class="token keyword">SET</span> polar_nblocks_cache_mode <span class="token operator">=</span> <span class="token string">&#39;scan&#39;</span><span class="token punctuation">;</span>
<span class="token keyword">ALTER</span> SYSTEM

<span class="token keyword">ALTER</span> SYSTEM <span class="token keyword">SET</span> polar_enable_replica_use_smgr_cache <span class="token operator">=</span> <span class="token keyword">on</span><span class="token punctuation">;</span>
<span class="token keyword">ALTER</span> SYSTEM

<span class="token keyword">ALTER</span> SYSTEM <span class="token keyword">SET</span> polar_enable_standby_use_smgr_cache <span class="token operator">=</span> <span class="token keyword">on</span><span class="token punctuation">;</span>
<span class="token keyword">ALTER</span> SYSTEM

<span class="token keyword">SELECT</span> pg_reload_conf<span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
 pg_reload_conf
<span class="token comment">----------------</span>
 t
<span class="token punctuation">(</span><span class="token number">1</span> <span class="token keyword">row</span><span class="token punctuation">)</span>

<span class="token keyword">SHOW</span> polar_nblocks_cache_mode<span class="token punctuation">;</span>
 polar_nblocks_cache_mode
<span class="token comment">--------------------------</span>
 scan
<span class="token punctuation">(</span><span class="token number">1</span> <span class="token keyword">row</span><span class="token punctuation">)</span>

<span class="token keyword">SHOW</span> polar_enable_replica_use_smgr_cache <span class="token punctuation">;</span>
 polar_enable_replica_use_smgr_cache
<span class="token comment">--------------------------</span>
 <span class="token keyword">on</span>
<span class="token punctuation">(</span><span class="token number">1</span> <span class="token keyword">row</span><span class="token punctuation">)</span>

<span class="token keyword">SHOW</span> polar_enable_standby_use_smgr_cache <span class="token punctuation">;</span>
 polar_enable_standby_use_smgr_cache
<span class="token comment">--------------------------</span>
 <span class="token keyword">on</span>
<span class="token punctuation">(</span><span class="token number">1</span> <span class="token keyword">row</span><span class="token punctuation">)</span>

<span class="token keyword">SELECT</span> <span class="token function">COUNT</span><span class="token punctuation">(</span><span class="token operator">*</span><span class="token punctuation">)</span> <span class="token keyword">FROM</span> hp<span class="token punctuation">;</span>
 count
<span class="token comment">-------</span>
     <span class="token number">0</span>
<span class="token punctuation">(</span><span class="token number">1</span> <span class="token keyword">row</span><span class="token punctuation">)</span>

<span class="token keyword">Time</span>: <span class="token number">97.658</span> ms

<span class="token keyword">SELECT</span> <span class="token function">COUNT</span><span class="token punctuation">(</span><span class="token operator">*</span><span class="token punctuation">)</span> <span class="token keyword">FROM</span> hp<span class="token punctuation">;</span>
 count
<span class="token comment">-------</span>
     <span class="token number">0</span>
<span class="token punctuation">(</span><span class="token number">1</span> <span class="token keyword">row</span><span class="token punctuation">)</span>

<span class="token keyword">Time</span>: <span class="token number">108.672</span> ms

<span class="token keyword">SELECT</span> <span class="token function">COUNT</span><span class="token punctuation">(</span><span class="token operator">*</span><span class="token punctuation">)</span> <span class="token keyword">FROM</span> hp<span class="token punctuation">;</span>
 count
<span class="token comment">-------</span>
     <span class="token number">0</span>
<span class="token punctuation">(</span><span class="token number">1</span> <span class="token keyword">row</span><span class="token punctuation">)</span>

<span class="token keyword">Time</span>: <span class="token number">93.678</span> ms
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>关闭 RSC：</p><div class="language-sql line-numbers-mode" data-ext="sql" data-title="sql"><pre class="language-sql"><code><span class="token keyword">ALTER</span> SYSTEM <span class="token keyword">SET</span> polar_nblocks_cache_mode <span class="token operator">=</span> <span class="token string">&#39;off&#39;</span><span class="token punctuation">;</span>
<span class="token keyword">ALTER</span> SYSTEM

<span class="token keyword">ALTER</span> SYSTEM <span class="token keyword">SET</span> polar_enable_replica_use_smgr_cache <span class="token operator">=</span> <span class="token keyword">off</span><span class="token punctuation">;</span>
<span class="token keyword">ALTER</span> SYSTEM

<span class="token keyword">ALTER</span> SYSTEM <span class="token keyword">SET</span> polar_enable_standby_use_smgr_cache <span class="token operator">=</span> <span class="token keyword">off</span><span class="token punctuation">;</span>
<span class="token keyword">ALTER</span> SYSTEM

<span class="token keyword">SELECT</span> pg_reload_conf<span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
 pg_reload_conf
<span class="token comment">----------------</span>
 t
<span class="token punctuation">(</span><span class="token number">1</span> <span class="token keyword">row</span><span class="token punctuation">)</span>

<span class="token keyword">SELECT</span> <span class="token function">COUNT</span><span class="token punctuation">(</span><span class="token operator">*</span><span class="token punctuation">)</span> <span class="token keyword">FROM</span> hp<span class="token punctuation">;</span>
 count
<span class="token comment">-------</span>
     <span class="token number">0</span>
<span class="token punctuation">(</span><span class="token number">1</span> <span class="token keyword">row</span><span class="token punctuation">)</span>

<span class="token keyword">Time</span>: <span class="token number">164.772</span> ms

<span class="token keyword">SELECT</span> <span class="token function">COUNT</span><span class="token punctuation">(</span><span class="token operator">*</span><span class="token punctuation">)</span> <span class="token keyword">FROM</span> hp<span class="token punctuation">;</span>
 count
<span class="token comment">-------</span>
     <span class="token number">0</span>
<span class="token punctuation">(</span><span class="token number">1</span> <span class="token keyword">row</span><span class="token punctuation">)</span>

<span class="token keyword">Time</span>: <span class="token number">147.255</span> ms

<span class="token keyword">SELECT</span> <span class="token function">COUNT</span><span class="token punctuation">(</span><span class="token operator">*</span><span class="token punctuation">)</span> <span class="token keyword">FROM</span> hp<span class="token punctuation">;</span>
 count
<span class="token comment">-------</span>
     <span class="token number">0</span>
<span class="token punctuation">(</span><span class="token number">1</span> <span class="token keyword">row</span><span class="token punctuation">)</span>

<span class="token keyword">Time</span>: <span class="token number">177.039</span> ms

<span class="token keyword">SELECT</span> <span class="token function">COUNT</span><span class="token punctuation">(</span><span class="token operator">*</span><span class="token punctuation">)</span> <span class="token keyword">FROM</span> hp<span class="token punctuation">;</span>
 count
<span class="token comment">-------</span>
     <span class="token number">0</span>
<span class="token punctuation">(</span><span class="token number">1</span> <span class="token keyword">row</span><span class="token punctuation">)</span>

<span class="token keyword">Time</span>: <span class="token number">194.724</span> ms
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div>`,38);function _(c,R){const p=o("Badge"),i=o("ArticleInfo"),a=o("router-link");return r(),d("div",null,[b,s(p,{type:"tip",text:"V11 / v1.1.10-",vertical:"top"}),s(i,{frontmatter:c.$frontmatter},null,8,["frontmatter"]),n("nav",S,[n("ul",null,[n("li",null,[s(a,{to:"#背景介绍"},{default:e(()=>[l("背景介绍")]),_:1})]),n("li",null,[s(a,{to:"#术语"},{default:e(()=>[l("术语")]),_:1})]),n("li",null,[s(a,{to:"#功能介绍"},{default:e(()=>[l("功能介绍")]),_:1})]),n("li",null,[s(a,{to:"#功能设计"},{default:e(()=>[l("功能设计")]),_:1}),n("ul",null,[n("li",null,[s(a,{to:"#总体设计"},{default:e(()=>[l("总体设计")]),_:1})]),n("li",null,[s(a,{to:"#rsc-缓存数组"},{default:e(()=>[l("RSC 缓存数组")]),_:1})]),n("li",null,[s(a,{to:"#rsc-一级索引"},{default:e(()=>[l("RSC 一级索引")]),_:1})]),n("li",null,[s(a,{to:"#rsc-二级索引"},{default:e(()=>[l("RSC 二级索引")]),_:1})]),n("li",null,[s(a,{to:"#rsc-缓存更新与淘汰"},{default:e(()=>[l("RSC 缓存更新与淘汰")]),_:1})]),n("li",null,[s(a,{to:"#备节点的-rsc-缓存"},{default:e(()=>[l("备节点的 RSC 缓存")]),_:1})])])]),n("li",null,[s(a,{to:"#使用指南"},{default:e(()=>[l("使用指南")]),_:1})]),n("li",null,[s(a,{to:"#性能测试"},{default:e(()=>[l("性能测试")]),_:1})])])]),h])}const f=t(m,[["render",_],["__file","rel-size-cache.html.vue"]]),g=JSON.parse('{"path":"/zh/features/v11/performance/rel-size-cache.html","title":"表大小缓存","lang":"zh-CN","frontmatter":{"author":"步真","date":"2022/11/14","minute":50},"headers":[{"level":2,"title":"背景介绍","slug":"背景介绍","link":"#背景介绍","children":[]},{"level":2,"title":"术语","slug":"术语","link":"#术语","children":[]},{"level":2,"title":"功能介绍","slug":"功能介绍","link":"#功能介绍","children":[]},{"level":2,"title":"功能设计","slug":"功能设计","link":"#功能设计","children":[{"level":3,"title":"总体设计","slug":"总体设计","link":"#总体设计","children":[]},{"level":3,"title":"RSC 缓存数组","slug":"rsc-缓存数组","link":"#rsc-缓存数组","children":[]},{"level":3,"title":"RSC 一级索引","slug":"rsc-一级索引","link":"#rsc-一级索引","children":[]},{"level":3,"title":"RSC 二级索引","slug":"rsc-二级索引","link":"#rsc-二级索引","children":[]},{"level":3,"title":"RSC 缓存更新与淘汰","slug":"rsc-缓存更新与淘汰","link":"#rsc-缓存更新与淘汰","children":[]},{"level":3,"title":"备节点的 RSC 缓存","slug":"备节点的-rsc-缓存","link":"#备节点的-rsc-缓存","children":[]}]},{"level":2,"title":"使用指南","slug":"使用指南","link":"#使用指南","children":[]},{"level":2,"title":"性能测试","slug":"性能测试","link":"#性能测试","children":[]}],"git":{"updatedTime":1736994405000,"contributors":[{"name":"mrdrivingduck","email":"mrdrivingduck@gmail.com","commits":1}]},"filePathRelative":"zh/features/v11/performance/rel-size-cache.md"}');export{f as comp,g as data};
