import{_ as u,r as t,o as k,c as d,d as s,a,w as p,b as n,e as o}from"./app-ClP3BR4q.js";const l="/PolarDB-for-PostgreSQL/assets/backup-dir-l8AuPsYf.png",b={},m=a("h1",{id:"备份恢复",tabindex:"-1"},[a("a",{class:"header-anchor",href:"#备份恢复"},[a("span",null,"备份恢复")])],-1),h=a("p",null,"PolarDB for PostgreSQL 采用基于共享存储的存算分离架构，其备份恢复和 PostgreSQL 存在部分差异。本文将指导您如何对 PolarDB for PostgreSQL 进行备份，并通过备份来搭建 Replica 节点或 Standby 节点。",-1),v={class:"table-of-contents"},_=o('<h2 id="备份恢复原理" tabindex="-1"><a class="header-anchor" href="#备份恢复原理"><span>备份恢复原理</span></a></h2><p>PostgreSQL 的备份流程可以总结为以下几步：</p><ol><li>进入备份模式 <ul><li>强制进入 Full Page Write 模式，并切换当前的 WAL segment 文件</li><li>在数据目录下创建 <code>backup_label</code> 文件，其中包含基础备份的起始点位置</li><li>备份的恢复必须从一个内存数据与磁盘数据一致的检查点开始，所以将等待下一次检查点的到来，或立刻强制进行一次 <code>CHECKPOINT</code></li></ul></li><li>备份数据库：使用文件系统级别的工具进行备份</li><li>退出备份模式 <ul><li>重置 Full Page Write 模式，并切换到下一个 WAL segment 文件</li><li>创建备份历史文件，包含当前基础备份的起止 WAL 位置，并删除 <code>backup_label</code> 文件</li></ul></li></ol><p>备份 PostgreSQL 数据库最简便方法是使用 <code>pg_basebackup</code> 工具。</p><h2 id="数据目录结构" tabindex="-1"><a class="header-anchor" href="#数据目录结构"><span>数据目录结构</span></a></h2><p>PolarDB for PostgreSQL 采用基于共享存储的存算分离架构，其数据目录分为以下两类：</p><ul><li>本地数据目录：位于每个计算节点的本地存储上，为每个计算节点私有</li><li>共享数据目录：位于共享存储上，被所有计算节点共享</li></ul><p><img src="'+l+`" alt="backup-dir"></p><p>由于本地数据目录中的目录和文件不涉及数据库的核心数据，因此在备份数据库时，备份本地数据目录是可选的。可以仅备份共享存储上的数据目录，然后使用 <code>initdb</code> 重新生成新的本地存储目录。但是计算节点的本地配置文件需要被手动备份，如 <code>postgresql.conf</code>、<code>pg_hba.conf</code> 等文件。</p><h3 id="本地数据目录" tabindex="-1"><a class="header-anchor" href="#本地数据目录"><span>本地数据目录</span></a></h3><p>通过以下 SQL 命令可以查看节点的本地数据目录：</p><div class="language-sql" data-ext="sql" data-title="sql"><pre class="language-sql"><code>postgres<span class="token operator">=</span><span class="token comment"># SHOW data_directory;</span>
     data_directory
<span class="token comment">------------------------</span>
 <span class="token operator">/</span>home<span class="token operator">/</span>postgres<span class="token operator">/</span><span class="token keyword">primary</span>
<span class="token punctuation">(</span><span class="token number">1</span> <span class="token keyword">row</span><span class="token punctuation">)</span>
</code></pre></div><p>本地数据目录类似于 PostgreSQL 的数据目录，大多数目录和文件都是通过 <code>initdb</code> 生成的。随着数据库服务的运行，本地数据目录中会产生更多的本地文件，如临时文件、缓存文件、配置文件、日志文件等。其结构如下：</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code>$ tree /home/postgres/primary <span class="token parameter variable">-L</span> <span class="token number">1</span>
/home/postgres/primary
├── base
├── current_logfiles
├── global
├── log
├── pg_commit_ts
├── pg_dynshmem
├── pg_hba.conf
├── pg_ident.conf
├── pg_logical
├── pg_logindex
├── pg_multixact
├── pg_notify
├── pg_replslot
├── pg_serial
├── pg_snapshots
├── pg_stat
├── pg_stat_tmp
├── pg_subtrans
├── pg_tblspc
├── PG_VERSION
├── pg_xact
├── polar_cache_trash
├── polar_fullpage
├── polar_rel_size_cache
├── polar_settings.conf
├── polar_shmem_stat_file
├── postgresql.auto.conf
├── postgresql.conf
├── postmaster.opts
└── postmaster.pid

<span class="token number">20</span> directories, <span class="token number">10</span> files
</code></pre></div><h3 id="共享数据目录" tabindex="-1"><a class="header-anchor" href="#共享数据目录"><span>共享数据目录</span></a></h3><p>通过以下 SQL 命令可以查看所有计算节点在共享存储上的共享数据目录：</p><div class="language-sql" data-ext="sql" data-title="sql"><pre class="language-sql"><code>postgres<span class="token operator">=</span><span class="token comment"># SHOW polar_datadir;</span>
     polar_datadir
<span class="token comment">-----------------------</span>
 <span class="token operator">/</span>nvme1n1<span class="token operator">/</span>shared_data<span class="token operator">/</span>
<span class="token punctuation">(</span><span class="token number">1</span> <span class="token keyword">row</span><span class="token punctuation">)</span>
</code></pre></div><p>共享数据目录中存放 PolarDB-PG 的核心数据文件，如表文件、索引文件、WAL 日志、LogIndex 等。这些文件被所有节点共享，因此必须被备份。其结构如下：</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code>$ <span class="token function">sudo</span> pfs <span class="token parameter variable">-C</span> disk <span class="token function">ls</span> /nvme1n1/shared_data/
   Dir  <span class="token number">1</span>     <span class="token number">512</span>               Wed Jan <span class="token number">11</span> 09:34:01 <span class="token number">2023</span>  base
   Dir  <span class="token number">1</span>     <span class="token number">7424</span>              Wed Jan <span class="token number">11</span> 09:34:02 <span class="token number">2023</span>  global
   Dir  <span class="token number">1</span>     <span class="token number">0</span>                 Wed Jan <span class="token number">11</span> 09:34:02 <span class="token number">2023</span>  pg_tblspc
   Dir  <span class="token number">1</span>     <span class="token number">512</span>               Wed Jan <span class="token number">11</span> 09:35:05 <span class="token number">2023</span>  pg_wal
   Dir  <span class="token number">1</span>     <span class="token number">384</span>               Wed Jan <span class="token number">11</span> 09:35:01 <span class="token number">2023</span>  pg_logindex
   Dir  <span class="token number">1</span>     <span class="token number">0</span>                 Wed Jan <span class="token number">11</span> 09:34:02 <span class="token number">2023</span>  pg_twophase
   Dir  <span class="token number">1</span>     <span class="token number">128</span>               Wed Jan <span class="token number">11</span> 09:34:02 <span class="token number">2023</span>  pg_xact
   Dir  <span class="token number">1</span>     <span class="token number">0</span>                 Wed Jan <span class="token number">11</span> 09:34:02 <span class="token number">2023</span>  pg_commit_ts
   Dir  <span class="token number">1</span>     <span class="token number">256</span>               Wed Jan <span class="token number">11</span> 09:34:03 <span class="token number">2023</span>  pg_multixact
   Dir  <span class="token number">1</span>     <span class="token number">0</span>                 Wed Jan <span class="token number">11</span> 09:34:03 <span class="token number">2023</span>  pg_csnlog
   Dir  <span class="token number">1</span>     <span class="token number">256</span>               Wed Jan <span class="token number">11</span> 09:34:03 <span class="token number">2023</span>  polar_dma
   Dir  <span class="token number">1</span>     <span class="token number">512</span>               Wed Jan <span class="token number">11</span> 09:35:09 <span class="token number">2023</span>  polar_fullpage
  File  <span class="token number">1</span>     <span class="token number">32</span>                Wed Jan <span class="token number">11</span> 09:35:00 <span class="token number">2023</span>  RWID
   Dir  <span class="token number">1</span>     <span class="token number">256</span>               Wed Jan <span class="token number">11</span> <span class="token number">10</span>:25:42 <span class="token number">2023</span>  pg_replslot
  File  <span class="token number">1</span>     <span class="token number">224</span>               Wed Jan <span class="token number">11</span> <span class="token number">10</span>:19:37 <span class="token number">2023</span>  polar_non_exclusive_backup_label
total <span class="token number">16384</span> <span class="token punctuation">(</span>unit: 512Bytes<span class="token punctuation">)</span>
</code></pre></div><h2 id="polar-basebackup-备份工具" tabindex="-1"><a class="header-anchor" href="#polar-basebackup-备份工具"><span>polar_basebackup 备份工具</span></a></h2>`,20),g=a("code",null,"polar_basebackup",-1),f={href:"https://www.postgresql.org/docs/15/app-pgbasebackup.html",target:"_blank",rel:"noopener noreferrer"},y=a("code",null,"pg_basebackup",-1),S=a("code",null,"pg_basebackup",-1),P=a("code",null,"polar_basebackup",-1),D=a("code",null,"bin/",-1),x=o(`<p>该工具的主要功能是将一个运行中的 PolarDB-PG 数据库的数据目录（包括本地数据目录和共享数据目录）备份到目标目录中。</p><div class="language-bash line-numbers-mode" data-ext="sh" data-title="sh"><pre class="language-bash"><code>polar_basebackup takes a base backup of a running PostgreSQL server.

Usage:
  polar_basebackup <span class="token punctuation">[</span>OPTION<span class="token punctuation">]</span><span class="token punctuation">..</span>.

Options controlling the output:
  -D, <span class="token parameter variable">--pgdata</span><span class="token operator">=</span>DIRECTORY receive base backup into directory
  -F, <span class="token parameter variable">--format</span><span class="token operator">=</span>p<span class="token operator">|</span>t       output <span class="token function">format</span> <span class="token punctuation">(</span>plain <span class="token punctuation">(</span>default<span class="token punctuation">)</span>, <span class="token function">tar</span><span class="token punctuation">)</span>
  -r, --max-rate<span class="token operator">=</span>RATE    maximum transfer rate to transfer data directory
                         <span class="token punctuation">(</span>in kB/s, or use suffix <span class="token string">&quot;k&quot;</span> or <span class="token string">&quot;M&quot;</span><span class="token punctuation">)</span>
  -R, --write-recovery-conf
                         <span class="token function">write</span> recovery.conf <span class="token keyword">for</span> replication
  -T, --tablespace-mapping<span class="token operator">=</span>OLDDIR<span class="token operator">=</span>NEWDIR
                         relocate tablespace <span class="token keyword">in</span> OLDDIR to NEWDIR
      <span class="token parameter variable">--waldir</span><span class="token operator">=</span>WALDIR    location <span class="token keyword">for</span> the write-ahead log directory
  -X, --wal-method<span class="token operator">=</span>none<span class="token operator">|</span>fetch<span class="token operator">|</span>stream
                         include required WAL files with specified method
  -z, <span class="token parameter variable">--gzip</span>             compress <span class="token function">tar</span> output
  -Z, <span class="token parameter variable">--compress</span><span class="token operator">=</span><span class="token number">0</span>-9     compress <span class="token function">tar</span> output with given compression level

General options:
  -c, <span class="token parameter variable">--checkpoint</span><span class="token operator">=</span>fast<span class="token operator">|</span>spread
                         <span class="token builtin class-name">set</span> fast or spread checkpointing
  -C, --create-slot      create replication slot
  -l, <span class="token parameter variable">--label</span><span class="token operator">=</span>LABEL      <span class="token builtin class-name">set</span> backup label
  -n, --no-clean         <span class="token keyword">do</span> not clean up after errors
  -N, --no-sync          <span class="token keyword">do</span> not <span class="token function">wait</span> <span class="token keyword">for</span> changes to be written safely to disk
  -P, <span class="token parameter variable">--progress</span>         show progress information
  -S, <span class="token parameter variable">--slot</span><span class="token operator">=</span>SLOTNAME    replication slot to use
  -v, <span class="token parameter variable">--verbose</span>          output verbose messages
  -V, <span class="token parameter variable">--version</span>          output version information, <span class="token keyword">then</span> <span class="token builtin class-name">exit</span>
      --no-slot          prevent creation of temporary replication slot
      --no-verify-checksums
                         <span class="token keyword">do</span> not verify checksums
  -?, <span class="token parameter variable">--help</span>             show this help, <span class="token keyword">then</span> <span class="token builtin class-name">exit</span>

Connection options:
  -d, <span class="token parameter variable">--dbname</span><span class="token operator">=</span>CONNSTR   connection string
  -h, <span class="token parameter variable">--host</span><span class="token operator">=</span><span class="token environment constant">HOSTNAME</span>    database server <span class="token function">host</span> or socket directory
  -p, <span class="token parameter variable">--port</span><span class="token operator">=</span>PORT        database server port number
  -s, --status-interval<span class="token operator">=</span>INTERVAL
                         <span class="token function">time</span> between status packets sent to server <span class="token punctuation">(</span>in seconds<span class="token punctuation">)</span>
  -U, <span class="token parameter variable">--username</span><span class="token operator">=</span>NAME    connect as specified database user
  -w, --no-password      never prompt <span class="token keyword">for</span> password
  -W, <span class="token parameter variable">--password</span>         force password prompt <span class="token punctuation">(</span>should happen automatically<span class="token punctuation">)</span>
      <span class="token parameter variable">--polardata</span><span class="token operator">=</span>datadir  receive polar data backup into directory
      <span class="token parameter variable">--polar_disk_home</span><span class="token operator">=</span>disk_home  polar_disk_home <span class="token keyword">for</span> polar data backup
      <span class="token parameter variable">--polar_host_id</span><span class="token operator">=</span>host_id  polar_host_id <span class="token keyword">for</span> polar data backup
      <span class="token parameter variable">--polar_storage_cluster_name</span><span class="token operator">=</span>cluster_name  polar_storage_cluster_name <span class="token keyword">for</span> polar data backup
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><code>polar_basebackup</code> 的参数及用法几乎和 <code>pg_basebackup</code> 一致，新增了以下与共享存储相关的参数：</p><ul><li><code>--polar_disk_home</code> / <code>--polar_host_id</code> / <code>--polar_storage_cluster_name</code>：这三个参数指定了用于存放备份共享数据的共享存储节点</li><li><code>--polardata</code>：该参数指定了备份共享存储节点上存放共享数据的路径；如不指定，则默认将共享数据备份到本地数据备份目录的 <code>polar_shared_data/</code> 路径下</li></ul><h2 id="备份并恢复一个-replica-节点" tabindex="-1"><a class="header-anchor" href="#备份并恢复一个-replica-节点"><span>备份并恢复一个 Replica 节点</span></a></h2><p>基础备份可用于搭建一个新的 Replica 节点。如前文所述，一个正在运行中的 PolarDB-PG 实例的数据文件分布在各计算节点的本地存储和存储节点的共享存储中。下面将说明如何使用 <code>polar_basebackup</code> 将实例的数据文件备份到一个本地磁盘上，并从这个备份上启动一个 Replica 节点。</p><h3 id="pfs-文件系统挂载" tabindex="-1"><a class="header-anchor" href="#pfs-文件系统挂载"><span>PFS 文件系统挂载</span></a></h3><p>首先，在将要部署 Replica 节点的机器上启动 PFSD 守护进程，挂载到正在运行中的共享存储的 PFS 文件系统上。后续启动的 Replica 节点将使用这个守护进程来访问共享存储。</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code><span class="token function">sudo</span> /usr/local/polarstore/pfsd/bin/start_pfsd.sh <span class="token parameter variable">-p</span> nvme1n1 <span class="token parameter variable">-w</span> <span class="token number">4</span>
</code></pre></div><h3 id="备份数据到本地存储" tabindex="-1"><a class="header-anchor" href="#备份数据到本地存储"><span>备份数据到本地存储</span></a></h3><p>运行如下命令，将实例 Primary 节点的本地数据和共享数据备份到用于部署 Replica 节点的本地存储路径 <code>/home/postgres/replica1</code> 下：</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code>polar_basebackup <span class="token punctuation">\\</span>
    <span class="token parameter variable">--host</span><span class="token operator">=</span><span class="token punctuation">[</span>Primary节点所在IP<span class="token punctuation">]</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">--port</span><span class="token operator">=</span><span class="token punctuation">[</span>Primary节点所在端口号<span class="token punctuation">]</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-D</span> /home/postgres/replica1 <span class="token punctuation">\\</span>
    <span class="token parameter variable">-X</span> stream <span class="token parameter variable">--progress</span> --write-recovery-conf <span class="token parameter variable">-v</span>
</code></pre></div><p>将看到如下输出：</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code>polar_basebackup: initiating base backup, waiting <span class="token keyword">for</span> checkpoint to complete
polar_basebackup: checkpoint completed
polar_basebackup: write-ahead log start point: <span class="token number">0</span>/40BDD1C8 on timeline <span class="token number">1</span>
polar_basebackup: starting background WAL receiver
polar_basebackup: created temporary replication slot <span class="token string">&quot;pg_basebackup_1590548&quot;</span>
<span class="token number">817548</span>/817548 kB <span class="token punctuation">(</span><span class="token number">100</span>%<span class="token punctuation">)</span>, <span class="token number">2</span>/2 tablespaces
polar_basebackup: write-ahead log end point: <span class="token number">0</span>/40BDD2A0
polar_basebackup: waiting <span class="token keyword">for</span> background process to finish streaming <span class="token punctuation">..</span>.
polar_basebackup: syncing data to disk <span class="token punctuation">..</span>.
polar_basebackup: renaming backup_manifest.tmp to backup_manifest
polar_basebackup: base backup completed
</code></pre></div><p>备份完成后，可以以这个备份目录作为本地数据目录，启动一个新的 Replica 节点。由于本地数据目录中不需要共享存储上已有的共享数据文件，所以删除掉本地数据目录中的 <code>polar_shared_data/</code> 目录：</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code><span class="token function">rm</span> <span class="token parameter variable">-rf</span> /home/postgres/replica1/polar_shared_data
</code></pre></div><h3 id="重新配置-replica-节点" tabindex="-1"><a class="header-anchor" href="#重新配置-replica-节点"><span>重新配置 Replica 节点</span></a></h3><p>重新编辑 Replica 节点的配置文件 <code>/home/postgres/replica1/postgresql.conf</code>：</p><div class="language-diff" data-ext="diff" data-title="diff"><pre class="language-diff"><code><span class="token deleted-sign deleted"><span class="token prefix deleted">-</span><span class="token line">polar_hostid=1
</span></span><span class="token inserted-sign inserted"><span class="token prefix inserted">+</span><span class="token line">polar_hostid=2
</span></span>
<span class="token inserted-sign inserted"><span class="token prefix inserted">+</span><span class="token line">primary_slot_name=&#39;replica1&#39;
</span></span></code></pre></div><p>将启动模式标识为 Replica：</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code><span class="token function">rm</span> <span class="token parameter variable">-rf</span> /home/postgres/replica1/standby.signal
<span class="token function">touch</span> /home/postgres/replica1/replica.signal
</code></pre></div><h3 id="replica-节点启动" tabindex="-1"><a class="header-anchor" href="#replica-节点启动"><span>Replica 节点启动</span></a></h3><p>启动 Replica 节点：</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code>pg_ctl <span class="token parameter variable">-D</span> /home/postgres/replica1 start
</code></pre></div><h3 id="replica-节点验证" tabindex="-1"><a class="header-anchor" href="#replica-节点验证"><span>Replica 节点验证</span></a></h3><p>在 Primary 节点上执行建表并插入数据，在 Replica 节点上可以查到 Primary 节点插入的数据：</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code>$ psql <span class="token parameter variable">-q</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-h</span> <span class="token punctuation">[</span>Primary节点所在IP<span class="token punctuation">]</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-p</span> <span class="token punctuation">[</span>Primary节点所在端口号<span class="token punctuation">]</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-d</span> postgres <span class="token punctuation">\\</span>
    <span class="token parameter variable">-c</span> <span class="token string">&quot;CREATE TABLE t (t1 INT PRIMARY KEY, t2 INT); INSERT INTO t VALUES (1, 1),(2, 3),(3, 3);&quot;</span>

$ psql <span class="token parameter variable">-q</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-h</span> <span class="token punctuation">[</span>Replica节点所在IP<span class="token punctuation">]</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-p</span> <span class="token punctuation">[</span>Replica节点所在端口号<span class="token punctuation">]</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-d</span> postgres <span class="token punctuation">\\</span>
    <span class="token parameter variable">-c</span> <span class="token string">&quot;SELECT * FROM t;&quot;</span>
 t1 <span class="token operator">|</span> t2
----+----
  <span class="token number">1</span> <span class="token operator">|</span>  <span class="token number">1</span>
  <span class="token number">2</span> <span class="token operator">|</span>  <span class="token number">3</span>
  <span class="token number">3</span> <span class="token operator">|</span>  <span class="token number">3</span>
<span class="token punctuation">(</span><span class="token number">3</span> rows<span class="token punctuation">)</span>
</code></pre></div><h2 id="备份并恢复一个-standby-节点" tabindex="-1"><a class="header-anchor" href="#备份并恢复一个-standby-节点"><span>备份并恢复一个 Standby 节点</span></a></h2><p>基础备份也可以用于搭建一个新的 Standby 节点。如下图所示，Standby 节点与 Primary / Replica 节点各自使用独立的共享存储，与 Primary 节点使用物理复制保持同步。Standby 节点可用于作为主共享存储的灾备。</p><p><img src="`+l+`" alt="backup-dir"></p><h3 id="pfs-文件系统格式化和挂载" tabindex="-1"><a class="header-anchor" href="#pfs-文件系统格式化和挂载"><span>PFS 文件系统格式化和挂载</span></a></h3><p>假设此时用于部署 Standby 计算节点的机器已经准备好用于后备的共享存储 <code>nvme2n1</code>：</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code>$ lsblk
NAME        MAJ:MIN RM SIZE RO TYPE MOUNTPOINT
nvme0n1     <span class="token number">259</span>:1    <span class="token number">0</span>  40G  <span class="token number">0</span> disk
└─nvme0n1p1 <span class="token number">259</span>:2    <span class="token number">0</span>  40G  <span class="token number">0</span> part /etc/hosts
nvme2n1     <span class="token number">259</span>:3    <span class="token number">0</span>  70G  <span class="token number">0</span> disk
nvme1n1     <span class="token number">259</span>:0    <span class="token number">0</span>  60G  <span class="token number">0</span> disk
</code></pre></div><p>将这个共享存储格式化为 PFS 格式，并启动 PFSD 守护进程挂载到 PFS 文件系统：</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code><span class="token function">sudo</span> pfs <span class="token parameter variable">-C</span> disk <span class="token function">mkfs</span> nvme2n1
<span class="token function">sudo</span> /usr/local/polarstore/pfsd/bin/start_pfsd.sh <span class="token parameter variable">-p</span> nvme2n1 <span class="token parameter variable">-w</span> <span class="token number">4</span>
</code></pre></div><h3 id="备份数据到本地存储和共享存储" tabindex="-1"><a class="header-anchor" href="#备份数据到本地存储和共享存储"><span>备份数据到本地存储和共享存储</span></a></h3><p>在用于部署 Standby 节点的机器上执行备份，以 <code>/home/postgres/standby</code> 作为本地数据目录，以 <code>/nvme2n1/shared_data</code> 作为共享存储目录：</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code>polar_basebackup <span class="token punctuation">\\</span>
    <span class="token parameter variable">--host</span><span class="token operator">=</span><span class="token punctuation">[</span>Primary节点所在IP<span class="token punctuation">]</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">--port</span><span class="token operator">=</span><span class="token punctuation">[</span>Primary节点所在端口号<span class="token punctuation">]</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-D</span> /home/postgres/standby <span class="token punctuation">\\</span>
    <span class="token parameter variable">--polardata</span><span class="token operator">=</span>/nvme2n1/shared_data/ <span class="token punctuation">\\</span>
    <span class="token parameter variable">--polar_storage_cluster_name</span><span class="token operator">=</span>disk <span class="token punctuation">\\</span>
    <span class="token parameter variable">--polar_disk_name</span><span class="token operator">=</span>nvme2n1 <span class="token punctuation">\\</span>
    <span class="token parameter variable">--polar_host_id</span><span class="token operator">=</span><span class="token number">3</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-X</span> stream <span class="token parameter variable">--progress</span> --write-recovery-conf <span class="token parameter variable">-v</span>
</code></pre></div><p>将会看到如下输出。其中，除了 <code>polar_basebackup</code> 的输出以外，还有 PFS 的输出日志：</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code><span class="token punctuation">[</span>PFSD_SDK INF Jan <span class="token number">11</span> <span class="token number">10</span>:11:27.247112<span class="token punctuation">]</span><span class="token punctuation">[</span><span class="token number">99</span><span class="token punctuation">]</span>pfs_mount_prepare <span class="token number">103</span>: begin prepare <span class="token function">mount</span> cluster<span class="token punctuation">(</span>disk<span class="token punctuation">)</span>, PBD<span class="token punctuation">(</span>nvme2n1<span class="token punctuation">)</span>, hostid<span class="token punctuation">(</span><span class="token number">3</span><span class="token punctuation">)</span>,flags<span class="token punctuation">(</span>0x13<span class="token punctuation">)</span>
<span class="token punctuation">[</span>PFSD_SDK INF Jan <span class="token number">11</span> <span class="token number">10</span>:11:27.247161<span class="token punctuation">]</span><span class="token punctuation">[</span><span class="token number">99</span><span class="token punctuation">]</span>pfs_mount_prepare <span class="token number">165</span>: pfs_mount_prepare success <span class="token keyword">for</span> nvme2n1 hostid <span class="token number">3</span>
<span class="token punctuation">[</span>PFSD_SDK INF Jan <span class="token number">11</span> <span class="token number">10</span>:11:27.293900<span class="token punctuation">]</span><span class="token punctuation">[</span><span class="token number">99</span><span class="token punctuation">]</span>chnl_connection_poll_shm <span class="token number">1238</span>: ack data update s_mount_epoch <span class="token number">1</span>
<span class="token punctuation">[</span>PFSD_SDK INF Jan <span class="token number">11</span> <span class="token number">10</span>:11:27.293912<span class="token punctuation">]</span><span class="token punctuation">[</span><span class="token number">99</span><span class="token punctuation">]</span>chnl_connection_poll_shm <span class="token number">1266</span>: connect and got ack data from svr, err <span class="token operator">=</span> <span class="token number">0</span>, mntid <span class="token number">0</span>
<span class="token punctuation">[</span>PFSD_SDK INF Jan <span class="token number">11</span> <span class="token number">10</span>:11:27.293979<span class="token punctuation">]</span><span class="token punctuation">[</span><span class="token number">99</span><span class="token punctuation">]</span>pfsd_sdk_init <span class="token number">191</span>: pfsd_chnl_connect success
<span class="token punctuation">[</span>PFSD_SDK INF Jan <span class="token number">11</span> <span class="token number">10</span>:11:27.293987<span class="token punctuation">]</span><span class="token punctuation">[</span><span class="token number">99</span><span class="token punctuation">]</span>pfs_mount_post <span class="token number">208</span>: pfs_mount_post err <span class="token builtin class-name">:</span> <span class="token number">0</span>
<span class="token punctuation">[</span>PFSD_SDK ERR Jan <span class="token number">11</span> <span class="token number">10</span>:11:27.297257<span class="token punctuation">]</span><span class="token punctuation">[</span><span class="token number">99</span><span class="token punctuation">]</span>pfsd_opendir <span class="token number">1437</span>: opendir /nvme2n1/shared_data/ error: No such <span class="token function">file</span> or directory
<span class="token punctuation">[</span>PFSD_SDK INF Jan <span class="token number">11</span> <span class="token number">10</span>:11:27.297396<span class="token punctuation">]</span><span class="token punctuation">[</span><span class="token number">99</span><span class="token punctuation">]</span>pfsd_mkdir <span class="token number">1320</span>: <span class="token function">mkdir</span> /nvme2n1/shared_data
polar_basebackup: initiating base backup, waiting <span class="token keyword">for</span> checkpoint to complete
WARNING:  a labelfile <span class="token string">&quot;/nvme1n1/shared_data//polar_non_exclusive_backup_label&quot;</span> is already on disk
HINT:  POLAR: we overwrite it
polar_basebackup: checkpoint completed
polar_basebackup: write-ahead log start point: <span class="token number">0</span>/16C91F8 on timeline <span class="token number">1</span>
polar_basebackup: starting background WAL receiver
polar_basebackup: created temporary replication slot <span class="token string">&quot;pg_basebackup_373&quot;</span>
<span class="token punctuation">..</span>.
<span class="token punctuation">[</span>PFSD_SDK INF Jan <span class="token number">11</span> <span class="token number">10</span>:11:32.992005<span class="token punctuation">]</span><span class="token punctuation">[</span><span class="token number">99</span><span class="token punctuation">]</span>pfsd_open <span class="token number">539</span>: <span class="token function">open</span> /nvme2n1/shared_data/polar_non_exclusive_backup_label with inode <span class="token number">6325</span>, fd <span class="token number">0</span>
<span class="token punctuation">[</span>PFSD_SDK INF Jan <span class="token number">11</span> <span class="token number">10</span>:11:32.993074<span class="token punctuation">]</span><span class="token punctuation">[</span><span class="token number">99</span><span class="token punctuation">]</span>pfsd_open <span class="token number">539</span>: <span class="token function">open</span> /nvme2n1/shared_data/global/pg_control with inode <span class="token number">8373</span>, fd <span class="token number">0</span>
<span class="token number">851396</span>/851396 kB <span class="token punctuation">(</span><span class="token number">100</span>%<span class="token punctuation">)</span>, <span class="token number">2</span>/2 tablespaces
polar_basebackup: write-ahead log end point: <span class="token number">0</span>/16C9300
polar_basebackup: waiting <span class="token keyword">for</span> background process to finish streaming <span class="token punctuation">..</span>.
polar_basebackup: base backup completed
<span class="token punctuation">[</span>PFSD_SDK INF Jan <span class="token number">11</span> <span class="token number">10</span>:11:52.378220<span class="token punctuation">]</span><span class="token punctuation">[</span><span class="token number">99</span><span class="token punctuation">]</span>pfsd_umount_force <span class="token number">247</span>: pbdname nvme2n1
<span class="token punctuation">[</span>PFSD_SDK INF Jan <span class="token number">11</span> <span class="token number">10</span>:11:52.378229<span class="token punctuation">]</span><span class="token punctuation">[</span><span class="token number">99</span><span class="token punctuation">]</span>pfs_umount_prepare <span class="token number">269</span>: pfs_umount_prepare. pbdname:nvme2n1
<span class="token punctuation">[</span>PFSD_SDK INF Jan <span class="token number">11</span> <span class="token number">10</span>:11:52.404010<span class="token punctuation">]</span><span class="token punctuation">[</span><span class="token number">99</span><span class="token punctuation">]</span>chnl_connection_release_shm <span class="token number">1164</span>: client <span class="token function">umount</span> <span class="token builtin class-name">return</span> <span class="token builtin class-name">:</span> deleted /var/run/pfsd//nvme2n1/99.pid
<span class="token punctuation">[</span>PFSD_SDK INF Jan <span class="token number">11</span> <span class="token number">10</span>:11:52.404171<span class="token punctuation">]</span><span class="token punctuation">[</span><span class="token number">99</span><span class="token punctuation">]</span>pfs_umount_post <span class="token number">281</span>: pfs_umount_post. pbdname:nvme2n1
<span class="token punctuation">[</span>PFSD_SDK INF Jan <span class="token number">11</span> <span class="token number">10</span>:11:52.404174<span class="token punctuation">]</span><span class="token punctuation">[</span><span class="token number">99</span><span class="token punctuation">]</span>pfsd_umount_force <span class="token number">261</span>: <span class="token function">umount</span> success <span class="token keyword">for</span> nvme2n1
</code></pre></div><p>上述命令会在当前机器的本地存储上备份 Primary 节点的本地数据目录，在参数指定的共享存储目录上备份共享数据目录。</p><h3 id="重新配置-standby-节点" tabindex="-1"><a class="header-anchor" href="#重新配置-standby-节点"><span>重新配置 Standby 节点</span></a></h3><p>重新编辑 Standby 节点的配置文件 <code>/home/postgres/standby/postgresql.conf</code>：</p><div class="language-diff" data-ext="diff" data-title="diff"><pre class="language-diff"><code><span class="token deleted-sign deleted"><span class="token prefix deleted">-</span><span class="token line">polar_hostid=1
</span></span><span class="token inserted-sign inserted"><span class="token prefix inserted">+</span><span class="token line">polar_hostid=3
</span></span><span class="token deleted-sign deleted"><span class="token prefix deleted">-</span><span class="token line">polar_disk_name=&#39;nvme1n1&#39;
</span><span class="token prefix deleted">-</span><span class="token line">polar_datadir=&#39;/nvme1n1/shared_data/&#39;
</span></span><span class="token inserted-sign inserted"><span class="token prefix inserted">+</span><span class="token line">polar_disk_name=&#39;nvme2n1&#39;
</span><span class="token prefix inserted">+</span><span class="token line">polar_datadir=&#39;/nvme2n1/shared_data/&#39;
</span></span>
<span class="token inserted-sign inserted"><span class="token prefix inserted">+</span><span class="token line">primary_slot_name = &#39;standby1&#39;
</span></span></code></pre></div><h3 id="standby-节点启动" tabindex="-1"><a class="header-anchor" href="#standby-节点启动"><span>Standby 节点启动</span></a></h3><p>在 Primary 节点上创建用于与 Standby 进行物理复制的复制槽：</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code>$ psql <span class="token punctuation">\\</span>
    <span class="token parameter variable">--host</span><span class="token operator">=</span><span class="token punctuation">[</span>Primary节点所在IP<span class="token punctuation">]</span> <span class="token parameter variable">--port</span><span class="token operator">=</span><span class="token punctuation">[</span>Primary节点所在端口号<span class="token punctuation">]</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-d</span> postgres <span class="token punctuation">\\</span>
    <span class="token parameter variable">-c</span> <span class="token string">&quot;SELECT * FROM pg_create_physical_replication_slot(&#39;standby1&#39;);&quot;</span>
 slot_name <span class="token operator">|</span> lsn
-----------+-----
 standby1  <span class="token operator">|</span>
<span class="token punctuation">(</span><span class="token number">1</span> row<span class="token punctuation">)</span>
</code></pre></div><p>启动 Standby 节点：</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code>pg_ctl <span class="token parameter variable">-D</span> <span class="token environment constant">$HOME</span>/standby start
</code></pre></div><h3 id="standby-节点验证" tabindex="-1"><a class="header-anchor" href="#standby-节点验证"><span>Standby 节点验证</span></a></h3><p>在 Primary 节点上创建表并插入数据，在 Standby 节点上可以查询到数据：</p><div class="language-bash" data-ext="sh" data-title="sh"><pre class="language-bash"><code>$ psql <span class="token parameter variable">-q</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-h</span> <span class="token punctuation">[</span>Primary节点所在IP<span class="token punctuation">]</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-p</span> <span class="token punctuation">[</span>Primary节点所在端口号<span class="token punctuation">]</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-d</span> postgres <span class="token punctuation">\\</span>
    <span class="token parameter variable">-c</span> <span class="token string">&quot;CREATE TABLE t (t1 INT PRIMARY KEY, t2 INT); INSERT INTO t VALUES (1, 1),(2, 3),(3, 3);&quot;</span>

$ psql <span class="token parameter variable">-q</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-h</span> <span class="token punctuation">[</span>Standby节点所在IP<span class="token punctuation">]</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-p</span> <span class="token punctuation">[</span>Standby节点所在端口号<span class="token punctuation">]</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-d</span> postgres <span class="token punctuation">\\</span>
    <span class="token parameter variable">-c</span> <span class="token string">&quot;SELECT * FROM t;&quot;</span>
 t1 <span class="token operator">|</span> t2
----+----
  <span class="token number">1</span> <span class="token operator">|</span>  <span class="token number">1</span>
  <span class="token number">2</span> <span class="token operator">|</span>  <span class="token number">3</span>
  <span class="token number">3</span> <span class="token operator">|</span>  <span class="token number">3</span>
<span class="token punctuation">(</span><span class="token number">3</span> rows<span class="token punctuation">)</span>
</code></pre></div>`,52);function w(c,R){const r=t("ArticleInfo"),e=t("router-link"),i=t("ExternalLinkIcon");return k(),d("div",null,[m,s(r,{frontmatter:c.$frontmatter},null,8,["frontmatter"]),h,a("nav",v,[a("ul",null,[a("li",null,[s(e,{to:"#备份恢复原理"},{default:p(()=>[n("备份恢复原理")]),_:1})]),a("li",null,[s(e,{to:"#数据目录结构"},{default:p(()=>[n("数据目录结构")]),_:1}),a("ul",null,[a("li",null,[s(e,{to:"#本地数据目录"},{default:p(()=>[n("本地数据目录")]),_:1})]),a("li",null,[s(e,{to:"#共享数据目录"},{default:p(()=>[n("共享数据目录")]),_:1})])])]),a("li",null,[s(e,{to:"#polar-basebackup-备份工具"},{default:p(()=>[n("polar_basebackup 备份工具")]),_:1})]),a("li",null,[s(e,{to:"#备份并恢复一个-replica-节点"},{default:p(()=>[n("备份并恢复一个 Replica 节点")]),_:1}),a("ul",null,[a("li",null,[s(e,{to:"#pfs-文件系统挂载"},{default:p(()=>[n("PFS 文件系统挂载")]),_:1})]),a("li",null,[s(e,{to:"#备份数据到本地存储"},{default:p(()=>[n("备份数据到本地存储")]),_:1})]),a("li",null,[s(e,{to:"#重新配置-replica-节点"},{default:p(()=>[n("重新配置 Replica 节点")]),_:1})]),a("li",null,[s(e,{to:"#replica-节点启动"},{default:p(()=>[n("Replica 节点启动")]),_:1})]),a("li",null,[s(e,{to:"#replica-节点验证"},{default:p(()=>[n("Replica 节点验证")]),_:1})])])]),a("li",null,[s(e,{to:"#备份并恢复一个-standby-节点"},{default:p(()=>[n("备份并恢复一个 Standby 节点")]),_:1}),a("ul",null,[a("li",null,[s(e,{to:"#pfs-文件系统格式化和挂载"},{default:p(()=>[n("PFS 文件系统格式化和挂载")]),_:1})]),a("li",null,[s(e,{to:"#备份数据到本地存储和共享存储"},{default:p(()=>[n("备份数据到本地存储和共享存储")]),_:1})]),a("li",null,[s(e,{to:"#重新配置-standby-节点"},{default:p(()=>[n("重新配置 Standby 节点")]),_:1})]),a("li",null,[s(e,{to:"#standby-节点启动"},{default:p(()=>[n("Standby 节点启动")]),_:1})]),a("li",null,[s(e,{to:"#standby-节点验证"},{default:p(()=>[n("Standby 节点验证")]),_:1})])])])])]),_,a("p",null,[n("PolarDB-PG 的备份工具 "),g,n("，由 PostgreSQL 的 "),a("a",f,[y,s(i)]),n(" 改造而来，完全兼容 "),S,n("，因此同样可以用于对 PostgreSQL 做备份恢复。"),P,n(" 的可执行文件位于 PolarDB-PG 安装目录下的 "),D,n(" 目录中。")]),x])}const F=u(b,[["render",w],["__file","backup-and-restore.html.vue"]]),N=JSON.parse('{"path":"/zh/operation/backup-and-restore.html","title":"备份恢复","lang":"zh-CN","frontmatter":{"author":"慎追、棠羽","date":"2023/01/11","minute":30},"headers":[{"level":2,"title":"备份恢复原理","slug":"备份恢复原理","link":"#备份恢复原理","children":[]},{"level":2,"title":"数据目录结构","slug":"数据目录结构","link":"#数据目录结构","children":[{"level":3,"title":"本地数据目录","slug":"本地数据目录","link":"#本地数据目录","children":[]},{"level":3,"title":"共享数据目录","slug":"共享数据目录","link":"#共享数据目录","children":[]}]},{"level":2,"title":"polar_basebackup 备份工具","slug":"polar-basebackup-备份工具","link":"#polar-basebackup-备份工具","children":[]},{"level":2,"title":"备份并恢复一个 Replica 节点","slug":"备份并恢复一个-replica-节点","link":"#备份并恢复一个-replica-节点","children":[{"level":3,"title":"PFS 文件系统挂载","slug":"pfs-文件系统挂载","link":"#pfs-文件系统挂载","children":[]},{"level":3,"title":"备份数据到本地存储","slug":"备份数据到本地存储","link":"#备份数据到本地存储","children":[]},{"level":3,"title":"重新配置 Replica 节点","slug":"重新配置-replica-节点","link":"#重新配置-replica-节点","children":[]},{"level":3,"title":"Replica 节点启动","slug":"replica-节点启动","link":"#replica-节点启动","children":[]},{"level":3,"title":"Replica 节点验证","slug":"replica-节点验证","link":"#replica-节点验证","children":[]}]},{"level":2,"title":"备份并恢复一个 Standby 节点","slug":"备份并恢复一个-standby-节点","link":"#备份并恢复一个-standby-节点","children":[{"level":3,"title":"PFS 文件系统格式化和挂载","slug":"pfs-文件系统格式化和挂载","link":"#pfs-文件系统格式化和挂载","children":[]},{"level":3,"title":"备份数据到本地存储和共享存储","slug":"备份数据到本地存储和共享存储","link":"#备份数据到本地存储和共享存储","children":[]},{"level":3,"title":"重新配置 Standby 节点","slug":"重新配置-standby-节点","link":"#重新配置-standby-节点","children":[]},{"level":3,"title":"Standby 节点启动","slug":"standby-节点启动","link":"#standby-节点启动","children":[]},{"level":3,"title":"Standby 节点验证","slug":"standby-节点验证","link":"#standby-节点验证","children":[]}]}],"git":{"updatedTime":1736994405000,"contributors":[{"name":"mrdrivingduck","email":"mrdrivingduck@gmail.com","commits":1}]},"filePathRelative":"zh/operation/backup-and-restore.md"}');export{F as comp,N as data};
