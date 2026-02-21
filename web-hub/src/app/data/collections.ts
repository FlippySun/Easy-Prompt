export interface Collection {
  id: string;
  title: string;
  description: string;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
  promptIds: string[];
  tags: string[];
  savedCount: number;
  difficulty: '入门' | '进阶' | '专业';
  estimatedTime: string;
}

export const COLLECTIONS: Collection[] = [
  {
    id: 'dev-toolkit',
    title: '开发者全套工具包',
    description: '从代码审查到 API 文档生成，覆盖软件开发全流程，每一个都是精挑细选的效率神器。',
    icon: '🛠️',
    gradientFrom: '#3b82f6',
    gradientTo: '#06b6d4',
    promptIds: ['1', '5', '9', '15', '22'],
    tags: ['编程', '代码质量', '效率', '后端'],
    savedCount: 1280,
    difficulty: '进阶',
    estimatedTime: '适合日常开发',
  },
  {
    id: 'content-creator',
    title: '内容创作全套工具',
    description: '小红书种草、抖音脚本、SEO 文章、年终总结，一站式覆盖各平台内容创作需求。',
    icon: '✍️',
    gradientFrom: '#8b5cf6',
    gradientTo: '#ec4899',
    promptIds: ['2', '16', '18', '24', '19'],
    tags: ['写作', '营销', '短视频', '种草'],
    savedCount: 2150,
    difficulty: '入门',
    estimatedTime: '适合日常创作',
  },
  {
    id: 'workplace-pro',
    title: '职场效率提升包',
    description: '周报、会议纪要、工作总结、商业计划，让职场沟通更专业高效，告别加班。',
    icon: '💼',
    gradientFrom: '#10b981',
    gradientTo: '#06b6d4',
    promptIds: ['14', '21', '16', '7', '11'],
    tags: ['职场', '效率', '汇报', '职业成长'],
    savedCount: 1890,
    difficulty: '入门',
    estimatedTime: '每周必用',
  },
  {
    id: 'ai-art-master',
    title: 'AI 绘画大师包',
    description: '精选 Midjourney 赛博朋克和 DALL-E 产品摄影提示词，轻松生成震撼的 AI 艺术作品。',
    icon: '🎨',
    gradientFrom: '#ec4899',
    gradientTo: '#f59e0b',
    promptIds: ['3', '13'],
    tags: ['AI绘画', 'Midjourney', 'DALL-E', '艺术'],
    savedCount: 980,
    difficulty: '进阶',
    estimatedTime: '创意时刻',
  },
  {
    id: 'life-wellness',
    title: '身心健康助手包',
    description: '营养饮食计划、冥想引导词、情感支持对话，用 AI 全方位照顾你的身心健康。',
    icon: '🌿',
    gradientFrom: '#ef4444',
    gradientTo: '#f97316',
    promptIds: ['8', '10', '20'],
    tags: ['健康', '冥想', '营养', '情感'],
    savedCount: 1560,
    difficulty: '入门',
    estimatedTime: '每日必备',
  },
  {
    id: 'business-starter',
    title: '创业者必备工具包',
    description: '商业计划书、竞品分析、投资组合分析，助力创业者在商海中做出更好的决策。',
    icon: '🚀',
    gradientFrom: '#06b6d4',
    gradientTo: '#6366f1',
    promptIds: ['7', '11', '17', '23'],
    tags: ['创业', '商业分析', '融资', '财务'],
    savedCount: 1120,
    difficulty: '专业',
    estimatedTime: '创业必读',
  },
  {
    id: 'learning-master',
    title: '终身学习者工具包',
    description: '职业发展规划、英语口语练习、苏格拉底式辩论训练，用 AI 加速你的成长之路。',
    icon: '📚',
    gradientFrom: '#f97316',
    gradientTo: '#8b5cf6',
    promptIds: ['4', '6', '12'],
    tags: ['学习', '职业发展', '英语', '思维训练'],
    savedCount: 870,
    difficulty: '进阶',
    estimatedTime: '持续学习',
  },
];

export const DIFFICULTY_CONFIG = {
  入门: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', darkBg: 'rgba(16,185,129,0.12)', darkColor: '#34d399' },
  进阶: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', darkBg: 'rgba(245,158,11,0.12)', darkColor: '#fbbf24' },
  专业: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', darkBg: 'rgba(239,68,68,0.12)', darkColor: '#f87171' },
};
