/* nodelib.js v8 — 通用网络安全节点模型库(实心低多边形 + 统一立方体归一化 + 分区底板;概念造型,程序化生成,无外部模型/商标)
   用法: NODELIB.addLights(scene, theme); const n = NODELIB.createNode('firewall', { theme:'dark', size:1 });
         const z = NODELIB.createZone({ title:'安全管理区', w:8, d:6, color:'violet' }); NODELIB.createLink(p1, p2);
         scene.add(n.group); n.setState('attacked'); 每帧 n.update(t);  n.dispose()
   规范数据: NODELIB.SPEC / NODELIB.CATS / NODELIB.CUBE / NODELIB.STATES
   依赖: window.THREE(仅在 createNode 时需要;SPEC 可在无 THREE 的环境读取,用于导出 JSON) */
(function (root) {
'use strict';

/* ---------- 类别与色板 ---------- */
const CATS = {
  /* 夜间色对齐旧图采样(饱和亮蓝/金黄/绿);日间加深一档保证浅底对比 */
  net:    { name: '网络设备',          en: 'Network',            dark: '#1fe85a', light: '#0c7a32', glyph: '◇', target: '#1fd65a' },
  office: { name: '办公设备',          en: 'Office / Endpoint',  dark: '#2f8fff', light: '#1a6fd4', glyph: '▢', target: '#2f8fff' },
  sec:    { name: '安全设备',          en: 'Security',           dark: '#f5c518', light: '#c9a010', glyph: '⛉', target: '#f5c518' },
  srv:    { name: '服务器 / 云',       en: 'Server / Cloud',     dark: '#c9a0ff', light: '#7a48c8', glyph: '☰', target: '#c9a0ff' },
  cn:     { name: '云原生',            en: 'Cloud Native',       dark: '#ff9a3c', light: '#c4600f', glyph: '⬡', target: '#ff9a3c' },
  iot:    { name: '终端 / IoT / 工控',  en: 'IoT / ICS',          dark: '#ff6bcb', light: '#c02098', glyph: '◎', target: '#ff6bcb' },
  ext:    { name: '攻击者 / 外部',      en: 'Threat / External',  dark: '#ff3b4e', light: '#c01830', glyph: '✕', target: '#ff3b4e' },
};
/* 状态色(与事件大全语义色一致) */
const STATE_COL = {
  dark:  { sel: '#ffffff', atk: '#ff2a3c', def: '#22e6ff', bg: '#0b1020', grid: '#1a2438' },
  light: { sel: '#0d1626', atk: '#c4001c', def: '#007f9e', bg: '#d5dee9', grid: '#7a8799' },
};
/* 统一承载立方体:所有模型归一化到边长 CUBE 的包围盒(最长边=1),底面贴地、水平居中。size 仅作整体倍数。 */
const CUBE = 1;
const SIZES = { S: 1, M: 1, L: 1, XL: 1 }; /* 兼容旧调用;实际一律按 1,不再分档 */
const STATES = {
  normal:    { name: '普通',   desc: '分层机身 + 面板/接口/指示灯/散热孔,朗伯+边缘光着色,无地面底座' },
  selected:  { name: '选中',   desc: '模型叠加白色细描边(EdgesGeometry)' },
  attacked:  { name: '被攻击', desc: '模型闪红 + 红色细描边,轻微抖动' },
  protected: { name: '已防护', desc: '青色细描边 + 薄半透明护罩' },
};

/* ---------- 造型 DSL ----------
   每个部件: [形状, 参数, 位置[x,y,z], 旋转[rx,ry,rz]?]
   形状: box[w,h,d] cyl[rt,rb,h,seg] sph[r,ws,hs] cone[r,h,seg] tor[R,r,arc] oct[r] hemi[r] */
const P = (s, a, p, r, tone) => tone ? [s, a, p || [0, 0, 0], r || [0, 0, 0], tone] : [s, a, p || [0, 0, 0], r || [0, 0, 0]];
const PI = Math.PI;

const SPEC = {
  /* ===== 网络设备(绿) ===== */
  router: { cat: 'net', name: '路由器', en: 'Router', size: 'M', abbr: 'RT', role: ['路径', '目标'],
    use: '在不同网段/运营商之间转发数据包、维护路由表。',
    look: '扁平机身 + 后部两根竖直天线,正面一排指示灯。',
    parts: [P('box', [2.2, .5, 1.4], [0, .35, 0]), P('cyl', [.05, .05, 1.3, 6], [-.85, 1.15, -.5]), P('cyl', [.05, .05, 1.3, 6], [.85, 1.15, -.5]),
      ...[-.6, -.3, 0, .3, .6].map(x => P('box', [.12, .08, .04], [x, .4, .72]))], core: [0, .9, 0] },
  switch: { cat: 'net', name: '交换机', en: 'Switch', size: 'M', abbr: 'SW', role: ['路径', '目标'],
    use: '在同一局域网内按 MAC 地址转发,连接大量终端端口。',
    look: '超长 1U 薄机身,正面两排小方口阵列。',
    parts: [P('box', [2.9, .32, 1.1], [0, .26, 0]), ...[...Array(10).keys()].flatMap(i => [P('box', [.16, .07, .04], [-1.2 + i * .267, .32, .57]), P('box', [.16, .07, .04], [-1.2 + i * .267, .2, .57])])], core: [0, .85, 0] },
  coreswitch: { cat: 'net', name: '核心交换机', en: 'Core Switch', size: 'L', abbr: 'CS', role: ['路径', '目标'],
    use: '园区/机房汇聚核心,承载大部分东西向流量。',
    look: '宽机箱,竖直插卡槽位(竖向条纹)+ 顶部风扇格栅。',
    parts: [P('box', [2.0, 1.5, 1.2], [0, .85, 0]), ...[...Array(7).keys()].map(i => P('box', [.06, 1.2, .04], [-.78 + i * .26, .85, .62])), P('cyl', [.3, .3, .06, 12], [-.45, 1.63, 0]), P('cyl', [.3, .3, .06, 12], [.45, 1.63, 0])], core: [0, 2.2, 0] },
  ap: { cat: 'net', name: '无线 AP', en: 'Wireless AP', size: 'S', abbr: 'AP', role: ['路径', '目标'],
    use: '为终端提供 Wi-Fi 接入,常见于办公区与公共区域。',
    look: '细杆上的圆饼形吸顶机身 + 上方两道同心信号弧。',
    parts: [P('cyl', [.08, .08, .95, 6], [0, .48, 0], [0,0,0], 'light'), P('hemi', [.9], [0, 1.0, 0], [0,0,0], 'dark'), P('cyl', [.95, .95, .12, 20], [0, 1.12, 0]), P('tor', [.55, .035, 3.14], [0, 1.28, 0], [0,0,0], 'light'), P('tor', [.95, .035, 3.14], [0, 1.28, 0], [0,0,0], 'light')], core: [0, 1.25, 0] },
  lb: { cat: 'net', name: '负载均衡', en: 'Load Balancer', size: 'M', abbr: 'LB', role: ['路径', '防护'],
    use: '把访问请求分发到多台后端服务器,提高可用性。',
    look: '中心方体 + 一进三出的扇形分叉臂,末端小方块。',
    parts: [P('box', [.9, .7, .9], [0, .45, 0]), P('box', [1.0, .08, .08], [-.95, .45, 0]), P('box', [.3, .3, .3], [-1.55, .45, 0]),
      ...[-.7, 0, .7].flatMap(z => [P('box', [.9, .08, .08], [.85, .45, z * .55], [0, -Math.atan2(z * .55, .85), 0]), P('box', [.3, .3, .3], [1.45, .45, z])])], core: [0, 1.15, 0] },
  dns: { cat: 'net', name: 'DNS 服务', en: 'DNS', size: 'S', abbr: 'DNS', role: ['目标', '路径'],
    use: '把域名解析为 IP 地址,是几乎所有访问的第一步。',
    look: '细高立柱托起一个带经纬线的小地球。',
    parts: [P('cyl', [.22, .32, 1.1, 8], [0, .55, 0]), P('sph', [.55, 10, 8], [0, 1.55, 0]), P('tor', [.62, .025, 2 * PI], [0, 1.55, 0], [PI / 2, 0, 0])], core: [0, 1.55, 0] },

  /* ===== 办公设备(蓝) ===== */
  pc: { cat: 'office', name: '台式电脑', en: 'Desktop PC', size: 'M', abbr: 'PC', role: ['目标', '源'],
    use: '员工日常办公主机,常是钓鱼、勒索的落点。',
    look: '左侧竖立机箱 + 右侧支架显示器。',
    parts: [P('box', [.55, 1.3, 1.1], [-.9, .65, 0]), P('box', [1.5, .95, .08], [.35, 1.15, 0]), P('box', [.1, .5, .1], [.35, .4, 0]), P('box', [.7, .05, .5], [.35, .05, 0])], core: [.35, 1.15, .25] },
  laptop: { cat: 'office', name: '笔记本', en: 'Laptop', size: 'S', abbr: 'NB', role: ['目标', '源'],
    use: '移动办公终端,常在外部网络与内网之间切换。',
    look: '薄底座 + 后仰张开的屏幕,呈打开的书本角度。',
    parts: [P('box', [1.7, .1, 1.15], [0, .1, .1]), P('box', [1.7, 1.05, .06], [0, .62, -.6], [-.3, 0, 0]), P('box', [1.3, .02, .6], [0, .16, .2], [0, 0, 0], 'dark')], core: [0, .7, -.3] },
  printer: { cat: 'office', name: '打印机', en: 'Printer', size: 'M', abbr: 'PR', role: ['目标'],
    use: '共享打印/扫描设备,常被忽视的联网资产。',
    look: '矮胖方机身 + 前伸出纸托盘 + 顶部斜插纸张。',
    parts: [P('box', [1.6, .7, 1.2], [0, .4, 0]), P('box', [1.2, .05, .7], [0, .2, .9]), P('box', [1.1, .9, .03], [0, 1.1, -.35], [-.35, 0, 0], 'light')], core: [0, .95, .3] },
  mobile: { cat: 'office', name: '手机', en: 'Mobile Phone', size: 'S', abbr: 'MB', role: ['目标', '源'],
    use: '移动终端,承载短信验证码、企业 IM 与邮件。',
    look: '直立的细长薄片,略向后倾,顶部听筒缝。',
    parts: [P('box', [.75, 1.5, .1], [0, .8, 0], [-.18, 0, 0]), P('box', [.3, .04, .02], [0, 1.45, .17], [-.18, 0, 0]), P('box', [.9, .08, .5], [0, .04, .1])], core: [0, .8, .3] },
  tablet: { cat: 'office', name: '平板', en: 'Tablet', size: 'S', abbr: 'TB', role: ['目标'],
    use: '会议/展示/移动审批终端。',
    look: '横放大屏薄片,靠在三角支架上明显后仰。',
    parts: [P('box', [1.6, 1.1, .07], [0, .7, 0], [-.55, 0, 0]), P('box', [.1, .7, .1], [0, .35, -.35], [.5, 0, 0]), P('box', [1.0, .05, .3], [0, .05, .3])], core: [0, .8, .25] },
  voip: { cat: 'office', name: 'IP 电话', en: 'IP Phone', size: 'S', abbr: 'VP', role: ['目标'],
    use: '基于网络的语音终端,常见于前台和会议室。',
    look: '斜面楔形底座 + 横卧听筒(两端鼓包)。',
    parts: [P('box', [1.4, .35, 1.0], [0, .3, 0], [-.3, 0, 0]), P('cyl', [.1, .1, 1.3, 8], [0, .65, -.25], [0, 0, PI / 2]), P('box', [.3, .22, .3], [-.6, .6, -.25]), P('box', [.3, .22, .3], [.6, .6, -.25])], core: [0, .5, .3] },

  /* ===== 安全设备(黄) ===== */
  firewall: { cat: 'sec', name: '防火墙', en: 'Firewall', size: 'L', abbr: 'FW', role: ['防护'],
    use: '按策略控制网段之间的流量,是边界的第一道闸门。',
    look: '三层错缝砖墙,砖块交错排列。',
    parts: [...[0, 1, 2].flatMap(r => [...Array(r % 2 ? 4 : 3).keys()].map(i => P('box', [r % 2 ? .52 : .7, .42, .5], [r % 2 ? -.81 + i * .54 : -.72 + i * .72, .24 + r * .46, 0])))], core: [0, 1.8, 0] },
  waf: { cat: 'sec', name: 'Web 应用防火墙', en: 'WAF', size: 'M', abbr: 'WAF', role: ['防护'],
    use: '在 Web 应用前检查 HTTP 请求,拦截注入、XSS 等。',
    look: '竖立的六边形盾牌板 + 板前一个网页窗口框。',
    parts: [P('cyl', [1.0, 1.0, .14, 6], [0, 1.05, -.2], [PI / 2, 0, 0]), P('box', [.9, .65, .06], [0, 1.05, .1]), P('box', [.9, .1, .06], [0, 1.32, .12]), P('box', [.6, .06, .5], [0, .03, 0])], core: [0, 1.05, .4] },
  idsips: { cat: 'sec', name: 'IDS / IPS', en: 'IDS / IPS', size: 'M', abbr: 'IPS', role: ['防护'],
    use: '检测(IDS)或在线阻断(IPS)可疑流量与攻击特征。',
    look: '立杆上朝上的雷达碟面 + 中心接收针。',
    parts: [P('cyl', [.08, .2, .9, 6], [0, .45, 0]), P('cone', [1.0, .45, 20], [0, 1.15, 0], [PI, 0, 0]), P('cyl', [.03, .03, .6, 4], [0, 1.4, 0]), P('sph', [.09, 6, 4], [0, 1.72, 0])], core: [0, 1.1, 0] },
  bastion: { cat: 'sec', name: '堡垒机', en: 'Bastion Host', size: 'M', abbr: 'BH', role: ['防护'],
    use: '运维统一入口,集中认证、授权与操作审计。',
    look: '宽矮台基上的方形塔楼,顶部四角城垛,台基正面一扇门。',
    parts: [P('box', [1.6, .5, 1.6], [0, .25, 0]), P('box', [.8, 1.5, .8], [0, 1.25, 0]), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => P('box', [.22, .26, .22], [a * .29, 2.13, b * .29])), P('box', [.3, .38, .03], [0, .19, .81])], core: [0, 1.3, .45] },
  honeypot: { cat: 'sec', name: '蜜罐', en: 'Honeypot', size: 'S', abbr: 'HP', role: ['防护', '目标'],
    use: '故意暴露的诱饵系统,用来发现与记录攻击行为。',
    look: '矮胖圆罐 + 宽口沿圆环 + 斜插的勺柄。',
    parts: [P('sph', [.8, 14, 10], [0, .7, 0]), P('tor', [.5, .07, 2 * PI], [0, 1.38, 0], [PI / 2, 0, 0]), P('cyl', [.04, .04, 1.2, 4], [.3, 1.6, 0], [0, 0, -.5])], core: [0, .7, 0], squash: [1, .8, 1] },
  soc: { cat: 'sec', name: '态势感知 / SOC', en: 'SOC / Situational Awareness', size: 'XL', abbr: 'SOC', role: ['防护'],
    use: '集中采集日志与告警,分析研判与响应调度。',
    look: '长桌面上三块弧形排列的大屏幕墙。',
    parts: [P('box', [2.8, .08, .9], [0, .6, .3]), P('box', [.1, .6, .1], [-1.2, .3, .3]), P('box', [.1, .6, .1], [1.2, .3, .3]),
      P('box', [1.0, .75, .05], [0, 1.25, -.2]), P('box', [1.0, .75, .05], [-.95, 1.25, -.02], [0, .45, 0]), P('box', [1.0, .75, .05], [.95, 1.25, -.02], [0, -.45, 0])], core: [0, 1.25, .2] },
  vpngw: { cat: 'sec', name: 'VPN 网关', en: 'VPN Gateway', size: 'M', abbr: 'VPN', role: ['防护', '路径'],
    use: '为远程用户/分支建立加密隧道接入内网。',
    look: '低矮机身上横跨一道半圆隧道拱门。',
    parts: [P('box', [1.8, .35, .9], [0, .2, 0]), P('tor', [.75, .12, PI], [0, .38, 0]), P('tor', [.5, .04, PI], [0, .38, 0])], core: [0, .65, 0] },
  behavior: { cat: 'sec', name: '上网行为管理', en: 'Secure Web Gateway', size: 'M', abbr: 'SWG', role: ['防护'],
    use: '对员工上网流量做分类、审计与访问控制。',
    look: '倒置漏斗(上宽下窄)+ 下方细出口管。',
    parts: [P('cone', [1.0, 1.0, 16], [0, 1.25, 0], [PI, 0, 0]), P('cyl', [.12, .12, .7, 8], [0, .4, 0]), P('tor', [1.0, .04, 2 * PI], [0, 1.75, 0], [PI / 2, 0, 0])], core: [0, 1.2, 0] },
  sandbox: { cat: 'sec', name: '沙箱', en: 'Sandbox', size: 'M', abbr: 'SBX', role: ['防护'],
    use: '在隔离环境中运行可疑文件,观察其行为。',
    look: '敞口方箱框 + 箱内悬浮一颗小球(被观察样本)。',
    parts: [P('box', [1.5, .08, 1.5], [0, .04, 0]), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => P('box', [.06, 1.3, .06], [a * .72, .69, b * .72])), P('box', [1.5, .05, .05], [0, 1.32, .72]), P('box', [1.5, .05, .05], [0, 1.32, -.72]), P('sph', [.32, 10, 8], [0, .7, 0])], core: [0, .7, 0] },

  /* ===== 服务器 / 云(紫) ===== */
  websrv: { cat: 'srv', name: 'Web / 应用服务器', en: 'Web / App Server', size: 'L', abbr: 'WEB', role: ['目标'],
    use: '对外提供网站与 API 服务,是最常见的攻击目标。',
    look: '高窄机柜,正面多条水平 1U 刻线。',
    parts: [P('box', [.95, 2.1, 1.0], [0, 1.05, 0]), ...[...Array(6).keys()].map(i => P('box', [.8, .05, .03], [0, .3 + i * .3, .51]))], core: [0, 2.45, 0] },
  dbsrv: { cat: 'srv', name: '数据库', en: 'Database', size: 'L', abbr: 'DB', role: ['目标'],
    use: '存放业务与用户数据,泄露后果最直接。',
    look: '三节堆叠的扁圆柱(经典数据库符号)。',
    parts: [P('cyl', [.85, .85, .45, 20], [0, .25, 0]), P('cyl', [.85, .85, .45, 20], [0, .78, 0]), P('cyl', [.85, .85, .45, 20], [0, 1.31, 0])], core: [0, 1.95, 0] },
  storage: { cat: 'srv', name: '存储阵列', en: 'Storage Array', size: 'L', abbr: 'NAS', role: ['目标'],
    use: '集中文件/块存储与备份,勒索软件的重点目标。',
    look: '地面上 2×2 平铺的四个磁盘模块,顶部一根横向汇流条。',
    parts: [[-.5, -.55], [.5, -.55], [-.5, .55], [.5, .55]].map(([x, z]) => P('box', [.85, .7, .9], [x, .35, z])).concat([[-.5, .55], [.5, .55]].map(([x, z]) => P('box', [.5, .04, .02], [x, .45, z + .46])), [P('box', [1.9, .06, .06], [0, .78, 0])]), core: [0, 1.25, 0] },
  cloud: { cat: 'srv', name: '云平台', en: 'Cloud Platform', size: 'XL', abbr: 'CLD', role: ['目标', '路径'],
    use: '公有云/私有云资源池,承载虚拟机、存储与服务。',
    look: '三颗大小不一的球团簇成云朵 + 扁平底座。',
    parts: [P('sph', [.6, 12, 8], [-.65, .75, 0]), P('sph', [.8, 12, 8], [.1, 1.0, 0]), P('sph', [.55, 12, 8], [.85, .7, 0]), P('box', [2.4, .1, .9], [0, .1, 0])], core: [0, 1.0, .6] },
  container: { cat: 'cn', name: '容器集群', en: 'Container Cluster', size: 'L', abbr: 'K8', role: ['目标'],
    use: '容器编排平台上的大量微服务实例。',
    look: '三块六棱柱错落堆叠成蜂巢簇。',
    parts: [P('cyl', [.55, .55, .6, 6], [-.55, .3, .3]), P('cyl', [.55, .55, .6, 6], [.55, .3, .3]), P('cyl', [.55, .55, .6, 6], [0, .3, -.6]), P('cyl', [.55, .55, .6, 6], [0, .9, 0])], core: [0, 1.6, 0] },
  mailsrv: { cat: 'srv', name: '邮件服务器', en: 'Mail Server', size: 'M', abbr: 'MX', role: ['目标', '路径'],
    use: '收发企业邮件,钓鱼与商业邮件诈骗的入口。',
    look: '方形邮箱身 + 半圆拱顶 + 侧边竖立小旗。',
    parts: [P('box', [1.3, .8, .9], [0, .4, 0]), P('cyl', [.65, .65, .9, 12, true], [0, .8, 0], [PI / 2, 0, 0]), P('cyl', [.03, .03, 1.0, 4], [.8, .75, 0]), P('box', [.35, .2, .03], [.95, 1.15, 0])], core: [0, .9, .5] },

  /* ===== 终端 / IoT / 工控(品红) ===== */
  ipcam: { cat: 'iot', name: '网络摄像头', en: 'IP Camera', size: 'S', abbr: 'CAM', role: ['目标', '源'],
    use: '视频监控终端,弱口令时易被拉入僵尸网络。',
    look: '墙装支架 + 横置圆筒镜头机身 + 前端遮阳檐。',
    parts: [P('box', [.4, 1.2, .15], [0, .6, -.6]), P('box', [.1, .1, .5], [0, 1.15, -.35]), P('cyl', [.3, .3, 1.2, 12], [0, 1.15, .3], [PI / 2, 0, 0]), P('box', [.7, .04, .5], [0, 1.47, .55])], core: [0, 1.15, .95] },
  plc: { cat: 'iot', name: 'PLC 控制器', en: 'PLC', size: 'M', abbr: 'PLC', role: ['目标'],
    use: '工业现场逻辑控制器,直接驱动阀门、电机等。',
    look: '横向导轨上一排高低不同的竖插模块。',
    parts: [P('box', [2.4, .08, .3], [0, .5, -.3]), ...[.9, .7, .7, .7, .5].map((h, i) => P('box', [.38, h, .6], [-.9 + i * .45, h / 2 + .05, 0]))], core: [0, 1.3, 0] },
  sensor: { cat: 'iot', name: '传感器', en: 'Sensor', size: 'S', abbr: 'SN', role: ['目标', '源'],
    use: '采集温湿度、压力等数据的小型联网节点。',
    look: '短杆顶上一个半球圆顶 + 两侧一组短弧。',
    parts: [P('cyl', [.06, .06, .6, 6], [0, .3, 0]), P('hemi', [.45], [0, .6, 0]), P('tor', [.7, .02, PI * .5], [0, .75, 0], [0, 0, PI * .25]), P('tor', [.7, .02, PI * .5], [0, .75, 0], [0, PI, PI * .25])], core: [0, .8, 0] },
  hmi: { cat: 'iot', name: '工控操作台 HMI', en: 'HMI Console', size: 'L', abbr: 'HMI', role: ['目标'],
    use: '操作员监视与控制产线的人机界面。',
    look: '立式柜体,上部前倾的斜面屏 + 下部按钮格。',
    parts: [P('box', [1.3, 1.2, .8], [0, .6, 0]), P('box', [1.3, .8, .08], [0, 1.45, .2], [-.6, 0, 0]), ...[-.35, 0, .35].map(x => P('cyl', [.08, .08, .05, 10], [x, .9, .42], [PI / 2, 0, 0]))], core: [0, 1.5, .5] },
  pos: { cat: 'iot', name: '收银 POS', en: 'POS Terminal', size: 'S', abbr: 'POS', role: ['目标'],
    use: '门店收银与刷卡终端,涉及支付卡数据。',
    look: '低矮底座 + 背后小票纸卷圆筒 + 前倾小屏。',
    parts: [P('box', [1.2, .3, 1.0], [0, .15, 0]), P('cyl', [.25, .25, .9, 12], [0, .55, -.3], [0, 0, PI / 2]), P('box', [.8, .5, .05], [0, .6, .25], [-.5, 0, 0])], core: [0, .65, .45] },

  /* ===== 攻击者 / 外部(红) ===== */
  attacker: { cat: 'ext', name: '攻击者', en: 'Attacker', size: 'M', abbr: 'ATK', role: ['源'],
    use: '外部恶意行为者的抽象,事件中的发起方。',
    look: '坐姿兜帽黑客:卫衣躯干 + 圆肩 + 深色帽内与红色面罩线,双手搭在打开的笔记本上,屏幕红光、背面灯标;低多边形硬边。',
    parts: [P('cone', [.75, 1.4, 10], [0, .7, 0]), P('sph', [.32, 10, 8], [0, 1.55, 0]), P('cone', [.42, .45, 10], [0, 1.82, -.05]), P('box', [.7, .45, .05], [0, .7, .7], [-.3, 0, 0])], core: [0, 1.55, .3] },
  botnet: { cat: 'ext', name: '僵尸网络', en: 'Botnet', size: 'L', abbr: 'BOT', role: ['源'],
    use: '被控制的大量设备集合,常用于 DDoS 与撞库。',
    look: '环形分布的六个小八面体 + 中心较大的控制球。',
    parts: [...[...Array(6).keys()].map(i => P('oct', [.25], [Math.cos(i * PI / 3) * 1.15, .6 + (i % 2) * .35, Math.sin(i * PI / 3) * 1.15])), P('sph', [.35, 10, 8], [0, 1.0, 0]), P('tor', [1.15, .02, 2 * PI], [0, .75, 0], [PI / 2, 0, 0])], core: [0, 1.0, 0] },
  c2: { cat: 'ext', name: 'C2 服务器', en: 'C2 Server', size: 'M', abbr: 'C2', role: ['源'],
    use: '恶意软件回连的指挥控制端,下发指令收集数据。',
    look: '指挥服务器塔(刀片位 + 指示灯)+ 顶部碟形天线 + 两道发射弧。',
    parts: [P('cone', [.75, 2.0, 4], [0, 1.0, 0]), P('box', [.9, .04, .04], [0, .6, 0], [0, PI / 4, 0]), P('sph', [.18, 8, 6], [0, 2.15, 0]), P('tor', [.45, .025, PI * .6], [0, 2.15, 0], [0, 0, PI * .2]), P('tor', [.75, .025, PI * .6], [0, 2.15, 0], [0, 0, PI * .2])], core: [0, 2.15, 0] },
  internet: { cat: 'ext', name: '互联网', en: 'Internet', size: 'XL', abbr: 'NET', role: ['路径', '源'],
    use: '外部公共网络的抽象,内外网边界的另一侧。',
    look: '大号经纬线地球 + 斜交的轨道环。',
    parts: [P('sph', [1.1, 16, 10], [0, 1.25, 0]), P('tor', [1.45, .03, 2 * PI], [0, 1.25, 0], [PI / 2 - .4, 0, .3]), P('tor', [1.15, .025, 2 * PI], [0, 1.25, 0], [0, 0, 0])], core: [0, 1.25, 0] },
  insider: { cat: 'ext', name: '内部威胁', en: 'Insider Threat', size: 'M', abbr: 'INS', role: ['源'],
    use: '拥有合法权限但滥用权限的内部人员。',
    look: '站姿西装人物:白衬衫 + 红领带 + 胸前工牌挂绳,抱着外泄的文件盒;与兜帽攻击者同一人形语言但可区分。',
    parts: [P('cyl', [.4, .5, 1.2, 12], [0, .6, 0]), P('sph', [.33, 10, 8], [0, 1.55, 0]), P('box', [.3, .38, .04], [.15, .85, .48]), P('box', [.04, .25, .02], [.15, 1.12, .48])], core: [0, 1.55, .35] },

  /* ===== v7 补充:对照对抗赛 32 种模型 ===== */
  aggswitch: { cat: 'net', name: '汇聚交换机', en: 'Aggregation Switch', size: 'M', abbr: 'AGG', role: ['路径'], use: '汇聚多台接入交换机上联到核心,区域内东西向流量的必经点。', look: '2U 双层机身,两排端口 + 上联光口,顶部散热格。', parts: [] },
  nta: { cat: 'sec', name: '全流量探针', en: 'Network Traffic Analyzer', size: 'M', abbr: 'NTA', role: ['检测'], use: '旁路镜像全流量,做协议还原、回溯与异常检测。', look: '1U 机身 + 前面板长指示条 + 顶部立杆探测球。', parts: [] },
  hids: { cat: 'sec', name: '主机安全 / 审计', en: 'HIDS / Host Audit', size: 'M', abbr: 'HIDS', role: ['检测', '防护'], use: '主机侧入侵检测、基线核查与操作审计。', look: '塔式机身,正面三条状态灯 + 顶部环形审计圈。', parts: [] },
  appsrv: { cat: 'srv', name: '应用服务器', en: 'Application Server', size: 'M', abbr: 'APP', role: ['目标'], use: '运行业务中间件与后端服务,区别于对外的 Web 前端。', look: '刀片机箱,两排竖插刀片 + 顶部风扇。', parts: [] },
  cache: { cat: 'srv', name: '缓存 Redis', en: 'Cache (Redis)', size: 'S', abbr: 'RDS', role: ['目标'], use: '内存缓存/会话存储,未授权访问是常见风险。', look: '短圆柱 + 闪电面板 + 顶部方块。', parts: [] },
  objstore: { cat: 'srv', name: '对象存储', en: 'Object Storage', size: 'L', abbr: 'OBJ', role: ['目标'], use: '存放文件/备份/镜像的桶式存储,权限配置错误易泄露。', look: '上宽下窄的桶形 + 箍圈 + 顶盖。', parts: [] },
  mq: { cat: 'srv', name: '消息队列 / 中间件', en: 'Message Queue', size: 'L', abbr: 'MQ', role: ['路径', '目标'], use: '异步消息、事件总线;横向移动与数据外泄的通道。', look: '扁平机身 + 顶部三段并排队列筒。', parts: [] },
  k8smaster: { cat: 'cn', name: 'K8s 主控节点', en: 'K8s Control Plane', size: 'L', abbr: 'K8M', role: ['目标'], use: '集群 API Server / 调度 / etcd,控制面一旦失守全集群沦陷。', look: '六棱柱机身 + 顶部舵轮。', parts: [] },
  k8snode: { cat: 'cn', name: 'K8s 计算节点', en: 'K8s Worker Node', size: 'M', abbr: 'K8N', role: ['目标'], use: '运行 Pod 的工作节点,容器逃逸的落点。', look: '高六棱柱 + 侧面三块 Pod 槽。', parts: [] },
  registry: { cat: 'cn', name: '镜像 / 制品仓库', en: 'Image Registry', size: 'L', abbr: 'REG', role: ['目标', '源'], use: '存放容器镜像/制品,供应链投毒的入口。', look: '机身上错落堆叠的镜像箱。', parts: [] },
  cnapp: { cat: 'cn', name: '容器化应用', en: 'Containerized App', size: 'M', abbr: 'POD', role: ['目标'], use: '以容器方式部署的单个业务应用(Pod/Deployment)。', look: '集装箱棱纹箱体 + 端门。', parts: [] },
  workstation: { cat: 'office', name: '研发工作站', en: 'Dev Workstation', size: 'L', abbr: 'WS', role: ['目标', '源'], use: '研发人员高性能主机,持有源码与凭据,价值高。', look: '大塔式主机 + 双显示器。', parts: [] },
  opsterm: { cat: 'office', name: '运维终端', en: 'Ops Terminal', size: 'M', abbr: 'OPS', role: ['源'], use: '运维人员接入堡垒机的专用终端。', look: '笔记本 + 侧立扩展坞 + 外接小屏。', parts: [] },
  kiosk: { cat: 'office', name: '分公司终端 / 自助机', en: 'Branch Kiosk', size: 'M', abbr: 'BR', role: ['目标'], use: '营业厅/分支机构的自助办理终端。', look: '立式机柜 + 前倾大屏 + 刷卡口 + 出票口。', parts: [] },
  term3p: { cat: 'office', name: '第三方终端', en: 'Third-party Device', size: 'S', abbr: '3P', role: ['源'], use: '外包、访客、供应商带入的设备,资产管理盲区。', look: '立式支架上的平板 + 访客标牌。', parts: [] },
  iotgw: { cat: 'iot', name: 'IoT 网关', en: 'IoT Gateway', size: 'S', abbr: 'IGW', role: ['路径'], use: '汇聚传感器/工控协议上云的边缘网关。', look: '小机盒 + 两根天线 + 侧面接线端子排。', parts: [] },

};
Object.keys(SPEC).forEach(k => { SPEC[k].type = k; });

/* ---------- 构造(v4:MeshStandard 明暗 + 无地面底座 + 状态描边) ---------- */
let THEME = 'dark';
try { if (root.THREE && root.THREE.ColorManagement) root.THREE.ColorManagement.enabled = false; } catch (e) {}
function setTheme(t) { THEME = t === 'light' ? 'light' : 'dark'; }
/** 保证类别色按 sRGB 往返,避免 Linear 输出把 #2f8fff 洗成灰蓝(sat≈0.53) */
function prepareRenderer(renderer) {
  const T = root.THREE;
  try {
    /* 关闭色彩管理:默认管线会把 sRGB hex 当线性再编码一次, #2f8fff → (119,197,255) sat≈0.53 */
    if (T.ColorManagement) T.ColorManagement.enabled = false;
    if (T.LinearSRGBColorSpace) renderer.outputColorSpace = T.LinearSRGBColorSpace;
    else if (renderer.outputEncoding != null && T.LinearEncoding != null) renderer.outputEncoding = T.LinearEncoding;
    /* ACES 压暗暗部并拉低饱和度;改用 Linear + 略提曝光,主色更清楚 */
    if (renderer.toneMapping != null) {
      renderer.toneMapping = T.NoToneMapping;
      if (renderer.toneMappingExposure != null) renderer.toneMappingExposure = 1.0;
    }
  } catch (e) {}
  return renderer;
}
const FRAME = {
  dark:  { normal: '#1aff60', selected: '#7dffaa', outline: '#ffffff', attacked: '#ff2040', protected: '#00e8ff', label: 'rgba(8,10,18,.88)', labelTxt: '#f2f6ff', labelLine: 'rgba(255,255,255,.7)' },
  light: { normal: '#0c9a38', selected: '#14b848', outline: '#0d1626', attacked: '#c4001c', protected: '#007f9e', label: 'rgba(255,255,255,.96)', labelTxt: '#152033', labelLine: 'rgba(30,50,80,.5)' },
};
const ZONE = {
  dark:  { violet: '#8a5cff', gray: '#7a8498', green: '#00ff66', blue: '#2f8fff', plate: '#05070c', grid: '#1c2434', text: 'rgba(235,240,255,.78)' },
  light: { violet: '#5a2fa8', gray: '#4f5a6c', green: '#0c9a38', blue: '#1360c8', plate: '#e8eef6', grid: '#8a96aa', text: 'rgba(30,42,64,.8)' },
};
const texCache = {};
const segCap = (n, d) => Math.min(n || d, d);
function geo(T, s, a) {
  switch (s) {
    case 'box': return new T.BoxGeometry(a[0], a[1], a[2]);
    case 'cyl': return new T.CylinderGeometry(a[0], a[1], a[2], segCap(a[3], 10), 1, !!a[4], 0, a[4] ? PI : 2 * PI);
    case 'sph': return new T.SphereGeometry(a[0], segCap(a[1], 10), segCap(a[2], 7));
    case 'cone': return new T.ConeGeometry(a[0], a[1], segCap(a[2], 10));
    case 'tor': return new T.TorusGeometry(a[0], Math.max(a[1], .035), 4, 20, a[2] == null ? 2 * PI : a[2]);
    case 'oct': return new T.OctahedronGeometry(a[0]);
    case 'hemi': return new T.SphereGeometry(a[0], 10, 4, 0, 2 * PI, 0, PI / 2);
  }
  throw new Error('未知形状 ' + s);
}
function toneOf(p) {
  if (p[4]) return p[4];
  const s = p[0], a = p[1]; let d;
  if (s === 'box') d = a.slice(0, 3); else if (s === 'cyl') d = [Math.max(a[0], a[1]) * 2, Math.max(a[0], a[1]) * 2, a[2]]; else if (s === 'tor') d = [a[1] * 2, a[1] * 2, a[0]]; else return 'body';
  d = d.slice().sort((x, y) => x - y);
  return d[0] < .13 && d[1] < .32 ? 'light' : 'body';
}
function canvasTex(T, key, w, h, draw) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return (texCache[key] = t);
}
function labelPlate(T, text, theme, accent) {
  const fr = FRAME[theme]; const fs = 42;
  const mw = (() => { const c = document.createElement('canvas').getContext('2d'); c.font = 'bold ' + fs + 'px "Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif'; return Math.ceil(c.measureText(text).width); })();
  const w = Math.max(110, mw + 36), h = 58;
  const tex = canvasTex(T, 'lp2|' + text + theme + accent, w, h, (x) => {
    // 旧图:深半透明底 + 白描边 + 白字
    x.fillStyle = theme === 'light' ? fr.label : 'rgba(6,8,14,.9)';
    x.strokeStyle = theme === 'light' ? fr.labelLine : 'rgba(255,255,255,.85)';
    x.lineWidth = 3; const r = 6;
    x.beginPath(); x.moveTo(r, 2); x.arcTo(w - 2, 2, w - 2, h - 2, r); x.arcTo(w - 2, h - 2, 2, h - 2, r); x.arcTo(2, h - 2, 2, 2, r); x.arcTo(2, 2, w - 2, 2, r); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = fr.labelTxt; x.font = 'bold ' + fs + 'px "Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 1);
  });
  const m = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }); const s = new T.Sprite(m);
  const sh = .42; s.scale.set(sh * w / h, sh, 1); s.renderOrder = 20; s.center.set(.5, 0); s.userData.isLabel = true; s.userData.aspect = w / h; return s;
}
/** fitLabels(scene, camera, viewHeightPx, px) — 标签按屏幕像素固定高度(默认 13px),不随距离放大 */
function fitLabels(scene, cam, viewH, px) {
  const k = (px || 13) * 2 / (Math.max(1, viewH) * cam.projectionMatrix.elements[5]);
  scene.traverse(o => { if (o.userData && o.userData.isLabel) { o.material.sizeAttenuation = false; o.scale.set(k * o.userData.aspect, k, 1); } });
}
/* 场景灯光:强平行光打出亮面/暗面 + 半球 + 冷色边缘光 */
function addLights(scene, theme) {
  const T = root.THREE, day = theme === 'light', g = new T.Group(); g.name = 'nodelib-lights';
  g.add(new T.HemisphereLight(day ? 0xffffff : 0xb0c0d8, day ? 0x8a96a8 : 0x080c14, day ? .55 : .22));
  const d = new T.DirectionalLight(0xffffff, day ? 2.05 : 2.35); d.position.set(6, 15, 5); g.add(d);
  const f = new T.DirectionalLight(day ? 0xa8bce0 : 0x5570b0, day ? .4 : .65); f.position.set(-11, 4, -6); g.add(f);
  const k = new T.DirectionalLight(day ? 0xffe0b0 : 0xffc070, day ? .18 : .28); k.position.set(2, 3, -11); g.add(k);
  scene.add(g); return g;
}
/** 把物体及其子树放到辉光层(默认层1)。与事件大全同款 UnrealBloom 配合:只让底框/连线/描边过阈值 */
function markBloom(obj, on) {
  obj.traverse(o => { if (on) o.layers.enable(1); else o.layers.disable(1); });
}

/* ---------- v6 规格化细节模型(借鉴“原子 → 归一化 → 角色合并”做法;单位立方体坐标) ----------
   原子坐标: x/z ∈ [-.5,.5], y = 底面高度, 正面 = +Z。角色: base/body/face/port/led/detail */
const ROLES = ['base', 'body', 'face', 'port', 'led', 'detail'];
const A = (s, r, o) => Object.assign({ s, r }, o);
const B = (r, x, y, z, w, h, d, rot) => A('box', r, { x, y, z, w, h, d, rot });
const C = (r, x, y, z, rt, h, seg, rb, rot) => A('cyl', r, { x, y, z, rt, rb: rb == null ? rt : rb, h, seg: seg || 10, rot });
const S = (r, x, y, z, rad, rot) => A('sph', r, { x, y, z, rad, rot });
const K = (r, x, y, z, rad, h, seg, rot) => A('cone', r, { x, y, z, rad, h, seg: seg || 10, rot });
const TO = (r, x, y, z, R, t, arc, rot) => A('tor', r, { x, y, z, R, t, arc: arc == null ? 2 * PI : arc, rot });
const O = (r, x, y, z, rad, rot) => A('oct', r, { x, y, z, rad, rot });
const RB = (r, x, y, z, w, h, d, b, rot) => A('rbox', r, { x, y, z, w, h, d, b: b == null ? .02 : b, rot });
/* n 个等距排列 */
const ROW = (n, x0, x1, f) => Array.from({ length: n }, (_, i) => f(n === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * i / (n - 1), i));
/* 机架通用:底座 + 机身 + 面板 */
const rack = (w, h, d, fh) => [B('base', 0, 0, 0, w + .04, .05, d + .04), B('body', 0, .05, 0, w, h, d), B('face', 0, .05 + (h - fh) / 2, d / 2 + .01, w - .06, fh, .02)];
/* 散热孔:一排细横条 */
const vents = (n, x0, x1, y, z, w = .035, h = .012) => ROW(n, x0, x1, x => B('port', x, y, z, w, h, .015));
const leds = (n, x0, x1, y, z, s = .03) => ROW(n, x0, x1, x => B('led', x, y, z, s, s, .015));
const RSPEC = {
  /* ===== 网络(绿) ===== */
  router: [...rack(.9, .22, .6, .16), ...ROW(4, -.3, .06, x => B('port', x, .09, .315, .07, .05, .02)), ...leds(4, .16, .34, .14, .315),
    ...vents(6, -.3, .3, .29, -.05, .07, .014).map(a => (a.y = .275, a.z = 0, a.d = .4, a)),
    C('detail', -.36, .27, -.22, .018, .55, 6), C('detail', .36, .27, -.22, .018, .55, 6), S('led', -.36, .83, -.22, .03), S('led', .36, .83, -.22, .03)],
  switch: [...rack(1, .14, .5, .1), ...ROW(12, -.42, .2, x => B('port', x, .1, .265, .04, .03, .02)), ...ROW(12, -.42, .2, x => B('port', x, .06, .265, .04, .03, .02)),
    ...ROW(4, .28, .42, x => B('port', x, .08, .265, .03, .05, .02)), ...leds(6, -.42, -.1, .14, .265, .016), B('detail', 0, .19, 0, .8, .012, .4)],
  coreswitch: [B('base', 0, 0, 0, .9, .05, .7), RB('body', 0, .05, 0, .86, .78, .66, .025), B('face', 0, .08, .345, .8, .72, .02), ...ROW(6, -.32, .32, x => B('detail', x, .14, .345, .1, .56, .02)),
    ...ROW(6, -.32, .32, x => B('port', x, .3, .36, .06, .2, .015)), ...ROW(6, -.32, .32, x => B('led', x, .62, .36, .03, .025, .015)),
    B('detail', 0, .83, 0, .6, .04, .5), ...ROW(3, -.2, .2, x => C('port', x, .87, 0, .07, .01, 14))],
  ap: [C('base', 0, 0, 0, .14, .04, 12), C('detail', 0, .04, 0, .03, .44, 8), C('body', 0, .48, 0, .44, .1, 12, .48), C('face', 0, .58, 0, .36, .03, 12),
    S('led', 0, .62, 0, .05), TO('detail', 0, .72, 0, .2, .015, PI, [0, 0, 0]), TO('detail', 0, .72, 0, .32, .015, PI, [0, 0, 0]), ...leds(3, -.1, .1, .52, .47, .025)],
  lb: [C('base', -.2, 0, 0, .2, .04, 16), C('body', -.2, .04, 0, .15, .55, 12), C('face', -.2, .3, 0, .155, .04, 12), C('face', -.2, .45, 0, .155, .04, 12), S('led', -.2, .64, 0, .05),
    ...[-1, 0, 1].flatMap(k => [B('detail', .08, .3, k * .14, .4, .04, .04, [0, -k * .55, 0]), B('body', .34, .2, k * .3, .14, .22, .14), B('face', .34, .25, k * .3 + .072, .1, .1, .01), B('led', .34, .44, k * .3, .04, .03, .04)])],
  dns: [B('base', 0, 0, 0, .44, .05, .44), B('body', 0, .05, 0, .3, .16, .3), B('face', 0, .08, .155, .24, .1, .02), ...leds(3, -.08, .08, .17, .165, .025),
    C('detail', 0, .21, 0, .03, .26, 8), S('body', 0, .72, 0, .25), TO('face', 0, .72, 0, .26, .012, 2 * PI, [PI / 2, 0, 0]), TO('face', 0, .72, 0, .26, .012, 2 * PI, [0, 0, 0]), TO('face', 0, .72, 0, .26, .012, 2 * PI, [0, PI / 2, 0])],
  /* ===== 办公(蓝) ===== */
  pc: [B('base', -.3, 0, .05, .3, .03, .22), RB('body', -.3, .03, 0, .26, .62, .5, .02), B('face', -.3, .45, .255, .2, .16, .015), ...vents(4, -.39, -.21, .2, .255, .03, .012),
    B('led', -.3, .52, .262, .03, .03, .01), B('base', .2, 0, .02, .34, .025, .2), C('detail', .2, .025, .02, .025, .22, 8),
    RB('body', .2, .24, 0, .56, .38, .05, .012), B('face', .2, .265, .03, .5, .32, .015), B('led', .43, .255, .036, .02, .015, .01), B('port', .2, .025, .22, .4, .02, .1)],
  laptop: [B('body', 0, 0, .1, .9, .05, .6), B('face', 0, .05, .14, .76, .008, .32), ...ROW(6, -.3, .3, x => B('port', x, .056, .02, .1, .006, .06)), B('port', 0, .05, .36, .24, .006, .14),
    B('body', 0, .05, -.22, .9, .62, .04, [-.32, 0, 0]), B('face', 0, .09, -.195, .8, .52, .01, [-.32, 0, 0]), B('led', 0, .64, -.37, .03, .02, .01)],
  printer: [B('base', 0, 0, 0, .9, .05, .7), B('body', 0, .05, 0, .84, .4, .64), B('face', 0, .3, .325, .78, .1, .02), B('port', 0, .14, .33, .6, .05, .02),
    B('detail', 0, .17, .42, .56, .02, .22), B('detail', 0, .45, -.16, .6, .02, .3, [.45, 0, 0]), B('face', .3, .38, .331, .14, .07, .01), ...leds(2, .24, .36, .3, .335, .025)],
  mobile: [B('base', 0, 0, .06, .46, .05, .34), B('face', 0, .05, .2, .3, .015, .04), B('body', 0, .04, 0, .4, .9, .06, [-.18, 0, 0]), B('face', 0, .12, .035, .34, .7, .01, [-.18, 0, 0]),
    ...[0, 1, 2].flatMap(r => ROW(3, -.1, .1, x => B('detail', x, .5 + r * .1, .04 - (.5 + r * .1) * .18, .07, .07, .006, [-.18, 0, 0]))),
    B('port', 0, .86, -.12, .12, .015, .01, [-.18, 0, 0]), S('port', .1, .86, -.12, .018), C('detail', -.1, .78, -.17, .045, .02, 12, null, [PI / 2 - .18, 0, 0]), B('led', .21, .5, -.08, .01, .1, .02, [-.18, 0, 0]), B('led', 0, .17, .04, .1, .012, .01, [-.18, 0, 0])],
  tablet: [B('base', 0, 0, .1, .74, .04, .32), B('face', 0, .04, .2, .6, .02, .08), B('detail', 0, .04, -.12, .08, .4, .04, [.5, 0, 0]), B('body', 0, .08, 0, 1, .66, .05, [-.42, 0, 0]),
    B('face', 0, .12, .03, .9, .56, .01, [-.42, 0, 0]), ...[0, 1].flatMap(r => ROW(4, -.3, .3, x => B('detail', x, .22 + r * .2, .05 - r * .085, .16, .14, .006, [-.42, 0, 0]))),
    S('port', 0, .68, -.24, .018), B('led', .45, .66, -.21, .03, .012, .01, [-.42, 0, 0]), B('port', 0, .1, .05, .08, .02, .01, [-.42, 0, 0])],
  voip: [B('base', 0, 0, 0, .8, .06, .7), B('body', 0, .06, 0, .74, .26, .64, [-.25, 0, 0]), B('face', .12, .2, .12, .36, .2, .02, [-.25, 0, 0]),
    ...[0, 1, 2].flatMap(r => ROW(3, -.34, -.14, x => B('port', x, .12 + r * .065, .18 - r * .06, .05, .035, .015, [-.25, 0, 0]))),
    B('detail', 0, .38, -.1, .62, .07, .14), C('body', -.31, .36, -.1, .08, .12, 12), C('body', .31, .36, -.1, .08, .12, 12), B('led', .34, .33, .26, .03, .03, .01)],
  /* ===== 安全(黄) ===== */
  firewall: [B('base', 0, 0, 0, 1, .05, .5), /* bricks */
    ...[0, 1, 2, 3].flatMap(r => ROW(r % 2 ? 4 : 3, r % 2 ? -.36 : -.3, r % 2 ? .36 : .3, x => B(r % 2 ? 'face' : 'body', x, .05 + r * .2, 0, r % 2 ? .22 : .3, .18, .4))),
    ...leds(3, -.3, .3, .9, .205, .03), B('detail', 0, .86, -.21, .9, .02, .02)],
  waf: [B('base', 0, 0, .05, .7, .05, .5), C('body', 0, .05, -.05, .44, .9, 6, null, [PI / 2, 0, 0]).y === 0 ? null : null,
    B('body', 0, .05, -.12, .78, .84, .1), B('face', 0, .12, -.06, .66, .7, .02), B('detail', 0, .58, .02, .5, .3, .02), B('port', 0, .82, .03, .5, .05, .02),
    ...leds(3, -.2, -.1, .84, .045, .025), ...ROW(3, -.18, .18, x => B('port', x, .2, .02, .1, .2, .02)), B('led', 0, .45, .02, .36, .02, .01)].filter(Boolean),
  idsips: [B('base', 0, 0, 0, .5, .06, .5), B('body', 0, .06, 0, .36, .22, .36), B('face', 0, .1, .185, .28, .14, .02), ...leds(3, -.08, .08, .2, .195, .025),
    C('detail', 0, .28, 0, .04, .22, 8), C('body', 0, .5, 0, .48, .12, 24, .08), C('face', 0, .6, 0, .42, .02, 24), C('detail', 0, .62, 0, .015, .28, 6), S('led', 0, .92, 0, .04),
    TO('detail', 0, .6, 0, .3, .01, 2 * PI, [PI / 2, 0, 0])],
  bastion: [B('base', 0, 0, 0, 1, .12, .8), B('face', 0, .02, .405, .9, .08, .02), B('port', 0, .12, .29, .2, .26, .03), B('body', 0, .12, 0, .62, .62, .56),
    B('face', 0, .3, .285, .5, .26, .02), ...ROW(3, -.16, .16, x => B('port', x, .52, .29, .08, .1, .02)),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => B('detail', a * .26, .74, b * .23, .1, .12, .1)), ...leds(2, -.12, .12, .62, .292, .03)],
  honeypot: [C('base', 0, 0, 0, .34, .05, 20), C('body', 0, .05, 0, .38, .48, 20, .32), TO('face', 0, .53, 0, .38, .03, 2 * PI, [PI / 2, 0, 0]),
    C('face', 0, .2, 0, .395, .06, 20), C('detail', .2, .55, 0, .025, .5, 6, null, [0, 0, -.7]), S('detail', .38, .72, 0, .05), ...leds(3, -.12, .12, .36, .375, .03)],
  soc: [B('base', 0, 0, .15, 1, .04, .4), B('body', 0, .04, .15, .9, .24, .34), B('face', 0, .1, .325, .8, .1, .02),
    ...[-1, 0, 1].flatMap(k => [B('body', k * .32, .32, -.1 + Math.abs(k) * .06, .32, .26, .04, [0, -k * .35, 0]), B('face', k * .32, .34, -.075 + Math.abs(k) * .06, .28, .22, .01, [0, -k * .35, 0])]),
    ...ROW(3, -.32, .32, x => C('detail', x, .28, -.08, .015, .06, 6)), ...leds(5, -.3, .3, .2, .336, .025)],
  vpngw: [...rack(1, .2, .6, .14), ...ROW(4, -.38, -.08, x => B('port', x, .1, .315, .06, .05, .02)), ...leds(3, .2, .38, .14, .315),
    TO('body', 0, .25, 0, .3, .07, PI, [0, 0, 0]), TO('face', 0, .25, .06, .3, .02, PI, [0, 0, 0]), B('detail', 0, .25, 0, .44, .03, .3), S('led', 0, .58, 0, .04)],
  behavior: [B('base', 0, 0, 0, .36, .04, .36), C('detail', 0, .04, 0, .04, .24, 8), C('body', 0, .28, 0, .42, .46, 12, .06), C('face', 0, .72, 0, .43, .04, 12),
    TO('detail', 0, .52, 0, .26, .012, 2 * PI, [PI / 2, 0, 0]), ...ROW(3, -.12, .12, x => S('led', x, .65, .28, .022))],
  sandbox: [B('base', 0, 0, 0, 1, .05, 1), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => B('body', a * .45, .05, b * .45, .08, .8, .08)),
    ...[-1, 1].flatMap(k => [B('body', 0, .82, k * .45, .98, .06, .08), B('body', k * .45, .82, 0, .08, .06, .98)]),
    B('face', 0, .05, 0, .8, .03, .8), S('led', 0, .45, 0, .14), TO('detail', 0, .45, 0, .22, .012, 2 * PI, [PI / 2, 0, 0]), ...leds(3, -.2, .2, .1, .495, .03)],
  /* ===== 服务器 / 云(紫) ===== */
  websrv: [B('base', 0, 0, 0, .5, .04, .5), B('body', 0, .04, 0, .44, .92, .46), ...ROW(7, .1, .82, (y, i) => B('face', 0, y, .235, .38, .09, .02)),
    ...ROW(7, .14, .86, y => B('led', .14, y, .248, .025, .02, .01)), ...ROW(7, .14, .86, y => B('port', -.08, y - .005, .248, .16, .012, .01))],
  dbsrv: [C('base', 0, 0, 0, .46, .04, 24), ...[0, 1, 2].flatMap(i => [C('body', 0, .05 + i * .3, 0, .42, .24, 24), C('face', 0, .29 + i * .3, 0, .43, .04, 24), B('led', 0, .17 + i * .3, .42, .1, .025, .02)]),
    C('detail', 0, .95, 0, .2, .03, 18)],
  storage: [B('base', 0, 0, 0, 1, .05, .8), ...[[-.25, -.18], [.25, -.18], [-.25, .18], [.25, .18]].flatMap(([x, z]) => [B('body', x, .05, z, .44, .3, .32), B('face', x, .1, z + .162, .38, .2, .015),
    ...ROW(3, .12, .28, y => B('port', x - .05, y, z + .172, .22, .025, .01)), B('led', x + .14, .25, z + .172, .025, .025, .01)]), B('detail', 0, .4, 0, .9, .06, .08), ...ROW(4, -.3, .3, x => B('detail', x, .35, 0, .04, .05, .04))],
  cloud: [B('base', 0, 0, 0, .9, .06, .5), B('face', 0, .06, .2, .8, .04, .06), S('body', -.25, .32, 0, .2), S('body', .25, .3, 0, .18), S('body', 0, .45, 0, .28), S('face', .1, .55, .15, .1),
    ...leds(4, -.3, .3, .03, .255, .025)],
  container: [...[[-.24, 0, 0], [.24, 0, 0], [0, 0, -.38], [0, .3, -.12]].flatMap(([x, y, z]) => [C('body', x, y, z, .26, .28, 6), C('face', x, y + .26, z, .265, .025, 6), B('led', x, y + .14, z + .23, .06, .025, .01)]),
    ...[[-.24, 0], [.24, 0]].map(([x, z]) => B('port', x, .08, z + .225, .14, .08, .01))],
  mailsrv: [B('base', 0, 0, 0, .7, .05, .6), B('body', 0, .05, 0, .6, .44, .5), C('body', 0, .49, 0, .3, .5, 18, null, [PI / 2, 0, 0]),
    B('face', 0, .2, .255, .48, .02, .02), B('port', 0, .36, .257, .3, .03, .015), B('face', 0, .1, .255, .5, .3, .01), C('detail', .4, .05, 0, .02, .7, 6), B('led', .48, .62, 0, .14, .1, .02)],
  /* ===== IoT(粉) ===== */
  ipcam: [B('base', 0, 0, -.4, .3, .56, .06), ...ROW(2, .12, .44, y => C('port', 0, y, -.365, .03, .012, 10, null, [PI / 2, 0, 0])), B('detail', 0, .42, -.28, .06, .06, .2), S('detail', 0, .45, -.18, .06),
    B('body', 0, .32, .05, .3, .26, .66), B('face', 0, .3, .05, .32, .04, .62), C('face', 0, .45, .39, .12, .04, 18, null, [PI / 2, 0, 0]), C('port', 0, .45, .41, .085, .02, 18, null, [PI / 2, 0, 0]),
    S('detail', 0, .45, .4, .05), B('detail', 0, .58, .12, .38, .03, .8), ...ROW(4, -.08, .08, x => B('led', x, .38, .385, .018, .018, .01)), B('led', .11, .52, .385, .025, .025, .01), ...vents(4, -.08, .08, .4, -.27, .015, .1)],
  plc: [B('base', 0, 0, 0, 1, .08, .4), B('detail', 0, .08, -.05, 1, .05, .1), ...ROW(6, -.4, .4, (x, i) => [B('body', x, .1, 0, .13, .4 + (i % 3) * .12, .34), B('face', x, .2, .175, .1, .2, .01), B('led', x, .44 + (i % 3) * .12, .176, .03, .03, .01), B('port', x, .14, .176, .08, .04, .01)]).flat()],
  sensor: [C('base', 0, 0, 0, .3, .05, 18), C('detail', 0, .05, 0, .04, .4, 8), C('body', 0, .45, 0, .28, .1, 18), S('face', 0, .55, 0, .26), S('led', 0, .62, .22, .04),
    TO('detail', 0, .6, 0, .38, .015, PI * .6, [0, 0, PI * .2]), TO('detail', 0, .6, 0, .48, .015, PI * .6, [0, 0, PI * .2])],
  hmi: [B('base', 0, 0, 0, .7, .05, .6), B('body', 0, .05, 0, .6, .5, .5), B('body', 0, .55, -.02, .6, .4, .3, [-.5, 0, 0]), B('face', 0, .6, .07, .5, .3, .015, [-.5, 0, 0]),
    ...[0, 1].flatMap(r => ROW(4, -.2, .2, x => B(r ? 'led' : 'port', x, .25 + r * .12, .255, .07, .06, .015))), B('detail', 0, .1, .255, .5, .06, .015)],
  pos: [B('base', 0, 0, 0, .9, .06, .7), B('body', 0, .06, 0, .8, .18, .6), ...ROW(4, -.3, .0, x => B('port', x, .24, .1, .06, .02, .06)), C('detail', .25, .24, -.2, .1, .3, 14, null, [0, 0, PI / 2]),
    C('detail', 0, .24, -.05, .03, .2, 8), B('body', 0, .42, .02, .5, .36, .04, [-.35, 0, 0]), B('face', 0, .45, .045, .44, .3, .01, [-.35, 0, 0]), B('led', .35, .24, .3, .04, .02, .01)],
  /* ===== 外部 / 威胁(红) ===== */
  /* 兜帽黑客:坐姿半身 + 打开的笔记本(屏幕红光朝向人物,背面灯标朝外),正面 +Z */
  attacker: [B('base', 0, 0, .02, .84, .04, .8),
    /* 卫衣躯干(上窄下宽)+ 圆肩 */
    C('body', 0, .04, -.16, .19, .36, 8, .25), S('body', -.15, .36, -.16, .085), S('body', .15, .36, -.16, .085),
    B('face', 0, .1, .07, .2, .09, .02), B('detail', -.035, .27, .08, .012, .1, .012), B('detail', .035, .27, .08, .012, .1, .012),
    /* 兜帽 + 帽檐 + 深色帽内 + 红色面罩线 */
    S('body', 0, .56, -.15, .155), TO('face', 0, .55, .012, .108, .03, PI), C('port', 0, .54, -.002, .102, .03, 10, null, [PI / 2, 0, 0]),
    B('led', 0, .555, .018, .13, .018, .01),
    /* 手臂:肩 → 键盘 */
    C('body', -.15, .03, -.01, .045, .42, 6, null, [-.78, 0, 0]), C('body', .15, .03, -.01, .045, .42, 6, null, [-.78, 0, 0]),
    B('face', -.12, .065, .16, .07, .035, .08), B('face', .12, .065, .16, .07, .035, .08),
    /* 笔记本:底座 + 键盘 + 后倾屏幕(红光) + 背面灯标 */
    B('detail', 0, .04, .22, .46, .025, .26), B('port', 0, .066, .2, .36, .004, .15),
    B('detail', 0, .05, .36, .46, .32, .02, [.22, 0, 0]), B('led', 0, .07, .345, .4, .26, .006, [.22, 0, 0]),
    B('led', 0, .18, .385, .05, .05, .006, [.22, 0, 0])],
  botnet: [S('body', 0, .45, 0, .18), TO('detail', 0, .45, 0, .36, .01, 2 * PI, [PI / 2, 0, 0]), ...ROW(6, 0, 5, (i) => O('face', Math.cos(i * PI / 3) * .38, .38, Math.sin(i * PI / 3) * .38, .09)),
    ...ROW(6, 0, 5, (i) => B('detail', Math.cos(i * PI / 3) * .2, .44, Math.sin(i * PI / 3) * .2, .2, .01, .01, [0, -i * PI / 3, 0])), S('led', 0, .64, 0, .04), C('base', 0, 0, 0, .1, .27, 8)],
  /* C2:指挥服务器塔 + 顶部碟形天线与发射弧 */
  c2: [B('base', 0, 0, 0, .62, .04, .62), B('body', 0, .04, 0, .44, .5, .44), B('face', 0, .1, .225, .36, .38, .02),
    ...ROW(4, .14, .4, y => [B('port', -.04, y, .238, .22, .03, .01), B('led', .13, y + .005, .238, .03, .02, .01)]).flat(),
    C('detail', 0, .54, 0, .03, .14, 6), C('face', 0, .7, .02, .14, .05, 8, .04, [.5, 0, 0]), S('led', 0, .76, .07, .03),
    TO('detail', 0, .8, .1, .16, .014, PI * .7, [-.5, 0, PI * .15]), TO('detail', 0, .82, .12, .25, .014, PI * .7, [-.5, 0, PI * .15])],
  internet: [C('base', 0, 0, 0, .18, .03, 8), C('detail', 0, .03, 0, .025, .08, 6), S('body', 0, .48, 0, .34),
    TO('face', 0, .48, 0, .35, .012, 2 * PI, [PI / 2, 0, 0]), TO('face', 0, .48, 0, .35, .012, 2 * PI, [0, 0, 0]),
    TO('detail', 0, .48, 0, .46, .014, 2 * PI, [PI / 2 + .35, .2, .25]), S('led', .42, .6, .08, .03)],
  /* 内部威胁:站姿西装人物 + 工牌 + 抱着外泄的文件盒,与攻击者同一人形语言 */
  insider: [C('base', 0, 0, 0, .3, .04, 10),
    B('port', -.07, .04, 0, .1, .34, .12), B('port', .07, .04, 0, .1, .34, .12),
    C('body', 0, .38, 0, .17, .3, 8, .14), S('body', -.16, .64, 0, .08), S('body', .16, .64, 0, .08),
    B('detail', 0, .5, .12, .08, .17, .03, [.12, 0, 0]), B('face', 0, .48, .14, .03, .15, .01, [.12, 0, 0]),
    B('led', .09, .55, .14, .05, .065, .01, [.12, 0, 0]), B('detail', .06, .6, .13, .01, .08, .01, [.12, 0, -.35]),
    C('detail', 0, .68, 0, .05, .05, 6), S('detail', 0, .8, 0, .1), S('port', 0, .84, -.015, .1),
    C('body', -.2, .36, 0, .04, .28, 6, null, [0, 0, -.12]), C('body', .19, .44, .07, .04, .2, 6, null, [1.2, 0, 0]),
    B('face', .14, .4, .19, .2, .16, .12), B('led', .14, .48, .25, .14, .012, .006)],

  /* ===== v7 新增 ===== */
  aggswitch: [B('base', 0, 0, 0, .74, .04, .6), ...[0, 1].flatMap(k => [B('body', 0, .05 + k * .26, 0, .7, .2, .56), B('face', 0, .08 + k * .26, .285, .64, .14, .02),
    ...ROW(6, -.26, .12, x => B('port', x, .1 + k * .26, .298, .045, .05, .01)), ...leds(2, .2, .27, .16 + k * .26, .298, .02)]), ...ROW(2, -.18, .18, x => B('detail', x, .25, 0, .06, .06, .5)),
    ...ROW(3, -.2, .2, x => C('detail', x, .51, -.12, .015, .32, 6, null, [.5, 0, 0])), ...ROW(3, -.2, .2, x => S('led', x, .8, -.26, .022))],
  nta: [...rack(.86, .22, .6, .16), ...ROW(4, -.32, -.02, x => B('port', x, .09, .315, .06, .05, .02)), B('led', .2, .17, .318, .3, .025, .012), ...leds(3, .1, .3, .1, .318, .025),
    C('detail', 0, .27, 0, .02, .34, 8), S('face', 0, .7, 0, .1), TO('detail', 0, .7, 0, .16, .012, 2 * PI, [PI / 2, 0, 0]), S('led', 0, .82, 0, .025)],
  hids: [B('base', 0, 0, 0, .8, .04, .6), B('body', 0, .04, 0, .7, .42, .5), B('face', 0, .1, .255, .6, .3, .02), ...ROW(3, .16, .32, y => B('led', -.1, y, .268, .3, .025, .012)),
    ...ROW(2, .18, .3, x => B('port', x, .2, .268, .08, .08, .012)), ...ROW(4, -.3, .3, x => C('detail', x, .46, 0, .02, .18, 6)), TO('detail', 0, .64, 0, .36, .025, 2 * PI, [PI / 2, 0, 0]), S('face', 0, .56, 0, .1), S('led', 0, .66, 0, .03)],
  appsrv: [B('base', 0, 0, 0, .8, .04, .56), B('body', 0, .04, 0, .74, .62, .5), ...ROW(6, -.28, .28, x => [B('face', x, .08, .255, .08, .5, .02), B('led', x, .52, .268, .025, .02, .01), B('port', x, .12, .268, .045, .06, .01)]).flat(),
    ...ROW(2, -.18, .18, x => C('port', x, .66, 0, .1, .01, 14)), B('detail', 0, .66, 0, .66, .008, .44), C('detail', 0, .67, -.1, .03, .2, 6), S('led', 0, .88, -.1, .03)],
  cache: [C('base', 0, 0, 0, .3, .04, 18), C('body', 0, .04, 0, .24, .78, 18), ...[.25, .5].map(y => C('face', 0, y, 0, .25, .04, 18)), B('detail', .3, .1, 0, .26, .5, .3),
    B('led', .43, .3, 0, .02, .16, .1, [.5, 0, 0]), B('led', .43, .22, .02, .02, .12, .06, [-.4, 0, 0]), B('port', .3, .14, .155, .16, .04, .01), C('detail', 0, .82, 0, .1, .14, 10), S('led', 0, .98, 0, .04)],
  objstore: [C('base', 0, 0, 0, .34, .05, 20), C('body', 0, .05, 0, .46, .62, 20, .32), ...[.2, .45].map(y => C('face', 0, y, 0, .32 + y * .28, .04, 20)),
    C('detail', 0, .67, 0, .48, .05, 20), C('port', 0, .72, 0, .2, .04, 14), B('led', 0, .32, .4, .14, .03, .03), B('led', 0, .55, .44, .14, .03, .03)],
  mq: [B('base', 0, 0, 0, 1, .04, .55), B('body', 0, .04, 0, .92, .2, .5), B('face', 0, .08, .255, .84, .12, .02), ...leds(4, -.28, .28, .14, .268, .022), ...ROW(3, -.3, .3, x => B('port', x, .09, .268, .07, .03, .01)),
    ...ROW(3, -.28, .28, x => [C('detail', x, .24, 0, .1, .36, 10), C('face', x, .36, 0, .105, .025, 10), C('face', x, .5, 0, .105, .025, 10), S('led', x, .62, 0, .025)]).flat()],
  k8smaster: [C('base', 0, 0, 0, .5, .05, 6), C('body', 0, .05, 0, .44, .5, 6), C('face', 0, .3, 0, .45, .05, 6), ...ROW(6, 0, 5, i => B('led', Math.sin(i * PI / 3) * .39, .18, Math.cos(i * PI / 3) * .39, .06, .04, .02, [0, i * PI / 3, 0])),
    C('detail', 0, .55, 0, .06, .16, 8), TO('face', 0, .78, 0, .22, .03, 2 * PI, [PI / 2, 0, 0]), ...ROW(7, 0, 6, i => B('detail', 0, .78, 0, .44, .025, .025, [0, i * PI / 7, 0])), S('led', 0, .78, 0, .05)],
  k8snode: [C('base', 0, 0, 0, .44, .05, 6), C('body', 0, .05, 0, .38, .86, 6), C('face', 0, .55, 0, .39, .04, 6), C('face', 0, .9, 0, .39, .04, 6),
    ...ROW(3, .12, .42, y => [B('port', 0, y, .325, .26, .08, .02), B('led', .1, y + .03, .337, .03, .02, .01)]).flat(), C('detail', 0, .94, 0, .14, .05, 6)],
  registry: [B('base', 0, 0, 0, 1, .05, .8), B('body', 0, .05, 0, .9, .3, .7), B('face', 0, .09, .355, .82, .22, .02), ...leds(3, -.3, -.1, .24, .368, .025), ...ROW(4, .05, .35, x => B('port', x, .14, .368, .05, .08, .01)),
    B('detail', -.22, .35, -.05, .4, .42, .5), ...ROW(4, -.38, -.06, x => B('face', x, .37, .205, .04, .16, .01)), B('detail', .24, .35, .02, .34, .55, .4), ...ROW(3, .12, .36, x => B('face', x, .38, .225, .04, .26, .01)), B('detail', -.2, .77, -.12, .3, .2, .3)],
  cnapp: [B('base', 0, 0, 0, 1, .04, .5), B('body', 0, .04, 0, .96, .3, .42), ...ROW(10, -.42, .42, x => B('face', x, .06, .215, .04, .26, .02)),
    B('body', .1, .34, -.04, .66, .26, .34), ...ROW(7, -.16, .36, x => B('face', x, .36, .135, .035, .22, .02)), B('detail', .48, .06, 0, .02, .26, .38), B('detail', .435, .36, -.04, .02, .22, .3),
    B('led', .38, .3, .225, .05, .03, .01), B('led', .38, .55, .14, .05, .03, .01), ...ROW(2, -.1, .1, z => B('port', .495, .08, z, .015, .22, .02))],
  workstation: [B('base', -.32, 0, -.02, .32, .03, .62), B('body', -.32, .03, -.02, .28, .76, .58), B('face', -.32, .55, .275, .22, .18, .015), ...vents(5, -.42, -.22, .22, .275, .03, .014),
    B('led', -.32, .66, .282, .03, .03, .01), B('port', -.32, .45, .282, .14, .03, .01),
    ...[-1, 1].flatMap(k => [B('body', .2 + k * .2, .3, -.05, .38, .3, .04, [0, -k * .25, 0]), B('face', .2 + k * .2, .32, -.025, .34, .25, .01, [0, -k * .25, 0])]),
    B('base', .2, 0, 0, .34, .025, .2), C('detail', .2, .025, -.05, .025, .3, 8), B('port', .2, .025, .25, .5, .02, .12)],
  opsterm: [B('body', -.08, 0, .1, .7, .045, .5), B('face', -.08, .045, .13, .6, .008, .26), ...ROW(5, -.3, .14, x => B('port', x, .05, .03, .08, .006, .05)),
    B('body', -.08, .045, -.15, .7, .48, .035, [-.3, 0, 0]), B('face', -.08, .08, -.13, .62, .4, .01, [-.3, 0, 0]),
    B('detail', .4, 0, .05, .12, .3, .3), ...ROW(3, .1, .22, y => B('port', .465, y, .05, .01, .03, .16)), B('led', .465, .26, .15, .01, .025, .025),
    B('body', .4, .3, -.15, .24, .2, .03), B('face', .4, .315, -.13, .2, .16, .01), C('detail', .4, .2, -.15, .015, .1, 6)],
  kiosk: [B('base', 0, 0, 0, .5, .04, .5), B('body', 0, .04, -.04, .34, .5, .34), B('face', 0, .2, .135, .28, .08, .015), B('port', -.06, .32, .14, .12, .015, .02), B('port', .06, .12, .14, .14, .04, .02),
    B('body', 0, .52, .06, .8, .46, .06, [-.45, 0, 0]), B('face', 0, .55, .095, .72, .38, .01, [-.45, 0, 0]), ...leds(2, .08, .12, .3, .145, .02), B('detail', 0, .92, -.12, .6, .05, .1), B('led', 0, .93, -.065, .5, .02, .01)],
  term3p: [B('base', 0, 0, 0, .5, .04, .5), C('detail', 0, .04, -.05, .03, .36, 8), B('detail', 0, .38, -.05, .2, .06, .1), B('body', 0, .36, 0, .7, .5, .04, [-.4, 0, 0]),
    B('face', 0, .39, .025, .62, .42, .01, [-.4, 0, 0]), S('led', 0, .82, -.17, .015), B('face', .3, .04, .18, .16, .12, .02, [-.2, 0, 0]), B('led', .3, .12, .2, .1, .02, .01, [-.2, 0, 0])],
  iotgw: [B('base', 0, 0, 0, .7, .04, .5), B('body', 0, .04, 0, .62, .28, .42), B('face', 0, .08, .215, .54, .2, .02), ...leds(4, -.2, .1, .22, .228, .025), ...ROW(2, .16, .24, x => B('port', x, .1, .228, .05, .05, .01)),
    ...ROW(6, -.2, .2, z => B('port', .315, .08, z * .8, .02, .05, .04)), C('detail', -.22, .32, -.12, .018, .5, 6), C('detail', .22, .32, -.12, .018, .5, 6), S('led', -.22, .83, -.12, .025), S('led', .22, .83, -.12, .025)],

};

/* 原子 → 几何(中心构造、旋转、再平移);分段数随尺寸自适应 */
function segFor(size, prefer) {
  const p = prefer || 10;
  if (size < .06) return Math.min(p, 8);
  if (size < .18) return Math.min(p, 10);
  return Math.min(p, 12);
}
/* rbox:不再做自制倒角(旧实现把带 index 的 BoxGeometry 当作非索引数组拼接,生成交叉斜三角),直接用 BoxGeometry 原始顶点 */
function atomGeo(T, a) {
  const g0 = atomGeo0(T, a); if (a.flat && a.s !== 'box' && a.s !== 'rbox') { g0.deleteAttribute('normal'); g0.computeVertexNormals(); } return g0;
}
function atomGeo0(T, a) {
  let g, cy;
  if (a.s === 'box') { g = new T.BoxGeometry(a.w, a.h, a.d); cy = a.y + a.h / 2; }
  else if (a.s === 'rbox') { g = new T.BoxGeometry(a.w, a.h, a.d); cy = a.y + a.h / 2; }
  else if (a.s === 'cyl') { const seg = segFor(Math.max(a.rt, a.rb) * 2, a.seg); g = new T.CylinderGeometry(a.rt, a.rb, a.h, seg, 1); cy = a.y + a.h / 2; }
  else if (a.s === 'cone') { const seg = segFor(a.rad * 2, a.seg); g = new T.ConeGeometry(a.rad, a.h, seg); cy = a.y + a.h / 2; }
  else if (a.s === 'tor') { const rs = segFor(a.R * 2, 16), ts = segFor(a.t * 2, 6); g = new T.TorusGeometry(a.R, a.t, Math.max(4, ts), Math.max(10, rs), a.arc); cy = a.y; }
  else if (a.s === 'oct') { g = new T.OctahedronGeometry(a.rad); cy = a.y; }
  else { const ws = segFor(a.rad * 2, 10), hs = Math.max(6, Math.round(ws * .7)); g = new T.SphereGeometry(a.rad, ws, hs); cy = a.y; }
  if (a.rot) { const e = new T.Euler(a.rot[0], a.rot[1], a.rot[2]); g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(e)); }
  g.translate(a.x, cy, a.z);
  return g.index ? g.toNonIndexed() : g;
}
/* 同角色原子拼接:每个原子先 toNonIndexed,保持各自原始顶点与硬边法线;不跨原子焊接、不平均法线 */
function mergeGeos(T, list) {
  list = list.map(g => g.index ? g.toNonIndexed() : g);
  let n = 0; list.forEach(g => n += g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  list.forEach(g => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); });
  /* 剔除零面积三角(球/锥极点处) */
  const kp = [], kn = [];
  for (let t = 0; t < n; t += 3) {
    const i = t * 3, ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
    const ux = pos[i + 3] - ax, uy = pos[i + 4] - ay, uz = pos[i + 5] - az, vx = pos[i + 6] - ax, vy = pos[i + 7] - ay, vz = pos[i + 8] - az;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * cx + cy * cy + cz * cz < 4e-16) continue;
    for (let j = 0; j < 9; j++) { kp.push(pos[i + j]); kn.push(nor[i + j]); }
  }
  const m = new T.BufferGeometry(); m.setAttribute('position', new T.Float32BufferAttribute(kp, 3)); m.setAttribute('normal', new T.Float32BufferAttribute(kn, 3)); return m;
}
/** 近似 AO:凹处/底面/朝下法线变暗,写入 aAo attribute */
function bakeAO(geo, role) {
  const P = geo.attributes.position, N = geo.attributes.normal, n = P.count;
  const ao = new Float32Array(n);
  let ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < n; i++) { const y = P.getY(i); if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
  const yr = Math.max(1e-4, ymax - ymin);
  const roleBias = { port: .9, detail: .94, base: .92, led: 1, face: .97, body: 1 }[role] || .95;
  for (let i = 0; i < n; i++) {
    const ny = N.getY(i), h = (P.getY(i) - ymin) / yr;
    let a = roleBias * (0.9 + 0.07 * h + 0.04 * Math.max(0, ny));
    ao[i] = Math.max(.85, Math.min(1, a));
  }
  geo.setAttribute('aAo', new root.THREE.BufferAttribute(ao, 1));
}
const GCACHE = {};
/* 构建并归一化到 CUBE 立方体(最长边=CUBE,底面 y=0,水平居中),按角色合并 */
function buildModel(T, type) {
  if (GCACHE[type]) return GCACHE[type];
  const atoms = RSPEC[type].flat().map(a => SPEC[type] && SPEC[type].cat === 'ext' ? Object.assign({ flat: true }, a) : a), geos = atoms.map(a => ({ r: a.r, g: atomGeo(T, a) }));
  const bb = new T.Box3(); geos.forEach(x => { x.g.computeBoundingBox(); bb.union(x.g.boundingBox); });
  const raw = bb.getSize(new T.Vector3()), k = CUBE / Math.max(raw.x, raw.y, raw.z);
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, y0 = bb.min.y;
  geos.forEach(x => { x.g.translate(-cx, -y0, -cz); x.g.scale(k, k, k); });
  const parts = [];
  ROLES.forEach(role => {
    const L = geos.filter(x => x.r === role).map(x => x.g); if (!L.length) return;
    const g = mergeGeos(T, L); bakeAO(g, role); g.computeBoundingBox(); g.computeBoundingSphere();
    const tris = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    const verts = g.attributes.position.count;
    parts.push({ role, name: role + '_' + String(parts.length).padStart(2, '0'), geo: g, tris, verts });
  });
  const box = new T.Box3(); parts.forEach(p => box.union(p.geo.boundingBox));
  const tris = parts.reduce((t, p) => t + p.tris, 0), verts = parts.reduce((t, p) => t + p.verts, 0);
  return (GCACHE[type] = { parts, box, norm: k, raw: { x: +raw.x.toFixed(4), y: +raw.y.toFixed(4), z: +raw.z.toFixed(4) }, atoms: atoms.length, tris, verts });
}
/* 设备着色器:半球环境 + 朗伯 + 低光泽 Blinn-Phong + 收窄边缘光 + 顶点 AO;led 不受光照 */
const VS_DEV = 'attribute float aAo;varying vec3 vN;varying vec3 vV;varying float vAo;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);vAo=aAo;gl_Position=projectionMatrix*mv;}';
const FS_DEV = 'uniform vec3 uColor,uRim,uHemiSky,uHemiGnd;uniform float uRimK,uLam,uAmb,uSpec,uShin,uFill;varying vec3 vN;varying vec3 vV;varying float vAo;void main(){vec3 N=normalize(vN);vec3 V=normalize(vV);vec3 Ldir=normalize(vec3(.35,.85,.45));float ndl=max(dot(N,Ldir),0.);float hemi=.5+.5*N.y;vec3 ambCol=mix(uHemiGnd,uHemiSky,hemi);float ambL=dot(ambCol,vec3(.2126,.7152,.0722));float shade=mix(uFill,1.,smoothstep(0.,1.,ndl)*.85);float lit=shade*(.55+uAmb*ambL*.9);vec3 diff=uColor*lit;vec3 H=normalize(Ldir+V);float sp=pow(max(dot(N,H),0.),uShin)*uSpec*ndl;float fr=pow(1.-max(abs(dot(N,V)),0.),3.6);vec3 c=(diff+uRim*sp*.55+uRim*fr*uRimK*.85)*vAo;gl_FragColor=vec4(c,1.);}';
const ROLE_FIX = { dark: { base: '#556578', port: '#3a4860', detail: '#a8b6c8' }, light: { base: '#7a8a9c', port: '#4a586c', detail: '#b0bec8' } };
const ROLE_K = { dark: { body: .78, face: 1.0, rim: { body: .22, face: .14, base: .08, port: .04, led: 0, detail: .12 }, spec: { body: .18, face: .22, base: .06, port: .04, led: 0, detail: .12 }, shin: { body: 28, face: 36, base: 16, port: 20, led: 1, detail: 24 } }, light: { body: .88, face: 1.0, rim: { body: .12, face: .08, base: .04, port: .03, led: 0, detail: .07 }, spec: { body: .12, face: .14, base: .04, port: .03, led: 0, detail: .08 }, shin: { body: 32, face: 40, base: 18, port: 22, led: 1, detail: 28 } } };
function roleColor(T, main, role, theme) {
  const F = ROLE_FIX[theme]; if (F[role]) return new T.Color(F[role]);
  if (role === 'led') { const hot = main.r > main.g * 2 && main.r > main.b * 2; return main.clone().lerp(new T.Color(hot ? '#ffb0b0' : '#ffffff'), hot ? .25 : .55); }
  return main.clone().multiplyScalar(ROLE_K[theme][role]);
}
function hemiColors(theme) {
  return theme === 'light' ? { sky: new root.THREE.Color('#ffffff'), gnd: new root.THREE.Color('#d8dee8') } : { sky: new root.THREE.Color('#e2eaf5'), gnd: new root.THREE.Color('#5a6880') };
}
function devMat(T, main, role, theme) {
  const c = roleColor(T, main, role, theme), H = hemiColors(theme), K = ROLE_K[theme];
  return new T.ShaderMaterial({ uniforms: {
    uColor: { value: c.clone() }, uRim: { value: main.clone() }, uRimK: { value: K.rim[role] },
    uLam: { value: role === 'led' ? 0 : 1 },
    uAmb: { value: theme === 'light' ? .45 : .4 },
    uFill: { value: theme === 'light' ? .78 : .80 },
    uSpec: { value: K.spec[role] * .75 }, uShin: { value: K.shin[role] },
    uHemiSky: { value: H.sky }, uHemiGnd: { value: H.gnd },
  }, vertexShader: VS_DEV, fragmentShader: FS_DEV,
  /* 贴在面板上的细部与面板共面,深度偏移防 z-fighting(不改几何) */
  polygonOffset: true, polygonOffsetFactor: { body: 0, base: 1, face: -1, detail: -2, port: -3, led: -4 }[role] || 0, polygonOffsetUnits: { body: 0, base: 1, face: -1, detail: -2, port: -3, led: -4 }[role] || 0 });
}
/** 脚下柔和接触阴影(径向渐变贴片,非发光底座) */
function contactShadow(T, theme, size) {
  const key = 'cs|' + theme + '|' + size.toFixed(2);
  if (texCache[key]) { const geoKey = 'csg|' + size.toFixed(2); if (!texCache[geoKey]) texCache[geoKey] = new T.PlaneGeometry(size, size);
  const m = new T.Mesh(texCache[geoKey], new T.MeshBasicMaterial({ map: texCache[key], transparent: true, depthWrite: false, opacity: 1 })); m.rotation.x = -PI / 2; m.position.y = .001; m.renderOrder = -2; m.userData.isContactShadow = true; return m; }
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, theme === 'light' ? 'rgba(30,40,60,.22)' : 'rgba(0,0,0,.25)');
  g.addColorStop(.5, theme === 'light' ? 'rgba(30,40,60,.08)' : 'rgba(0,0,0,.1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const tex = new T.CanvasTexture(c); texCache[key] = tex;
  const geoKey = 'csg|' + size.toFixed(2); if (!texCache[geoKey]) texCache[geoKey] = new T.PlaneGeometry(size, size);
  const m = new T.Mesh(texCache[geoKey], new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 1 }));
  m.rotation.x = -PI / 2; m.position.y = .001; m.renderOrder = -2; m.userData.isContactShadow = true; return m;
}

/**
 * createNode(type, opts) — 接口兼容 v1/v2
 * opts: theme, size, badge/label, ring/frame, mask, color
 * 场景需要: NODELIB.addLights(scene, theme); 组合示例用 setupBloom(renderer)
 */
function createNode(type, opts) {
  const T = root.THREE; if (!T) throw new Error('需要 THREE');
  const o = opts || {}; const sp = SPEC[type]; if (!sp) throw new Error('未知节点类型 ' + type);
  const theme = o.theme === 'light' || o.theme === 'dark' ? o.theme : THEME, day = theme === 'light';
  const cat = CATS[sp.cat], fr = FRAME[theme];
  const color = new T.Color(o.color || cat[theme]);
  const scale = (o.size != null ? o.size : 1) || 1; /* 整体倍数,默认 1;不再用 S/M/L/XL */
  const group = new T.Group(); group.name = 'node:' + type;
  const body = new T.Group(); group.add(body);
  if (sp.squash) body.scale.set(sp.squash[0], sp.squash[1], sp.squash[2]);
  const mats = [], disp = []; const mk = m => { mats.push(m); return m; };
  const bodyC = new T.Color(day ? cat.light : cat.dark);
  const emI = 0; /* v6:无 emissive;朗伯 + 边缘光 */
  const M = buildModel(T, type);
  const roleMats = {}; const bodyMeshes = [];
  M.parts.forEach(pt => {
    const mat = o.mask ? mk(new T.MeshBasicMaterial({ color: 0xffffff })) : (roleMats[pt.role] = mk(devMat(T, bodyC, pt.role, theme)));
    const m = new T.Mesh(pt.geo, mat); m.name = pt.name; body.add(m);
    if (!o.mask && (pt.role === 'body' || pt.role === 'face')) bodyMeshes.push(m);
  });
  const box = M.box.clone(); const size = box.getSize(new T.Vector3()); const norm = M.norm, raw = M.raw;
  group.scale.setScalar(scale);
  group.add(contactShadow(T, theme, Math.max(size.x, size.z) * 0.85 + .08));
  const radius = Math.max(size.x, size.z) * .5 * scale;
  const out = { group, type, spec: sp, cat: sp.cat, color, theme, scale, norm, rawSize: raw, roles: M.parts.map(p => p.name), tris: M.tris, verts: M.verts, parts: M.parts.length, mats: M.parts.length, stats: { tris: M.tris, verts: M.verts, parts: M.parts.length, mats: M.parts.length }, bounds: { height: box.max.y * scale, radius, cube: CUBE * scale, size: { x: +(size.x * scale).toFixed(4), y: +(size.y * scale).toFixed(4), z: +(size.z * scale).toFixed(4) } }, state: 'normal' };
  if (o.mask) { out.update = () => { }; out.setState = () => { }; out.setLabel = () => { }; out.dispose = () => { mats.forEach(m => m.dispose()); }; return out; }

  /* 状态描边:EdgesGeometry 合集,默认隐藏;选中白 / 被攻击红 / 已防护青 */
  const edgeGroup = new T.Group(); edgeGroup.visible = false; body.add(edgeGroup);
  const edgeMat = mk(new T.LineBasicMaterial({ color: new T.Color(fr.outline), transparent: true, opacity: 0.95, depthTest: true }));
  bodyMeshes.forEach(m => {
    const eg = new T.EdgesGeometry(m.geometry, 25); disp.push(eg);
    const ls = new T.LineSegments(eg, edgeMat);
    ls.position.copy(m.position); ls.rotation.copy(m.rotation); ls.scale.copy(m.scale);
    edgeGroup.add(ls);
  });
  /* 已防护:薄半透明护罩(普通混合,不加色外扩) */
  const domeR = Math.max(CUBE * .55 + .2, (box.max.y - box.min.y) * .55 + .15);
  const domeGeo = new T.SphereGeometry(domeR, 16, 10, 0, PI * 2, 0, PI * .55); disp.push(domeGeo);
  const domeMat = mk(new T.MeshStandardMaterial({ color: new T.Color(fr.protected), transparent: true, opacity: 0, roughness: .55, metalness: .05, flatShading: true, depthWrite: false, side: T.DoubleSide, emissive: new T.Color(fr.protected), emissiveIntensity: .08 }));
  const dome = new T.Mesh(domeGeo, domeMat); dome.position.y = (box.max.y + box.min.y) / 2; dome.visible = false; body.add(dome);

  let tag = null; const tagText = typeof o.label === 'string' ? o.label : (typeof o.badge === 'string' ? o.badge : sp.abbr);
  const showTag = o.badge !== false && o.label !== false;
  out.setLabel = text => { if (tag) { group.remove(tag); tag.material.dispose(); } tag = text ? labelPlate(T, text, theme, '#' + new T.Color(cat[theme]).getHexString()) : null; if (tag) { tag.position.set(0, box.max.y + .12, 0); group.add(tag); } };
  if (showTag) out.setLabel(tagText);

  const cSel = new T.Color(fr.outline), cAtk = new T.Color(fr.attacked), cDef = new T.Color(fr.protected);
  
  out.setState = s => { out.state = STATES[s] ? s : 'normal'; };
  out.update = t => {
    const s = out.state, sel = s === 'selected', atk = s === 'attacked', pro = s === 'protected';
    const flash = atk ? (.55 + .45 * Math.sin(t * 12)) : 0;
    edgeGroup.visible = sel || atk || pro;
    if (sel) edgeMat.color.copy(cSel);
    else if (atk) edgeMat.color.copy(cAtk);
    else if (pro) edgeMat.color.copy(cDef);
    edgeMat.opacity = atk ? (.5 + .5 * flash) : .95;
    dome.visible = pro; domeMat.opacity = pro ? (day ? .14 : .18) : 0;
    /* 被攻击:主体与面板偏红 */
    ['body', 'face'].forEach(r => { const mm = roleMats[r]; if (!mm) return; const base = roleColor(T, bodyC, r, theme);
      mm.uniforms.uColor.value.copy(atk ? base.lerp(cAtk, .35 + .4 * flash) : base); mm.uniforms.uRimK.value = ROLE_K[theme].rim[r] * (sel ? 1.5 : 1); });
    body.position.x = atk ? Math.sin(t * 38) * .02 : 0;
  };
  out.dispose = () => { disp.forEach(g => g.dispose && g.dispose()); mats.forEach(m => m.dispose()); if (tag) tag.material.dispose(); };
  out.update(0);
  return out;
}

function createZoneLabel(text, opts) {
  const T = root.THREE, o = opts || {}, theme = o.theme === 'light' || o.theme === 'dark' ? o.theme : THEME, Z = ZONE[theme];
  const fs = 110, c0 = document.createElement('canvas').getContext('2d'); c0.font = 'bold ' + fs + 'px "Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif';
  const w = Math.ceil(c0.measureText(text).width) + 48, h = 148;
  const tex = canvasTex(T, 'zl2|' + text + theme, w, h, x => {
    x.fillStyle = theme === 'light' ? Z.text : 'rgba(245,248,255,.82)';
    x.font = c0.font; x.textBaseline = 'middle'; x.fillText(text, 24, h / 2);
  });
  const height = o.height || 1.05; const g = new T.PlaneGeometry(height * w / h, height);
  const m = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: .95 });
  const mesh = new T.Mesh(g, m); mesh.rotation.x = -PI / 2; mesh.position.y = .04; mesh.renderOrder = 3;
  mesh.userData.width = height * w / h; mesh.userData.dispose = () => { g.dispose(); m.dispose(); };
  return mesh;
}
/**
 * createZone({ title, w, d, color:'violet'|'gray'|css, theme, titleSize, nested:false, pad })
 * 旧图风格:很暗近透明底板 + 细网格 + 紫色发光细描边; nested=true 时做子分区(略浅、略小描边)
 */
function createZone(opts) {
  const T = root.THREE, o = opts || {}, theme = o.theme === 'light' || o.theme === 'dark' ? o.theme : THEME, day = theme === 'light', Z = ZONE[theme];
  const w = o.w || 8, d = o.d || 6, nested = !!o.nested;
  const edge = new T.Color(Z[o.color] || o.color || Z.violet);
  const g = new T.Group(); g.name = 'zone:' + (o.title || ''); const disp = [];
  const pg = new T.PlaneGeometry(w, d); disp.push(pg);
  // 底板:夜间几乎透明的深色,日间浅半透明
  const pm = new T.MeshBasicMaterial({ color: new T.Color(Z.plate), transparent: true, opacity: day ? (nested ? .5 : .62) : (nested ? .18 : .22), depthWrite: false }); disp.push(pm);
  const plate = new T.Mesh(pg, pm); plate.rotation.x = -PI / 2; plate.position.y = nested ? .004 : .002; g.add(plate);
  const gp = [], step = o.grid || .4;
  for (let x = -w / 2 + step; x < w / 2 - 1e-6; x += step) gp.push(x, .008, -d / 2, x, .008, d / 2);
  for (let z = -d / 2 + step; z < d / 2 - 1e-6; z += step) gp.push(-w / 2, .008, z, w / 2, .008, z);
  const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(gp, 3)); disp.push(gg);
  const gm = new T.LineBasicMaterial({ color: new T.Color(Z.grid), transparent: true, opacity: day ? .35 : .22, depthWrite: false }); disp.push(gm);
  g.add(new T.LineSegments(gg, gm));
  // 发光描边(bloom 层)
  const bw = nested ? .035 : .045;
  const bm = new T.MeshBasicMaterial({ color: edge, transparent: true, opacity: day ? .85 : .9, depthWrite: false }); disp.push(bm);
  const border = new T.Group();
  [[0, -d / 2, w + bw, bw], [0, d / 2, w + bw, bw], [-w / 2, 0, bw, d], [w / 2, 0, bw, d]].forEach(([x, z, ww, dd]) => { const e = new T.PlaneGeometry(ww, dd); disp.push(e); const m = new T.Mesh(e, bm); m.rotation.x = -PI / 2; m.position.set(x, .02, z); border.add(m); });
  /* 极轻外描边(普通混合,不加色外扩 glow) */
  const om = new T.MeshBasicMaterial({ color: edge, transparent: true, opacity: day ? .25 : .3, depthWrite: false }); disp.push(om);
  const ow = w + (nested ? .18 : .28), od = d + (nested ? .18 : .28);
  [[0, -od / 2, ow, .02], [0, od / 2, ow, .02], [-ow / 2, 0, .02, od], [ow / 2, 0, .02, od]].forEach(([x, z, ww, dd]) => { const e = new T.PlaneGeometry(ww, dd); disp.push(e); const m = new T.Mesh(e, om); m.rotation.x = -PI / 2; m.position.set(x, .015, z); border.add(m); });
  g.add(border);
  let label = null;
  if (o.title) {
    label = createZoneLabel(o.title, { theme, height: o.titleSize || (nested ? .7 : Math.min(1.15, d * .14)) });
    label.position.set(-w / 2 + .25 + label.userData.width / 2, .045, d / 2 - label.userData.width * .08 - .35);
    // 大区标签放外侧前方
    if (!nested) label.position.set(0, .05, d / 2 + (o.titleSize || 1.1) * .7);
    g.add(label);
  }
  const pad = o.pad || (nested ? .55 : .9);
  return {
    group: g, w, d, title: o.title || '', nested,
    slot(i, n, cols) {
      cols = cols || Math.ceil(Math.sqrt(n)); const rows = Math.ceil(n / cols), r = Math.floor(i / cols), c = i % cols;
      const top = -d / 2 + pad, bot = d / 2 - pad - (nested && o.title ? .55 : 0);
      const left = -w / 2 + pad, right = w / 2 - pad;
      return { x: cols === 1 ? 0 : left + (right - left) * c / (cols - 1 || 1), z: rows === 1 ? (top + bot) / 2 : top + (bot - top) * r / (rows - 1 || 1) };
    },
    dispose() { disp.forEach(x => x.dispose()); if (label) label.userData.dispose(); },
  };
}
function createLink(a, b, opts) {
  const T = root.THREE, o = opts || {}, theme = o.theme === 'light' || o.theme === 'dark' ? o.theme : THEME, day = theme === 'light';
  const col = new T.Color(o.color || FRAME[theme].normal), y = o.y == null ? .05 : o.y;
  const A = new T.Vector3(a.x, y, a.z), B = new T.Vector3(b.x, y, b.z), dir = B.clone().sub(A), len = dir.length(); dir.normalize();
  const dash = o.dash || .3, gap = o.gap || .2, per = dash + gap, n = Math.max(1, Math.floor((len - .4) / per));
  const g = new T.Group(); const disp = [];
  const mat = new T.MeshBasicMaterial({ color: col, transparent: true, opacity: day ? .75 : .85, depthWrite: false }); disp.push(mat);
  const dg = new T.PlaneGeometry(dash, .045); disp.push(dg);
  const ang = Math.atan2(dir.x, dir.z) - PI / 2;
  const dashes = [];
  for (let i = 0; i < n; i++) {
    const m = new T.Mesh(dg, mat); m.rotation.set(-PI / 2, 0, ang); g.add(m); dashes.push(m);
  }
  if (o.arrow !== false) {
    const sh = new T.Shape(); sh.moveTo(0, .18); sh.lineTo(-.11, -.08); sh.lineTo(.11, -.08); sh.closePath();
    const ag = new T.ShapeGeometry(sh); disp.push(ag); const ar = new T.Mesh(ag, mat);
    const aq = new T.Group(); aq.add(ar); ar.rotation.set(-PI / 2, 0, 0); aq.rotation.y = Math.atan2(dir.x, dir.z) + PI; aq.position.copy(B).addScaledVector(dir, -.12); g.add(aq);
  }
  const usable = len - .35;
  const update = t => { const off = ((t || 0) * .55) % per; dashes.forEach((m, i) => { const s = Math.min(usable, i * per + off + dash / 2); m.position.copy(A).addScaledVector(dir, s); }); };
  update(0);
  return { group: g, update, dispose() { disp.forEach(x => x.dispose()); } };
}

function setupBloom(renderer, opts) {
  const T = root.THREE, o = opts || {};
  if (!T.EffectComposer || !T.UnrealBloomPass) return null;
  try {
    const size = new T.Vector2(); renderer.getSize(size);
    const pr = renderer.getPixelRatio();
    const darkMat = new T.MeshBasicMaterial({ color: 0x000000 });
    const bloomPass = new T.UnrealBloomPass(new T.Vector2(size.x * pr, size.y * pr), o.strength == null ? .7 : o.strength, o.radius == null ? .5 : o.radius, o.threshold == null ? .15 : o.threshold);
    const composer = new T.EffectComposer(renderer);
    const renderPass = new T.RenderPass(new T.Scene(), new T.PerspectiveCamera());
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    bloomPass.renderToScreen = false;
    let blit = null, blitScene = null, blitCam = null;
    return {
      bloom: bloomPass,
      setSize(w, h) {
        const p = renderer.getPixelRatio();
        composer.setSize(w, h); bloomPass.setSize(w * p, h * p);
      },
      render(scene, cam) {
        // A. 正常整景
        cam.layers.enable(0); cam.layers.enable(1);
        renderer.setRenderTarget(null); renderer.autoClear = true; renderer.render(scene, cam);
        // B. 非辉光物体涂黑,只留层1
        const saved = new Map(), lights = [];
        scene.traverse(o => {
          if (o.isLight) { lights.push([o, o.intensity]); o.intensity = 0; return; }
          if (!(o.isMesh || o.isLine || o.isLineSegments || o.isSprite || o.isPoints)) return;
          if ((o.layers.mask & 2) !== 0) return; // bit1 = layer 1
          saved.set(o, o.material);
          o.material = Array.isArray(o.material) ? o.material.map(() => darkMat) : darkMat;
        });
        const bg = scene.background; scene.background = new T.Color(0x000000);
        cam.layers.set(1);
        renderPass.scene = scene; renderPass.camera = cam;
        composer.renderToScreen = false;
        composer.render();
        if (!blit) {
          blitCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
          blitScene = new T.Scene();
          blit = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ map: composer.readBuffer.texture, transparent: true, blending: T.AdditiveBlending, depthTest: false, depthWrite: false }));
          blitScene.add(blit);
        }
        blit.material.map = composer.readBuffer.texture;
        renderer.autoClear = false; renderer.setRenderTarget(null); renderer.render(blitScene, blitCam); renderer.autoClear = true;
        saved.forEach((m, o) => { o.material = m; });
        lights.forEach(([o, i]) => { o.intensity = i; });
        scene.background = bg; cam.layers.enable(0); cam.layers.enable(1);
      },
      dispose() { darkMat.dispose(); composer.dispose(); if (blit) { blit.geometry.dispose(); blit.material.dispose(); } },
    };
  } catch (e) { console.error('setupBloom', e); return null; }
}

const api = { version: 8, CATS, SPEC, RSPEC, ROLES, buildModel, CUBE, SIZES, STATES, STATE_COL, FRAME, ZONE, createNode, createZone, createZoneLabel, createLink, fitLabels, addLights, setupBloom, markBloom, prepareRenderer, setTheme, get theme() { return THEME; }, types: () => Object.keys(SPEC), byCat: c => Object.keys(SPEC).filter(k => SPEC[k].cat === c) };
api._debug = { RSPEC, atomGeo, buildModel };
root.NODELIB = api;
if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
