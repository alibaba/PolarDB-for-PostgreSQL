import{_ as s,o as n,c as a,e as t}from"./app-ClP3BR4q.js";const o={},p=t(`<h1 id="问题报告" tabindex="-1"><a class="header-anchor" href="#问题报告"><span>问题报告</span></a></h1><p>如果在运行 PolarDB for PostgreSQL 的过程中出现问题，请提供数据库的日志与机器的配置信息以方便定位问题。</p><p>通过 <code>polar_stat_env</code> 插件可以轻松获取数据库所在主机的硬件配置：</p><div class="language-sql" data-ext="sql" data-title="sql"><pre class="language-sql"><code><span class="token operator">=</span><span class="token operator">&gt;</span> <span class="token keyword">CREATE</span> EXTENSION polar_stat_env<span class="token punctuation">;</span>
<span class="token operator">=</span><span class="token operator">&gt;</span> <span class="token keyword">SELECT</span> polar_stat_env<span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                           polar_stat_env
<span class="token comment">--------------------------------------------------------------------</span>
 {                                                                 <span class="token operator">+</span>
   <span class="token string">&quot;Role&quot;</span>: <span class="token string">&quot;Primary&quot;</span><span class="token punctuation">,</span>                                              <span class="token operator">+</span>
   <span class="token string">&quot;CPU&quot;</span>: {                                                        <span class="token operator">+</span>
     <span class="token string">&quot;Architecture&quot;</span>: <span class="token string">&quot;x86_64&quot;</span><span class="token punctuation">,</span>                                     <span class="token operator">+</span>
     <span class="token string">&quot;Model Name&quot;</span>: <span class="token string">&quot;Intel(R) Xeon(R) Platinum 8369B CPU @ 2.70GHz&quot;</span><span class="token punctuation">,</span><span class="token operator">+</span>
     <span class="token string">&quot;CPU Cores&quot;</span>: <span class="token string">&quot;8&quot;</span><span class="token punctuation">,</span>                                             <span class="token operator">+</span>
     <span class="token string">&quot;CPU Thread Per Cores&quot;</span>: <span class="token string">&quot;2&quot;</span><span class="token punctuation">,</span>                                  <span class="token operator">+</span>
     <span class="token string">&quot;CPU Core Per Socket&quot;</span>: <span class="token string">&quot;4&quot;</span><span class="token punctuation">,</span>                                   <span class="token operator">+</span>
     <span class="token string">&quot;NUMA Nodes&quot;</span>: <span class="token string">&quot;1&quot;</span><span class="token punctuation">,</span>                                            <span class="token operator">+</span>
     <span class="token string">&quot;L1d cache&quot;</span>: <span class="token string">&quot;192 KiB (4 instances)&quot;</span><span class="token punctuation">,</span>                         <span class="token operator">+</span>
     <span class="token string">&quot;L1i cache&quot;</span>: <span class="token string">&quot;128 KiB (4 instances)&quot;</span><span class="token punctuation">,</span>                         <span class="token operator">+</span>
     <span class="token string">&quot;L2 cache&quot;</span>: <span class="token string">&quot;5 MiB (4 instances)&quot;</span><span class="token punctuation">,</span>                            <span class="token operator">+</span>
     <span class="token string">&quot;L3 cache&quot;</span>: <span class="token string">&quot;48 MiB (1 instance)&quot;</span>                             <span class="token operator">+</span>
   }<span class="token punctuation">,</span>                                                              <span class="token operator">+</span>
   <span class="token string">&quot;Memory&quot;</span>: {                                                     <span class="token operator">+</span>
     <span class="token string">&quot;Memory Total (GB)&quot;</span>: <span class="token string">&quot;14&quot;</span><span class="token punctuation">,</span>                                    <span class="token operator">+</span>
     <span class="token string">&quot;HugePage Size (MB)&quot;</span>: <span class="token string">&quot;2&quot;</span><span class="token punctuation">,</span>                                    <span class="token operator">+</span>
     <span class="token string">&quot;HugePage Total Size (GB)&quot;</span>: <span class="token string">&quot;0&quot;</span>                               <span class="token operator">+</span>
   }<span class="token punctuation">,</span>                                                              <span class="token operator">+</span>
   <span class="token string">&quot;OS Params&quot;</span>: {                                                  <span class="token operator">+</span>
     <span class="token string">&quot;OS&quot;</span>: <span class="token string">&quot;5.10.134-16.1.al8.x86_64&quot;</span><span class="token punctuation">,</span>                             <span class="token operator">+</span>
     <span class="token string">&quot;Swappiness(1-100)&quot;</span>: <span class="token string">&quot;0&quot;</span><span class="token punctuation">,</span>                                     <span class="token operator">+</span>
     <span class="token string">&quot;Vfs Cache Pressure(0-1000)&quot;</span>: <span class="token string">&quot;100&quot;</span><span class="token punctuation">,</span>                          <span class="token operator">+</span>
     <span class="token string">&quot;Min Free KBytes(KB)&quot;</span>: <span class="token string">&quot;67584&quot;</span>                                <span class="token operator">+</span>
   }                                                               <span class="token operator">+</span>
 }
<span class="token punctuation">(</span><span class="token number">1</span> <span class="token keyword">row</span><span class="token punctuation">)</span>
</code></pre></div><p>通过 ePQ 功能可以直接获取整个集群中所有计算节点的硬件配置信息：</p><div class="language-sql" data-ext="sql" data-title="sql"><pre class="language-sql"><code><span class="token operator">=</span><span class="token operator">&gt;</span> <span class="token keyword">CREATE</span> EXTENSION polar_stat_env<span class="token punctuation">;</span>
<span class="token operator">=</span><span class="token operator">&gt;</span> <span class="token keyword">SET</span> polar_enable_px <span class="token keyword">TO</span> <span class="token keyword">ON</span><span class="token punctuation">;</span>
<span class="token operator">=</span><span class="token operator">&gt;</span> <span class="token keyword">SET</span> polar_px_use_master <span class="token keyword">TO</span> <span class="token keyword">ON</span><span class="token punctuation">;</span>
<span class="token operator">=</span><span class="token operator">&gt;</span> <span class="token keyword">SET</span> polar_px_use_standby <span class="token keyword">TO</span> <span class="token keyword">ON</span><span class="token punctuation">;</span>
<span class="token operator">=</span><span class="token operator">&gt;</span> <span class="token keyword">SELECT</span> <span class="token operator">*</span> <span class="token keyword">FROM</span> polar_global_function<span class="token punctuation">(</span><span class="token string">&#39;polar_stat_env&#39;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                           polar_stat_env
<span class="token comment">---------------------------------------------------------------------</span>
 {                                                                  <span class="token operator">+</span>
   <span class="token string">&quot;Role&quot;</span>: <span class="token string">&quot;Standby&quot;</span><span class="token punctuation">,</span>                                               <span class="token operator">+</span>
   <span class="token string">&quot;CPU&quot;</span>: {                                                         <span class="token operator">+</span>
     <span class="token string">&quot;Architecture&quot;</span>: <span class="token string">&quot;x86_64&quot;</span><span class="token punctuation">,</span>                                      <span class="token operator">+</span>
     <span class="token string">&quot;Model Name&quot;</span>: <span class="token string">&quot;Intel(R) Xeon(R) Platinum 8269CY CPU @ 2.50GHz&quot;</span><span class="token punctuation">,</span><span class="token operator">+</span>
     <span class="token string">&quot;CPU Cores&quot;</span>: <span class="token string">&quot;104&quot;</span><span class="token punctuation">,</span>                                            <span class="token operator">+</span>
     <span class="token string">&quot;CPU Thread Per Cores&quot;</span>: <span class="token string">&quot;2&quot;</span><span class="token punctuation">,</span>                                   <span class="token operator">+</span>
     <span class="token string">&quot;CPU Core Per Socket&quot;</span>: <span class="token string">&quot;26&quot;</span><span class="token punctuation">,</span>                                   <span class="token operator">+</span>
     <span class="token string">&quot;NUMA Nodes&quot;</span>: <span class="token string">&quot;2&quot;</span><span class="token punctuation">,</span>                                             <span class="token operator">+</span>
     <span class="token string">&quot;L1d cache&quot;</span>: <span class="token string">&quot;32K&quot;</span><span class="token punctuation">,</span>                                            <span class="token operator">+</span>
     <span class="token string">&quot;L1i cache&quot;</span>: <span class="token string">&quot;32K&quot;</span><span class="token punctuation">,</span>                                            <span class="token operator">+</span>
     <span class="token string">&quot;L2 cache&quot;</span>: <span class="token string">&quot;1024K&quot;</span><span class="token punctuation">,</span>                                           <span class="token operator">+</span>
     <span class="token string">&quot;L3 cache&quot;</span>: <span class="token string">&quot;36608K&quot;</span>                                           <span class="token operator">+</span>
   }<span class="token punctuation">,</span>                                                               <span class="token operator">+</span>
   <span class="token string">&quot;Memory&quot;</span>: {                                                      <span class="token operator">+</span>
     <span class="token string">&quot;Memory Total (GB)&quot;</span>: <span class="token string">&quot;754&quot;</span><span class="token punctuation">,</span>                                    <span class="token operator">+</span>
     <span class="token string">&quot;HugePage Size (MB)&quot;</span>: <span class="token string">&quot;2&quot;</span><span class="token punctuation">,</span>                                     <span class="token operator">+</span>
     <span class="token string">&quot;HugePage Total Size (GB)&quot;</span>: <span class="token string">&quot;42&quot;</span>                               <span class="token operator">+</span>
   }<span class="token punctuation">,</span>                                                               <span class="token operator">+</span>
   <span class="token string">&quot;OS Params&quot;</span>: {                                                   <span class="token operator">+</span>
     <span class="token string">&quot;OS&quot;</span>: <span class="token string">&quot;5.10.134-16.1.al8.x86_64&quot;</span><span class="token punctuation">,</span>                              <span class="token operator">+</span>
     <span class="token string">&quot;Swappiness(1-100)&quot;</span>: <span class="token string">&quot;0&quot;</span><span class="token punctuation">,</span>                                      <span class="token operator">+</span>
     <span class="token string">&quot;Vfs Cache Pressure(0-1000)&quot;</span>: <span class="token string">&quot;500&quot;</span><span class="token punctuation">,</span>                           <span class="token operator">+</span>
     <span class="token string">&quot;Min Free KBytes(KB)&quot;</span>: <span class="token string">&quot;20971520&quot;</span>                              <span class="token operator">+</span>
   }                                                                <span class="token operator">+</span>
 }
 {                                                                  <span class="token operator">+</span>
   <span class="token string">&quot;Role&quot;</span>: <span class="token string">&quot;Replica&quot;</span><span class="token punctuation">,</span>                                               <span class="token operator">+</span>
   <span class="token string">&quot;CPU&quot;</span>: {                                                         <span class="token operator">+</span>
     <span class="token string">&quot;Architecture&quot;</span>: <span class="token string">&quot;x86_64&quot;</span><span class="token punctuation">,</span>                                      <span class="token operator">+</span>
     <span class="token string">&quot;Model Name&quot;</span>: <span class="token string">&quot;Intel(R) Xeon(R) Platinum 8269CY CPU @ 2.50GHz&quot;</span><span class="token punctuation">,</span><span class="token operator">+</span>
     <span class="token string">&quot;CPU Cores&quot;</span>: <span class="token string">&quot;104&quot;</span><span class="token punctuation">,</span>                                            <span class="token operator">+</span>
     <span class="token string">&quot;CPU Thread Per Cores&quot;</span>: <span class="token string">&quot;2&quot;</span><span class="token punctuation">,</span>                                   <span class="token operator">+</span>
     <span class="token string">&quot;CPU Core Per Socket&quot;</span>: <span class="token string">&quot;26&quot;</span><span class="token punctuation">,</span>                                   <span class="token operator">+</span>
     <span class="token string">&quot;NUMA Nodes&quot;</span>: <span class="token string">&quot;2&quot;</span><span class="token punctuation">,</span>                                             <span class="token operator">+</span>
     <span class="token string">&quot;L1d cache&quot;</span>: <span class="token string">&quot;32K&quot;</span><span class="token punctuation">,</span>                                            <span class="token operator">+</span>
     <span class="token string">&quot;L1i cache&quot;</span>: <span class="token string">&quot;32K&quot;</span><span class="token punctuation">,</span>                                            <span class="token operator">+</span>
     <span class="token string">&quot;L2 cache&quot;</span>: <span class="token string">&quot;1024K&quot;</span><span class="token punctuation">,</span>                                           <span class="token operator">+</span>
     <span class="token string">&quot;L3 cache&quot;</span>: <span class="token string">&quot;36608K&quot;</span>                                           <span class="token operator">+</span>
   }<span class="token punctuation">,</span>                                                               <span class="token operator">+</span>
   <span class="token string">&quot;Memory&quot;</span>: {                                                      <span class="token operator">+</span>
     <span class="token string">&quot;Memory Total (GB)&quot;</span>: <span class="token string">&quot;754&quot;</span><span class="token punctuation">,</span>                                    <span class="token operator">+</span>
     <span class="token string">&quot;HugePage Size (MB)&quot;</span>: <span class="token string">&quot;2&quot;</span><span class="token punctuation">,</span>                                     <span class="token operator">+</span>
     <span class="token string">&quot;HugePage Total Size (GB)&quot;</span>: <span class="token string">&quot;42&quot;</span>                               <span class="token operator">+</span>
   }<span class="token punctuation">,</span>                                                               <span class="token operator">+</span>
   <span class="token string">&quot;OS Params&quot;</span>: {                                                   <span class="token operator">+</span>
     <span class="token string">&quot;OS&quot;</span>: <span class="token string">&quot;5.10.134-16.1.al8.x86_64&quot;</span><span class="token punctuation">,</span>                              <span class="token operator">+</span>
     <span class="token string">&quot;Swappiness(1-100)&quot;</span>: <span class="token string">&quot;0&quot;</span><span class="token punctuation">,</span>                                      <span class="token operator">+</span>
     <span class="token string">&quot;Vfs Cache Pressure(0-1000)&quot;</span>: <span class="token string">&quot;500&quot;</span><span class="token punctuation">,</span>                           <span class="token operator">+</span>
     <span class="token string">&quot;Min Free KBytes(KB)&quot;</span>: <span class="token string">&quot;20971520&quot;</span>                              <span class="token operator">+</span>
   }                                                                <span class="token operator">+</span>
 }
 {                                                                  <span class="token operator">+</span>
   <span class="token string">&quot;Role&quot;</span>: <span class="token string">&quot;Primary&quot;</span><span class="token punctuation">,</span>                                               <span class="token operator">+</span>
   <span class="token string">&quot;CPU&quot;</span>: {                                                         <span class="token operator">+</span>
     <span class="token string">&quot;Architecture&quot;</span>: <span class="token string">&quot;x86_64&quot;</span><span class="token punctuation">,</span>                                      <span class="token operator">+</span>
     <span class="token string">&quot;Model Name&quot;</span>: <span class="token string">&quot;Intel(R) Xeon(R) Platinum 8269CY CPU @ 2.50GHz&quot;</span><span class="token punctuation">,</span><span class="token operator">+</span>
     <span class="token string">&quot;CPU Cores&quot;</span>: <span class="token string">&quot;104&quot;</span><span class="token punctuation">,</span>                                            <span class="token operator">+</span>
     <span class="token string">&quot;CPU Thread Per Cores&quot;</span>: <span class="token string">&quot;2&quot;</span><span class="token punctuation">,</span>                                   <span class="token operator">+</span>
     <span class="token string">&quot;CPU Core Per Socket&quot;</span>: <span class="token string">&quot;26&quot;</span><span class="token punctuation">,</span>                                   <span class="token operator">+</span>
     <span class="token string">&quot;NUMA Nodes&quot;</span>: <span class="token string">&quot;2&quot;</span><span class="token punctuation">,</span>                                             <span class="token operator">+</span>
     <span class="token string">&quot;L1d cache&quot;</span>: <span class="token string">&quot;32K&quot;</span><span class="token punctuation">,</span>                                            <span class="token operator">+</span>
     <span class="token string">&quot;L1i cache&quot;</span>: <span class="token string">&quot;32K&quot;</span><span class="token punctuation">,</span>                                            <span class="token operator">+</span>
     <span class="token string">&quot;L2 cache&quot;</span>: <span class="token string">&quot;1024K&quot;</span><span class="token punctuation">,</span>                                           <span class="token operator">+</span>
     <span class="token string">&quot;L3 cache&quot;</span>: <span class="token string">&quot;36608K&quot;</span>                                           <span class="token operator">+</span>
   }<span class="token punctuation">,</span>                                                               <span class="token operator">+</span>
   <span class="token string">&quot;Memory&quot;</span>: {                                                      <span class="token operator">+</span>
     <span class="token string">&quot;Memory Total (GB)&quot;</span>: <span class="token string">&quot;754&quot;</span><span class="token punctuation">,</span>                                    <span class="token operator">+</span>
     <span class="token string">&quot;HugePage Size (MB)&quot;</span>: <span class="token string">&quot;2&quot;</span><span class="token punctuation">,</span>                                     <span class="token operator">+</span>
     <span class="token string">&quot;HugePage Total Size (GB)&quot;</span>: <span class="token string">&quot;42&quot;</span>                               <span class="token operator">+</span>
   }<span class="token punctuation">,</span>                                                               <span class="token operator">+</span>
   <span class="token string">&quot;OS Params&quot;</span>: {                                                   <span class="token operator">+</span>
     <span class="token string">&quot;OS&quot;</span>: <span class="token string">&quot;5.10.134-16.1.al8.x86_64&quot;</span><span class="token punctuation">,</span>                              <span class="token operator">+</span>
     <span class="token string">&quot;Swappiness(1-100)&quot;</span>: <span class="token string">&quot;0&quot;</span><span class="token punctuation">,</span>                                      <span class="token operator">+</span>
     <span class="token string">&quot;Vfs Cache Pressure(0-1000)&quot;</span>: <span class="token string">&quot;500&quot;</span><span class="token punctuation">,</span>                           <span class="token operator">+</span>
     <span class="token string">&quot;Min Free KBytes(KB)&quot;</span>: <span class="token string">&quot;20971520&quot;</span>                              <span class="token operator">+</span>
   }                                                                <span class="token operator">+</span>
 }
 {                                                                  <span class="token operator">+</span>
   <span class="token string">&quot;Role&quot;</span>: <span class="token string">&quot;Replica&quot;</span><span class="token punctuation">,</span>                                               <span class="token operator">+</span>
   <span class="token string">&quot;CPU&quot;</span>: {                                                         <span class="token operator">+</span>
     <span class="token string">&quot;Architecture&quot;</span>: <span class="token string">&quot;x86_64&quot;</span><span class="token punctuation">,</span>                                      <span class="token operator">+</span>
     <span class="token string">&quot;Model Name&quot;</span>: <span class="token string">&quot;Intel(R) Xeon(R) Platinum 8269CY CPU @ 2.50GHz&quot;</span><span class="token punctuation">,</span><span class="token operator">+</span>
     <span class="token string">&quot;CPU Cores&quot;</span>: <span class="token string">&quot;104&quot;</span><span class="token punctuation">,</span>                                            <span class="token operator">+</span>
     <span class="token string">&quot;CPU Thread Per Cores&quot;</span>: <span class="token string">&quot;2&quot;</span><span class="token punctuation">,</span>                                   <span class="token operator">+</span>
     <span class="token string">&quot;CPU Core Per Socket&quot;</span>: <span class="token string">&quot;26&quot;</span><span class="token punctuation">,</span>                                   <span class="token operator">+</span>
     <span class="token string">&quot;NUMA Nodes&quot;</span>: <span class="token string">&quot;2&quot;</span><span class="token punctuation">,</span>                                             <span class="token operator">+</span>
     <span class="token string">&quot;L1d cache&quot;</span>: <span class="token string">&quot;32K&quot;</span><span class="token punctuation">,</span>                                            <span class="token operator">+</span>
     <span class="token string">&quot;L1i cache&quot;</span>: <span class="token string">&quot;32K&quot;</span><span class="token punctuation">,</span>                                            <span class="token operator">+</span>
     <span class="token string">&quot;L2 cache&quot;</span>: <span class="token string">&quot;1024K&quot;</span><span class="token punctuation">,</span>                                           <span class="token operator">+</span>
     <span class="token string">&quot;L3 cache&quot;</span>: <span class="token string">&quot;36608K&quot;</span>                                           <span class="token operator">+</span>
   }<span class="token punctuation">,</span>                                                               <span class="token operator">+</span>
   <span class="token string">&quot;Memory&quot;</span>: {                                                      <span class="token operator">+</span>
     <span class="token string">&quot;Memory Total (GB)&quot;</span>: <span class="token string">&quot;754&quot;</span><span class="token punctuation">,</span>                                    <span class="token operator">+</span>
     <span class="token string">&quot;HugePage Size (MB)&quot;</span>: <span class="token string">&quot;2&quot;</span><span class="token punctuation">,</span>                                     <span class="token operator">+</span>
     <span class="token string">&quot;HugePage Total Size (GB)&quot;</span>: <span class="token string">&quot;42&quot;</span>                               <span class="token operator">+</span>
   }<span class="token punctuation">,</span>                                                               <span class="token operator">+</span>
   <span class="token string">&quot;OS Params&quot;</span>: {                                                   <span class="token operator">+</span>
     <span class="token string">&quot;OS&quot;</span>: <span class="token string">&quot;5.10.134-16.1.al8.x86_64&quot;</span><span class="token punctuation">,</span>                              <span class="token operator">+</span>
     <span class="token string">&quot;Swappiness(1-100)&quot;</span>: <span class="token string">&quot;0&quot;</span><span class="token punctuation">,</span>                                      <span class="token operator">+</span>
     <span class="token string">&quot;Vfs Cache Pressure(0-1000)&quot;</span>: <span class="token string">&quot;500&quot;</span><span class="token punctuation">,</span>                           <span class="token operator">+</span>
     <span class="token string">&quot;Min Free KBytes(KB)&quot;</span>: <span class="token string">&quot;20971520&quot;</span>                              <span class="token operator">+</span>
   }                                                                <span class="token operator">+</span>
 }
<span class="token punctuation">(</span><span class="token number">4</span> <span class="token keyword">rows</span><span class="token punctuation">)</span>
</code></pre></div>`,6),e=[p];function c(u,r){return n(),a("div",null,e)}const k=s(o,[["render",c],["__file","trouble-issuing.html.vue"]]),q=JSON.parse('{"path":"/zh/contributing/trouble-issuing.html","title":"问题报告","lang":"zh-CN","frontmatter":{},"headers":[],"git":{"updatedTime":1736994405000,"contributors":[{"name":"mrdrivingduck","email":"mrdrivingduck@gmail.com","commits":1}]},"filePathRelative":"zh/contributing/trouble-issuing.md"}');export{k as comp,q as data};
