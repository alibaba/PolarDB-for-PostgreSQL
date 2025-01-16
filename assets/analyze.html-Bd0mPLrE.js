import{_ as l,r as t,o as p,c,d as s,a as n,b as e,e as r}from"./app-ClP3BR4q.js";const d={},u=n("h1",{id:"code-analysis-of-analyze",tabindex:"-1"},[n("a",{class:"header-anchor",href:"#code-analysis-of-analyze"},[n("span",null,"Code Analysis of ANALYZE")])],-1),v=r(`<h2 id="background" tabindex="-1"><a class="header-anchor" href="#background"><span>Background</span></a></h2><p>PostgreSQL 在优化器中为一个查询树输出一个执行效率最高的物理计划树。其中，执行效率高低的衡量是通过代价估算实现的。比如通过估算查询返回元组的条数，和元组的宽度，就可以计算出 I/O 开销；也可以根据将要执行的物理操作估算出可能需要消耗的 CPU 代价。优化器通过系统表 <code>pg_statistic</code> 获得这些在代价估算过程需要使用到的关键统计信息，而 <code>pg_statistic</code> 系统表中的统计信息又是通过自动或手动的 <code>ANALYZE</code> 操作（或 <code>VACUUM</code>）计算得到的。<code>ANALYZE</code> 将会扫描表中的数据并按列进行分析，将得到的诸如每列的数据分布、最常见值、频率等统计信息写入系统表。</p><p>本文从源码的角度分析一下 <code>ANALYZE</code> 操作的实现机制。源码使用目前 PostgreSQL 最新的稳定版本 PostgreSQL 14。</p><h2 id="statistics" tabindex="-1"><a class="header-anchor" href="#statistics"><span>Statistics</span></a></h2><p>首先，我们应当搞明白分析操作的输出是什么。所以我们可以看一看 <code>pg_statistic</code> 中有哪些列，每个列的含义是什么。这个系统表中的每一行表示其它数据表中 <strong>每一列的统计信息</strong>。</p><div class="language-sql line-numbers-mode" data-ext="sql" data-title="sql"><pre class="language-sql"><code>postgres<span class="token operator">=</span><span class="token comment"># \\d+ pg_statistic</span>
                                 <span class="token keyword">Table</span> <span class="token string">&quot;pg_catalog.pg_statistic&quot;</span>
   <span class="token keyword">Column</span>    <span class="token operator">|</span>   <span class="token keyword">Type</span>   <span class="token operator">|</span> Collation <span class="token operator">|</span> Nullable <span class="token operator">|</span> <span class="token keyword">Default</span> <span class="token operator">|</span> Storage  <span class="token operator">|</span> Stats target <span class="token operator">|</span> Description
<span class="token comment">-------------+----------+-----------+----------+---------+----------+--------------+-------------</span>
 starelid    <span class="token operator">|</span> oid      <span class="token operator">|</span>           <span class="token operator">|</span> <span class="token operator">not</span> <span class="token boolean">null</span> <span class="token operator">|</span>         <span class="token operator">|</span> plain    <span class="token operator">|</span>              <span class="token operator">|</span>
 staattnum   <span class="token operator">|</span> <span class="token keyword">smallint</span> <span class="token operator">|</span>           <span class="token operator">|</span> <span class="token operator">not</span> <span class="token boolean">null</span> <span class="token operator">|</span>         <span class="token operator">|</span> plain    <span class="token operator">|</span>              <span class="token operator">|</span>
 stainherit  <span class="token operator">|</span> <span class="token keyword">boolean</span>  <span class="token operator">|</span>           <span class="token operator">|</span> <span class="token operator">not</span> <span class="token boolean">null</span> <span class="token operator">|</span>         <span class="token operator">|</span> plain    <span class="token operator">|</span>              <span class="token operator">|</span>
 stanullfrac <span class="token operator">|</span> <span class="token keyword">real</span>     <span class="token operator">|</span>           <span class="token operator">|</span> <span class="token operator">not</span> <span class="token boolean">null</span> <span class="token operator">|</span>         <span class="token operator">|</span> plain    <span class="token operator">|</span>              <span class="token operator">|</span>
 stawidth    <span class="token operator">|</span> <span class="token keyword">integer</span>  <span class="token operator">|</span>           <span class="token operator">|</span> <span class="token operator">not</span> <span class="token boolean">null</span> <span class="token operator">|</span>         <span class="token operator">|</span> plain    <span class="token operator">|</span>              <span class="token operator">|</span>
 stadistinct <span class="token operator">|</span> <span class="token keyword">real</span>     <span class="token operator">|</span>           <span class="token operator">|</span> <span class="token operator">not</span> <span class="token boolean">null</span> <span class="token operator">|</span>         <span class="token operator">|</span> plain    <span class="token operator">|</span>              <span class="token operator">|</span>
 stakind1    <span class="token operator">|</span> <span class="token keyword">smallint</span> <span class="token operator">|</span>           <span class="token operator">|</span> <span class="token operator">not</span> <span class="token boolean">null</span> <span class="token operator">|</span>         <span class="token operator">|</span> plain    <span class="token operator">|</span>              <span class="token operator">|</span>
 stakind2    <span class="token operator">|</span> <span class="token keyword">smallint</span> <span class="token operator">|</span>           <span class="token operator">|</span> <span class="token operator">not</span> <span class="token boolean">null</span> <span class="token operator">|</span>         <span class="token operator">|</span> plain    <span class="token operator">|</span>              <span class="token operator">|</span>
 stakind3    <span class="token operator">|</span> <span class="token keyword">smallint</span> <span class="token operator">|</span>           <span class="token operator">|</span> <span class="token operator">not</span> <span class="token boolean">null</span> <span class="token operator">|</span>         <span class="token operator">|</span> plain    <span class="token operator">|</span>              <span class="token operator">|</span>
 stakind4    <span class="token operator">|</span> <span class="token keyword">smallint</span> <span class="token operator">|</span>           <span class="token operator">|</span> <span class="token operator">not</span> <span class="token boolean">null</span> <span class="token operator">|</span>         <span class="token operator">|</span> plain    <span class="token operator">|</span>              <span class="token operator">|</span>
 stakind5    <span class="token operator">|</span> <span class="token keyword">smallint</span> <span class="token operator">|</span>           <span class="token operator">|</span> <span class="token operator">not</span> <span class="token boolean">null</span> <span class="token operator">|</span>         <span class="token operator">|</span> plain    <span class="token operator">|</span>              <span class="token operator">|</span>
 staop1      <span class="token operator">|</span> oid      <span class="token operator">|</span>           <span class="token operator">|</span> <span class="token operator">not</span> <span class="token boolean">null</span> <span class="token operator">|</span>         <span class="token operator">|</span> plain    <span class="token operator">|</span>              <span class="token operator">|</span>
 staop2      <span class="token operator">|</span> oid      <span class="token operator">|</span>           <span class="token operator">|</span> <span class="token operator">not</span> <span class="token boolean">null</span> <span class="token operator">|</span>         <span class="token operator">|</span> plain    <span class="token operator">|</span>              <span class="token operator">|</span>
 staop3      <span class="token operator">|</span> oid      <span class="token operator">|</span>           <span class="token operator">|</span> <span class="token operator">not</span> <span class="token boolean">null</span> <span class="token operator">|</span>         <span class="token operator">|</span> plain    <span class="token operator">|</span>              <span class="token operator">|</span>
 staop4      <span class="token operator">|</span> oid      <span class="token operator">|</span>           <span class="token operator">|</span> <span class="token operator">not</span> <span class="token boolean">null</span> <span class="token operator">|</span>         <span class="token operator">|</span> plain    <span class="token operator">|</span>              <span class="token operator">|</span>
 staop5      <span class="token operator">|</span> oid      <span class="token operator">|</span>           <span class="token operator">|</span> <span class="token operator">not</span> <span class="token boolean">null</span> <span class="token operator">|</span>         <span class="token operator">|</span> plain    <span class="token operator">|</span>              <span class="token operator">|</span>
 stanumbers1 <span class="token operator">|</span> <span class="token keyword">real</span><span class="token punctuation">[</span><span class="token punctuation">]</span>   <span class="token operator">|</span>           <span class="token operator">|</span>          <span class="token operator">|</span>         <span class="token operator">|</span> <span class="token keyword">extended</span> <span class="token operator">|</span>              <span class="token operator">|</span>
 stanumbers2 <span class="token operator">|</span> <span class="token keyword">real</span><span class="token punctuation">[</span><span class="token punctuation">]</span>   <span class="token operator">|</span>           <span class="token operator">|</span>          <span class="token operator">|</span>         <span class="token operator">|</span> <span class="token keyword">extended</span> <span class="token operator">|</span>              <span class="token operator">|</span>
 stanumbers3 <span class="token operator">|</span> <span class="token keyword">real</span><span class="token punctuation">[</span><span class="token punctuation">]</span>   <span class="token operator">|</span>           <span class="token operator">|</span>          <span class="token operator">|</span>         <span class="token operator">|</span> <span class="token keyword">extended</span> <span class="token operator">|</span>              <span class="token operator">|</span>
 stanumbers4 <span class="token operator">|</span> <span class="token keyword">real</span><span class="token punctuation">[</span><span class="token punctuation">]</span>   <span class="token operator">|</span>           <span class="token operator">|</span>          <span class="token operator">|</span>         <span class="token operator">|</span> <span class="token keyword">extended</span> <span class="token operator">|</span>              <span class="token operator">|</span>
 stanumbers5 <span class="token operator">|</span> <span class="token keyword">real</span><span class="token punctuation">[</span><span class="token punctuation">]</span>   <span class="token operator">|</span>           <span class="token operator">|</span>          <span class="token operator">|</span>         <span class="token operator">|</span> <span class="token keyword">extended</span> <span class="token operator">|</span>              <span class="token operator">|</span>
 stavalues1  <span class="token operator">|</span> anyarray <span class="token operator">|</span>           <span class="token operator">|</span>          <span class="token operator">|</span>         <span class="token operator">|</span> <span class="token keyword">extended</span> <span class="token operator">|</span>              <span class="token operator">|</span>
 stavalues2  <span class="token operator">|</span> anyarray <span class="token operator">|</span>           <span class="token operator">|</span>          <span class="token operator">|</span>         <span class="token operator">|</span> <span class="token keyword">extended</span> <span class="token operator">|</span>              <span class="token operator">|</span>
 stavalues3  <span class="token operator">|</span> anyarray <span class="token operator">|</span>           <span class="token operator">|</span>          <span class="token operator">|</span>         <span class="token operator">|</span> <span class="token keyword">extended</span> <span class="token operator">|</span>              <span class="token operator">|</span>
 stavalues4  <span class="token operator">|</span> anyarray <span class="token operator">|</span>           <span class="token operator">|</span>          <span class="token operator">|</span>         <span class="token operator">|</span> <span class="token keyword">extended</span> <span class="token operator">|</span>              <span class="token operator">|</span>
 stavalues5  <span class="token operator">|</span> anyarray <span class="token operator">|</span>           <span class="token operator">|</span>          <span class="token operator">|</span>         <span class="token operator">|</span> <span class="token keyword">extended</span> <span class="token operator">|</span>              <span class="token operator">|</span>
Indexes:
    <span class="token string">&quot;pg_statistic_relid_att_inh_index&quot;</span> <span class="token keyword">UNIQUE</span><span class="token punctuation">,</span> <span class="token keyword">btree</span> <span class="token punctuation">(</span>starelid<span class="token punctuation">,</span> staattnum<span class="token punctuation">,</span> stainherit<span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/* ----------------
 *      pg_statistic definition.  cpp turns this into
 *      typedef struct FormData_pg_statistic
 * ----------------
 */</span>
<span class="token function">CATALOG</span><span class="token punctuation">(</span>pg_statistic<span class="token punctuation">,</span><span class="token number">2619</span><span class="token punctuation">,</span>StatisticRelationId<span class="token punctuation">)</span>
<span class="token punctuation">{</span>
    <span class="token comment">/* These fields form the unique key for the entry: */</span>
    Oid         starelid <span class="token function">BKI_LOOKUP</span><span class="token punctuation">(</span>pg_class<span class="token punctuation">)</span><span class="token punctuation">;</span>  <span class="token comment">/* relation containing
                                                 * attribute */</span>
    int16       staattnum<span class="token punctuation">;</span>      <span class="token comment">/* attribute (column) stats are for */</span>
    bool        stainherit<span class="token punctuation">;</span>     <span class="token comment">/* true if inheritance children are included */</span>

    <span class="token comment">/* the fraction of the column&#39;s entries that are NULL: */</span>
    float4      stanullfrac<span class="token punctuation">;</span>

    <span class="token comment">/*
     * stawidth is the average width in bytes of non-null entries.  For
     * fixed-width datatypes this is of course the same as the typlen, but for
     * var-width types it is more useful.  Note that this is the average width
     * of the data as actually stored, post-TOASTing (eg, for a
     * moved-out-of-line value, only the size of the pointer object is
     * counted).  This is the appropriate definition for the primary use of
     * the statistic, which is to estimate sizes of in-memory hash tables of
     * tuples.
     */</span>
    int32       stawidth<span class="token punctuation">;</span>

    <span class="token comment">/* ----------------
     * stadistinct indicates the (approximate) number of distinct non-null
     * data values in the column.  The interpretation is:
     *      0       unknown or not computed
     *      &gt; 0     actual number of distinct values
     *      &lt; 0     negative of multiplier for number of rows
     * The special negative case allows us to cope with columns that are
     * unique (stadistinct = -1) or nearly so (for example, a column in which
     * non-null values appear about twice on the average could be represented
     * by stadistinct = -0.5 if there are no nulls, or -0.4 if 20% of the
     * column is nulls).  Because the number-of-rows statistic in pg_class may
     * be updated more frequently than pg_statistic is, it&#39;s important to be
     * able to describe such situations as a multiple of the number of rows,
     * rather than a fixed number of distinct values.  But in other cases a
     * fixed number is correct (eg, a boolean column).
     * ----------------
     */</span>
    float4      stadistinct<span class="token punctuation">;</span>

    <span class="token comment">/* ----------------
     * To allow keeping statistics on different kinds of datatypes,
     * we do not hard-wire any particular meaning for the remaining
     * statistical fields.  Instead, we provide several &quot;slots&quot; in which
     * statistical data can be placed.  Each slot includes:
     *      kind            integer code identifying kind of data (see below)
     *      op              OID of associated operator, if needed
     *      coll            OID of relevant collation, or 0 if none
     *      numbers         float4 array (for statistical values)
     *      values          anyarray (for representations of data values)
     * The ID, operator, and collation fields are never NULL; they are zeroes
     * in an unused slot.  The numbers and values fields are NULL in an
     * unused slot, and might also be NULL in a used slot if the slot kind
     * has no need for one or the other.
     * ----------------
     */</span>

    int16       stakind1<span class="token punctuation">;</span>
    int16       stakind2<span class="token punctuation">;</span>
    int16       stakind3<span class="token punctuation">;</span>
    int16       stakind4<span class="token punctuation">;</span>
    int16       stakind5<span class="token punctuation">;</span>

    Oid         staop1 <span class="token function">BKI_LOOKUP_OPT</span><span class="token punctuation">(</span>pg_operator<span class="token punctuation">)</span><span class="token punctuation">;</span>
    Oid         staop2 <span class="token function">BKI_LOOKUP_OPT</span><span class="token punctuation">(</span>pg_operator<span class="token punctuation">)</span><span class="token punctuation">;</span>
    Oid         staop3 <span class="token function">BKI_LOOKUP_OPT</span><span class="token punctuation">(</span>pg_operator<span class="token punctuation">)</span><span class="token punctuation">;</span>
    Oid         staop4 <span class="token function">BKI_LOOKUP_OPT</span><span class="token punctuation">(</span>pg_operator<span class="token punctuation">)</span><span class="token punctuation">;</span>
    Oid         staop5 <span class="token function">BKI_LOOKUP_OPT</span><span class="token punctuation">(</span>pg_operator<span class="token punctuation">)</span><span class="token punctuation">;</span>

    Oid         stacoll1 <span class="token function">BKI_LOOKUP_OPT</span><span class="token punctuation">(</span>pg_collation<span class="token punctuation">)</span><span class="token punctuation">;</span>
    Oid         stacoll2 <span class="token function">BKI_LOOKUP_OPT</span><span class="token punctuation">(</span>pg_collation<span class="token punctuation">)</span><span class="token punctuation">;</span>
    Oid         stacoll3 <span class="token function">BKI_LOOKUP_OPT</span><span class="token punctuation">(</span>pg_collation<span class="token punctuation">)</span><span class="token punctuation">;</span>
    Oid         stacoll4 <span class="token function">BKI_LOOKUP_OPT</span><span class="token punctuation">(</span>pg_collation<span class="token punctuation">)</span><span class="token punctuation">;</span>
    Oid         stacoll5 <span class="token function">BKI_LOOKUP_OPT</span><span class="token punctuation">(</span>pg_collation<span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">ifdef</span> <span class="token expression">CATALOG_VARLEN           </span><span class="token comment">/* variable-length fields start here */</span></span>
    float4      stanumbers1<span class="token punctuation">[</span><span class="token number">1</span><span class="token punctuation">]</span><span class="token punctuation">;</span>
    float4      stanumbers2<span class="token punctuation">[</span><span class="token number">1</span><span class="token punctuation">]</span><span class="token punctuation">;</span>
    float4      stanumbers3<span class="token punctuation">[</span><span class="token number">1</span><span class="token punctuation">]</span><span class="token punctuation">;</span>
    float4      stanumbers4<span class="token punctuation">[</span><span class="token number">1</span><span class="token punctuation">]</span><span class="token punctuation">;</span>
    float4      stanumbers5<span class="token punctuation">[</span><span class="token number">1</span><span class="token punctuation">]</span><span class="token punctuation">;</span>

    <span class="token comment">/*
     * Values in these arrays are values of the column&#39;s data type, or of some
     * related type such as an array element type.  We presently have to cheat
     * quite a bit to allow polymorphic arrays of this kind, but perhaps
     * someday it&#39;ll be a less bogus facility.
     */</span>
    anyarray    stavalues1<span class="token punctuation">;</span>
    anyarray    stavalues2<span class="token punctuation">;</span>
    anyarray    stavalues3<span class="token punctuation">;</span>
    anyarray    stavalues4<span class="token punctuation">;</span>
    anyarray    stavalues5<span class="token punctuation">;</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">endif</span></span>
<span class="token punctuation">}</span> FormData_pg_statistic<span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>从数据库命令行的角度和内核 C 代码的角度来看，统计信息的内容都是一致的。所有的属性都以 <code>sta</code> 开头。其中：</p><ul><li><code>starelid</code> 表示当前列所属的表或索引</li><li><code>staattnum</code> 表示本行统计信息属于上述表或索引中的第几列</li><li><code>stainherit</code> 表示统计信息是否包含子列</li><li><code>stanullfrac</code> 表示该列中值为 NULL 的行数比例</li><li><code>stawidth</code> 表示该列非空值的平均宽度</li><li><code>stadistinct</code> 表示列中非空值的唯一值数量 <ul><li><code>0</code> 表示未知或未计算</li><li><code>&gt; 0</code> 表示唯一值的实际数量</li><li><code>&lt; 0</code> 表示 <em>negative of multiplier for number of rows</em></li></ul></li></ul><p>由于不同数据类型所能够被计算的统计信息可能会有一些细微的差别，在接下来的部分中，PostgreSQL 预留了一些存放统计信息的 <strong>槽（slots）</strong>。目前的内核里暂时预留了五个槽：</p><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">STATISTIC_NUM_SLOTS</span>  <span class="token expression"><span class="token number">5</span></span></span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>每一种特定的统计信息可以使用一个槽，具体在槽里放什么完全由这种统计信息的定义自由决定。每一个槽的可用空间包含这么几个部分（其中的 <code>N</code> 表示槽的编号，取值为 <code>1</code> 到 <code>5</code>）：</p><ul><li><code>stakindN</code>：标识这种统计信息的整数编号</li><li><code>staopN</code>：用于计算或使用统计信息的运算符 OID</li><li><code>stacollN</code>：排序规则 OID</li><li><code>stanumbersN</code>：浮点数数组</li><li><code>stavaluesN</code>：任意值数组</li></ul><p>PostgreSQL 内核中规定，统计信息的编号 <code>1</code> 至 <code>99</code> 被保留给 PostgreSQL 核心统计信息使用，其它部分的编号安排如内核注释所示：</p><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 * The present allocation of &quot;kind&quot; codes is:
 *
 *  1-99:       reserved for assignment by the core PostgreSQL project
 *              (values in this range will be documented in this file)
 *  100-199:    reserved for assignment by the PostGIS project
 *              (values to be documented in PostGIS documentation)
 *  200-299:    reserved for assignment by the ESRI ST_Geometry project
 *              (values to be documented in ESRI ST_Geometry documentation)
 *  300-9999:   reserved for future public assignments
 *
 * For private use you may choose a &quot;kind&quot; code at random in the range
 * 10000-30000.  However, for code that is to be widely disseminated it is
 * better to obtain a publicly defined &quot;kind&quot; code by request from the
 * PostgreSQL Global Development Group.
 */</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>目前可以在内核代码中看到的 PostgreSQL 核心统计信息有 7 个，编号分别从 <code>1</code> 到 <code>7</code>。我们可以看看这 7 种统计信息分别如何使用上述的槽。</p><h3 id="most-common-values-mcv" tabindex="-1"><a class="header-anchor" href="#most-common-values-mcv"><span>Most Common Values (MCV)</span></a></h3><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 * In a &quot;most common values&quot; slot, staop is the OID of the &quot;=&quot; operator
 * used to decide whether values are the same or not, and stacoll is the
 * collation used (same as column&#39;s collation).  stavalues contains
 * the K most common non-null values appearing in the column, and stanumbers
 * contains their frequencies (fractions of total row count).  The values
 * shall be ordered in decreasing frequency.  Note that since the arrays are
 * variable-size, K may be chosen by the statistics collector.  Values should
 * not appear in MCV unless they have been observed to occur more than once;
 * a unique column will have no MCV slot.
 */</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">STATISTIC_KIND_MCV</span>  <span class="token expression"><span class="token number">1</span></span></span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>对于一个列中的 <strong>最常见值</strong>，在 <code>staop</code> 中保存 <code>=</code> 运算符来决定一个值是否等于一个最常见值。在 <code>stavalues</code> 中保存了该列中最常见的 K 个非空值，<code>stanumbers</code> 中分别保存了这 K 个值出现的频率。</p><h3 id="histogram" tabindex="-1"><a class="header-anchor" href="#histogram"><span>Histogram</span></a></h3><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 * A &quot;histogram&quot; slot describes the distribution of scalar data.  staop is
 * the OID of the &quot;&lt;&quot; operator that describes the sort ordering, and stacoll
 * is the relevant collation.  (In theory more than one histogram could appear,
 * if a datatype has more than one useful sort operator or we care about more
 * than one collation.  Currently the collation will always be that of the
 * underlying column.)  stavalues contains M (&gt;=2) non-null values that
 * divide the non-null column data values into M-1 bins of approximately equal
 * population.  The first stavalues item is the MIN and the last is the MAX.
 * stanumbers is not used and should be NULL.  IMPORTANT POINT: if an MCV
 * slot is also provided, then the histogram describes the data distribution
 * *after removing the values listed in MCV* (thus, it&#39;s a &quot;compressed
 * histogram&quot; in the technical parlance).  This allows a more accurate
 * representation of the distribution of a column with some very-common
 * values.  In a column with only a few distinct values, it&#39;s possible that
 * the MCV list describes the entire data population; in this case the
 * histogram reduces to empty and should be omitted.
 */</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">STATISTIC_KIND_HISTOGRAM</span>  <span class="token expression"><span class="token number">2</span></span></span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>表示一个（数值）列的数据分布直方图。<code>staop</code> 保存 <code>&lt;</code> 运算符用于决定数据分布的排序顺序。<code>stavalues</code> 包含了能够将该列的非空值划分到 M - 1 个容量接近的桶中的 M 个非空值。如果该列中已经有了 MCV 的槽，那么数据分布直方图中将不包含 MCV 中的值，以获得更精确的数据分布。</p><h3 id="correlation" tabindex="-1"><a class="header-anchor" href="#correlation"><span>Correlation</span></a></h3><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 * A &quot;correlation&quot; slot describes the correlation between the physical order
 * of table tuples and the ordering of data values of this column, as seen
 * by the &quot;&lt;&quot; operator identified by staop with the collation identified by
 * stacoll.  (As with the histogram, more than one entry could theoretically
 * appear.)  stavalues is not used and should be NULL.  stanumbers contains
 * a single entry, the correlation coefficient between the sequence of data
 * values and the sequence of their actual tuple positions.  The coefficient
 * ranges from +1 to -1.
 */</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">STATISTIC_KIND_CORRELATION</span>  <span class="token expression"><span class="token number">3</span></span></span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>在 <code>stanumbers</code> 中保存数据值和它们的实际元组位置的相关系数。</p><h3 id="most-common-elements" tabindex="-1"><a class="header-anchor" href="#most-common-elements"><span>Most Common Elements</span></a></h3><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 * A &quot;most common elements&quot; slot is similar to a &quot;most common values&quot; slot,
 * except that it stores the most common non-null *elements* of the column
 * values.  This is useful when the column datatype is an array or some other
 * type with identifiable elements (for instance, tsvector).  staop contains
 * the equality operator appropriate to the element type, and stacoll
 * contains the collation to use with it.  stavalues contains
 * the most common element values, and stanumbers their frequencies.  Unlike
 * MCV slots, frequencies are measured as the fraction of non-null rows the
 * element value appears in, not the frequency of all rows.  Also unlike
 * MCV slots, the values are sorted into the element type&#39;s default order
 * (to support binary search for a particular value).  Since this puts the
 * minimum and maximum frequencies at unpredictable spots in stanumbers,
 * there are two extra members of stanumbers, holding copies of the minimum
 * and maximum frequencies.  Optionally, there can be a third extra member,
 * which holds the frequency of null elements (expressed in the same terms:
 * the fraction of non-null rows that contain at least one null element).  If
 * this member is omitted, the column is presumed to contain no null elements.
 *
 * Note: in current usage for tsvector columns, the stavalues elements are of
 * type text, even though their representation within tsvector is not
 * exactly text.
 */</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">STATISTIC_KIND_MCELEM</span>  <span class="token expression"><span class="token number">4</span></span></span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>与 MCV 类似，但是保存的是列中的 <strong>最常见元素</strong>，主要用于数组等类型。同样，在 <code>staop</code> 中保存了等值运算符用于判断元素出现的频率高低。但与 MCV 不同的是这里的频率计算的分母是非空的行，而不是所有的行。另外，所有的常见元素使用元素对应数据类型的默认顺序进行排序，以便二分查找。</p><h3 id="distinct-elements-count-histogram" tabindex="-1"><a class="header-anchor" href="#distinct-elements-count-histogram"><span>Distinct Elements Count Histogram</span></a></h3><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 * A &quot;distinct elements count histogram&quot; slot describes the distribution of
 * the number of distinct element values present in each row of an array-type
 * column.  Only non-null rows are considered, and only non-null elements.
 * staop contains the equality operator appropriate to the element type,
 * and stacoll contains the collation to use with it.
 * stavalues is not used and should be NULL.  The last member of stanumbers is
 * the average count of distinct element values over all non-null rows.  The
 * preceding M (&gt;=2) members form a histogram that divides the population of
 * distinct-elements counts into M-1 bins of approximately equal population.
 * The first of these is the minimum observed count, and the last the maximum.
 */</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">STATISTIC_KIND_DECHIST</span>  <span class="token expression"><span class="token number">5</span></span></span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>表示列中出现所有数值的频率分布直方图。<code>stanumbers</code> 数组的前 M 个元素是将列中所有唯一值的出现次数大致均分到 M - 1 个桶中的边界值。后续跟上一个所有唯一值的平均出现次数。这个统计信息应该会被用于计算 <em>选择率</em>。</p><h3 id="length-histogram" tabindex="-1"><a class="header-anchor" href="#length-histogram"><span>Length Histogram</span></a></h3><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 * A &quot;length histogram&quot; slot describes the distribution of range lengths in
 * rows of a range-type column. stanumbers contains a single entry, the
 * fraction of empty ranges. stavalues is a histogram of non-empty lengths, in
 * a format similar to STATISTIC_KIND_HISTOGRAM: it contains M (&gt;=2) range
 * values that divide the column data values into M-1 bins of approximately
 * equal population. The lengths are stored as float8s, as measured by the
 * range type&#39;s subdiff function. Only non-null rows are considered.
 */</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">STATISTIC_KIND_RANGE_LENGTH_HISTOGRAM</span>  <span class="token expression"><span class="token number">6</span></span></span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>长度直方图描述了一个范围类型的列的范围长度分布。同样也是一个长度为 M 的直方图，保存在 <code>stanumbers</code> 中。</p><h3 id="bounds-histogram" tabindex="-1"><a class="header-anchor" href="#bounds-histogram"><span>Bounds Histogram</span></a></h3><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 * A &quot;bounds histogram&quot; slot is similar to STATISTIC_KIND_HISTOGRAM, but for
 * a range-type column.  stavalues contains M (&gt;=2) range values that divide
 * the column data values into M-1 bins of approximately equal population.
 * Unlike a regular scalar histogram, this is actually two histograms combined
 * into a single array, with the lower bounds of each value forming a
 * histogram of lower bounds, and the upper bounds a histogram of upper
 * bounds.  Only non-NULL, non-empty ranges are included.
 */</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">STATISTIC_KIND_BOUNDS_HISTOGRAM</span>  <span class="token expression"><span class="token number">7</span></span></span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>边界直方图同样也被用于范围类型，与数据分布直方图类似。<code>stavalues</code> 中保存了使该列数值大致均分到 M - 1 个桶中的 M 个范围边界值。只考虑非空行。</p><h2 id="kernel-execution-of-analyze" tabindex="-1"><a class="header-anchor" href="#kernel-execution-of-analyze"><span>Kernel Execution of ANALYZE</span></a></h2><p>知道 <code>pg_statistic</code> 最终需要保存哪些信息以后，再来看看内核如何收集和计算这些信息。让我们进入 PostgreSQL 内核的执行器代码中。对于 <code>ANALYZE</code> 这种工具性质的指令，执行器代码通过 <code>standard_ProcessUtility()</code> 函数中的 switch case 将每一种指令路由到实现相应功能的函数中。</p><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 * standard_ProcessUtility itself deals only with utility commands for
 * which we do not provide event trigger support.  Commands that do have
 * such support are passed down to ProcessUtilitySlow, which contains the
 * necessary infrastructure for such triggers.
 *
 * This division is not just for performance: it&#39;s critical that the
 * event trigger code not be invoked when doing START TRANSACTION for
 * example, because we might need to refresh the event trigger cache,
 * which requires being in a valid transaction.
 */</span>
<span class="token keyword">void</span>
<span class="token function">standard_ProcessUtility</span><span class="token punctuation">(</span>PlannedStmt <span class="token operator">*</span>pstmt<span class="token punctuation">,</span>
                        <span class="token keyword">const</span> <span class="token keyword">char</span> <span class="token operator">*</span>queryString<span class="token punctuation">,</span>
                        bool readOnlyTree<span class="token punctuation">,</span>
                        ProcessUtilityContext context<span class="token punctuation">,</span>
                        ParamListInfo params<span class="token punctuation">,</span>
                        QueryEnvironment <span class="token operator">*</span>queryEnv<span class="token punctuation">,</span>
                        DestReceiver <span class="token operator">*</span>dest<span class="token punctuation">,</span>
                        QueryCompletion <span class="token operator">*</span>qc<span class="token punctuation">)</span>
<span class="token punctuation">{</span>
    <span class="token comment">// ...</span>

    <span class="token keyword">switch</span> <span class="token punctuation">(</span><span class="token function">nodeTag</span><span class="token punctuation">(</span>parsetree<span class="token punctuation">)</span><span class="token punctuation">)</span>
    <span class="token punctuation">{</span>
        <span class="token comment">// ...</span>

        <span class="token keyword">case</span> T_VacuumStmt<span class="token operator">:</span>
            <span class="token function">ExecVacuum</span><span class="token punctuation">(</span>pstate<span class="token punctuation">,</span> <span class="token punctuation">(</span>VacuumStmt <span class="token operator">*</span><span class="token punctuation">)</span> parsetree<span class="token punctuation">,</span> isTopLevel<span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token keyword">break</span><span class="token punctuation">;</span>

        <span class="token comment">// ...</span>
    <span class="token punctuation">}</span>

    <span class="token comment">// ...</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><code>ANALYZE</code> 的处理逻辑入口和 <code>VACUUM</code> 一致，进入 <code>ExecVacuum()</code> 函数。</p><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 * Primary entry point for manual VACUUM and ANALYZE commands
 *
 * This is mainly a preparation wrapper for the real operations that will
 * happen in vacuum().
 */</span>
<span class="token keyword">void</span>
<span class="token function">ExecVacuum</span><span class="token punctuation">(</span>ParseState <span class="token operator">*</span>pstate<span class="token punctuation">,</span> VacuumStmt <span class="token operator">*</span>vacstmt<span class="token punctuation">,</span> bool isTopLevel<span class="token punctuation">)</span>
<span class="token punctuation">{</span>
    <span class="token comment">// ...</span>

    <span class="token comment">/* Now go through the common routine */</span>
    <span class="token function">vacuum</span><span class="token punctuation">(</span>vacstmt<span class="token operator">-&gt;</span>rels<span class="token punctuation">,</span> <span class="token operator">&amp;</span>params<span class="token punctuation">,</span> <span class="token constant">NULL</span><span class="token punctuation">,</span> isTopLevel<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>在 parse 了一大堆 option 之后，进入了 <code>vacuum()</code> 函数。在这里，内核代码将会首先明确一下要分析哪些表。因为 <code>ANALYZE</code> 命令在使用上可以：</p><ul><li>分析整个数据库中的所有表</li><li>分析某几个特定的表</li><li>分析某个表的某几个特定列</li></ul><p>在明确要分析哪些表以后，依次将每一个表传入 <code>analyze_rel()</code> 函数：</p><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token keyword">if</span> <span class="token punctuation">(</span>params<span class="token operator">-&gt;</span>options <span class="token operator">&amp;</span> VACOPT_ANALYZE<span class="token punctuation">)</span>
<span class="token punctuation">{</span>
    <span class="token comment">// ...</span>

    <span class="token function">analyze_rel</span><span class="token punctuation">(</span>vrel<span class="token operator">-&gt;</span>oid<span class="token punctuation">,</span> vrel<span class="token operator">-&gt;</span>relation<span class="token punctuation">,</span> params<span class="token punctuation">,</span>
                vrel<span class="token operator">-&gt;</span>va_cols<span class="token punctuation">,</span> in_outer_xact<span class="token punctuation">,</span> vac_strategy<span class="token punctuation">)</span><span class="token punctuation">;</span>

    <span class="token comment">// ...</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>进入 <code>analyze_rel()</code> 函数以后，内核代码将会对将要被分析的表加 <code>ShareUpdateExclusiveLock</code> 锁，以防止两个并发进行的 <code>ANALYZE</code>。然后根据待分析表的类型来决定具体的处理方式（比如分析一个 FDW 外表就应该直接调用 FDW routine 中提供的 ANALYZE 功能了）。接下来，将这个表传入 <code>do_analyze_rel()</code> 函数中。</p><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 *  analyze_rel() -- analyze one relation
 *
 * relid identifies the relation to analyze.  If relation is supplied, use
 * the name therein for reporting any failure to open/lock the rel; do not
 * use it once we&#39;ve successfully opened the rel, since it might be stale.
 */</span>
<span class="token keyword">void</span>
<span class="token function">analyze_rel</span><span class="token punctuation">(</span>Oid relid<span class="token punctuation">,</span> RangeVar <span class="token operator">*</span>relation<span class="token punctuation">,</span>
            VacuumParams <span class="token operator">*</span>params<span class="token punctuation">,</span> List <span class="token operator">*</span>va_cols<span class="token punctuation">,</span> bool in_outer_xact<span class="token punctuation">,</span>
            BufferAccessStrategy bstrategy<span class="token punctuation">)</span>
<span class="token punctuation">{</span>
    <span class="token comment">// ...</span>

    <span class="token comment">/*
     * Do the normal non-recursive ANALYZE.  We can skip this for partitioned
     * tables, which don&#39;t contain any rows.
     */</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>onerel<span class="token operator">-&gt;</span>rd_rel<span class="token operator">-&gt;</span>relkind <span class="token operator">!=</span> RELKIND_PARTITIONED_TABLE<span class="token punctuation">)</span>
        <span class="token function">do_analyze_rel</span><span class="token punctuation">(</span>onerel<span class="token punctuation">,</span> params<span class="token punctuation">,</span> va_cols<span class="token punctuation">,</span> acquirefunc<span class="token punctuation">,</span>
                       relpages<span class="token punctuation">,</span> false<span class="token punctuation">,</span> in_outer_xact<span class="token punctuation">,</span> elevel<span class="token punctuation">)</span><span class="token punctuation">;</span>

    <span class="token comment">// ...</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>进入 <code>do_analyze_rel()</code> 函数后，内核代码将进一步明确要分析一个表中的哪些列：用户可能指定只分析表中的某几个列——被频繁访问的列才更有被分析的价值。然后还要打开待分析表的所有索引，看看是否有可以被分析的列。</p><p>为了得到每一列的统计信息，显然我们需要把每一列的数据从磁盘上读起来再去做计算。这里就有一个比较关键的问题了：到底扫描多少行数据呢？理论上，分析尽可能多的数据，最好是全部的数据，肯定能够得到最精确的统计数据；但是对一张很大的表来说，我们没有办法在内存中放下所有的数据，并且分析的阻塞时间也是不可接受的。所以用户可以指定要采样的最大行数，从而在运行开销和统计信息准确性上达成一个妥协：</p><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 * Determine how many rows we need to sample, using the worst case from
 * all analyzable columns.  We use a lower bound of 100 rows to avoid
 * possible overflow in Vitter&#39;s algorithm.  (Note: that will also be the
 * target in the corner case where there are no analyzable columns.)
 */</span>
targrows <span class="token operator">=</span> <span class="token number">100</span><span class="token punctuation">;</span>
<span class="token keyword">for</span> <span class="token punctuation">(</span>i <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span> i <span class="token operator">&lt;</span> attr_cnt<span class="token punctuation">;</span> i<span class="token operator">++</span><span class="token punctuation">)</span>
<span class="token punctuation">{</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>targrows <span class="token operator">&lt;</span> vacattrstats<span class="token punctuation">[</span>i<span class="token punctuation">]</span><span class="token operator">-&gt;</span>minrows<span class="token punctuation">)</span>
        targrows <span class="token operator">=</span> vacattrstats<span class="token punctuation">[</span>i<span class="token punctuation">]</span><span class="token operator">-&gt;</span>minrows<span class="token punctuation">;</span>
<span class="token punctuation">}</span>
<span class="token keyword">for</span> <span class="token punctuation">(</span>ind <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span> ind <span class="token operator">&lt;</span> nindexes<span class="token punctuation">;</span> ind<span class="token operator">++</span><span class="token punctuation">)</span>
<span class="token punctuation">{</span>
    AnlIndexData <span class="token operator">*</span>thisdata <span class="token operator">=</span> <span class="token operator">&amp;</span>indexdata<span class="token punctuation">[</span>ind<span class="token punctuation">]</span><span class="token punctuation">;</span>

    <span class="token keyword">for</span> <span class="token punctuation">(</span>i <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span> i <span class="token operator">&lt;</span> thisdata<span class="token operator">-&gt;</span>attr_cnt<span class="token punctuation">;</span> i<span class="token operator">++</span><span class="token punctuation">)</span>
    <span class="token punctuation">{</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span>targrows <span class="token operator">&lt;</span> thisdata<span class="token operator">-&gt;</span>vacattrstats<span class="token punctuation">[</span>i<span class="token punctuation">]</span><span class="token operator">-&gt;</span>minrows<span class="token punctuation">)</span>
            targrows <span class="token operator">=</span> thisdata<span class="token operator">-&gt;</span>vacattrstats<span class="token punctuation">[</span>i<span class="token punctuation">]</span><span class="token operator">-&gt;</span>minrows<span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>

<span class="token comment">/*
 * Look at extended statistics objects too, as those may define custom
 * statistics target. So we may need to sample more rows and then build
 * the statistics with enough detail.
 */</span>
minrows <span class="token operator">=</span> <span class="token function">ComputeExtStatisticsRows</span><span class="token punctuation">(</span>onerel<span class="token punctuation">,</span> attr_cnt<span class="token punctuation">,</span> vacattrstats<span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token keyword">if</span> <span class="token punctuation">(</span>targrows <span class="token operator">&lt;</span> minrows<span class="token punctuation">)</span>
    targrows <span class="token operator">=</span> minrows<span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>在确定需要采样多少行数据后，内核代码分配了一块相应长度的元组数组，然后开始使用 <code>acquirefunc</code> 函数指针采样数据：</p><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 * Acquire the sample rows
 */</span>
rows <span class="token operator">=</span> <span class="token punctuation">(</span>HeapTuple <span class="token operator">*</span><span class="token punctuation">)</span> <span class="token function">palloc</span><span class="token punctuation">(</span>targrows <span class="token operator">*</span> <span class="token keyword">sizeof</span><span class="token punctuation">(</span>HeapTuple<span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token function">pgstat_progress_update_param</span><span class="token punctuation">(</span>PROGRESS_ANALYZE_PHASE<span class="token punctuation">,</span>
                             inh <span class="token operator">?</span> PROGRESS_ANALYZE_PHASE_ACQUIRE_SAMPLE_ROWS_INH <span class="token operator">:</span>
                             PROGRESS_ANALYZE_PHASE_ACQUIRE_SAMPLE_ROWS<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">if</span> <span class="token punctuation">(</span>inh<span class="token punctuation">)</span>
    numrows <span class="token operator">=</span> <span class="token function">acquire_inherited_sample_rows</span><span class="token punctuation">(</span>onerel<span class="token punctuation">,</span> elevel<span class="token punctuation">,</span>
                                            rows<span class="token punctuation">,</span> targrows<span class="token punctuation">,</span>
                                            <span class="token operator">&amp;</span>totalrows<span class="token punctuation">,</span> <span class="token operator">&amp;</span>totaldeadrows<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">else</span>
    numrows <span class="token operator">=</span> <span class="token punctuation">(</span><span class="token operator">*</span>acquirefunc<span class="token punctuation">)</span> <span class="token punctuation">(</span>onerel<span class="token punctuation">,</span> elevel<span class="token punctuation">,</span>
                              rows<span class="token punctuation">,</span> targrows<span class="token punctuation">,</span>
                              <span class="token operator">&amp;</span>totalrows<span class="token punctuation">,</span> <span class="token operator">&amp;</span>totaldeadrows<span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>这个函数指针指向的是 <code>analyze_rel()</code> 函数中设置好的 <code>acquire_sample_rows()</code> 函数。该函数使用两阶段模式对表中的数据进行采样：</p><ul><li>阶段 1：随机选择包含目标采样行数的数据块</li><li>阶段 2：对每一个数据块使用 Vitter 算法按行随机采样数据</li></ul><p>两阶段同时进行。在采样完成后，被采样到的元组应该已经被放置在元组数组中了。对这个元组数组按照元组的位置进行快速排序，并使用这些采样到的数据估算整个表中的存活元组与死元组的个数：</p><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 * acquire_sample_rows -- acquire a random sample of rows from the table
 *
 * Selected rows are returned in the caller-allocated array rows[], which
 * must have at least targrows entries.
 * The actual number of rows selected is returned as the function result.
 * We also estimate the total numbers of live and dead rows in the table,
 * and return them into *totalrows and *totaldeadrows, respectively.
 *
 * The returned list of tuples is in order by physical position in the table.
 * (We will rely on this later to derive correlation estimates.)
 *
 * As of May 2004 we use a new two-stage method:  Stage one selects up
 * to targrows random blocks (or all blocks, if there aren&#39;t so many).
 * Stage two scans these blocks and uses the Vitter algorithm to create
 * a random sample of targrows rows (or less, if there are less in the
 * sample of blocks).  The two stages are executed simultaneously: each
 * block is processed as soon as stage one returns its number and while
 * the rows are read stage two controls which ones are to be inserted
 * into the sample.
 *
 * Although every row has an equal chance of ending up in the final
 * sample, this sampling method is not perfect: not every possible
 * sample has an equal chance of being selected.  For large relations
 * the number of different blocks represented by the sample tends to be
 * too small.  We can live with that for now.  Improvements are welcome.
 *
 * An important property of this sampling method is that because we do
 * look at a statistically unbiased set of blocks, we should get
 * unbiased estimates of the average numbers of live and dead rows per
 * block.  The previous sampling method put too much credence in the row
 * density near the start of the table.
 */</span>
<span class="token keyword">static</span> <span class="token keyword">int</span>
<span class="token function">acquire_sample_rows</span><span class="token punctuation">(</span>Relation onerel<span class="token punctuation">,</span> <span class="token keyword">int</span> elevel<span class="token punctuation">,</span>
                    HeapTuple <span class="token operator">*</span>rows<span class="token punctuation">,</span> <span class="token keyword">int</span> targrows<span class="token punctuation">,</span>
                    <span class="token keyword">double</span> <span class="token operator">*</span>totalrows<span class="token punctuation">,</span> <span class="token keyword">double</span> <span class="token operator">*</span>totaldeadrows<span class="token punctuation">)</span>
<span class="token punctuation">{</span>
    <span class="token comment">// ...</span>

    <span class="token comment">/* Outer loop over blocks to sample */</span>
    <span class="token keyword">while</span> <span class="token punctuation">(</span><span class="token function">BlockSampler_HasMore</span><span class="token punctuation">(</span><span class="token operator">&amp;</span>bs<span class="token punctuation">)</span><span class="token punctuation">)</span>
    <span class="token punctuation">{</span>
        bool        block_accepted<span class="token punctuation">;</span>
        BlockNumber targblock <span class="token operator">=</span> <span class="token function">BlockSampler_Next</span><span class="token punctuation">(</span><span class="token operator">&amp;</span>bs<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">// ...</span>
    <span class="token punctuation">}</span>

    <span class="token comment">// ...</span>

    <span class="token comment">/*
     * If we didn&#39;t find as many tuples as we wanted then we&#39;re done. No sort
     * is needed, since they&#39;re already in order.
     *
     * Otherwise we need to sort the collected tuples by position
     * (itempointer). It&#39;s not worth worrying about corner cases where the
     * tuples are already sorted.
     */</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>numrows <span class="token operator">==</span> targrows<span class="token punctuation">)</span>
        <span class="token function">qsort</span><span class="token punctuation">(</span><span class="token punctuation">(</span><span class="token keyword">void</span> <span class="token operator">*</span><span class="token punctuation">)</span> rows<span class="token punctuation">,</span> numrows<span class="token punctuation">,</span> <span class="token keyword">sizeof</span><span class="token punctuation">(</span>HeapTuple<span class="token punctuation">)</span><span class="token punctuation">,</span> compare_rows<span class="token punctuation">)</span><span class="token punctuation">;</span>

    <span class="token comment">/*
     * Estimate total numbers of live and dead rows in relation, extrapolating
     * on the assumption that the average tuple density in pages we didn&#39;t
     * scan is the same as in the pages we did scan.  Since what we scanned is
     * a random sample of the pages in the relation, this should be a good
     * assumption.
     */</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>bs<span class="token punctuation">.</span>m <span class="token operator">&gt;</span> <span class="token number">0</span><span class="token punctuation">)</span>
    <span class="token punctuation">{</span>
        <span class="token operator">*</span>totalrows <span class="token operator">=</span> <span class="token function">floor</span><span class="token punctuation">(</span><span class="token punctuation">(</span>liverows <span class="token operator">/</span> bs<span class="token punctuation">.</span>m<span class="token punctuation">)</span> <span class="token operator">*</span> totalblocks <span class="token operator">+</span> <span class="token number">0.5</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token operator">*</span>totaldeadrows <span class="token operator">=</span> <span class="token function">floor</span><span class="token punctuation">(</span><span class="token punctuation">(</span>deadrows <span class="token operator">/</span> bs<span class="token punctuation">.</span>m<span class="token punctuation">)</span> <span class="token operator">*</span> totalblocks <span class="token operator">+</span> <span class="token number">0.5</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token keyword">else</span>
    <span class="token punctuation">{</span>
        <span class="token operator">*</span>totalrows <span class="token operator">=</span> <span class="token number">0.0</span><span class="token punctuation">;</span>
        <span class="token operator">*</span>totaldeadrows <span class="token operator">=</span> <span class="token number">0.0</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token comment">// ...</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>回到 <code>do_analyze_rel()</code> 函数。采样到数据以后，对于要分析的每一个列，分别计算统计数据，然后更新 <code>pg_statistic</code> 系统表：</p><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 * Compute the statistics.  Temporary results during the calculations for
 * each column are stored in a child context.  The calc routines are
 * responsible to make sure that whatever they store into the VacAttrStats
 * structure is allocated in anl_context.
 */</span>
<span class="token keyword">if</span> <span class="token punctuation">(</span>numrows <span class="token operator">&gt;</span> <span class="token number">0</span><span class="token punctuation">)</span>
<span class="token punctuation">{</span>
    <span class="token comment">// ...</span>

    <span class="token keyword">for</span> <span class="token punctuation">(</span>i <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span> i <span class="token operator">&lt;</span> attr_cnt<span class="token punctuation">;</span> i<span class="token operator">++</span><span class="token punctuation">)</span>
    <span class="token punctuation">{</span>
        VacAttrStats <span class="token operator">*</span>stats <span class="token operator">=</span> vacattrstats<span class="token punctuation">[</span>i<span class="token punctuation">]</span><span class="token punctuation">;</span>
        AttributeOpts <span class="token operator">*</span>aopt<span class="token punctuation">;</span>

        stats<span class="token operator">-&gt;</span>rows <span class="token operator">=</span> rows<span class="token punctuation">;</span>
        stats<span class="token operator">-&gt;</span>tupDesc <span class="token operator">=</span> onerel<span class="token operator">-&gt;</span>rd_att<span class="token punctuation">;</span>
        stats<span class="token operator">-&gt;</span><span class="token function">compute_stats</span><span class="token punctuation">(</span>stats<span class="token punctuation">,</span>
                             std_fetch_func<span class="token punctuation">,</span>
                             numrows<span class="token punctuation">,</span>
                             totalrows<span class="token punctuation">)</span><span class="token punctuation">;</span>

        <span class="token comment">// ...</span>
    <span class="token punctuation">}</span>

    <span class="token comment">// ...</span>

    <span class="token comment">/*
     * Emit the completed stats rows into pg_statistic, replacing any
     * previous statistics for the target columns.  (If there are stats in
     * pg_statistic for columns we didn&#39;t process, we leave them alone.)
     */</span>
    <span class="token function">update_attstats</span><span class="token punctuation">(</span><span class="token function">RelationGetRelid</span><span class="token punctuation">(</span>onerel<span class="token punctuation">)</span><span class="token punctuation">,</span> inh<span class="token punctuation">,</span>
                    attr_cnt<span class="token punctuation">,</span> vacattrstats<span class="token punctuation">)</span><span class="token punctuation">;</span>

    <span class="token comment">// ...</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>显然，对于不同类型的列，其 <code>compute_stats</code> 函数指针指向的计算函数肯定不太一样。所以我们不妨看看给这个函数指针赋值的地方：</p><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 * std_typanalyze -- the default type-specific typanalyze function
 */</span>
bool
<span class="token function">std_typanalyze</span><span class="token punctuation">(</span>VacAttrStats <span class="token operator">*</span>stats<span class="token punctuation">)</span>
<span class="token punctuation">{</span>
    <span class="token comment">// ...</span>

    <span class="token comment">/*
     * Determine which standard statistics algorithm to use
     */</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token function">OidIsValid</span><span class="token punctuation">(</span>eqopr<span class="token punctuation">)</span> <span class="token operator">&amp;&amp;</span> <span class="token function">OidIsValid</span><span class="token punctuation">(</span>ltopr<span class="token punctuation">)</span><span class="token punctuation">)</span>
    <span class="token punctuation">{</span>
        <span class="token comment">/* Seems to be a scalar datatype */</span>
        stats<span class="token operator">-&gt;</span>compute_stats <span class="token operator">=</span> compute_scalar_stats<span class="token punctuation">;</span>
        <span class="token comment">/*--------------------
         * The following choice of minrows is based on the paper
         * &quot;Random sampling for histogram construction: how much is enough?&quot;
         * by Surajit Chaudhuri, Rajeev Motwani and Vivek Narasayya, in
         * Proceedings of ACM SIGMOD International Conference on Management
         * of Data, 1998, Pages 436-447.  Their Corollary 1 to Theorem 5
         * says that for table size n, histogram size k, maximum relative
         * error in bin size f, and error probability gamma, the minimum
         * random sample size is
         *      r = 4 * k * ln(2*n/gamma) / f^2
         * Taking f = 0.5, gamma = 0.01, n = 10^6 rows, we obtain
         *      r = 305.82 * k
         * Note that because of the log function, the dependence on n is
         * quite weak; even at n = 10^12, a 300*k sample gives &lt;= 0.66
         * bin size error with probability 0.99.  So there&#39;s no real need to
         * scale for n, which is a good thing because we don&#39;t necessarily
         * know it at this point.
         *--------------------
         */</span>
        stats<span class="token operator">-&gt;</span>minrows <span class="token operator">=</span> <span class="token number">300</span> <span class="token operator">*</span> attr<span class="token operator">-&gt;</span>attstattarget<span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token keyword">else</span> <span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token function">OidIsValid</span><span class="token punctuation">(</span>eqopr<span class="token punctuation">)</span><span class="token punctuation">)</span>
    <span class="token punctuation">{</span>
        <span class="token comment">/* We can still recognize distinct values */</span>
        stats<span class="token operator">-&gt;</span>compute_stats <span class="token operator">=</span> compute_distinct_stats<span class="token punctuation">;</span>
        <span class="token comment">/* Might as well use the same minrows as above */</span>
        stats<span class="token operator">-&gt;</span>minrows <span class="token operator">=</span> <span class="token number">300</span> <span class="token operator">*</span> attr<span class="token operator">-&gt;</span>attstattarget<span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token keyword">else</span>
    <span class="token punctuation">{</span>
        <span class="token comment">/* Can&#39;t do much but the trivial stuff */</span>
        stats<span class="token operator">-&gt;</span>compute_stats <span class="token operator">=</span> compute_trivial_stats<span class="token punctuation">;</span>
        <span class="token comment">/* Might as well use the same minrows as above */</span>
        stats<span class="token operator">-&gt;</span>minrows <span class="token operator">=</span> <span class="token number">300</span> <span class="token operator">*</span> attr<span class="token operator">-&gt;</span>attstattarget<span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token comment">// ...</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>这个条件判断语句可以被解读为：</p><ul><li>如果说一个列的数据类型支持默认的 <code>=</code>（<code>eqopr</code>：equals operator）和 <code>&lt;</code>（<code>ltopr</code>：less than operator），那么这个列应该是一个数值类型，可以使用 <code>compute_scalar_stats()</code> 函数进行分析</li><li>如果列的数据类型只支持 <code>=</code> 运算符，那么依旧还可以使用 <code>compute_distinct_stats</code> 进行唯一值的统计分析</li><li>如果都不行，那么这个列只能使用 <code>compute_trivial_stats</code> 进行一些简单的分析</li></ul><p>我们可以分别看看这三个分析函数里做了啥，但我不准备深入每一个分析函数解读其中的逻辑了。因为其中的思想基于一些很古早的统计学论文，古早到连 PDF 上的字母都快看不清了。在代码上没有特别大的可读性，因为基本是参照论文中的公式实现的，不看论文根本没法理解变量和公式的含义。</p><h3 id="compute-trivial-stats" tabindex="-1"><a class="header-anchor" href="#compute-trivial-stats"><span>compute_trivial_stats</span></a></h3><p>如果某个列的数据类型不支持等值运算符和比较运算符，那么就只能进行一些简单的分析，比如：</p><ul><li>非空行的比例</li><li>列中元组的平均宽度</li></ul><p>这些可以通过对采样后的元组数组进行循环遍历后轻松得到。</p><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 *  compute_trivial_stats() -- compute very basic column statistics
 *
 *  We use this when we cannot find a hash &quot;=&quot; operator for the datatype.
 *
 *  We determine the fraction of non-null rows and the average datum width.
 */</span>
<span class="token keyword">static</span> <span class="token keyword">void</span>
<span class="token function">compute_trivial_stats</span><span class="token punctuation">(</span>VacAttrStatsP stats<span class="token punctuation">,</span>
                      AnalyzeAttrFetchFunc fetchfunc<span class="token punctuation">,</span>
                      <span class="token keyword">int</span> samplerows<span class="token punctuation">,</span>
                      <span class="token keyword">double</span> totalrows<span class="token punctuation">)</span>
<span class="token punctuation">{</span><span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="compute-distinct-stats" tabindex="-1"><a class="header-anchor" href="#compute-distinct-stats"><span>compute_distinct_stats</span></a></h3><p>如果某个列只支持等值运算符，也就是说我们只能知道一个数值 <strong>是什么</strong>，但不能和其它数值比大小。所以无法分析数值在大小范围上的分布，只能分析数值在出现频率上的分布。所以该函数分析的统计数据包含：</p><ul><li>非空行的比例</li><li>列中元组的平均宽度</li><li>最频繁出现的值（MCV）</li><li>（估算的）唯一值个数</li></ul><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 *  compute_distinct_stats() -- compute column statistics including ndistinct
 *
 *  We use this when we can find only an &quot;=&quot; operator for the datatype.
 *
 *  We determine the fraction of non-null rows, the average width, the
 *  most common values, and the (estimated) number of distinct values.
 *
 *  The most common values are determined by brute force: we keep a list
 *  of previously seen values, ordered by number of times seen, as we scan
 *  the samples.  A newly seen value is inserted just after the last
 *  multiply-seen value, causing the bottommost (oldest) singly-seen value
 *  to drop off the list.  The accuracy of this method, and also its cost,
 *  depend mainly on the length of the list we are willing to keep.
 */</span>
<span class="token keyword">static</span> <span class="token keyword">void</span>
<span class="token function">compute_distinct_stats</span><span class="token punctuation">(</span>VacAttrStatsP stats<span class="token punctuation">,</span>
                       AnalyzeAttrFetchFunc fetchfunc<span class="token punctuation">,</span>
                       <span class="token keyword">int</span> samplerows<span class="token punctuation">,</span>
                       <span class="token keyword">double</span> totalrows<span class="token punctuation">)</span>
<span class="token punctuation">{</span><span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="compute-scalar-stats" tabindex="-1"><a class="header-anchor" href="#compute-scalar-stats"><span>compute_scalar_stats</span></a></h3><p>如果一个列的数据类型支持等值运算符和比较运算符，那么可以进行最详尽的分析。分析目标包含：</p><ul><li>非空行的比例</li><li>列中元组的平均宽度</li><li>最频繁出现的值（MCV）</li><li>（估算的）唯一值个数</li><li>数据分布直方图</li><li>物理和逻辑位置的相关性</li></ul><div class="language-c line-numbers-mode" data-ext="c" data-title="c"><pre class="language-c"><code><span class="token comment">/*
 *  compute_distinct_stats() -- compute column statistics including ndistinct
 *
 *  We use this when we can find only an &quot;=&quot; operator for the datatype.
 *
 *  We determine the fraction of non-null rows, the average width, the
 *  most common values, and the (estimated) number of distinct values.
 *
 *  The most common values are determined by brute force: we keep a list
 *  of previously seen values, ordered by number of times seen, as we scan
 *  the samples.  A newly seen value is inserted just after the last
 *  multiply-seen value, causing the bottommost (oldest) singly-seen value
 *  to drop off the list.  The accuracy of this method, and also its cost,
 *  depend mainly on the length of the list we are willing to keep.
 */</span>
<span class="token keyword">static</span> <span class="token keyword">void</span>
<span class="token function">compute_distinct_stats</span><span class="token punctuation">(</span>VacAttrStatsP stats<span class="token punctuation">,</span>
                       AnalyzeAttrFetchFunc fetchfunc<span class="token punctuation">,</span>
                       <span class="token keyword">int</span> samplerows<span class="token punctuation">,</span>
                       <span class="token keyword">double</span> totalrows<span class="token punctuation">)</span>
<span class="token punctuation">{</span><span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="summary" tabindex="-1"><a class="header-anchor" href="#summary"><span>Summary</span></a></h2><p>以 PostgreSQL 优化器需要的统计信息为切入点，分析了 <code>ANALYZE</code> 命令的大致执行流程。出于简洁性，在流程分析上没有覆盖各种 corner case 和相关的处理逻辑。</p><h2 id="references" tabindex="-1"><a class="header-anchor" href="#references"><span>References</span></a></h2>`,80),m={href:"https://www.postgresql.org/docs/current/sql-analyze.html",target:"_blank",rel:"noopener noreferrer"},k={href:"https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-STATISTICS",target:"_blank",rel:"noopener noreferrer"},b={href:"https://www.postgresql.org/docs/current/planner-stats.html",target:"_blank",rel:"noopener noreferrer"},h={href:"https://www.postgresql.org/docs/current/catalog-pg-statistic.html",target:"_blank",rel:"noopener noreferrer"},g={href:"http://mysql.taobao.org/monthly/2016/05/09/",target:"_blank",rel:"noopener noreferrer"};function f(o,y){const i=t("ArticleInfo"),a=t("ExternalLinkIcon");return p(),c("div",null,[u,s(i,{frontmatter:o.$frontmatter},null,8,["frontmatter"]),v,n("p",null,[n("a",m,[e("PostgreSQL 14 Documentation: ANALYZE"),s(a)])]),n("p",null,[n("a",k,[e("PostgreSQL 14 Documentation: 25.1. Routine Vacuuming"),s(a)])]),n("p",null,[n("a",b,[e("PostgreSQL 14 Documentation: 14.2. Statistics Used by the Planner"),s(a)])]),n("p",null,[n("a",h,[e("PostgreSQL 14 Documentation: 52.49. pg_statistic"),s(a)])]),n("p",null,[n("a",g,[e("阿里云数据库内核月报 2016/05：PostgreSQL 特性分析 统计信息计算方法"),s(a)])])])}const _=l(d,[["render",f],["__file","analyze.html.vue"]]),A=JSON.parse('{"path":"/theory/analyze.html","title":"Code Analysis of ANALYZE","lang":"en-US","frontmatter":{"author":"棠羽","date":"2022/06/20","minute":15},"headers":[{"level":2,"title":"Background","slug":"background","link":"#background","children":[]},{"level":2,"title":"Statistics","slug":"statistics","link":"#statistics","children":[{"level":3,"title":"Most Common Values (MCV)","slug":"most-common-values-mcv","link":"#most-common-values-mcv","children":[]},{"level":3,"title":"Histogram","slug":"histogram","link":"#histogram","children":[]},{"level":3,"title":"Correlation","slug":"correlation","link":"#correlation","children":[]},{"level":3,"title":"Most Common Elements","slug":"most-common-elements","link":"#most-common-elements","children":[]},{"level":3,"title":"Distinct Elements Count Histogram","slug":"distinct-elements-count-histogram","link":"#distinct-elements-count-histogram","children":[]},{"level":3,"title":"Length Histogram","slug":"length-histogram","link":"#length-histogram","children":[]},{"level":3,"title":"Bounds Histogram","slug":"bounds-histogram","link":"#bounds-histogram","children":[]}]},{"level":2,"title":"Kernel Execution of ANALYZE","slug":"kernel-execution-of-analyze","link":"#kernel-execution-of-analyze","children":[{"level":3,"title":"compute_trivial_stats","slug":"compute-trivial-stats","link":"#compute-trivial-stats","children":[]},{"level":3,"title":"compute_distinct_stats","slug":"compute-distinct-stats","link":"#compute-distinct-stats","children":[]},{"level":3,"title":"compute_scalar_stats","slug":"compute-scalar-stats","link":"#compute-scalar-stats","children":[]}]},{"level":2,"title":"Summary","slug":"summary","link":"#summary","children":[]},{"level":2,"title":"References","slug":"references","link":"#references","children":[]}],"git":{"updatedTime":1736994405000,"contributors":[{"name":"mrdrivingduck","email":"mrdrivingduck@gmail.com","commits":1}]},"filePathRelative":"theory/analyze.md"}');export{_ as comp,A as data};
