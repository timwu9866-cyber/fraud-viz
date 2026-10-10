/* world-data.js — 8 阵营(场景)、25 个节点、23 个任务事件的统一数据(纯概念示意) */
(function () {
'use strict';
const D = 30;                 // 阵营环半径
const campPos = i => { const a = (-90 + i * 45) * Math.PI / 180; return { a, x: D * Math.cos(a), z: D * Math.sin(a) }; };

// 每个阵营:名称 + 若干节点(相对阵营中心的切向偏移 off,沿环切线排布)
const CAMPS = [
  { id: 'c1', name: '场景一 暗链收网', nodes: [
    { id: 's1_app', label: '涉诈APP·营业厅助手', kind: 'phone', c: 'warn' },
    { id: 's1_back', label: '涉诈后台·渠道客服', kind: 'server', c: 'atk' },
    { id: 's1_data', label: '涉诈号码大数据', kind: 'db', c: 'warn' },
    { id: 's1_vic', label: '潜在受害人群', kind: 'client', c: 'ok' } ] },
  { id: 'c2', name: '场景二 华信通信积分商城', nodes: [
    { id: 's2_site', label: '积分商城网站', kind: 'server', c: 'atk' },
    { id: 's2_sms', label: '短信数据管理台', kind: 'db', c: 'warn' },
    { id: 's2_vic', label: '受害用户', kind: 'client', c: 'ok' } ] },
  { id: 'c3', name: '场景三 蓝厅暗线', nodes: [
    { id: 's3_app', label: '营业厅APP', kind: 'phone', c: 'warn' },
    { id: 's3_call', label: '外呼号码池', kind: 'db', c: 'warn' },
    { id: 's3_vic', label: '高危用户', kind: 'client', c: 'ok' } ] },
  { id: 'c4', name: '场景四 迷贷枭网', nodes: [
    { id: 's4_loan', label: '贷款APP', kind: 'phone', c: 'warn' },
    { id: 's4_back', label: '返利网站后台', kind: 'server', c: 'atk' },
    { id: 's4_vic', label: '投资转化用户', kind: 'client', c: 'ok' } ] },
  { id: 'c5', name: '场景五 屏幕背后的眼睛', nodes: [
    { id: 's5_video', label: '视频客服号码/基站', kind: 'net', c: 'atk' },
    { id: 's5_data', label: '涉诈数据集', kind: 'db', c: 'warn' },
    { id: 's5_vic', label: '受害人', kind: 'client', c: 'ok' } ] },
  { id: 'c6', name: '场景六 断线行动', nodes: [
    { id: 's6_credit', label: '征信平台', kind: 'server', c: 'atk' },
    { id: 's6_goip', label: 'GOIP窝点', kind: 'net', c: 'atk' },
    { id: 's6_vic', label: '受害人', kind: 'client', c: 'ok' } ] },
  { id: 'c7', name: '场景七 系统更新远控插件', nodes: [
    { id: 's7_rat', label: '远控软件', kind: 'iot', c: 'atk' },
    { id: 's7_data', label: '涉诈数据集', kind: 'db', c: 'warn' },
    { id: 's7_vic', label: '受害人', kind: 'client', c: 'ok' } ] },
  { id: 'c8', name: '场景八 接码平台与境外博彩', nodes: [
    { id: 's8_code', label: '接码平台', kind: 'cloud', c: 'atk' },
    { id: 's8_bet', label: '博彩网站', kind: 'server', c: 'atk' },
    { id: 's8_vic', label: '受害人', kind: 'client', c: 'ok' } ] },
];

// 计算每个节点的世界坐标:在阵营中心沿"切线"方向展开,略向外错开成弧
const NODES = [];
CAMPS.forEach((camp, ci) => {
  const p = campPos(ci); camp.pos = p;
  const tang = { x: -Math.sin(p.a), z: Math.cos(p.a) };     // 切线方向
  const radial = { x: Math.cos(p.a), z: Math.sin(p.a) };    // 径向(朝外)
  const n = camp.nodes.length, span = 7.0;
  camp.nodes.forEach((nd, k) => {
    const off = (k - (n - 1) / 2) * span;
    const out = (Math.abs(k - (n - 1) / 2)) * 2.2;          // 两端稍微外扩成弧
    nd.x = p.x + tang.x * off + radial.x * out;
    nd.z = p.z + tang.z * off + radial.z * out;
    nd.scale = 0.95; nd.camp = camp.id; nd.campName = camp.name;
    NODES.push(nd);
  });
});

// 事件:中央攻击源(core) 与阵营节点之间的攻防/取证动效。role: extract(取证) / control(操控) / spread(扩线)
const E = (o) => o;
const EVENTS = [
  // 场景一
  E({ id: 's1t1', camp: 'c1', name: '任务1 提取APP后台凭证', from: 'core', to: 's1_back', role: 'extract', dur: 14,
    cap: ['锁定涉诈APP与后台', '静态分析还原后台线索(示意)', '后台地址/账号线索浮现', '沿暗链溯源流向后台', '定位落入涉诈后台', '取证闭环·APP与后台关联'] }),
  E({ id: 's1t2', camp: 'c1', name: '任务2 进入网站后台并取证', from: 'core', to: 's1_back', role: 'extract', dur: 14,
    cap: ['接入涉诈后台边界', '凭线索进入后台(授权取证)', '后台数据结构浮现', '关键运营证据提取', '证据固定与留痕', '后台取证完成'] }),
  E({ id: 's1t3', camp: 'c1', name: '任务3 话单账单交叉定位', from: 'core', to: 's1_back', role: 'extract', dur: 14,
    cap: ['调取话单与账单数据', '多源数据对齐', '交叉比对找共性', '可疑号码聚合', '轨迹收敛定位', '交叉定位完成'] }),
  E({ id: 's1t4', camp: 'c1', name: '任务4 潜在受害人闭环圈定', from: 'core', to: 's1_vic', role: 'spread', dur: 14,
    cap: ['以后台信息为锚点', '扩线到接触人群', '风险评分筛选', '高风险人群圈定', '闭环比对确认', '潜在受害人圈定完成'] }),
  // 场景二
  E({ id: 's2t1', camp: 'c2', name: '任务1 积分站暗链还原', from: 'core', to: 's2_sms', role: 'extract', dur: 14,
    cap: ['锁定积分商城站点', '解析页面隐藏跳转(示意)', '暗链路径还原', '指向后端的链路浮现', '定位真实后端', '暗链还原完成'] }),
  E({ id: 's2t2', camp: 'c2', name: '任务2 短信外发窗口识别', from: 'core', to: 's2_vic', role: 'control', dur: 14,
    cap: ['接入短信数据管理台', '统计外发频次/时段', '异常外发窗口浮现', '锁定高频外发时段', '关联接收用户', '外发窗口识别完成'] }),
  E({ id: 's2t3', camp: 'c2', name: '任务3 点击提交用户定位', from: 'core', to: 's2_vic', role: 'spread', dur: 14,
    cap: ['采集提交行为(示意)', '关联用户标识', '定位提交用户', '圈定受影响用户', '风险提示', '用户定位完成'] }),
  // 场景三
  E({ id: 's3t1', camp: 'c3', name: '任务1 营业厅APP上报地址', from: 'core', to: 's3_call', role: 'extract', dur: 14,
    cap: ['查获营业厅APP', '还原上报地址(示意)', '上报目标浮现', '指向外呼号码池', '定位号码池', '上报地址取证完成'] }),
  E({ id: 's3t2', camp: 'c3', name: '任务2 高离散外呼号码识别', from: 'core', to: 's3_app', role: 'extract', dur: 14,
    cap: ['调取外呼号码池', '计算离散度', '高离散号码浮现', '聚类锁定', '关联APP', '高离散号码识别完成'] }),
  E({ id: 's3t3', camp: 'c3', name: '任务3 安装后高危用户筛选', from: 'core', to: 's3_vic', role: 'spread', dur: 14,
    cap: ['采集安装行为(示意)', '关联用户画像', '风险打分', '高危用户浮现', '圈定高危人群', '高危用户筛选完成'] }),
  // 场景四
  E({ id: 's4t1', camp: 'c4', name: '任务1 贷款APP桥接口令还原', from: 'core', to: 's4_back', role: 'extract', dur: 14,
    cap: ['查获贷款APP', '还原桥接口令(示意)', '桥接通道浮现', '连接返利后台', '定位后台', '桥接口令还原完成'] }),
  E({ id: 's4t2', camp: 'c4', name: '任务2 返利网站后台穿透', from: 'core', to: 's4_back', role: 'extract', dur: 14,
    cap: ['接入返利网站边界', '穿透到后台(授权取证)', '后台结构浮现', '运营数据提取', '证据固定', '后台穿透取证完成'] }),
  E({ id: 's4t3', camp: 'c4', name: '任务3 投资转化阶段扩线', from: 'core', to: 's4_vic', role: 'spread', dur: 14,
    cap: ['以后台数据为锚点', '还原投资转化链路', '转化阶段用户浮现', '扩线关联', '圈定受害用户', '投资转化扩线完成'] }),
  // 场景五
  E({ id: 's5t1', camp: 'c5', name: '任务1 视频客服号码与基站定位', from: 'core', to: 's5_data', role: 'extract', dur: 14,
    cap: ['采集视频客服号码', '关联基站数据', '基站位置浮现', '多基站交汇', '位置收敛', '号码与基站定位完成'] }),
  E({ id: 's5t2', camp: 'c5', name: '任务2 屏幕共享转账预警', from: 'core', to: 's5_vic', role: 'control', dur: 14,
    cap: ['监测屏幕共享行为(示意)', '识别转账前兆', '高危会话浮现', '锁定受害人', '实时预警', '转账预警触发'] }),
  // 场景六
  E({ id: 's6t1', camp: 'c6', name: '任务1 征信平台工单越权', from: 'core', to: 's6_credit', role: 'extract', dur: 14,
    cap: ['接入征信平台边界', '发现工单越权(示意)', '越权访问路径浮现', '取证固定', '留痕归档', '工单越权取证完成'] }),
  E({ id: 's6t2', camp: 'c6', name: '任务2 GOIP窝点轨迹收束', from: 'core', to: 's6_goip', role: 'extract', dur: 14,
    cap: ['采集GOIP信令(示意)', '还原活动轨迹', '轨迹点浮现', '多点收束', '窝点定位', 'GOIP轨迹收束完成'] }),
  E({ id: 's6t3', camp: 'c6', name: '任务3 征信修复潜在受害人扩线', from: 'core', to: 's6_vic', role: 'spread', dur: 14,
    cap: ['以平台信息为锚点', '还原征信修复话术链路', '接触人群浮现', '风险扩线', '圈定受害人', '潜在受害人扩线完成'] }),
  // 场景七
  E({ id: 's7t1', camp: 'c7', name: '任务1 远控插件协议逆向', from: 'core', to: 's7_data', role: 'extract', dur: 14,
    cap: ['提取远控插件样本', '逆向通信协议(示意)', '控制指令结构浮现', '指向涉诈数据集', '定位控制端', '协议逆向完成'] }),
  E({ id: 's7t2', camp: 'c7', name: '任务2 转账前远控受害人拦截', from: 'core', to: 's7_vic', role: 'control', dur: 14,
    cap: ['监测远控会话(示意)', '识别转账前兆', '高危受害人浮现', '锁定会话', '实时拦截预警', '转账拦截触发'] }),
  // 场景八
  E({ id: 's8t1', camp: 'c8', name: '任务1 接码平台取证', from: 'core', to: 's8_code', role: 'extract', dur: 14,
    cap: ['锁定接码平台', '接入边界(授权取证)', '接码记录浮现', '组织关系提取', '证据固定', '接码平台取证完成'] }),
  E({ id: 's8t2', camp: 'c8', name: '任务2 博彩网站取证', from: 'core', to: 's8_bet', role: 'extract', dur: 14,
    cap: ['锁定博彩网站', '接入边界(授权取证)', '站点结构浮现', '资金/账号线索提取', '证据固定', '博彩网站取证完成'] }),
  E({ id: 's8t3', camp: 'c8', name: '任务3 潜在受害人扩线', from: 'core', to: 's8_vic', role: 'spread', dur: 14,
    cap: ['以站点数据为锚点', '扩线接触人群', '投注用户浮现', '风险圈定', '闭环确认', '潜在受害人扩线完成'] }),
];

window.FRAUD_WORLD = { CAMPS, NODES, EVENTS, campPos, D };
})();
