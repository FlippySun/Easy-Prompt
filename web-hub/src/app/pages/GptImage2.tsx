import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Clock3,
  Copy,
  Download,
  Heart,
  Image as ImageIcon,
  Info,
  Layers3,
  Maximize2,
  Search,
  Share2,
  Sparkles,
  Wand2,
  Zap,
  GitCompare,
  Upload,
  Trash2,
  ChevronDown,
  ArrowRight,
  Flame,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, downloadFile } from '@/lib/utils';
import { useLayoutContext } from '../components/Layout';

/**
 * 2026-04-23
 * 变更类型：add
 * What：新增 `/gpt-image2` 页面，按 Figma Make 里的 GPT-image2 在线图像生成专页做 1:1 高保真适配，并补齐前端可交互的生成、预览、下载、对比、历史、收藏与分享体验。
 * Why：当前仓库里没有独立的图像生成专页，这个页面先以可运行的前端工作台承接设计稿，给后续接入真实图像生成后端留出稳定入口和交互骨架。
 * Params & return：`GptImage2()` 为无参路由组件，返回完整页面 UI；内部子组件通过 props 接收状态并回传用户操作。
 * Impact scope：`/gpt-image2` 路由、PromptHub 新增的银河探索模式入口、命令面板页面检索入口。
 * Risk：当前“生成图片”为前端高保真原型，使用本地 SVG 作品模拟图像产物；下载、分享、对比、历史与收藏交互可用，但尚未接入真实图像生成 API。
 */

type WorkspaceTab = 'create' | 'history' | 'favorites' | 'compare';
type AspectRatioOption = '1:1' | '3:4' | '4:3' | '16:9' | '9:16';
type QualityOption = '标准' | '高清' | '极致';
type StyleOption = '自然' | '摄影' | '动漫' | '电影' | '插画' | '像素';
type BackgroundOption = '自动' | '不透明' | '透明';
type FormatOption = 'PNG' | 'JPEG' | 'WebP';
type ArtworkVariant = 'atlas' | 'glyph' | 'fluid' | 'cinema' | 'poster' | 'nebula';

interface GeneratedImage {
  id: string;
  title: string;
  prompt: string;
  meta: string;
  createdLabel: string;
  url: string;
  svg: string;
  width: number;
  height: number;
  aspectRatio: AspectRatioOption;
  variant: ArtworkVariant;
  background: BackgroundOption;
}

interface HistoryGroup {
  label: string;
  items: GeneratedImage[];
}

interface InspirationCard {
  title: string;
  prompt: string;
  author: string;
  likes: number;
  variant: ArtworkVariant;
}

const DEMO_PROMPT = '一只戴着宇航头盔的柴犬漂浮在粉紫色星云中，电影级光影，超写实，8K';
const PROMPT_PRESETS = [
  '赛博朋克城市夜景',
  '水彩风少女肖像',
  '极简几何海报',
  '3D 等距插画',
  '胶片写真人像',
  '宫崎骏动画场景',
];
const ARTWORK_VARIANTS: ArtworkVariant[] = ['atlas', 'glyph', 'fluid', 'cinema', 'poster', 'nebula'];
const GENERATION_COUNTS = [1, 2, 4, 6] as const;
const RATIO_OPTIONS: AspectRatioOption[] = ['1:1', '3:4', '4:3', '16:9', '9:16'];
const QUALITY_OPTIONS: QualityOption[] = ['标准', '高清', '极致'];
const STYLE_OPTIONS: StyleOption[] = ['自然', '摄影', '动漫', '电影', '插画', '像素'];
const FORMAT_OPTIONS: FormatOption[] = ['PNG', 'JPEG', 'WebP'];
const INSPIRATION_ITEMS: InspirationCard[] = [
  {
    title: '霓虹赛博都市 · 紫粉色雨夜',
    prompt: '霓虹赛博都市，紫粉色雨夜，倒影街道，电影镜头，超真实，霓虹招牌',
    author: '@neo',
    likes: 1248,
    variant: 'atlas',
  },
  {
    title: '流体艺术 · 丝绸光泽',
    prompt: '抽象流体艺术，蓝橙紫粉漩涡，丝绸反光，高清海报，艺术装置',
    author: '@liuyun',
    likes: 982,
    variant: 'fluid',
  },
  {
    title: '抽象字符艺术',
    prompt: '巨大发光 AI 字符，橙色霓虹，放射纹理，抽象科技海报，极致细节',
    author: '@lumi',
    likes: 764,
    variant: 'glyph',
  },
  {
    title: '未来主义品牌封面',
    prompt: '未来品牌 KV 封面，紫蓝渐变流动，简洁高级，视觉中心突出',
    author: '@atlas',
    likes: 651,
    variant: 'poster',
  },
  {
    title: '曲面屏幕展厅',
    prompt: '大型曲面屏幕展厅，黑色观众席，紫蓝霓虹主视觉，品牌发布会',
    author: '@stella',
    likes: 503,
    variant: 'cinema',
  },
];
const TAB_ITEMS: Array<{ key: WorkspaceTab; label: string; icon: typeof ImageIcon }> = [
  { key: 'create', label: '创作工作台', icon: ImageIcon },
  { key: 'history', label: '生成历史', icon: Clock3 },
  { key: 'favorites', label: '我的收藏', icon: Heart },
  { key: 'compare', label: '效果对比', icon: GitCompare },
];
const RATIO_DIMENSIONS: Record<AspectRatioOption, { width: number; height: number; cardClassName: string }> = {
  '1:1': { width: 1024, height: 1024, cardClassName: 'aspect-square' },
  '3:4': { width: 960, height: 1280, cardClassName: 'aspect-[3/4]' },
  '4:3': { width: 1280, height: 960, cardClassName: 'aspect-[4/3]' },
  '16:9': { width: 1600, height: 900, cardClassName: 'aspect-[16/9]' },
  '9:16': { width: 900, height: 1600, cardClassName: 'aspect-[9/16]' },
};

function escapeXml(input: string) {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function promptExcerpt(prompt: string, maxLength = 18) {
  return prompt.length > maxLength ? `${prompt.slice(0, maxLength)}…` : prompt;
}

function createArtworkSvg(options: {
  variant: ArtworkVariant;
  prompt: string;
  title: string;
  aspectRatio: AspectRatioOption;
  style: StyleOption;
  quality: QualityOption;
  background: BackgroundOption;
}) {
  const { width, height } = RATIO_DIMENSIONS[options.aspectRatio];
  const safeTitle = escapeXml(options.title);
  const safePrompt = escapeXml(promptExcerpt(options.prompt, 28));
  const safeFooter = escapeXml(`GPT-image2 · ${options.aspectRatio} · ${options.quality} · ${options.style}`);
  const backgroundRect =
    options.background === '透明'
      ? ''
      : `<rect width="${width}" height="${height}" fill="${options.background === '不透明' ? '#ffffff' : '#fbf7ff'}" />`;

  switch (options.variant) {
    case 'atlas':
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#60a5fa"/>
              <stop offset="34%" stop-color="#c4b5fd"/>
              <stop offset="67%" stop-color="#8b5cf6"/>
              <stop offset="100%" stop-color="#f0abfc"/>
            </linearGradient>
          </defs>
          ${backgroundRect}
          <rect width="${width}" height="${height}" fill="url(#bg)" />
          <path d="M-40 ${height * 0.78} C ${width * 0.18} ${height * 0.46}, ${width * 0.36} ${height * 0.38}, ${width * 0.74} ${height * 0.1} L ${width + 40} -20 L ${width + 40} ${height + 40} L -40 ${height + 40}Z" fill="rgba(255,255,255,0.46)" />
          <path d="M-60 ${height * 0.94} C ${width * 0.18} ${height * 0.62}, ${width * 0.42} ${height * 0.52}, ${width * 0.86} ${height * 0.14} L ${width + 50} 0 L ${width + 50} ${height + 40} L -60 ${height + 40}Z" fill="rgba(255,255,255,0.18)" />
          <rect x="${width * 0.42}" y="${height * 0.38}" width="${width * 0.16}" height="${height * 0.16}" rx="${width * 0.04}" fill="#0f1953" opacity="0.94" />
          <text x="${width * 0.5}" y="${height * 0.475}" fill="#ffffff" font-size="${width * 0.05}" text-anchor="middle" font-family="Inter, Arial, sans-serif">✦</text>
          <text x="${width * 0.5}" y="${height * 0.72}" fill="#111827" font-size="${width * 0.05}" font-weight="700" text-anchor="middle" font-family="Inter, Arial, sans-serif">${safeTitle}</text>
          <text x="${width * 0.5}" y="${height * 0.79}" fill="rgba(17,24,39,0.82)" font-size="${width * 0.025}" text-anchor="middle" font-family="Inter, Arial, sans-serif">${safePrompt}</text>
          <text x="${width * 0.08}" y="${height * 0.93}" fill="rgba(17,24,39,0.78)" font-size="${width * 0.024}" font-family="Inter, Arial, sans-serif">${safeFooter}</text>
        </svg>
      `;
    case 'glyph':
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <defs>
            <radialGradient id="burst" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stop-color="#f8b87a"/>
              <stop offset="42%" stop-color="#f97316"/>
              <stop offset="100%" stop-color="#5b1c1b"/>
            </radialGradient>
          </defs>
          ${backgroundRect}
          <rect width="${width}" height="${height}" fill="#2e1323" />
          <circle cx="${width / 2}" cy="${height / 2}" r="${width * 0.28}" fill="url(#burst)" />
          <g stroke="rgba(255,255,255,0.18)" stroke-width="${width * 0.01}" fill="none">
            <circle cx="${width / 2}" cy="${height / 2}" r="${width * 0.22}" />
            <circle cx="${width / 2}" cy="${height / 2}" r="${width * 0.29}" />
            <circle cx="${width / 2}" cy="${height / 2}" r="${width * 0.36}" />
          </g>
          <text x="${width * 0.5}" y="${height * 0.58}" fill="rgba(255,255,255,0.38)" font-size="${width * 0.32}" font-weight="700" text-anchor="middle" font-family="Inter, Arial, sans-serif">AI</text>
          <text x="${width * 0.5}" y="${height * 0.82}" fill="#fff7ed" font-size="${width * 0.03}" text-anchor="middle" font-family="Inter, Arial, sans-serif">${safePrompt}</text>
        </svg>
      `;
    case 'fluid':
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <defs>
            <linearGradient id="fluidBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#111827"/>
              <stop offset="50%" stop-color="#1d4ed8"/>
              <stop offset="100%" stop-color="#f97316"/>
            </linearGradient>
          </defs>
          ${backgroundRect}
          <rect width="${width}" height="${height}" fill="url(#fluidBg)" />
          <path d="M0 ${height * 0.15} C ${width * 0.28} ${height * 0.3}, ${width * 0.32} ${height * 0.05}, ${width * 0.65} ${height * 0.18} S ${width * 0.95} ${height * 0.3}, ${width} ${height * 0.08}" stroke="#f9fafb" stroke-opacity="0.48" stroke-width="${width * 0.04}" fill="none" stroke-linecap="round" />
          <path d="M-20 ${height * 0.42} C ${width * 0.18} ${height * 0.3}, ${width * 0.52} ${height * 0.64}, ${width} ${height * 0.34}" stroke="#22d3ee" stroke-opacity="0.72" stroke-width="${width * 0.06}" fill="none" stroke-linecap="round" />
          <path d="M0 ${height * 0.68} C ${width * 0.22} ${height * 0.52}, ${width * 0.42} ${height * 0.86}, ${width * 0.8} ${height * 0.64} S ${width} ${height * 0.82}, ${width} ${height * 0.68}" stroke="#fde68a" stroke-opacity="0.9" stroke-width="${width * 0.05}" fill="none" stroke-linecap="round" />
          <path d="M${width * 0.08} ${height * 0.88} Q ${width * 0.38} ${height * 0.74}, ${width * 0.84} ${height * 0.9}" stroke="#f472b6" stroke-opacity="0.72" stroke-width="${width * 0.03}" fill="none" stroke-linecap="round" />
          <text x="${width * 0.07}" y="${height * 0.92}" fill="rgba(255,255,255,0.88)" font-size="${width * 0.03}" font-family="Inter, Arial, sans-serif">${safePrompt}</text>
        </svg>
      `;
    case 'cinema':
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <defs>
            <linearGradient id="screen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#60a5fa"/>
              <stop offset="35%" stop-color="#a78bfa"/>
              <stop offset="100%" stop-color="#d946ef"/>
            </linearGradient>
          </defs>
          ${backgroundRect}
          <rect width="${width}" height="${height}" fill="#050816" />
          <rect x="0" y="${height * 0.18}" width="${width}" height="${height * 0.5}" fill="url(#screen)" />
          <path d="M0 ${height * 0.18} C ${width * 0.18} ${height * 0.05}, ${width * 0.34} ${height * 0.05}, ${width * 0.58} ${height * 0.18}" fill="rgba(255,255,255,0.12)" />
          <path d="M0 ${height * 0.68} C ${width * 0.18} ${height * 0.6}, ${width * 0.44} ${height * 0.76}, ${width} ${height * 0.64} L ${width} ${height} L 0 ${height}Z" fill="rgba(6,7,20,0.92)" />
          <rect x="${width * 0.42}" y="${height * 0.42}" width="${width * 0.16}" height="${height * 0.08}" rx="${width * 0.026}" fill="#1d4ed8" opacity="0.92" />
          <text x="${width * 0.5}" y="${height * 0.472}" fill="#ffffff" font-size="${width * 0.035}" text-anchor="middle" font-family="Inter, Arial, sans-serif">✦</text>
          <text x="${width * 0.5}" y="${height * 0.56}" fill="#0f172a" font-size="${width * 0.03}" font-weight="700" text-anchor="middle" font-family="Inter, Arial, sans-serif">${safeTitle}</text>
          <g fill="rgba(0,0,0,0.58)">
            <rect x="0" y="${height * 0.75}" width="${width}" height="${height * 0.07}" />
            <rect x="0" y="${height * 0.83}" width="${width}" height="${height * 0.06}" />
            <rect x="0" y="${height * 0.9}" width="${width}" height="${height * 0.08}" />
          </g>
        </svg>
      `;
    case 'poster':
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <defs>
            <linearGradient id="posterBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#dbeafe"/>
              <stop offset="36%" stop-color="#c4b5fd"/>
              <stop offset="72%" stop-color="#a855f7"/>
              <stop offset="100%" stop-color="#fbcfe8"/>
            </linearGradient>
          </defs>
          ${backgroundRect}
          <rect width="${width}" height="${height}" fill="url(#posterBg)" />
          <path d="M0 ${height * 0.95} C ${width * 0.16} ${height * 0.7}, ${width * 0.28} ${height * 0.66}, ${width * 0.48} ${height * 0.5} C ${width * 0.66} ${height * 0.34}, ${width * 0.84} ${height * 0.24}, ${width} ${height * 0.02} L ${width} ${height} L 0 ${height}Z" fill="rgba(255,255,255,0.34)" />
          <text x="${width * 0.08}" y="${height * 0.78}" fill="#111827" font-size="${width * 0.07}" font-weight="700" font-family="Inter, Arial, sans-serif">${safeTitle}</text>
          <text x="${width * 0.08}" y="${height * 0.85}" fill="rgba(17,24,39,0.86)" font-size="${width * 0.03}" font-family="Inter, Arial, sans-serif">${safePrompt}</text>
          <text x="${width * 0.08}" y="${height * 0.92}" fill="rgba(17,24,39,0.72)" font-size="${width * 0.024}" font-family="Inter, Arial, sans-serif">${safeFooter}</text>
        </svg>
      `;
    case 'nebula':
    default:
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <defs>
            <radialGradient id="nebula" cx="50%" cy="35%" r="72%">
              <stop offset="0%" stop-color="#f0abfc"/>
              <stop offset="38%" stop-color="#8b5cf6"/>
              <stop offset="72%" stop-color="#1d4ed8"/>
              <stop offset="100%" stop-color="#030712"/>
            </radialGradient>
          </defs>
          ${backgroundRect}
          <rect width="${width}" height="${height}" fill="url(#nebula)" />
          <circle cx="${width * 0.2}" cy="${height * 0.22}" r="${width * 0.04}" fill="rgba(255,255,255,0.9)" />
          <circle cx="${width * 0.76}" cy="${height * 0.16}" r="${width * 0.02}" fill="rgba(255,255,255,0.72)" />
          <circle cx="${width * 0.6}" cy="${height * 0.3}" r="${width * 0.015}" fill="rgba(255,255,255,0.8)" />
          <path d="M${width * 0.08} ${height * 0.66} C ${width * 0.34} ${height * 0.52}, ${width * 0.52} ${height * 0.8}, ${width * 0.88} ${height * 0.64}" stroke="rgba(255,255,255,0.2)" stroke-width="${width * 0.02}" fill="none" stroke-linecap="round" />
          <text x="${width * 0.08}" y="${height * 0.84}" fill="#fdf2f8" font-size="${width * 0.058}" font-weight="700" font-family="Inter, Arial, sans-serif">${safeTitle}</text>
          <text x="${width * 0.08}" y="${height * 0.91}" fill="rgba(255,255,255,0.8)" font-size="${width * 0.026}" font-family="Inter, Arial, sans-serif">${safePrompt}</text>
        </svg>
      `;
  }
}

function createGeneratedImage(options: {
  id: string;
  title: string;
  prompt: string;
  variant: ArtworkVariant;
  aspectRatio: AspectRatioOption;
  quality: QualityOption;
  style: StyleOption;
  background: BackgroundOption;
  createdLabel: string;
}) {
  const svg = createArtworkSvg(options);
  const { width, height } = RATIO_DIMENSIONS[options.aspectRatio];

  return {
    id: options.id,
    title: options.title,
    prompt: options.prompt,
    meta: `GPT-image2 · ${options.aspectRatio} · ${options.quality}`,
    createdLabel: options.createdLabel,
    url: buildDataUrl(svg),
    svg,
    width,
    height,
    aspectRatio: options.aspectRatio,
    variant: options.variant,
    background: options.background,
  } satisfies GeneratedImage;
}

function buildSeedGallery() {
  const todayItems = [
    createGeneratedImage({
      id: 'seed-atlas',
      title: '未来都市夜景',
      prompt: '未来都市夜景，霓虹灯，紫粉色辉光，超写实电影镜头',
      variant: 'atlas',
      aspectRatio: '1:1',
      quality: '高清',
      style: '摄影',
      background: '自动',
      createdLabel: '刚刚',
    }),
    createGeneratedImage({
      id: 'seed-glyph',
      title: '发光 AI 字符',
      prompt: '发光的 AI 字符，橙蓝渐变光，抽象科技感背景',
      variant: 'glyph',
      aspectRatio: '1:1',
      quality: '高清',
      style: '电影',
      background: '自动',
      createdLabel: '刚刚',
    }),
    createGeneratedImage({
      id: 'seed-fluid',
      title: '抽象流体艺术',
      prompt: '抽象流体艺术，紫粉色漩涡，丝绸质感，极致海报',
      variant: 'fluid',
      aspectRatio: '1:1',
      quality: '高清',
      style: '插画',
      background: '自动',
      createdLabel: '刚刚',
    }),
    createGeneratedImage({
      id: 'seed-cinema',
      title: '品牌展厅曲面屏',
      prompt: '大型曲面屏幕展示未来品牌 logo，科技展厅，黑色观众席',
      variant: 'cinema',
      aspectRatio: '1:1',
      quality: '高清',
      style: '电影',
      background: '自动',
      createdLabel: '刚刚',
    }),
  ];

  return {
    currentBatch: todayItems,
    history: [
      { label: '今天 · 4 月 23 日', items: todayItems },
      {
        label: '昨天',
        items: [
          createGeneratedImage({
            id: 'seed-poster',
            title: '未来主义封面',
            prompt: '未来主义品牌封面，紫蓝渐变流线，简洁高级排版',
            variant: 'poster',
            aspectRatio: '1:1',
            quality: '标准',
            style: '自然',
            background: '自动',
            createdLabel: '昨天',
          }),
          createGeneratedImage({
            id: 'seed-nebula',
            title: '星云幻想海报',
            prompt: '粉紫星云，悬浮感，科幻封面，发光尘埃',
            variant: 'nebula',
            aspectRatio: '1:1',
            quality: '高清',
            style: '动漫',
            background: '自动',
            createdLabel: '昨天',
          }),
          createGeneratedImage({
            id: 'seed-vertical',
            title: '视觉海报实验',
            prompt: '高饱和霓虹海报，强构图，未来视觉试验',
            variant: 'poster',
            aspectRatio: '3:4',
            quality: '标准',
            style: '插画',
            background: '自动',
            createdLabel: '昨天',
          }),
        ],
      },
    ] satisfies HistoryGroup[],
  };
}

function mergeIntoHistory(groups: HistoryGroup[], nextBatch: GeneratedImage[]) {
  if (groups.length === 0) return [{ label: '今天', items: nextBatch }];
  const [todayGroup, ...rest] = groups;
  if (todayGroup.label.includes('今天')) {
    return [{ ...todayGroup, items: [...nextBatch, ...todayGroup.items] }, ...rest];
  }
  return [{ label: '今天', items: nextBatch }, ...groups];
}

async function downloadRasterizedImage(item: GeneratedImage, format: FormatOption) {
  const image = new Image();
  image.src = item.url;
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = item.width;
  canvas.height = item.height;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('canvas context unavailable');
  }

  if (!(item.background === '透明' && (format === 'PNG' || format === 'WebP'))) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(image, 0, 0);

  const mimeType = format === 'PNG' ? 'image/png' : format === 'JPEG' ? 'image/jpeg' : 'image/webp';
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('blob generation failed'))), mimeType, 0.96);
  });

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${item.id.toLowerCase()}.${format.toLowerCase() === 'jpeg' ? 'jpg' : format.toLowerCase()}`;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function useRevocableObjectUrl() {
  const [value, setValue] = useState<string | null>(null);
  const latestValueRef = useRef<string | null>(null);

  const replace = useCallback((file: File | null) => {
    setValue((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      const next = file ? URL.createObjectURL(file) : null;
      latestValueRef.current = next;
      return next;
    });
  }, []);

  useEffect(
    () => () => {
      if (latestValueRef.current) {
        URL.revokeObjectURL(latestValueRef.current);
        latestValueRef.current = null;
      }
    },
    [],
  );

  return [value, replace] as const;
}

export function GptImage2() {
  const { darkMode } = useLayoutContext();
  const promptRef = useRef<HTMLDivElement | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const completionTimerRef = useRef<number | null>(null);
  const seedGallery = useMemo(() => buildSeedGallery(), []);
  const [tab, setTab] = useState<WorkspaceTab>('create');
  const [prompt, setPrompt] = useState(DEMO_PROMPT);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('1:1');
  const [quality, setQuality] = useState<QualityOption>('高清');
  const [style, setStyle] = useState<StyleOption>('摄影');
  const [background, setBackground] = useState<BackgroundOption>('自动');
  const [format, setFormat] = useState<FormatOption>('PNG');
  const [historyQuery, setHistoryQuery] = useState('');
  const [currentBatch, setCurrentBatch] = useState(seedGallery.currentBatch);
  const [historyGroups, setHistoryGroups] = useState<HistoryGroup[]>(seedGallery.history);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set(['seed-atlas']));
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generationCount, setGenerationCount] = useState<(typeof GENERATION_COUNTS)[number]>(4);
  const [shareTarget, setShareTarget] = useState<GeneratedImage | null>(null);
  const [lightboxTarget, setLightboxTarget] = useState<GeneratedImage | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [referenceImage, setReferenceImageFile] = useRevocableObjectUrl();
  const [maskImage, setMaskImageFile] = useRevocableObjectUrl();

  useEffect(
    () => () => {
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
      if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current);
    },
    [],
  );

  const allKnownImages = useMemo(() => {
    const map = new Map<string, GeneratedImage>();
    for (const group of historyGroups) {
      for (const item of group.items) map.set(item.id, item);
    }
    return [...map.values()];
  }, [historyGroups]);

  const favoriteImages = useMemo(
    () => allKnownImages.filter((item) => favoriteIds.has(item.id)),
    [allKnownImages, favoriteIds],
  );

  const visibleHistoryGroups = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return historyGroups;
    return historyGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => item.prompt.toLowerCase().includes(query) || item.title.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [historyGroups, historyQuery]);

  const compareItems = useMemo(
    () => currentBatch.filter((item) => selectedIds.has(item.id)),
    [currentBatch, selectedIds],
  );

  const heroItems = useMemo(
    () =>
      ARTWORK_VARIANTS.map((variant, index) =>
        createGeneratedImage({
          id: `hero-${variant}`,
          title: INSPIRATION_ITEMS[index % INSPIRATION_ITEMS.length]?.title ?? 'GPT-image2',
          prompt: INSPIRATION_ITEMS[index % INSPIRATION_ITEMS.length]?.prompt ?? DEMO_PROMPT,
          variant,
          aspectRatio: '1:1',
          quality: '高清',
          style: STYLE_OPTIONS[index % STYLE_OPTIONS.length],
          background: '自动',
          createdLabel: '展示',
        }),
      ),
    [],
  );

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
        toast.success('已移出收藏');
      } else {
        next.add(id);
        toast.success('已加入收藏 ⭐');
      }
      return next;
    });
  }, []);

  const toggleCompareSelection = useCallback((id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const loadPromptFromHistory = useCallback((item: GeneratedImage) => {
    setPrompt(item.prompt);
    setTab('create');
    toast.success('已载入该历史提示词');
    promptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleCopyPrompt = useCallback(async (item: GeneratedImage) => {
    try {
      await navigator.clipboard.writeText(item.prompt);
      toast.success('提示词已复制');
    } catch {
      toast.error('复制失败，请稍后重试');
    }
  }, []);

  const handleShare = useCallback(async (item: GeneratedImage) => {
    const shareText = `GPT-image2 作品分享\n标题：${item.title}\n提示词：${item.prompt}\n预览入口：${window.location.origin}/gpt-image2`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, text: shareText, url: `${window.location.origin}/gpt-image2` });
        toast.success('已调起系统分享');
        return;
      }

      await navigator.clipboard.writeText(shareText);
      toast.success('分享文案已复制');
    } catch {
      toast.error('分享失败，请稍后重试');
    }
  }, []);

  const handleDownload = useCallback(
    async (item: GeneratedImage) => {
      try {
        await downloadRasterizedImage(item, format);
        toast.success(`已下载 ${format} 文件`);
      } catch {
        downloadFile(item.svg, `${item.id}.svg`, 'image/svg+xml');
        toast.info('已回退为 SVG 下载');
      }
    },
    [format],
  );

  const runGeneration = useCallback(
    (nextPrompt?: string) => {
      const finalPrompt = (nextPrompt ?? prompt).trim();
      if (!finalPrompt) {
        toast.error('请先输入提示词');
        return;
      }

      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
      if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current);

      setLoading(true);
      setProgress(6);
      setTab('create');

      progressTimerRef.current = window.setInterval(() => {
        setProgress((previous) => (previous >= 92 ? previous : previous + Math.random() * 14));
      }, 180);

      /**
       * 2026-04-23
       * 变更类型：add
       * What：生成按钮先走可感知进度，再在 1.8 秒后落回新的作品批次。
       * Why：设计稿强调“即时生成”的观感，这里用固定时长的前端模拟保持 UI 节奏稳定，避免完全瞬时更新导致页面缺少反馈。
       * Params & return：计时器不接收入参；结束后写入 `currentBatch` 与 `historyGroups` 新状态。
       * Impact scope：GPT-image2 工作台的生成反馈、预览刷新与历史记录沉淀。
       * Risk：若后续接入真实后端，应以服务端流式进度替换这里的模拟进度，避免双重状态源。
       */
      completionTimerRef.current = window.setTimeout(() => {
        if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);

        const ratioSeed = hashString(finalPrompt + aspectRatio + quality + style);
        const nextItems = Array.from({ length: generationCount }, (_, index) => {
          const variant = ARTWORK_VARIANTS[(ratioSeed + index) % ARTWORK_VARIANTS.length];
          return createGeneratedImage({
            id: `generated-${Date.now()}-${index}`,
            title: index === 0 ? promptExcerpt(finalPrompt, 10) : `方案 ${index + 1}`,
            prompt: finalPrompt,
            variant,
            aspectRatio,
            quality,
            style,
            background,
            createdLabel: '刚刚',
          });
        });

        setCurrentBatch(nextItems);
        setHistoryGroups((previous) => mergeIntoHistory(previous, nextItems));
        setSelectedIds(new Set());
        setProgress(100);
        setLoading(false);
        toast.success(`已生成 ${nextItems.length} 张作品`);
        window.setTimeout(() => setProgress(0), 360);
      }, 1800);
    },
    [aspectRatio, background, generationCount, prompt, quality, style],
  );

  const pickRandomPrompt = useCallback(() => {
    const randomPreset = PROMPT_PRESETS[Math.floor(Math.random() * PROMPT_PRESETS.length)];
    setPrompt(randomPreset);
  }, []);

  return (
    <div className="space-y-6">
      <HeroBanner
        darkMode={darkMode}
        items={heroItems}
        onTryDemo={() => {
          setPrompt('赛博东方古城，灯笼雨夜，蒸汽朋克飞船穿过，8K 电影感');
          promptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          window.setTimeout(() => runGeneration('赛博东方古城，灯笼雨夜，蒸汽朋克飞船穿过，8K 电影感'), 120);
        }}
        onViewGuide={() => promptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />

      <TabBar current={tab} onChange={setTab} />

      <InspirationRail darkMode={darkMode} onPickPrompt={setPrompt} />

      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              'rounded-2xl border px-4 py-3 shadow-sm',
              darkMode
                ? 'border-violet-500/20 bg-linear-to-r from-violet-500/10 via-fuchsia-500/10 to-pink-500/10'
                : 'border-violet-200 bg-linear-to-r from-violet-500/10 via-fuchsia-500/10 to-pink-500/10',
            )}
          >
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-violet-500 animate-pulse" />
              <span className={cn('text-sm', darkMode ? 'text-gray-100' : 'text-gray-700')}>
                GPT-image2 正在描绘你的画面…
              </span>
              <div className={cn('h-2 flex-1 overflow-hidden rounded-full', darkMode ? 'bg-gray-800' : 'bg-white/80')}>
                <motion.div
                  animate={{ width: `${Math.min(100, Math.round(progress))}%` }}
                  className="h-full bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500"
                />
              </div>
              <span
                className={cn('text-xs font-semibold tabular-nums', darkMode ? 'text-violet-200' : 'text-violet-700')}
              >
                {Math.min(100, Math.round(progress))}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-12 gap-6">
        <div className={cn('col-span-12 space-y-6', tab === 'history' ? 'xl:col-span-12' : 'xl:col-span-8')}>
          {(tab === 'create' || tab === 'compare') && (
            <>
              <div ref={promptRef}>
                <PromptComposer
                  darkMode={darkMode}
                  prompt={prompt}
                  aspectRatio={aspectRatio}
                  quality={quality}
                  style={style}
                  background={background}
                  format={format}
                  advancedOpen={advancedOpen}
                  generationCount={generationCount}
                  referenceImage={referenceImage}
                  maskImage={maskImage}
                  onPromptChange={setPrompt}
                  onRatioChange={setAspectRatio}
                  onQualityChange={setQuality}
                  onStyleChange={setStyle}
                  onBackgroundChange={setBackground}
                  onFormatChange={setFormat}
                  onGenerationCountChange={setGenerationCount}
                  onToggleAdvanced={() => setAdvancedOpen((previous) => !previous)}
                  onReferenceUpload={setReferenceImageFile}
                  onMaskUpload={setMaskImageFile}
                  onRandomPrompt={pickRandomPrompt}
                  onGenerate={() => runGeneration()}
                />
              </div>

              <PreviewWorkspace
                darkMode={darkMode}
                items={currentBatch}
                selectedIds={selectedIds}
                compareItems={compareItems}
                favoriteIds={favoriteIds}
                compareMode={tab === 'compare'}
                loading={loading}
                onToggleCompare={() => setTab((previous) => (previous === 'compare' ? 'create' : 'compare'))}
                onToggleSelection={toggleCompareSelection}
                onToggleFavorite={toggleFavorite}
                onCopyPrompt={handleCopyPrompt}
                onDownload={handleDownload}
                onShare={(item) => setShareTarget(item)}
                onOpen={setLightboxTarget}
              />
            </>
          )}

          {tab === 'history' && (
            <HistoryGallery
              darkMode={darkMode}
              groups={visibleHistoryGroups}
              onReusePrompt={loadPromptFromHistory}
              onOpen={setLightboxTarget}
            />
          )}

          {tab === 'favorites' && (
            <FavoritesGallery
              darkMode={darkMode}
              items={favoriteImages}
              onToggleFavorite={toggleFavorite}
              onDownload={handleDownload}
              onShare={(item) => setShareTarget(item)}
              onOpen={setLightboxTarget}
              onCopyPrompt={handleCopyPrompt}
            />
          )}
        </div>

        {tab !== 'history' && (
          <div className="col-span-12 xl:col-span-4">
            <div className="xl:sticky xl:top-24">
              <HistorySidebar
                darkMode={darkMode}
                query={historyQuery}
                groups={visibleHistoryGroups}
                onQueryChange={setHistoryQuery}
                onReusePrompt={loadPromptFromHistory}
              />
            </div>
          </div>
        )}
      </div>

      <ShareModal
        darkMode={darkMode}
        item={shareTarget}
        onClose={() => setShareTarget(null)}
        onCopyPrompt={handleCopyPrompt}
        onShare={handleShare}
      />

      <LightboxModal
        darkMode={darkMode}
        item={lightboxTarget}
        onClose={() => setLightboxTarget(null)}
        onDownload={handleDownload}
        onShare={(item) => setShareTarget(item)}
        onRegenerate={(item) => {
          setPrompt(item.prompt);
          setLightboxTarget(null);
          runGeneration(item.prompt);
        }}
      />
    </div>
  );
}

function HeroBanner({
  darkMode,
  items,
  onTryDemo,
  onViewGuide,
}: {
  darkMode: boolean;
  items: GeneratedImage[];
  onTryDemo: () => void;
  onViewGuide: () => void;
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[28px] border px-7 py-8 shadow-sm',
        darkMode
          ? 'border-violet-500/10 bg-linear-to-br from-violet-500/15 via-fuchsia-500/10 to-pink-500/15'
          : 'border-violet-100 bg-linear-to-br from-violet-500/15 via-fuchsia-500/10 to-pink-500/15',
      )}
    >
      <div
        className="absolute inset-y-0 right-0 w-80 opacity-80"
        style={{ background: 'radial-gradient(circle at center, rgba(255,255,255,0.25), rgba(255,255,255,0))' }}
      />
      <div className="relative flex flex-col justify-between gap-8 xl:flex-row xl:items-center">
        <div className="max-w-[620px]">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/75 px-3 py-1 text-xs font-semibold text-violet-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            银河探索模式 · 全新上线
          </div>
          <h1
            className={cn('text-4xl font-bold tracking-tight md:text-5xl', darkMode ? 'text-white' : 'text-gray-900')}
          >
            GPT-image2 · 在线图像生成
          </h1>
          <p
            className={cn(
              'mt-3 max-w-[560px] text-sm leading-7 md:text-base',
              darkMode ? 'text-gray-200/80' : 'text-gray-700',
            )}
          >
            用一句话描绘你的世界。支持提示词即时生成、多图对比、生成历史回溯、一键下载与分享，让创作像对话一样自然。
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={onTryDemo}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-linear-to-r from-violet-600 to-pink-500 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-transform hover:scale-[1.01]"
            >
              <Zap className="h-4 w-4" />
              试一个示例
            </button>
            <button
              onClick={onViewGuide}
              className={cn(
                'inline-flex h-11 items-center gap-2 rounded-xl border px-5 text-sm font-semibold transition-colors',
                darkMode
                  ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                  : 'border-white bg-white/85 text-gray-700 hover:bg-white',
              )}
            >
              查看创作指南
            </button>
          </div>
        </div>

        <div className="grid max-w-[320px] grid-cols-3 gap-3">
          {items.slice(0, 6).map((item, index) => (
            <div
              key={item.id}
              className={cn(
                'overflow-hidden rounded-2xl border border-white/70 shadow-sm',
                index % 2 === 1 ? 'translate-y-3' : 'translate-y-0',
              )}
            >
              <img src={item.url} alt={item.title} className="aspect-square h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TabBar({ current, onChange }: { current: WorkspaceTab; onChange: (next: WorkspaceTab) => void }) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
      {TAB_ITEMS.map((tabItem) => (
        <button
          key={tabItem.key}
          onClick={() => onChange(tabItem.key)}
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors',
            current === tabItem.key
              ? 'bg-linear-to-r from-violet-500/15 to-pink-500/10 text-violet-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
          )}
        >
          <tabItem.icon className="h-4 w-4" />
          {tabItem.label}
        </button>
      ))}
    </div>
  );
}

function InspirationRail({ darkMode, onPickPrompt }: { darkMode: boolean; onPickPrompt: (prompt: string) => void }) {
  const items = useMemo(
    () =>
      INSPIRATION_ITEMS.map((item, index) =>
        createGeneratedImage({
          id: `inspiration-${index}`,
          title: item.title,
          prompt: item.prompt,
          variant: item.variant,
          aspectRatio: '1:1',
          quality: '高清',
          style: '摄影',
          background: '自动',
          createdLabel: '推荐',
        }),
      ),
    [],
  );

  return (
    <section
      className={cn(
        'overflow-hidden rounded-[26px] border shadow-sm',
        darkMode ? 'border-gray-800 bg-gray-900/80' : 'border-gray-200 bg-white',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between border-b px-5 py-4',
          darkMode ? 'border-gray-800' : 'border-gray-100',
        )}
      >
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className={cn('text-base font-semibold', darkMode ? 'text-white' : 'text-gray-900')}>社区灵感</span>
          <span className={cn('text-xs', darkMode ? 'text-gray-400' : 'text-gray-500')}>· 点击即可套用提示词</span>
        </div>
        <button className="inline-flex items-center gap-1 text-sm font-semibold text-violet-600">
          查看全部 <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto px-5 py-4">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => onPickPrompt(INSPIRATION_ITEMS[index].prompt)}
            className={cn(
              'w-[180px] shrink-0 overflow-hidden rounded-2xl border text-left shadow-sm transition-transform hover:-translate-y-0.5',
              darkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white',
            )}
          >
            <img src={item.url} alt={item.title} className="aspect-[4/5] h-full w-full object-cover" />
            <div className="space-y-1.5 p-3">
              <p className={cn('line-clamp-1 text-sm font-semibold', darkMode ? 'text-white' : 'text-gray-900')}>
                {item.title}
              </p>
              <div
                className={cn(
                  'flex items-center justify-between text-xs',
                  darkMode ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                <span>{INSPIRATION_ITEMS[index].author}</span>
                <span>♥ {INSPIRATION_ITEMS[index].likes}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function PromptComposer(props: {
  darkMode: boolean;
  prompt: string;
  aspectRatio: AspectRatioOption;
  quality: QualityOption;
  style: StyleOption;
  background: BackgroundOption;
  format: FormatOption;
  advancedOpen: boolean;
  generationCount: (typeof GENERATION_COUNTS)[number];
  referenceImage: string | null;
  maskImage: string | null;
  onPromptChange: (value: string) => void;
  onRatioChange: (value: AspectRatioOption) => void;
  onQualityChange: (value: QualityOption) => void;
  onStyleChange: (value: StyleOption) => void;
  onBackgroundChange: (value: BackgroundOption) => void;
  onFormatChange: (value: FormatOption) => void;
  onGenerationCountChange: (value: (typeof GENERATION_COUNTS)[number]) => void;
  onToggleAdvanced: () => void;
  onReferenceUpload: (file: File | null) => void;
  onMaskUpload: (file: File | null) => void;
  onRandomPrompt: () => void;
  onGenerate: () => void;
}) {
  const dm = props.darkMode;

  return (
    <section
      className={cn(
        'overflow-hidden rounded-[28px] border shadow-sm',
        dm ? 'border-gray-800 bg-gray-900/80' : 'border-gray-200 bg-white',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 border-b px-5 py-4',
          dm
            ? 'border-gray-800 bg-white/5'
            : 'border-gray-100 bg-linear-to-r from-violet-500/5 via-fuchsia-500/5 to-pink-500/5',
        )}
      >
        <Wand2 className="h-4 w-4 text-violet-600" />
        <span className={cn('text-base font-semibold', dm ? 'text-white' : 'text-gray-900')}>创作提示词</span>
        <span className={cn('text-xs', dm ? 'text-gray-400' : 'text-gray-500')}>· 描述越具体，生成效果越贴近想象</span>
      </div>

      <div className="space-y-5 p-5">
        <div className="relative">
          <textarea
            value={props.prompt}
            onChange={(event) => props.onPromptChange(event.target.value)}
            rows={5}
            placeholder="例：一只戴着宇航头盔的柴犬漂浮在粉紫色星云中，电影级光影，超写实，8K"
            className={cn(
              'w-full resize-none rounded-[22px] border px-4 py-4 text-base leading-8 outline-none transition-colors',
              dm
                ? 'border-gray-800 bg-gray-950 text-white placeholder:text-gray-500 focus:border-violet-500/60'
                : 'border-gray-200 bg-[#fafafa] text-gray-900 placeholder:text-gray-400 focus:border-violet-300 focus:bg-white',
            )}
          />
          <button
            onClick={props.onRandomPrompt}
            className={cn(
              'absolute bottom-3 right-3 inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors',
              dm
                ? 'border-gray-700 bg-gray-900 text-white hover:bg-gray-800'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
            )}
          >
            <Sparkles className="h-4 w-4 text-violet-600" />
            灵感
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {PROMPT_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => props.onPromptChange(preset)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                dm
                  ? 'border-gray-700 bg-gray-950 text-gray-300 hover:border-violet-500/50 hover:text-violet-300'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:text-violet-700',
              )}
            >
              # {preset}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StaticSelect label="模型" value="GPT-image2" />
          <ChipGroup
            label="比例"
            value={props.aspectRatio}
            options={RATIO_OPTIONS}
            onChange={props.onRatioChange}
            darkMode={dm}
          />
          <ChipGroup
            label="画质"
            value={props.quality}
            options={QUALITY_OPTIONS}
            onChange={props.onQualityChange}
            darkMode={dm}
          />
          <ChipGroup
            label="风格"
            value={props.style}
            options={STYLE_OPTIONS}
            onChange={props.onStyleChange}
            darkMode={dm}
          />
        </div>

        <AdvancedOptions
          darkMode={dm}
          open={props.advancedOpen}
          background={props.background}
          format={props.format}
          referenceImage={props.referenceImage}
          maskImage={props.maskImage}
          onToggle={props.onToggleAdvanced}
          onBackgroundChange={props.onBackgroundChange}
          onFormatChange={props.onFormatChange}
          onReferenceUpload={props.onReferenceUpload}
          onMaskUpload={props.onMaskUpload}
        />

        <div className="flex flex-col gap-4 rounded-[24px] border border-dashed border-violet-200/70 bg-violet-50/60 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Layers3 className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-semibold text-gray-700">生成数量</span>
            <div className="flex items-center gap-2">
              {GENERATION_COUNTS.map((count) => (
                <button
                  key={count}
                  onClick={() => props.onGenerationCountChange(count)}
                  className={cn(
                    'h-9 min-w-9 rounded-xl border px-3 text-sm font-semibold transition-colors',
                    props.generationCount === count
                      ? 'border-violet-400 bg-white text-violet-700 shadow-sm'
                      : 'border-white bg-white/70 text-gray-600 hover:bg-white',
                  )}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={props.onGenerate}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-violet-600 via-fuchsia-500 to-pink-500 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20"
          >
            <ImageIcon className="h-4 w-4" />
            开始生成
            <span className="rounded-lg bg-white/20 px-2 py-0.5 text-xs">2 积分</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function StaticSelect({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-gray-500">{label}</div>
      <div className="flex h-11 items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 shadow-sm">
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          {value}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({
  darkMode,
  label,
  value,
  options,
  onChange,
}: {
  darkMode: boolean;
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <div className={cn('mb-2 text-xs font-medium', darkMode ? 'text-gray-400' : 'text-gray-500')}>{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={cn(
              'rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors',
              value === option
                ? 'border-violet-400 bg-violet-50 text-violet-700'
                : darkMode
                  ? 'border-gray-700 bg-gray-950 text-gray-300 hover:border-violet-500/50'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:text-violet-700',
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function AdvancedOptions(props: {
  darkMode: boolean;
  open: boolean;
  background: BackgroundOption;
  format: FormatOption;
  referenceImage: string | null;
  maskImage: string | null;
  onToggle: () => void;
  onBackgroundChange: (value: BackgroundOption) => void;
  onFormatChange: (value: FormatOption) => void;
  onReferenceUpload: (file: File | null) => void;
  onMaskUpload: (file: File | null) => void;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[24px] border shadow-sm',
        props.darkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white',
      )}
    >
      <button
        onClick={props.onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-gray-700"
      >
        <Layers3 className="h-4 w-4 text-violet-600" />
        <span className={cn(props.darkMode ? 'text-white' : 'text-gray-900')}>更多选项</span>
        <span className={cn('text-xs', props.darkMode ? 'text-gray-400' : 'text-gray-500')}>
          · 背景、格式、参考图编辑
        </span>
        <span className="ml-auto">
          <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', props.open ? 'rotate-180' : '')} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {props.open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'space-y-5 border-t px-4 pb-4 pt-4',
                props.darkMode ? 'border-gray-800' : 'border-gray-100',
              )}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <SegmentedControl
                  darkMode={props.darkMode}
                  label="背景"
                  value={props.background}
                  options={['自动', '不透明', '透明']}
                  hint="透明背景仅支持 PNG / WebP 输出。"
                  onChange={props.onBackgroundChange}
                />
                <SegmentedControl
                  darkMode={props.darkMode}
                  label="输出格式"
                  value={props.format}
                  options={FORMAT_OPTIONS}
                  onChange={props.onFormatChange}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <UploadCard
                  darkMode={props.darkMode}
                  label="参考图（编辑模式）"
                  hint="上传一张图，让模型基于它再创作"
                  imageUrl={props.referenceImage}
                  disabled={false}
                  onFileChange={props.onReferenceUpload}
                />
                <UploadCard
                  darkMode={props.darkMode}
                  label="蒙版（局部重绘）"
                  hint="需先上传参考图"
                  imageUrl={props.maskImage}
                  disabled={!props.referenceImage}
                  onFileChange={props.onMaskUpload}
                />
              </div>

              <div
                className={cn(
                  'flex gap-2 rounded-2xl border px-3 py-3 text-sm leading-6',
                  props.darkMode
                    ? 'border-gray-800 bg-gray-900 text-gray-300'
                    : 'border-gray-200 bg-gray-50 text-gray-600',
                )}
              >
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                GPT-image2 通过自然语言理解画面，对构图、文字、风格的控制直接写进提示词即可，无需 seed / 采样步数 / CFG
                等传统扩散模型参数。
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SegmentedControl<T extends string>({
  darkMode,
  label,
  value,
  options,
  hint,
  onChange,
}: {
  darkMode: boolean;
  label: string;
  value: T;
  options: readonly T[];
  hint?: string;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <div className={cn('mb-2 text-xs font-medium', darkMode ? 'text-gray-400' : 'text-gray-500')}>{label}</div>
      <div
        className={cn(
          'inline-flex rounded-2xl border p-1',
          darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50',
        )}
      >
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
              value === option
                ? 'bg-white text-violet-700 shadow-sm ring-1 ring-violet-200'
                : darkMode
                  ? 'text-gray-300 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900',
            )}
          >
            {option}
          </button>
        ))}
      </div>
      {hint && <div className={cn('mt-2 text-xs', darkMode ? 'text-gray-500' : 'text-gray-500')}>{hint}</div>}
    </div>
  );
}

function UploadCard({
  darkMode,
  label,
  hint,
  imageUrl,
  disabled,
  onFileChange,
}: {
  darkMode: boolean;
  label: string;
  hint: string;
  imageUrl: string | null;
  disabled: boolean;
  onFileChange: (file: File | null) => void;
}) {
  return (
    <div>
      <div className={cn('mb-2 text-xs font-medium', darkMode ? 'text-gray-400' : 'text-gray-500')}>{label}</div>
      {imageUrl ? (
        <div className="relative overflow-hidden rounded-[22px] border border-gray-200">
          <img src={imageUrl} alt={label} className="h-28 w-full object-cover" />
          <button
            onClick={() => onFileChange(null)}
            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          className={cn(
            'flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed text-sm font-semibold transition-colors',
            disabled
              ? darkMode
                ? 'cursor-not-allowed border-gray-800 bg-gray-950 text-gray-500'
                : 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
              : darkMode
                ? 'border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15'
                : 'border-violet-300 bg-violet-50/50 text-violet-700 hover:bg-violet-50',
          )}
        >
          <Upload className="h-4 w-4" />
          {disabled ? '需先上传参考图' : '点击或拖拽上传'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled}
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
        </label>
      )}
      <div className={cn('mt-2 text-xs', darkMode ? 'text-gray-500' : 'text-gray-500')}>{hint}</div>
    </div>
  );
}

function PreviewWorkspace(props: {
  darkMode: boolean;
  items: GeneratedImage[];
  selectedIds: Set<string>;
  compareItems: GeneratedImage[];
  favoriteIds: Set<string>;
  compareMode: boolean;
  loading: boolean;
  onToggleCompare: () => void;
  onToggleSelection: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onCopyPrompt: (item: GeneratedImage) => void;
  onDownload: (item: GeneratedImage) => void;
  onShare: (item: GeneratedImage) => void;
  onOpen: (item: GeneratedImage) => void;
}) {
  const dm = props.darkMode;
  const showCompareGrid = props.compareMode && props.compareItems.length >= 2;

  return (
    <section
      className={cn(
        'overflow-hidden rounded-[28px] border shadow-sm',
        dm ? 'border-gray-800 bg-gray-900/80' : 'border-gray-200 bg-white',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between border-b px-5 py-4',
          dm ? 'border-gray-800' : 'border-gray-100',
        )}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-fuchsia-500" />
          <span className={cn('text-base font-semibold', dm ? 'text-white' : 'text-gray-900')}>生成预览</span>
          <span className={cn('text-xs', dm ? 'text-gray-400' : 'text-gray-500')}>
            · {props.compareMode ? '对比模式' : '标准视图'}
          </span>
        </div>

        <button
          onClick={props.onToggleCompare}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors',
            props.compareMode
              ? 'border-violet-400 bg-violet-50 text-violet-700'
              : dm
                ? 'border-gray-700 bg-gray-950 text-gray-300 hover:border-violet-500/50'
                : 'border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:text-violet-700',
          )}
        >
          <GitCompare className="h-4 w-4" />
          对比 {props.compareMode ? `(${props.selectedIds.size})` : ''}
        </button>
      </div>

      <div className="space-y-4 p-5">
        {props.compareMode && props.compareItems.length < 2 && (
          <div
            className={cn(
              'rounded-2xl border px-4 py-3 text-sm',
              dm
                ? 'border-violet-500/20 bg-violet-500/10 text-violet-200'
                : 'border-violet-200 bg-violet-50 text-violet-700',
            )}
          >
            请选择至少 2 张作品进入对比视图。
          </div>
        )}

        {props.loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="aspect-square animate-pulse rounded-[24px] bg-linear-to-br from-violet-200 via-fuchsia-100 to-pink-100"
              />
            ))}
          </div>
        ) : showCompareGrid ? (
          <div className="grid gap-4 md:grid-cols-2">
            {props.compareItems.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className={cn(
                  'overflow-hidden rounded-[24px] border shadow-sm',
                  dm ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white',
                )}
              >
                <img
                  src={item.url}
                  alt={item.title}
                  className={cn('w-full object-cover', RATIO_DIMENSIONS[item.aspectRatio].cardClassName)}
                />
                <div className="space-y-1.5 p-4">
                  <p className={cn('text-sm font-semibold', dm ? 'text-white' : 'text-gray-900')}>{item.title}</p>
                  <p className={cn('text-xs', dm ? 'text-gray-400' : 'text-gray-500')}>{item.meta}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {props.items.map((item) => {
              const selected = props.selectedIds.has(item.id);
              const favorite = props.favoriteIds.has(item.id);
              return (
                <article
                  key={item.id}
                  className={cn(
                    'group overflow-hidden rounded-[24px] border shadow-sm transition-all',
                    selected
                      ? 'border-violet-400 ring-2 ring-violet-200'
                      : dm
                        ? 'border-gray-800 bg-gray-950'
                        : 'border-gray-200 bg-white',
                  )}
                >
                  <div className="relative">
                    <img
                      src={item.url}
                      alt={item.title}
                      className={cn('w-full object-cover', RATIO_DIMENSIONS[item.aspectRatio].cardClassName)}
                    />
                    {props.compareMode && (
                      <button
                        onClick={() => props.onToggleSelection(item.id)}
                        className={cn(
                          'absolute left-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white',
                          selected ? 'bg-violet-600' : 'bg-black/45 backdrop-blur-sm',
                        )}
                      >
                        {selected ? '✓' : ''}
                      </button>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/55 via-black/25 to-transparent px-3 py-3 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="pointer-events-auto flex items-center gap-2">
                        <PreviewIconButton icon={Download} label="下载" onClick={() => props.onDownload(item)} />
                        <PreviewIconButton icon={Share2} label="分享" onClick={() => props.onShare(item)} />
                        <PreviewIconButton
                          icon={Heart}
                          label="收藏"
                          active={favorite}
                          onClick={() => props.onToggleFavorite(item.id)}
                        />
                        <PreviewIconButton icon={Copy} label="复制提示词" onClick={() => props.onCopyPrompt(item)} />
                        <div className="flex-1" />
                        <PreviewIconButton icon={Maximize2} label="查看大图" onClick={() => props.onOpen(item)} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 p-4">
                    <p className={cn('text-sm font-semibold', dm ? 'text-white' : 'text-gray-900')}>{item.title}</p>
                    <p className={cn('line-clamp-2 text-sm', dm ? 'text-gray-300' : 'text-gray-600')}>{item.prompt}</p>
                    <div
                      className={cn(
                        'flex items-center justify-between text-xs',
                        dm ? 'text-gray-400' : 'text-gray-500',
                      )}
                    >
                      <span>{item.meta}</span>
                      <span>{item.createdLabel}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function PreviewIconButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Download;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/92 text-gray-800 shadow-sm transition-transform hover:scale-[1.04]',
        active && 'text-pink-500',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function HistorySidebar({
  darkMode,
  query,
  groups,
  onQueryChange,
  onReusePrompt,
}: {
  darkMode: boolean;
  query: string;
  groups: HistoryGroup[];
  onQueryChange: (value: string) => void;
  onReusePrompt: (item: GeneratedImage) => void;
}) {
  return (
    <aside
      className={cn(
        'overflow-hidden rounded-[28px] border shadow-sm',
        darkMode ? 'border-gray-800 bg-gray-900/80' : 'border-gray-200 bg-white',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between border-b px-5 py-4',
          darkMode ? 'border-gray-800' : 'border-gray-100',
        )}
      >
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-violet-600" />
          <span className={cn('text-base font-semibold', darkMode ? 'text-white' : 'text-gray-900')}>生成历史</span>
        </div>
        <button
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-xl',
            darkMode ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100',
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className={cn('border-b px-4 py-4', darkMode ? 'border-gray-800' : 'border-gray-100')}>
        <div className="relative">
          <Search
            className={cn(
              'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2',
              darkMode ? 'text-gray-500' : 'text-gray-400',
            )}
          />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索历史..."
            className={cn(
              'w-full rounded-2xl border py-2.5 pl-9 pr-4 text-sm outline-none',
              darkMode
                ? 'border-gray-700 bg-gray-950 text-white placeholder:text-gray-500'
                : 'border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-violet-300 focus:bg-white',
            )}
          />
        </div>
      </div>

      <div className="max-h-[720px] space-y-5 overflow-y-auto px-4 py-4">
        {groups.map((group) => (
          <div key={group.label}>
            <div className={cn('mb-2 text-xs font-medium', darkMode ? 'text-gray-400' : 'text-gray-500')}>
              {group.label}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onReusePrompt(item)}
                  className={cn(
                    'overflow-hidden rounded-2xl border transition-transform hover:-translate-y-0.5',
                    darkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white',
                  )}
                >
                  <img src={item.url} alt={item.title} className="aspect-square h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function HistoryGallery({
  darkMode,
  groups,
  onReusePrompt,
  onOpen,
}: {
  darkMode: boolean;
  groups: HistoryGroup[];
  onReusePrompt: (item: GeneratedImage) => void;
  onOpen: (item: GeneratedImage) => void;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-[28px] border shadow-sm',
        darkMode ? 'border-gray-800 bg-gray-900/80' : 'border-gray-200 bg-white',
      )}
    >
      <div className={cn('border-b px-5 py-4', darkMode ? 'border-gray-800' : 'border-gray-100')}>
        <h2 className={cn('text-lg font-semibold', darkMode ? 'text-white' : 'text-gray-900')}>生成历史</h2>
      </div>
      <div className="space-y-8 p-5">
        {groups.map((group) => (
          <div key={group.label} className="space-y-4">
            <div className={cn('text-sm font-semibold', darkMode ? 'text-gray-300' : 'text-gray-600')}>
              {group.label}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onOpen(item)}
                  onDoubleClick={() => onReusePrompt(item)}
                  className={cn(
                    'overflow-hidden rounded-[24px] border text-left shadow-sm',
                    darkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white',
                  )}
                >
                  <img
                    src={item.url}
                    alt={item.title}
                    className={cn('w-full object-cover', RATIO_DIMENSIONS[item.aspectRatio].cardClassName)}
                  />
                  <div className="space-y-1.5 p-4">
                    <p className={cn('text-sm font-semibold', darkMode ? 'text-white' : 'text-gray-900')}>
                      {item.title}
                    </p>
                    <p className={cn('line-clamp-2 text-sm', darkMode ? 'text-gray-300' : 'text-gray-600')}>
                      {item.prompt}
                    </p>
                    <div className={cn('text-xs', darkMode ? 'text-gray-500' : 'text-gray-500')}>
                      双击即可回填提示词
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FavoritesGallery({
  darkMode,
  items,
  onToggleFavorite,
  onDownload,
  onShare,
  onOpen,
  onCopyPrompt,
}: {
  darkMode: boolean;
  items: GeneratedImage[];
  onToggleFavorite: (id: string) => void;
  onDownload: (item: GeneratedImage) => void;
  onShare: (item: GeneratedImage) => void;
  onOpen: (item: GeneratedImage) => void;
  onCopyPrompt: (item: GeneratedImage) => void;
}) {
  if (items.length === 0) {
    return (
      <section
        className={cn(
          'rounded-[28px] border px-6 py-12 text-center shadow-sm',
          darkMode ? 'border-gray-800 bg-gray-900/80 text-gray-300' : 'border-gray-200 bg-white text-gray-600',
        )}
      >
        <Heart className="mx-auto mb-3 h-7 w-7 text-pink-500" />
        <h2 className={cn('text-lg font-semibold', darkMode ? 'text-white' : 'text-gray-900')}>还没有收藏的作品</h2>
        <p className="mt-2 text-sm">去生成一张满意的图，再把它加入收藏吧 ✨</p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'overflow-hidden rounded-[28px] border shadow-sm',
        darkMode ? 'border-gray-800 bg-gray-900/80' : 'border-gray-200 bg-white',
      )}
    >
      <div className={cn('border-b px-5 py-4', darkMode ? 'border-gray-800' : 'border-gray-100')}>
        <h2 className={cn('text-lg font-semibold', darkMode ? 'text-white' : 'text-gray-900')}>我的收藏</h2>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-2">
        {items.map((item) => (
          <article
            key={item.id}
            className={cn(
              'overflow-hidden rounded-[24px] border shadow-sm',
              darkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white',
            )}
          >
            <img
              src={item.url}
              alt={item.title}
              className={cn('w-full object-cover', RATIO_DIMENSIONS[item.aspectRatio].cardClassName)}
            />
            <div className="space-y-3 p-4">
              <div>
                <p className={cn('text-sm font-semibold', darkMode ? 'text-white' : 'text-gray-900')}>{item.title}</p>
                <p className={cn('mt-1 line-clamp-2 text-sm', darkMode ? 'text-gray-300' : 'text-gray-600')}>
                  {item.prompt}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onToggleFavorite(item.id)}
                  className="rounded-xl border border-pink-200 bg-pink-50 px-3 py-2 text-sm font-semibold text-pink-600"
                >
                  取消收藏
                </button>
                <button
                  onClick={() => onDownload(item)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700"
                >
                  下载
                </button>
                <button
                  onClick={() => onShare(item)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700"
                >
                  分享
                </button>
                <button
                  onClick={() => onCopyPrompt(item)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700"
                >
                  复制提示词
                </button>
                <button
                  onClick={() => onOpen(item)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700"
                >
                  查看大图
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ShareModal({
  darkMode,
  item,
  onClose,
  onCopyPrompt,
  onShare,
}: {
  darkMode: boolean;
  item: GeneratedImage | null;
  onClose: () => void;
  onCopyPrompt: (item: GeneratedImage) => void;
  onShare: (item: GeneratedImage) => void;
}) {
  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/50 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            className={cn(
              'mx-auto mt-20 max-w-xl overflow-hidden rounded-[28px] border shadow-2xl',
              darkMode ? 'border-gray-800 bg-gray-950' : 'border-white bg-white',
            )}
          >
            <div
              className={cn(
                'flex items-center justify-between border-b px-5 py-4',
                darkMode ? 'border-gray-800' : 'border-gray-100',
              )}
            >
              <div>
                <h3 className={cn('text-lg font-semibold', darkMode ? 'text-white' : 'text-gray-900')}>分享作品</h3>
                <p className={cn('mt-1 text-sm', darkMode ? 'text-gray-400' : 'text-gray-500')}>{item.title}</p>
              </div>
              <button
                onClick={onClose}
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-xl',
                  darkMode ? 'hover:bg-gray-900 text-gray-300' : 'hover:bg-gray-100 text-gray-600',
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <img
                src={item.url}
                alt={item.title}
                className={cn('w-full rounded-[24px] object-cover', RATIO_DIMENSIONS[item.aspectRatio].cardClassName)}
              />
              <div className="space-y-2">
                <p className={cn('text-sm font-semibold', darkMode ? 'text-white' : 'text-gray-900')}>提示词</p>
                <div
                  className={cn(
                    'rounded-[22px] border px-4 py-3 text-sm leading-7',
                    darkMode ? 'border-gray-800 bg-gray-900 text-gray-300' : 'border-gray-200 bg-gray-50 text-gray-600',
                  )}
                >
                  {item.prompt}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => onCopyPrompt(item)}
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700"
                >
                  复制提示词
                </button>
                <button
                  onClick={() => onShare(item)}
                  className="rounded-2xl bg-linear-to-r from-violet-600 to-pink-500 px-4 py-3 text-sm font-semibold text-white"
                >
                  一键分享
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LightboxModal({
  darkMode,
  item,
  onClose,
  onDownload,
  onShare,
  onRegenerate,
}: {
  darkMode: boolean;
  item: GeneratedImage | null;
  onClose: () => void;
  onDownload: (item: GeneratedImage) => void;
  onShare: (item: GeneratedImage) => void;
  onRegenerate: (item: GeneratedImage) => void;
}) {
  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            className={cn(
              'mx-auto flex max-w-6xl flex-col overflow-hidden rounded-[32px] border shadow-2xl xl:flex-row',
              darkMode ? 'border-gray-800 bg-gray-950' : 'border-white bg-white',
            )}
          >
            <div className={cn('relative flex-1 p-4', darkMode ? 'bg-black' : 'bg-gray-50')}>
              <button
                onClick={onClose}
                className="absolute right-6 top-6 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <img
                src={item.url}
                alt={item.title}
                className="mx-auto max-h-[72vh] w-full rounded-[24px] object-contain"
              />
            </div>

            <div className="w-full max-w-[420px] space-y-5 p-6">
              <div>
                <h3 className={cn('text-2xl font-bold', darkMode ? 'text-white' : 'text-gray-900')}>{item.title}</h3>
                <p className={cn('mt-2 text-sm', darkMode ? 'text-gray-400' : 'text-gray-500')}>{item.meta}</p>
              </div>
              <div
                className={cn(
                  'rounded-[24px] border px-4 py-4 text-sm leading-7',
                  darkMode ? 'border-gray-800 bg-gray-900 text-gray-300' : 'border-gray-200 bg-gray-50 text-gray-600',
                )}
              >
                {item.prompt}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => onDownload(item)}
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700"
                >
                  下载作品
                </button>
                <button
                  onClick={() => onShare(item)}
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700"
                >
                  分享作品
                </button>
                <button
                  onClick={() => onRegenerate(item)}
                  className="rounded-2xl bg-linear-to-r from-violet-600 to-pink-500 px-4 py-3 text-sm font-semibold text-white"
                >
                  基于此图再生成
                </button>
                <button
                  onClick={onClose}
                  className={cn(
                    'rounded-2xl border px-4 py-3 text-sm font-semibold',
                    darkMode ? 'border-gray-700 bg-gray-900 text-gray-200' : 'border-gray-200 bg-gray-50 text-gray-700',
                  )}
                >
                  关闭
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
