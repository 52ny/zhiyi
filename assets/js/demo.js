/* 知忆 · 首次使用的示例资料 */
(function (Z) {
  function englishDemo() {
    const blocks = [
      { t: 'h1', text: 'The Forgetting Curve', page: 1 },
      { t: 'p', text: 'More than a century ago, psychologist Hermann Ebbinghaus discovered that we forget most of what we learn surprisingly fast. In his experiments, he memorized lists of nonsense syllables and tested himself at different intervals. The result was a curve that drops steeply within the first day and then flattens out.', page: 1 },
      { t: 'p', text: 'The practical lesson is simple: review soon after learning, and review again at increasing intervals. Each review strengthens the memory trace and makes the next forgetting slower. This is the foundation of spaced repetition, one of the most effective study techniques known to cognitive science.', page: 1 },
      { t: 'p', text: 'Active recall is the second half of the story. Instead of rereading a passage, close the book and try to reconstruct it from memory. The struggle to retrieve information is what makes the memory durable. When you combine spacing with retrieval practice, you learn more in less time.', page: 2 },
      { t: 'p', text: 'Finally, sleep matters. During sleep, the brain consolidates what you studied during the day. A short review before bed, followed by a good night of sleep, can do more for long-term retention than an extra hour of late-night cramming.', page: 2 }
    ];
    const translations = {
      1: '一个多世纪前，心理学家赫尔曼·艾宾浩斯发现：我们会以惊人的速度遗忘刚学到的大部分内容。在实验中，他记忆无意义音节表，并在不同间隔后自测。结果得到一条曲线：最初一天内急剧下降，随后逐渐平缓。',
      2: '实践启示很简单：学习后尽快复习，并在逐渐拉长的间隔中再次复习。每一次复习都会强化记忆痕迹，让下一次遗忘变慢。这就是间隔重复——认知科学中最有效的学习技术之一。',
      3: '主动回忆是故事的另一半。不要反复阅读，而是合上书，尝试凭记忆重建内容。正是这种“费力提取”让记忆变得牢固。把间隔与提取练习结合起来，你能用更少的时间学得更多。',
      4: '最后，睡眠很重要。睡眠中，大脑会巩固白天所学。睡前快速复习，再睡个好觉，对长期记忆的帮助可能胜过深夜多熬一小时。'
    };
    return Z.Import.finishDoc(Z.Import.makeDoc({
      title: 'The Forgetting Curve · 遗忘曲线',
      type: 'text',
      source: 'demo',
      lang: 'en',
      blocks,
      translations,
      bilingual: true,
      highlights: [
        { id: Z.uid('hl'), block: 1, start: 44, end: 90, text: 'we forget most of what we learn surprisingly fast', color: 'yellow', note: '主题句：遗忘速度极快', createdAt: Date.now() - 5000 },
        { id: Z.uid('hl'), block: 2, start: 27, end: 94, text: 'review soon after learning, and review again at increasing intervals', color: 'green', note: '间隔重复的核心做法', createdAt: Date.now() - 4000 }
      ],
      cards: [
        { id: Z.uid('card'), kind: 'qa', front: 'What is the foundation of spaced repetition?', back: 'Reviewing soon after learning, then again at increasing intervals to strengthen the memory trace.', due: Date.now() - 1000, interval: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: Date.now() },
        { id: Z.uid('card'), kind: 'qa', front: 'Why is active recall effective?', back: 'The effort of retrieving information from memory makes the memory more durable than rereading.', due: Date.now() - 1000, interval: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: Date.now() },
        { id: Z.uid('card'), kind: 'word', front: 'consolidate', back: '/kənˈsɒlɪdeɪt/\n巩固；使合并', context: 'the brain consolidates what you studied during the day', due: Date.now() - 1000, interval: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: Date.now() }
      ]
    }), { forceType: 'text' });
  }

  function knowledgeDemo() {
    const blocks = [
      { t: 'h1', text: 'TCP/IP 四层模型', page: 1 },
      { t: 'p', text: 'TCP/IP 是互联网实际使用的协议体系。它把通信过程分为四层，每一层只关心自己的职责，并通过接口向上层提供服务。', page: 1 },
      { t: 'h2', text: '应用层', page: 1 },
      { t: 'p', text: '直接面向用户程序，负责定义数据格式与交互规则。常见协议有 HTTP、HTTPS、DNS、SMTP、FTP。', page: 1 },
      { t: 'li', text: 'HTTP：超文本传输，浏览器访问网页的基础', page: 1 },
      { t: 'li', text: 'DNS：把域名解析为 IP 地址', page: 1 },
      { t: 'h2', text: '传输层', page: 1 },
      { t: 'p', text: '为两台主机的进程提供端到端通信。TCP 提供面向连接、可靠、字节流的服务；UDP 提供无连接、不可靠但开销小的数据报服务。', page: 1 },
      { t: 'li', text: 'TCP：三次握手、滑动窗口、拥塞控制、重传', page: 1 },
      { t: 'li', text: 'UDP：适合实时音视频、DNS 查询等场景', page: 1 },
      { t: 'h2', text: '网络层', page: 1 },
      { t: 'p', text: '负责分组转发与路由选择，核心协议是 IP。IP 地址标识主机与网络，路由器根据路由表选择下一跳。', page: 1 },
      { t: 'li', text: 'IP：无连接、尽力而为的交付', page: 1 },
      { t: 'li', text: 'ICMP：用于差错报告与网络诊断（ping、traceroute）', page: 1 },
      { t: 'h2', text: '网络接口层', page: 1 },
      { t: 'p', text: '对应 OSI 的数据链路层与物理层，负责在具体链路上传输帧与比特，如以太网、Wi-Fi、PPP。', page: 1 },
      { t: 'h2', text: '数据封装与解封装', page: 1 },
      { t: 'p', text: '发送时数据自上而下逐层加头：应用数据 → TCP 段 → IP 包 → 帧 → 比特。接收时自下而上逐层拆头，最终交给应用进程。', page: 1 },
      { t: 'li', text: '每一层的头部只被对端同层解析，体现“对等通信”', page: 1 },
      { t: 'li', text: 'MTU 限制可能导致 IP 分片，影响性能', page: 1 }
    ];
    return Z.Import.finishDoc(Z.Import.makeDoc({
      title: 'TCP/IP 四层模型',
      type: 'knowledge',
      source: 'demo',
      lang: 'zh',
      blocks,
      cards: [
        { id: Z.uid('card'), kind: 'qa', front: 'TCP/IP 模型分为哪四层？', back: '应用层、传输层、网络层、网络接口层。', due: Date.now() - 1000, interval: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: Date.now() },
        { id: Z.uid('card'), kind: 'qa', front: 'TCP 与 UDP 的核心区别？', back: 'TCP 面向连接、可靠、字节流；UDP 无连接、不可靠、开销小、适合实时场景。', due: Date.now() - 1000, interval: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: Date.now() }
      ]
    }), { forceType: 'knowledge' });
  }

  async function seed() {
    const docs = await Z.DB.allDocs();
    if (docs.length) return false;
    await Z.DB.putDoc(englishDemo());
    await Z.DB.putDoc(knowledgeDemo());
    return true;
  }

  Z.Demo = { seed };
})(window.ZY);
