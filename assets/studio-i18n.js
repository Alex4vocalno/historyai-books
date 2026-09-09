'use strict';
/**
 * studio-i18n.js — 工作台英文化（v4.92 英文版第二期，零重构策略）
 *
 * 与书城同思路：不改既有代码，渲染后按词典确定性替换。差异：工作台是
 * 动态 SPA，故用 MutationObserver 盯新增节点与文本变化；语言=用户偏好
 * （localStorage hai.lang，缺省跟浏览器），右上角可切换。
 *
 * 词典分两层：MAP=精确整串；RULES=带插值的正则整串。都只匹配界面壳——
 * 用户输入、书名、正文（服务端日志按书语言本就双语）不会被误translated，
 * 因为它们不会整串命中词典。
 */
(function () {
  var isBrowser = typeof document !== 'undefined';
  var store = typeof localStorage !== 'undefined' ? localStorage : { getItem: function () { return null; }, setItem: function () {} };
  var nav = typeof navigator !== 'undefined' ? navigator : { language: 'zh' };
  // v4.93 用户定调：语言跟随系统——中文系统才中文，非中文系统一律英文。
  // 手动切换（hai.lang）永远优先于系统判定。
  var lang = store.getItem('hai.lang') || (String(nav.language || '').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en');

  var MAP = {
    '阅读免费。写作、编修使用积分。': 'Reading is free. Credits are for writing and editing.',
    '一个账号，连接阅读与创作。': 'One account for reading and writing.',
    '登录并继续': 'Sign in and continue', '登录 / 注册': 'Sign in / Register',
    '登录后管理邮箱、笔名与写作积分。': 'Sign in to manage your email, pen name and writing credits.',
    '书城与写作工作台': 'Bookstore and writing studio', '进入工作台': 'Open studio',
    '我的主页': 'My page',
    '登录邮箱': 'Sign-in email', '邮箱或原测试账号': 'Email or existing test account',
    '你的公开署名': 'Your public pen name', '确认密码': 'Confirm password', '再次输入密码': 'Repeat your password',
    '使用邮箱登录。原测试账号仍可使用。': 'Sign in with your email. Existing test accounts still work.',
    '邮箱用于登录，笔名用于公开署名。笔名绑定后不可更改。': 'Use your email to sign in and a pen name for publishing. Your pen name cannot be changed later.',
    '请填写笔名、邮箱和至少 8 位密码': 'Enter a pen name, email and password of at least 8 characters.',
    '两次输入的密码不一致': 'The passwords do not match.',
    '尚未设置笔名': 'Pen name not set', '邮箱待绑定': 'Email not linked', '创作者': 'Author',
    '绑定邮箱并激活': 'Link and verify email', '原激活码': 'Original activation code', '设置登录密码': 'Set sign-in password',
    '验证后可用邮箱登录；原有书稿、笔名和积分保持不变。': 'Sign in with your email after verification. Your manuscripts, pen name and credits stay unchanged.',
    '发送验证邮件': 'Send verification email', '邮箱验证码': 'Email verification code', '验证并绑定': 'Verify and link',
    '验证邮件已发送，请输入验证码完成绑定。': 'Verification email sent. Enter the code to finish linking.',
    '邮箱已验证，原有内容已保留。': 'Email verified. Your existing content is preserved.',
    '当前账号不支持绑定新邮箱': 'This account cannot link a new email.', '请先使用账号登录': 'Please sign in with your account first.',
    '当前密码或原激活码不正确': 'Your current password or activation code is incorrect.',
    '该邮箱不可绑定，请使用其他邮箱或找回原账号': 'This email cannot be linked. Use another email or recover the existing account.',
    '发送过于频繁，请稍后再试': 'Too many requests. Please try again later.',
    '在线支付暂未开放，已有积分与兑换码仍可使用。': 'Online payments are not available yet. Existing credits and redemption codes still work.',
    '选择积分套餐': 'Choose a credit pack', '前往测试结账': 'Test checkout', '前往安全结账': 'Secure checkout',
    '购买记录': 'Purchase history', '暂无购买记录': 'No purchases yet', '购买记录暂时无法读取': 'Purchase history is temporarily unavailable.',
    '登录': 'Sign in', '注册': 'Sign up', '找回密码': 'Forgot password',
    '账号名称': 'Username', '至少 8 位': 'At least 8 characters',
    '创建账号': 'Create account', '设置新密码': 'Set new password', '发送重置邮件': 'Send reset email',
    '验证码': 'Verification code', '6 位验证码': '6-digit code', '验证邮箱': 'Verify email', '重新发送验证码': 'Resend code',
    '请输入邮件中的 6 位验证码，有效期 10 分钟。': 'Enter the 6-digit code from your email. It expires after 10 minutes.',
    '创建独立的写作与阅读账号。': 'Create your writing and reading account.',
    '为账号设置一个新密码。': 'Set a new password for your account.',
    '输入注册邮箱，获取密码重置邮件。': 'Enter your account email to request a password reset.',
    '请输入邮箱和 6 位验证码': 'Enter your email and the 6-digit code.',
    '请填写账号、邮箱和至少 8 位密码': 'Enter a username, email and password of at least 8 characters.',
    '请输入注册邮箱': 'Enter your account email.', '新密码至少 8 位': 'Your new password needs at least 8 characters.',
    '账号已创建，验证邮件暂未入队，请稍后重发。': 'Account created, but the email could not be queued. Please resend shortly.',
    '账号已创建，验证邮件已排队，请查收。': 'Account created. Your verification email is queued for delivery.',
    '邮箱尚未验证时，可在此输入验证码或重新发送；已验证账号请直接登录。': 'For an unverified email, enter your code or request a new one here. Otherwise, sign in.',
    '如果邮箱仍待验证，系统会重新发送验证邮件。': 'If your email is awaiting verification, a new email will be sent subject to the resend limits.',
    '验证码无效、已过期或尝试次数过多，请重新获取': 'The code is invalid, expired or has too many failed attempts. Request a new code.',
    '邮件服务暂不可用': 'Email delivery is temporarily unavailable.',
    '密码重置邮件暂不可用，请联系客服': 'Password reset email is unavailable. Please contact support.',
    '如果该邮箱已注册，系统会发送重置邮件。': 'If this email is registered, a password reset email will be sent subject to the resend limits.',
    '密码已更新，请登录。': 'Password updated. Please sign in.',
    '重置链接无效或已过期': 'The reset link is invalid or has expired. Request a new one.',
    '暂时无法发送，请稍后重试': 'Unable to send right now. Please try again later.',
    '每个账号的书稿与积分相互独立；登录后可在账号菜单修改密码、设定笔名。': 'Your manuscripts and credits belong to your account. Manage your password and pen name after signing in.',
    '当前仅开放已有账号登录。': 'Sign-in is currently available to existing accounts only.',
    '积分价格': 'Writing credit pricing', '隐私政策': 'Privacy Policy', '服务条款': 'Terms of Service', '可接受使用政策': 'Acceptable Use Policy',
    '逐条编辑建议': 'Editorial suggestions', '正在读取编辑建议…': 'Loading editorial suggestions…',
    '选择报告': 'Select report', '尚无保存的项目报告': 'No saved project reports',
    '报告编号': 'Report ID', '评测时间': 'Evaluated at', '报告来源': 'Report source',
    '建议与摘录来自所选历史报告；章节入口打开当前工作稿，不保证旧段落仍在原位。': 'Suggestions and excerpts come from the selected historical report. Chapter links open the current working manuscript; passages may have moved.',
    '该报告未保存编辑评审，不代表没有问题': 'No editorial review was saved with this report. This does not mean there are no issues.',
    '该报告未列出逐条建议，不代表全文无问题': 'This report lists no individual suggestions. This does not mean the manuscript is issue-free.',
    '已保存的编辑建议': 'Saved editorial suggestions', '高优先级': 'High priority', '中优先级': 'Medium priority', '低优先级': 'Low priority',
    '优先级未记录': 'Priority not recorded', '建议内容未记录': 'Suggestion text not recorded', '报告摘录': 'Report excerpt',
    '打开对应章节': 'Open corresponding chapter', '章节信息暂不可用': 'Chapter information is unavailable',
    '报告章号无效': 'Invalid chapter number in report', '报告未提供章节位置': 'No chapter location in report',
    '无法唯一匹配当前章节': 'Cannot uniquely match a current chapter', '章节标题已变化，请核对报告': 'Chapter title differs. Check the report.',
    '报告内章节信息不一致': 'Chapter information conflicts within the report',
    '当前章节尚无可读正文': 'This chapter has no readable manuscript yet',
    '编辑建议读取失败，请重试；未触发评测或改稿。': 'Could not load editorial suggestions. Retry; no evaluation or rewrite was started.',
    '评分概览读取失败，仍可查看已保存的编辑建议。': 'Could not load the score overview. Saved editorial suggestions are still available.',
    '对话': 'Conversation', '质量结果': 'Quality results',
    '查看质量结果': 'View quality results', '查看发布历史': 'View publication history', '刷新结果': 'Refresh results',
    '正在读取结果…': 'Loading results…', '读取失败，请重试；现有书稿和发布记录未改变。': 'Could not load results. Retry; your manuscript and releases are unchanged.',
    '编辑评分': 'Editorial score', '规则评分': 'Rule score', '暂无评分': 'No score available',
    '评测进行中': 'Evaluation in progress', '上次评测未完成': 'Last evaluation did not complete', '已有评测记录': 'Evaluation on record', '尚无评测结果': 'No evaluation results yet',
    '报告就绪判定': 'Report readiness', '尚未就绪': 'Not ready', '暂无判定': 'No verdict yet', '记录时间': 'Recorded at',
    '评分来自最近保存的报告；不代表发布后修订稿已重新评测。': 'Scores come from the last saved report; subsequent manuscript revisions may not have been evaluated.',
    '评测轮次': 'Evaluation rounds', '已保存的发布版本': 'Saved publication versions', '尚无发布记录': 'No publication history yet',
    '发布记录保留当时的书名、署名与正文版本。书城链接打开当前公开版本。': 'Records preserve the title, byline and manuscript version at publication. Bookstore links open the current public version.',
    '显示更多版本': 'Show more versions', '发布版本': 'Release version', '正文版本': 'Manuscript version', '打开书城页面': 'Open bookstore page',
    // ── 顶栏 / 左栏 ──
    'EVORON AI 工作台': 'EVORON AI Studio', '让知识相对进化': 'Where knowledge evolves',
    '新建书稿': 'New book', '设定台': 'SETUP AGENT', '虚构作品': 'FICTION', '非虚构作品': 'NONFICTION', '搜索书稿': 'Search books', '正在写作': 'Writing now',
    '书稿视图': 'Book views', '最近': 'Recent', '进行中': 'In progress', '完稿': 'Finished', '归档': 'Archive',
    '书稿工作区': 'Your books', '没有匹配的书稿': 'No matching books',
    '写作中': 'Writing', '已完成': 'Finished', '待继续': 'Paused', '已完成 · 打磨中': 'Finished · polishing',
    '拖动调整书单宽度': 'Drag to resize',
    // ── 用户区 ──
    '客': 'G', '本地用户': 'Local user', '本地版 · 未登录': 'Local · signed out',
    '账号体系即将上线': 'Accounts coming soon',
    '测试账号管理': 'Test accounts', '我的积分': 'My credits', '笔名设定': 'Pen name',
    '修改密码': 'Change password', '个人资料': 'Profile', '即将上线': 'Coming soon', '登出': 'Sign out',
    '服务已连接': 'Service connected', '经典控制台': 'Classic console',
    // Personal account panel
    '账号资料': 'Account profile', '版本信息': 'Version details', '账号中心': 'Account center',
    '关闭书稿列表': 'Close book list', '关闭写作进展': 'Close progress',
    '关闭账号中心': 'Close account center', '账号设置': 'Account settings', '账号安全': 'Security', '积分': 'Credits', '版本': 'Version',
    '登录账号': 'Username', '账号 ID': 'Account ID', '邮箱': 'Email', '未绑定': 'Not linked', '账号类型': 'Account type',
    '超级用户': 'Owner', '创作账号': 'Author', '笔名': 'Pen name', '未设置': 'Not set',
    '笔名已绑定，不可更改。': 'Your pen name is locked and cannot be changed.', '绑定笔名': 'Set pen name', '发布署名': 'Publishing byline',
    '我确认使用此笔名，绑定后不可更改。': 'I confirm this pen name. It cannot be changed once set.',
    '确认绑定': 'Confirm pen name', '请输入笔名并确认绑定规则': 'Enter a pen name and confirm the binding rule.', '笔名已绑定': 'Pen name saved',
    '当前为本机直通模式，没有可在此修改的登录密码。': 'Local owner mode has no login password to change here.',
    '当前密码': 'Current password', '新密码': 'New password', '确认新密码': 'Confirm new password',
    '请输入当前密码': 'Enter your current password.', '新密码至少需要 6 位': 'The new password needs at least 6 characters.',
    '两次输入的新密码不一致': 'The new passwords do not match.', '旧密码不正确': 'The current password is incorrect.',
    '原登录会话已失效，请使用新密码重新登录。': 'Your previous sessions have expired. Sign in with your new password.',
    '重新登录': 'Sign in again', '密码修改成功，请重新登录': 'Password changed. Please sign in again.',
    '积分与流水': 'Credits and history', '累计授予': 'Total granted', '累计消耗': 'Total used', '兑换码': 'Redeem code',
    '购买积分': 'Buy credits', '购买积分 · 测试环境': 'Buy credits · Test mode', '购买': 'Buy',
    '测试交易，不产生真实扣款。': 'Test transaction. No real charge.',
    '一次性购买，无自动续费。适用税费以结账页为准。': 'One-time purchase. No auto-renewal. Applicable tax is shown at checkout.',
    '正在查询付款结果…': 'Checking payment status…', '查询付款结果': 'Check payment status',
    '付款已确认，积分已到账': 'Payment confirmed. Credits added.', '已退款，积分已调整': 'Refunded. Credits adjusted.',
    '已部分退款，积分已调整': 'Partially refunded. Credits adjusted.', '退款处理中': 'Refund processing',
    '订单创建未完成，尚未确认付款': 'Checkout was not completed. Payment is not confirmed.',
    '尚未收到付款确认，积分未入账。可稍后查询，无需重复付款。': 'Payment confirmation is pending. Check again later; do not pay twice.',
    '未能查询到本账号的订单，请稍后重试或联系支持。': 'Could not find this order for your account. Retry later or contact support.',
    '付款结果暂时无法查询，请稍后重试，勿重复付款。': 'Payment status is temporarily unavailable. Retry later; do not pay twice.',
    '积分套餐暂时无法读取，请稍后重试。': 'Credit packs are temporarily unavailable. Please try again later.',
    '兑换积分': 'Redeem credits', '请输入兑换码': 'Enter a redeem code.', '兑换成功，余额已重新读取': 'Code redeemed. Your balance is up to date.',
    '最近 50 条积分流水': 'Recent credit entries (up to 50)', '暂无积分流水': 'No credit entries yet',
    '流水记录积分授予与调整；剩余积分以当前余额为准。': 'Entries record credit grants and adjustments. Available credits are shown in the current balance.',
    '积分授予': 'Credit grant', '积分调整': 'Credit adjustment', '兑换入账': 'Code redeemed', '退款调整': 'Refund adjustment',
    '购买入账': 'Purchase', '积分变动': 'Credit change', '时间未记录': 'Time not recorded', '暂不可用': 'Unavailable', '不限额度': 'Unlimited',
    '正在读取账号…': 'Loading account...', '登录已失效，请重新登录': 'Your session has expired. Please sign in again.',
    '更新来源': 'Update source', 'GitHub 正式版本': 'GitHub release', '查看版本说明': 'Release notes', '工作台': 'Studio',
    '读取超时，请重试': 'Loading timed out. Please try again.', '重新读取': 'Reload', '读取失败': 'Could not load', '正在提交…': 'Submitting...',
    '操作未成功，请检查后重试': 'The operation failed. Check your details and try again.',
    '操作已成功，但最新资料读取失败。请重新打开面板核对，无需重复提交。': 'The change succeeded, but updated details could not be loaded. Reopen this panel to check; do not submit again.',
    '未收到确认，请先核对结果，勿立即重复提交。': 'No confirmation received. Check the result before submitting again.',
    // ── 中栏 / 对话 ──
    '设定 Agent': 'Setup Agent', '书稿规划模式': 'Book planning', '项目控制台': 'Project console', '虚构作品控制台': 'Fiction console', '非虚构作品控制台': 'Nonfiction console',
    '写作任务与状态': 'Tasks & status', '你': 'You', '项目助手': 'Assistant', '系统': 'System', '流水线': 'Pipeline', '引擎': 'Engine', '发布': 'Publish',
    'Enter 发送 · Shift + Enter 换行': 'Enter to send · Shift+Enter for newline', '发送': 'Send',
    '在下方输入你想写的书，剩下的交给写作引擎': 'Describe the book you want below — the engine does the rest',
    '对话完成设定': 'Plan by chat', '引擎自动写作': 'Engine writes', '阅读与发布': 'Read & publish',
    '描述你想写的一本书，或继续完善书名、书型、风格与规模…': 'Describe a book you want, or refine its title, form, style and scale…',
    '问我这本书的进度、大纲、章节状态或下一步怎么走…': 'Ask about progress, outline, chapters, or what to do next…',
    '设定 Agent 将把写作目标整理成完整书稿设定': 'The Setup Agent turns your goal into a complete book plan',
    '设定草案': 'Draft plan', '开始交流后，书稿设定会在这里同步整理。': 'Your book plan will assemble here as you chat.',
    '开始对话后，设定草案会实时出现在这里。': 'The draft plan appears here as you chat.',
    '设定 Agent 思考中…': 'Setup Agent is thinking…', '正在查阅项目状态账…': 'Checking the project ledger…',
    '采用这套方案': 'Use this plan', '采用失败': 'Could not apply',
    '✓ 确认设定，建项开写': '✓ Confirm & start writing',
    '设定已齐备。点上方「确认设定，建项开写」即开始写作；也可以继续调整。': 'All set. Click “Confirm & start writing” above — or keep refining.',
    '会话创建失败：': 'Could not create session: ', '本轮交流失败，草案已保留，可重试。': 'That turn failed — your draft is saved, try again.',
    '确认失败': 'Confirm failed', '设定已确认，正在创建书稿项目…': 'Confirmed — creating your book project…', '建项失败：': 'Could not create project: ',
    // ── 弹门 / 动作 ──
    '◈ 等待你拍板': '◈ Your call', '批准继续': 'Approve & continue', '重写本章': 'Rewrite chapter',
    '跳过本阶段': 'Skip stage', '🚀 全自动写完全书': '🚀 Auto-write the whole book',
    '📝 逐章确认推进': '📝 Chapter-by-chapter', '↻ 重写大纲': '↻ Rewrite outline',
    '▶ 开始写作': '▶ Start writing', '▶ 继续写作': '▶ Continue writing',
    '▶ 继续当前阶段': '▶ Resume stage', '▶ 继续全文后处理': '▶ Resume postprocess',
    '⚖ 发行评测': '⚖ Release evaluation', '↻ 重跑全文后处理': '↻ Re-run postprocess',
    '已开始写作': 'Writing started', '已从中断处继续': 'Resumed from interruption',
    '发行评测已启动，评分轮次与判定会实时显示在本对话中。': 'Release evaluation started — rounds and verdicts will appear in this chat.',
    '已按终稿状态重启后处理（高风险操作已确认）': 'Postprocess restarted (high-risk action confirmed)',
    // ── 活动词 / 阶段条 ──
    '写作中': 'Writing', '编修中': 'Editing', '润色中': 'Polishing', '校勘中': 'Proofreading',
    '整理中': 'Finishing', '研究中': 'Researching', '构思中': 'Planning', '思考中': 'Thinking',
    '等待你拍板': 'Waiting for you',
    '研究': 'Research', '大纲': 'Outline', '正文': 'Writing', '编修': 'Edit', '润色': 'Polish', '校勘': 'Proof', '整理': 'Finish',
    // ── 右栏 ──
    '写作进展': 'Progress', '成书总结': 'Book summary', '成书总结 · 编修打磨中': 'Book summary · polishing',
    '选中一本书后，这里实时直播它的正文流。': 'Pick a book to watch its prose stream live.',
    '阅读与导出': 'Read & export', '在线阅读': 'Read online', '历史大纲': 'Outline',
    '查看全书结构': 'Book structure', '章节蓝图': 'Chapter blueprints', '查看写作委托': 'Narrative design',
    '正式正文': 'Manuscript', '阅读精编书稿': 'Read the final text', '发布电子书': 'Publish e-book',
    '更新电子书': 'Update e-book', '实时进展': 'Live progress', '写作委托': 'Commission',
    '进入发布中心': 'Open publish center', '下载文件': 'Downloads', 'Word 文档': 'Word document',
    '精排 DOCX': 'Formatted DOCX', '结构化正文': 'Structured text', '纯文本': 'Plain text', 'TXT 正文': 'TXT manuscript',
    '完成全书写作后开放': 'Opens when the book is finished', '运行发行评测后开放': 'Opens after release evaluation',
    '纲': 'O', '策': 'B', '文': 'M',
    // ── 完稿总结 ──
    '恭喜，书稿已经完成！': 'Congratulations — your book is finished!',
    '🚀 发布电子书': '🚀 Publish e-book', '完整章节': 'Chapters', '正文总量': 'Total length',
    '平均每章': 'Avg per chapter', '从建项到完本': 'Start to finish', '写作语言': 'Language',
    '书稿类型': 'Genre', '写作风格': 'Style', '完成时间': 'Finished at',
    '正文与全文后处理已完成': 'Manuscript and postprocess complete',
    '全书编修打磨中 · 不影响已发布版本': 'Whole-book polishing · published version unaffected',
    '中文': 'Chinese', '历史非虚构': 'History nonfiction', '项目设定': 'Per project settings', '未记录': 'Not recorded',
    '正式正文已经进入可阅读、可下载和可发布状态。下方入口分别提供在线阅读、精排 Word、Markdown、纯文本与电子书发布。': 'The manuscript is ready to read, download and publish — use the entries below.',
    '手机可长按图片保存到相册': 'Long-press the image to save it',
    // ── 用户区动态串（v4.93.1 实弹补齐）──
    '超级用户 · 本机直通': 'Owner · local direct', '超级用户 · 已登录': 'Owner · signed in',
    '本机已直通超级用户，无需登录': 'Local owner mode — no sign-in needed',
    '本机直通模式无会话可登出': 'Local owner mode has no session to sign out',
    '积分信息读取失败': 'Could not load credit balance',
    '测试账号管理': 'Test accounts',
    '还没有测试账号。': 'No test accounts yet.',
    '充值失败': 'Top-up failed', '已复制': 'Copied', '回到书城': 'Back to the bookstore', '个人主页 · 书架': 'My page · Shelf',
    // ── 登录页 ──
    '登录 · EVORON AI': 'Sign in · EVORON AI', 'EVORON AI 写作台': 'EVORON AI Studio',
    '输入账号密码进入你的写作空间。': 'Enter your account to open your writing space.',
    '账号': 'Account', '密码': 'Password', '进入写作台': 'Enter the studio',
    '没有账号？请联系管理员开通。每个账号的书稿与积分相互独立；登录后可在账号菜单修改密码、设定笔名。': 'No account? Ask the admin. Each account has its own books and credits; you can change your password and pen name after signing in.',
    '由管理员创建': 'created by the admin', '初始密码由管理员发放': 'initial password issued by the admin',
    '请输入账号和密码': 'Enter your username and password', '登录失败': 'Sign-in failed', '网络错误：': 'Network error: ',
    // ── 发布中心（核心壳）──
    '发布中心': 'Publish center', '保存草稿': 'Save draft', '确认发布': 'Publish now',
    '需先完成发行评测': 'Release evaluation required',
    '书名': 'Title', '副标题': 'Subtitle', '作者': 'Author', '简介': 'Description',
    '分类': 'Category', '标签': 'Tags', '封面': 'Cover', '重新生成封面': 'Regenerate cover',
    '发布历史': 'Release history', '打开': 'Open', '已发布': 'Published', '草稿': 'Draft',
    '发布会创建独立版本，不修改写作项目。修改后再次发布时会更新原作品（书城地址与二维码不变），不会新增一本。': 'Publishing creates an immutable release without touching the writing project. Re-publishing after edits updates the same book — its URL and QR stay unchanged.',
    // ── v5.70 界面英文化大补：v4.92 之后新功能全量补翻 ──
    // 左栏 / 状态
    '书稿列表': 'Book list', '书稿管理': 'Book actions', '筹备新书': 'New book setup', '新书筹备': 'New book setup',
    '设定中 · 聊齐即可开写': 'Planning · chat until ready', '已归档': 'Archived', '已完成 · 评测中': 'Finished · evaluating',
    '处理中': 'Working', '关闭': 'Close', '拖动调整宽度': 'Drag to resize', '当前版本': 'Version',
    '在当前章节边界优雅暂停；进度全部保留，可随时继续写作': 'Pause gracefully at the chapter boundary; all progress is kept and writing can resume anytime',
    '把这条要求排队为写作指令：下一章开写时注入写作提示，一次性生效': 'Queue this as a writing instruction — injected into the next chapter once',
    '⏸ 暂停': '⏸ Pause',
    // 委托标签页
    '核心问题': 'Core question', '核心论点': 'Core thesis',
    '范围': 'Scope', '主要矛盾': 'Central tension', '写作重点': 'Writing focus', '创意核心': 'Creative core',
    '书型': 'Book type', '作品类型': 'Book class', '内容品类': 'Category', '成书样态': 'Book form', '题材': 'Genre', '笔法': 'Style', '目标规模': 'Target length',
    '每章': 'Per chapter', '章数': 'Chapters', '事实边界': 'Fact boundary',
    '考据强度': 'Research rigor', '虚构': 'Fiction', '非虚构': 'Nonfiction', '小说': 'Novel', '历史书': 'History book', '严格非虚构': 'Strict nonfiction', '这本书没有留下文字委托。': 'This book has no written commission.',
    '这本书没有留下文字委托（早期小说建项未存创意核心；题材、笔法、样态与规模见上方）。': 'No written commission on file (early novel projects did not store the creative core; genre, style, form and scale are above).',
    // 归档 / 书稿管理菜单
    '📥 归档收起': '📥 Archive', '📤 恢复到写作区': '📤 Restore to workspace', '🗑 删除书稿': '🗑 Delete book',
    '已归档收起，可在左栏「已归档」分组找回。': 'Archived — find it under “Archived” in the left rail.',
    '已恢复到写作区。': 'Restored to the workspace.', '书名不匹配，已取消删除。': 'Title did not match — deletion cancelled.',
    '把这本书归档收起？它会折进左栏「已归档」分组，随时可恢复；书稿与已发布版本都不受影响。': 'Archive this book? It folds into the “Archived” group in the left rail and can be restored anytime; the manuscript and published releases are untouched.',
    // 账户菜单 / 兑换 / 管理台
    '账号管理': 'Accounts', '运营管理台': 'Ops console', '剩余积分': 'Remaining credits', '兑换码充值': 'Redeem code',
    '输入兑换码（形如 EV-XXXX-XXXX）：': 'Enter a redeem code (like EV-XXXX-XXXX):',
    '兑换失败': 'Redeem failed', '当前密码：': 'Current password:', '新密码（至少 6 位）：': 'New password (6+ characters):',
    '密码已修改': 'Password changed', '修改失败': 'Change failed',
    '设定笔名（发布署名用，一经设定不可更改）：': 'Set your pen name (publishing byline, cannot be changed later):',
    '设定失败': 'Could not set',
    // 阅读与导出 / 发布动作区
    '成书发布': 'Publish', '进入发布中心，生成封面与书城页面': 'Open the publish center — cover and store page',
    '编修书稿': 'Edit manuscript', '正文·标题·插图可改，不改可直接发布': 'Edit text, titles & art — or publish as is',
    '编辑本章正文': 'Edit this chapter',
    // 编修书稿页（editor.html）
    '返回工作台': 'Back to studio', '章节标题': 'Chapter title', '保存本章修订': 'Save chapter revision',
    '保存中…': 'Saving…', '有未保存的修订': 'Unsaved revisions', '（未命名）': '(untitled)',
    '还没有可编修的正式正文。': 'No manuscript to edit yet.', '缺少 projectId。': 'Missing projectId.',
    '重画要求（可留空，按张计积分）：': 'Redraw instructions (optional; billed per image):',
    '重画中，约需十几秒…': 'Redrawing — about 10–20 seconds…', '已弃用，成书已同步': 'Removed — the book is updated',
    '已恢复采用': 'Restored', '已重画': 'Redrawn', '操作失败': 'Action failed', '操作失败（网络错误）': 'Action failed (network error)',
    '当前章有未保存的修订，切换将丢弃。确定切换？': 'This chapter has unsaved revisions that will be lost. Switch anyway?',
    '读取章节失败': 'Could not load the chapter', '章题保存失败': 'Could not save the title', '正文保存失败': 'Could not save the text',
    '本章修订已保存。已发布的书回工作台点「更新电子书」生效。': 'Chapter revision saved. For published books, click “Update ebook” in the studio to go live.',
    '保存失败（网络错误）': 'Save failed (network error)', '书名已更新': 'Title updated', '书名保存失败': 'Could not save the title',
    '书稿': 'Manuscript', '弃用': 'Remove', '重画': 'Redraw', '恢复采用': 'Restore', '取消': 'Cancel',
    '本章插图（弃用即从成书移除；重画按张计积分）': 'Chapter illustrations (removing updates the book; redraws are billed per image)',
    '正文·标题·插图可改；不改也可直接发布。已发布的书改完回工作台点「更新电子书」生效。': 'Edit text, titles and art — or publish as is. For published books, click “Update ebook” in the studio after editing.',
    '插图修改在本书对话里回复「配图」。': 'For illustrations, reply “配图” in the book chat.',
    '修订不影响发行评测；保存后已发布的书需「更新电子书」生效。插图修改在本书对话里回复「配图」。': 'Revisions never expire the release evaluation. Published books need “Update ebook” after saving. For illustrations, reply “配图” in the book chat.',
    '保存修订': 'Save revision',
    // 发布中心（publish.js 动态区）
    '请求失败': 'Request failed', '成品封面': 'Final cover', '图片通道': 'Image channel', '未记录模型': 'model not recorded',
    '尚未生成': 'Not generated yet', '未命名作品': 'Untitled work', '作者待填写': 'Author TBD', '历史': 'History',
    '暂无内容简介。': 'No description yet.', '当前正文': 'Current manuscript', '发布预览': 'Publish preview',
    '书籍详情预览': 'Book page preview', '可选': 'optional', '填写公开署名': 'public byline',
    '用逗号分隔，最多 6 个': 'comma-separated, up to 6', '内容简介': 'Description', '公开': 'Public',
    '人物传记': 'Biography', '文化史': 'Cultural history', '科技史': 'History of science', '商业史': 'Business history',
    '政治军事': 'Politics & war', '社会文化': 'Society & culture',
    '封面由 AI 画师按书籍内容执笔（2K、2:3 出版比例），成品自带书名排版并经逐字质检。个别画面触发安全策略时，会自动改为无字画面并由系统排上真实书名与作者。': 'Covers are painted by an AI artist from the book itself (2K, 2:3). The finished cover carries typeset title text verified glyph by glyph; if a scene trips safety policies, a textless painting is used and the real title and author are typeset by the system.',
    '书名已改：封面上还是旧书名，请点「重新生成封面」后再发布。': 'The title changed but the cover still shows the old one — click “Regenerate cover” before publishing.',
    '已保存并设为默认作者': 'Saved as your default byline', '发布草稿已保存': 'Draft saved',
    '缺少 projectId，请从写作台进入发布中心': 'Missing projectId — open the publish center from the studio',
    '请先在工作台绑定笔名': 'Bind a pen name in the studio first', '需先绑定笔名': 'Pen name required',
    '发布署名=你的笔名，在工作台左下角头像菜单「笔名设定」里绑定（一经设定不可更改）': 'Your byline is your pen name — set it in the studio avatar menu (“Pen name”, cannot be changed later)',
    '发布需要笔名署名：回工作台点左下角头像菜单里的「笔名设定」绑定笔名后再发布。': 'Publishing needs a pen name byline — set it in the studio avatar menu, then publish.',
    '书稿尚未完成': 'The book is not finished yet', '先跑发行评测（点此启动）': 'Run the release evaluation first (click to start)',
    '发行评测启动中…': 'Starting the release evaluation…', '发行评测进行中，完成后回来发布': 'Evaluation running — come back to publish after it finishes',
    '发行评测已启动：评分轮次会实时显示在写作台对话中，拿到编辑评测报告后回本页即可发布。': 'Release evaluation started — rounds appear live in the studio chat; come back here with the editorial report to publish.',
    '评测启动失败，请回写作台点「⚖ 发行评测」。': 'Could not start the evaluation — use “⚖ Release evaluation” in the studio.',
    '发布前必须完成发行评测——点发布按钮即可一键启动。': 'A release evaluation is required before publishing — the publish button starts it in one click.',
    '正在生成书籍信息…': 'Generating book metadata…', '书籍信息生成失败：': 'Metadata generation failed: ',
    'AI 画师执笔中——正在为这本书画封面…': 'The AI artist is painting your cover…', '封面生成失败：': 'Cover generation failed: ',
    '保存中': 'Saving', '生成简介中': 'Writing the description', '简介与分类已生成': 'Description and category generated',
    '生成封面中': 'Painting the cover', '已生成演示封面，请在模型设置中启用图片模型': 'Demo cover generated — enable an image model in settings for real covers',
    '成品封面已生成，并已同步到公开电子书': 'Final cover generated and synced to the published book',
    '成品封面已生成，发布后会自动进入书库': 'Final cover generated — it ships with the book on publish',
    '成品封面已生成': 'Final cover generated',
    '确认把当前正文版本发布为公开电子书？发布不会修改书稿。': 'Publish the current manuscript as a public ebook? Publishing never modifies the manuscript.',
    '发布中': 'Publishing', '电子书已发布': 'Ebook published', '加载失败': 'Could not load',
    '尚未评测': 'Not evaluated', '尚未发布。': 'Not published yet.',
    '论证': 'Argument', '洞见': 'Insight', '体验': 'Experience', '样态': 'Form', '场景': 'Scene', '对白': 'Dialogue', '人物': 'Characters', '节奏': 'Pacing',
    // ── v5.76 英文工作流补洞：小说线阶段标签 + 服务器回执 ──
    '章节写作': 'Chapter writing', '章节规划': 'Chapter planning', '分卷规划': 'Volume planning',
    '大纲修订': 'Outline revision', '全书编修': 'Whole-book edit', '全书综合编修': 'Whole-book comprehensive edit',
    '全书文学润色': 'Whole-book literary polish', '全书审读': 'Whole-book proofread',
    '已开始小说写作': 'Novel writing started', '已开始历史大纲': 'Outline started', '已在运行': 'Already running',
    '已在边界暂停，进度已保留，随时可继续': 'Paused at the chapter boundary — progress kept, resume anytime',
    '未在运行': 'Not running', '已停止': 'Stopped',
  };

  var RULES = [
    [/^重新发送（(\d+)s）$/, 'Resend in $1s'],
    [/^(.*) · 已验证$/, '$1 · Verified'],
    [/^(.*) · 未验证$/, '$1 · Unverified'],
    [/^另有 (\d+) 本，使用搜索查找$/, 'And $1 more — use search'],
    [/^方案 ([A-Z]) · /, 'Option $1 · '],
    [/^已采用「(.+)」，可继续微调或直接确认开写。$/, 'Applied “$1” — refine further or confirm to start.'],
    [/^还差 (\d+) 项才能开写：/, '$1 item(s) missing before writing: '],
    [/^第(\d+)章：/, 'Ch. $1: '],
    [/^拍板：(.+)$/, function (m, x) { return 'Decision: ' + (MAP[x] || x); }],
    [/^拍板未生效：/, 'Decision not applied: '],
    [/^正文 (\d+)\/(\d+) 章$/, 'Writing $1/$2'],
    [/^(\d+) \/ (\d+) 章$/, '$1 / $2 chapters'],
    [/^([\d,.]+) 字$/, '$1 chars'],
    [/^([\d,.]+) (words|字)$/, '$1 $2'],
    [/^(\d+) 小时 ?(\d*) ?分?钟?$/, function (m, h, mi) { return h + ' h' + (mi ? ' ' + mi + ' min' : ''); }],
    [/^(\d+) 分钟$/, '$1 min'],
    [/^(\d+) 天 ?(\d*) ?小?时?$/, function (m, d, h) { return d + ' d' + (h ? ' ' + h + ' h' : ''); }],
    [/^恭喜！书稿已完成写作与发行评测（编辑分 (\d+)）。$/, 'Congratulations! Writing and release evaluation are complete (editorial score $1).'],
    [/^现在可以把它发布成电子书，上架 EVORON AI 书城。$/, 'You can now publish it to the EVORON AI bookstore.'],
    [/进入发布中心（编辑分 (\d+)）$/, 'Open publish center (score $1)'],
    [/^失败：/, 'Failed: '],
    [/^测试账号 · 积分 ([\d.]+)$/, 'Tester · $1 credits'],
    [/^积分 ([\d.]+)$/, '$1 credits'],
    [/^([\d,]+) 积分$/, '$1 credits'],
    [/^购买 ([\d,]+) 积分，(.+)$/, 'Buy $1 credits, $2'],
    [/^余额 ([\d.]+) 积分（授予 ([\d.]+)，已用 ([\d.]+)）。积分不足请联系管理员充值。$/, 'Balance $1 credits (granted $2, used $3). Contact the admin to top up.'],
    [/^超级用户不限积分（累计消耗 ([\d.]+) 积分当量）$/, 'Owner has unlimited credits (≈$1 consumed).'],
    [/ · 超级用户/, ' · Owner'],
    [/ · 笔名「(.+)」$/, ' · pen name “$1”'],
    [/^已充值，当前授予 ([\d.]+) 积分$/, 'Topped up — $1 credits granted.'],
    // ── v5.70 界面英文化大补 ──
    [/^虚构 · (.+)$/, function (m, x) { return 'Fiction · ' + (MAP[x] || x); }],
    [/^小说 · (.+)$/, function (m, x) { return 'Novel · ' + (MAP[x] || x); }],
    [/^归档失败：(.*)$/, 'Could not archive: $1'],
    [/^恢复失败：(.*)$/, 'Could not restore: $1'],
    [/^删除失败：(.*)$/, 'Could not delete: $1'],
    [/^兑换成功：\+(\d+) 积分（当前授予 ([\d.]+)）$/, 'Redeemed — +$1 credits (granted total $2)'],
    [/^删除后书稿数据不可恢复（已发布到公开站的版本不受影响）。\n如确认删除，请输入书名：(.+)$/, 'Deletion is permanent (published releases are unaffected).\nType the book title to confirm: $1'],
    [/^笔名已绑定为「(.+)」，不可更改$/, 'Pen name is locked as “$1” and cannot be changed'],
    [/^笔名「(.+)」绑定成功$/, 'Pen name “$1” is set'],
    [/^第 (\d+) 章 · ([\d,.]+) 字$/, 'Chapter $1 · $2 chars'],
    [/^第(\d+)章 (.*)$/, 'Ch. $1 $2'],
    [/^编辑 第(\d+)章$/, 'Edit chapter $1'],
    [/^编修 · (.+)$/, 'Edit · $1'],
    [/^第 (\d+) 章已保存（([+-]?\d+) 字）。已发布的书需重新发布电子书生效。$/, 'Chapter $1 saved ($2 chars). Published books need a re-publish to go live.'],
    [/^(\d+) 章$/, '$1 chapters'],
    [/^(\d+)\/(\d+) 章 · ([\d,.]+) (.+)$/, '$1/$2 chapters · $3 $4'],
    [/^书稿还没写完（正式正文 (\d+)\/(\d+) 章）。完成全书写作与编修后再来发布。$/, 'The book is unfinished ($1/$2 chapters of final text). Finish writing and editing before publishing.'],
    [/^([\d.]+)\/100 编辑评测$/, '$1/100 editorial score'],
    [/^存在上一版 ([\d.]+) 分评测，但与当前正文版本不一致，本次不会公开该分数。$/, 'A previous $1-point evaluation exists but no longer matches the current manuscript — it will not be shown this time.'],
    // ── v5.76 英文工作流补洞：队列回执/进度聚合行 ──
    [/^写作已排队（第 (\d+) 位），前面的书完成后自动开始$/, 'Queued for writing (position $1) — starts automatically when a slot frees up'],
    [/^章节委托书推进到第 (\d+) 章（逐章充实中）$/, 'Chapter briefs advanced to chapter $1 (enriching chapter by chapter)'],
    [/^已从中断处继续（(.+)）$/, 'Resumed from interruption ($1)'],
  ];

  function trText(text) {
    var s = String(text);
    var trimmed = s.trim();
    if (!trimmed || !/[一-鿿]/.test(trimmed)) return s;
    var hit = MAP[trimmed];
    if (hit != null) return s.replace(trimmed, hit);
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][0].test(trimmed)) {
        var out = trimmed.replace(RULES[i][0], RULES[i][1]);
        return s.replace(trimmed, out);
      }
    }
    return s;
  }

  // 测试暴露（Node 契约测试用）
  if (typeof module !== 'undefined' && module.exports) module.exports = { trText: trText, MAP: MAP, RULES: RULES };
  if (typeof window !== 'undefined') window.__haiI18n = { lang: lang, trText: trText };
  if (!isBrowser) return;

  // ── 语言切换按钮（两种语言都显示，切换即刷新）──
  function mountToggle() {
    var existingToggle = document.getElementById('langToggle');
    var btn = existingToggle || document.createElement('button');
    btn.id = 'langToggle';
    btn.type = 'button';
    btn.textContent = lang === 'en' ? '中文' : 'EN';
    btn.title = lang === 'en' ? '切换到中文' : 'Switch to English';
    btn.onclick = function () {
      store.setItem('hai.lang', lang === 'en' ? 'zh' : 'en');
      store.setItem('hai.shelfLang', lang === 'en' ? 'zh' : 'en');
      location.reload();
    };
    if (existingToggle) return;
    // v4.93.1 用户定调：统一放左下角。工作台挂进用户资料栏（#userRow 上方），
    // 其他页（登录/发布中心）固定左下。
    var userRow = document.getElementById('userRow');
    if (userRow && userRow.parentNode) {
      btn.style.cssText = 'display:block;width:calc(100% - 20px);margin:0 10px 6px;height:26px;border:1px solid #d5dae0;border-radius:13px;background:#fff;color:#555;font-size:12px;font-weight:700;cursor:pointer';
      userRow.parentNode.insertBefore(btn, userRow);
    } else {
      btn.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:80;min-width:44px;height:26px;border:1px solid #d5dae0;border-radius:13px;background:#fff;color:#555;font-size:12px;font-weight:700;cursor:pointer;opacity:.9';
      document.body.appendChild(btn);
    }
  }

  function trAttrs(el) {
    if (!el || !el.getAttribute) return;
    if (el.id === 'langToggle') return; // 切换按钮的中文提示是刻意的，跳过
    var attrs = ['placeholder', 'title', 'aria-label'];
    for (var i = 0; i < attrs.length; i++) {
      var v = el.getAttribute(attrs[i]);
      if (!v || !/[一-鿿]/.test(v)) continue;
      var t = trText(v);
      // v4.93.2 死循环实弹：词典翻不动的中文属性若原值写回，setAttribute 仍
      // 触发 mutation 记录→观察器再进→无限循环→页面无响应。值未变绝不写回。
      if (t !== v) el.setAttribute(attrs[i], t);
    }
  }
  function walk(node) {
    if (!node) return;
    var element = node.nodeType === 1 ? node : node.parentElement;
    if (element && element.closest('[translate="no"]')) return;
    if (node.nodeType === 3) { // 文本节点
      if (/[一-鿿]/.test(node.nodeValue)) {
        var t = trText(node.nodeValue);
        if (t !== node.nodeValue) node.nodeValue = t;
      }
      return;
    }
    if (node.nodeType !== 1) return;
    if (node.id === 'input' || node.tagName === 'TEXTAREA' || node.tagName === 'SCRIPT' || node.tagName === 'STYLE') { trAttrs(node); return; }
    trAttrs(node);
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  function boot() {
    mountToggle();
    if (lang !== 'en') return; // 中文=原生，不动
    walk(document.body);
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'characterData') walk(m.target);
        else if (m.type === 'attributes') trAttrs(m.target); // v4.93.1：动态 placeholder 实弹
        else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
