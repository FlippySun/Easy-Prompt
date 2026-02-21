import { useState, useEffect } from 'react';

/**
 * 打字机效果 Hook — 循环显示一组短语，带打字+删除动画
 * @param phrases 短语列表
 * @param speed 每字符打字速度（毫秒）
 */
export function useTypewriter(phrases: readonly string[], speed = 85): string {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const target = phrases[idx];
    const delay = isDeleting ? 45 : text === target ? 2200 : speed;
    const timer = setTimeout(() => {
      if (!isDeleting && text === target) setIsDeleting(true);
      else if (isDeleting && text === '') {
        setIsDeleting(false);
        setIdx((i) => (i + 1) % phrases.length);
      } else setText(isDeleting ? target.slice(0, text.length - 1) : target.slice(0, text.length + 1));
    }, delay);
    return () => clearTimeout(timer);
  }, [text, isDeleting, idx, phrases, speed]);

  return text;
}
