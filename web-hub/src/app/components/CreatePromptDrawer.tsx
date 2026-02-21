import { Drawer } from 'vaul';
import { Plus, X, Sparkles, ChevronDown } from 'lucide-react';
import { useState, type ReactNode, type FormEvent } from 'react';
import { toast } from 'sonner';
import { CATEGORY_CONFIG, MODEL_CONFIG } from '../data/constants';

// 从集中常量派生分类和模型列表
const CATEGORIES = Object.entries(CATEGORY_CONFIG).map(([id, cfg]) => ({ id, name: cfg.label, emoji: cfg.emoji }));
const MODELS = Object.entries(MODEL_CONFIG).map(([id, cfg]) => ({ id, name: cfg.label }));

interface CreatePromptDrawerProps {
  children: ReactNode;
  darkMode?: boolean;
}

export function CreatePromptDrawer({ children, darkMode }: CreatePromptDrawerProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('writing');
  const [model, setModel] = useState('gpt4');
  const [tags, setTags] = useState('');

  const dm = darkMode;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title || !content) {
      toast.error('请填写标题和 Prompt 内容');
      return;
    }
    toast.success('Prompt 提交成功！', {
      description: '我们会在审核后发布到精选库中',
    });
    setTitle('');
    setDescription('');
    setContent('');
    setCategory('writing');
    setModel('gpt4');
    setTags('');
    setOpen(false);
  };

  const inputClass = `w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all ${
    dm
      ? 'border-gray-700 bg-gray-800 text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
      : 'border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-400/20'
  }`;

  const labelClass = `mb-1.5 block text-sm font-medium ${dm ? 'text-gray-300' : 'text-gray-700'}`;

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>{children}</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Drawer.Content
          className={`fixed bottom-0 left-0 right-0 z-50 flex max-h-[92vh] flex-col rounded-t-2xl outline-none ${
            dm ? 'bg-gray-900' : 'bg-white'
          }`}
        >
          <Drawer.Title className="sr-only">提交 Prompt</Drawer.Title>
          <Drawer.Description className="sr-only">
            分享你的高质量 AI 提示词到 PromptHub 精选库
          </Drawer.Description>
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className={`h-1 w-10 rounded-full ${dm ? 'bg-gray-700' : 'bg-gray-200'}`} />
          </div>

          {/* Header */}
          <div
            className={`flex items-center justify-between border-b px-6 py-4 ${dm ? 'border-gray-800' : 'border-gray-100'}`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-indigo-600">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <h2 className={`text-lg font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>提交 Prompt</h2>
                <p className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>分享你的高质量 AI 提示词</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                dm
                  ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6 pb-8 mx-auto max-w-2xl">
              {/* Title */}
              <div>
                <label className={labelClass}>
                  Prompt 标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：爆款小红书文案生成器"
                  className={inputClass}
                />
              </div>

              {/* Description */}
              <div>
                <label className={labelClass}>简短描述</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="一句话说明这个 Prompt 能做什么..."
                  className={inputClass}
                />
              </div>

              {/* Category + Model */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    分类 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={inputClass + ' appearance-none pr-10 cursor-pointer'}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.emoji} {cat.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${dm ? 'text-gray-400' : 'text-gray-400'}`}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>适用模型</label>
                  <div className="relative">
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className={inputClass + ' appearance-none pr-10 cursor-pointer'}
                    >
                      {MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                  </div>
                </div>
              </div>

              {/* Prompt Content */}
              <div>
                <label className={labelClass}>
                  Prompt 内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="在这里粘贴你的完整 Prompt 内容...&#10;&#10;技巧：使用 [变量] 标记可自定义的部分，让 Prompt 更通用"
                  className={inputClass + ' font-mono resize-none leading-relaxed'}
                />
                <p className={`mt-1.5 text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                  💡 使用 [方括号] 标记可以自定义的变量，让你的 Prompt 更灵活易用
                </p>
              </div>

              {/* Tags */}
              <div>
                <label className={labelClass}>标签</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="用逗号分隔，例如：写作, SEO, 博客"
                  className={inputClass}
                />
              </div>

              {/* Submit */}
              <div className={`flex gap-3 pt-2 border-t ${dm ? 'border-gray-800' : 'border-gray-100'}`}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-colors ${
                    dm
                      ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-500 to-indigo-600 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:shadow-lg hover:shadow-indigo-500/40"
                >
                  <Plus size={16} />
                  提交 Prompt
                </button>
              </div>
            </form>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
